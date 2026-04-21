#!/usr/bin/env bash
# run_on_pr.sh — Trigger del sistema QA (Android + iOS) al abrir/actualizar un PR.
# Llamado desde GitHub Actions como step en .github/workflows/qa_agent.yml
#
# Uso: ./scripts/run_on_pr.sh <pr_number> <base_sha> <head_sha> [platform]
#   platform: android (default) | ios

set -euo pipefail

PR_NUMBER="${1:?PR_NUMBER requerido}"
BASE_SHA="${2:?BASE_SHA requerido}"
HEAD_SHA="${3:?HEAD_SHA requerido}"
PLATFORM="${4:-${APP_PLATFORM:-android}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="${PLATFORM}_pr${PR_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"

echo "=== QA Agent ${PLATFORM^^} — PR #${PR_NUMBER} ==="
echo "Base: ${BASE_SHA} → Head: ${HEAD_SHA}"
echo "Run ID: ${RUN_ID}"

# Ir a ROOT antes de cualquier operacion — rutas relativas compatibles Windows Python + Git Bash
cd "$ROOT"

# ── Pre-filtro: saltar si solo cambiaron archivos no relevantes ───────────────
CHANGED_FILES=$(git diff --name-only "${BASE_SHA}..${HEAD_SHA}")
echo "Archivos cambiados:"
echo "$CHANGED_FILES"

SKIP_PATTERNS=(
  "^README"
  "^docs/"
  "^\.github/"
  "^\.gitignore"
  "^.*\.md$"
  "^.*\.txt$"
  "^.*\.png$"
  "^.*\.jpg$"
  "^.*\.svg$"
  "^CHANGELOG"
  "^LICENSE"
)

RELEVANT=false
while IFS= read -r file; do
  skip=false
  for pattern in "${SKIP_PATTERNS[@]}"; do
    if echo "$file" | grep -qE "$pattern"; then
      skip=true
      break
    fi
  done
  if [ "$skip" = false ]; then
    RELEVANT=true
    break
  fi
done <<< "$CHANGED_FILES"

if [ "$RELEVANT" = false ]; then
  echo "--- Pre-filtro: solo cambios en docs/assets. Skipping QA run."
  exit 0
fi

echo "--- Pre-filtro: cambios relevantes detectados. Iniciando QA ${PLATFORM^^}..."

# ── Directorio temporal local (compatible Windows Python + Git Bash) ──────────
# Usar rutas relativas desde ROOT evita el problema de /tmp/ en Windows Python
TMP_DIR=".qa_tmp/${RUN_ID}"
mkdir -p "$TMP_DIR"

DIFF_FILE="${TMP_DIR}/qa_diff.txt"
TRIGGER_FILE="${TMP_DIR}/qa_trigger.json"
AGENT1_OUTPUT="${TMP_DIR}/qa_agent1_output.json"
AGENT2_OUTPUT="${TMP_DIR}/qa_agent2_output.json"
AGENT3_INPUT="${TMP_DIR}/qa_agent3_input.json"
AGENT3_OUTPUT="${TMP_DIR}/qa_agent3_output.json"

# ── 1. Generar diff del PR ────────────────────────────────────────────────────
git diff "${BASE_SHA}..${HEAD_SHA}" > "$DIFF_FILE"
echo "Diff generado: $(wc -l < "$DIFF_FILE") lineas"

# ── 2. Construir trigger JSON ─────────────────────────────────────────────────
cat > "$TRIGGER_FILE" <<EOF
{
  "type": "pull_request",
  "platform": "${PLATFORM}",
  "pr_number": ${PR_NUMBER},
  "base_sha": "${BASE_SHA}",
  "head_sha": "${HEAD_SHA}",
  "run_id": "${RUN_ID}",
  "changed_files": $(echo "$CHANGED_FILES" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip().splitlines()))")
}
EOF

# ── 3. Ejecutar Agente 1 (Analizador) ────────────────────────────────────────
echo "--- Agente 1: Analizando cambios..."
APP_ID="${APP_ID:?APP_ID requerido}" python3 agents/analyzer.py "$TRIGGER_FILE" "$DIFF_FILE" > "$AGENT1_OUTPUT"
# Inyectar platform en el output del Agente 1 para que el Agente 2 lo herede explícitamente
python3 - "$AGENT1_OUTPUT" "$PLATFORM" <<'PYEOF'
import json, sys
path, platform = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))
data["platform"] = platform
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PYEOF
echo "Agente 1 completado."

# ── 4a. Verificar/iniciar Appium (DEC-04) ────────────────────────────────────
# wdio.conf.js conecta a Appium externo — no arranca el suyo propio.
# Si ya corre en la URL de la plataforma se reutiliza; si no, lo inicia.

# Exportar ANDROID_HOME y JAVA_HOME para que Appium (proceso background) los herede.
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/bin}"
export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home}"
export PATH="${ANDROID_HOME}:${JAVA_HOME}/bin:${PATH}"

if [ "$PLATFORM" = "ios" ]; then
  APPIUM_URL="${IOS_APPIUM_SERVER_URL:-http://localhost:4724}"
else
  APPIUM_URL="${APPIUM_SERVER_URL:-http://localhost:4723}"
fi
APPIUM_PORT="${APPIUM_URL##*:}"
APPIUM_PORT="${APPIUM_PORT%%/*}"

# Python TCP check — más fiable que curl en git-bash Windows
# (curl puede fallar por resolución IPv6 de localhost u otros quirks de Windows)
_appium_up() {
  python3 -c "
import socket, sys
try:
    s = socket.create_connection(('127.0.0.1', $APPIUM_PORT), timeout=5)
    s.close()
except Exception:
    sys.exit(1)
sys.exit(0)
" 2>/dev/null
}

echo "🔌 Verificando Appium en puerto ${APPIUM_PORT}..."
if _appium_up; then
  echo "   ✓ Appium ya está corriendo en el puerto ${APPIUM_PORT}"
else
  # Liberar puerto si hay proceso ocupándolo (zombie o instancia anterior)
  echo "   Appium no responde — liberando puerto ${APPIUM_PORT} si está ocupado..."
  lsof -ti :"${APPIUM_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 4
  echo "   Iniciando Appium en puerto ${APPIUM_PORT}..."
  mkdir -p "reports/${APP_ID:-tvnPass}/logs"
  appium --port "${APPIUM_PORT}" --relaxed-security \
    --log "reports/${APP_ID:-tvnPass}/logs/appium.log" > /dev/null 2>&1 &
  echo "   PID: $! — esperando que esté listo..."
  READY=0
  for i in $(seq 1 30); do
    sleep 1
    if _appium_up; then
      echo "   ✓ Appium listo (${i}s)"
      READY=1
      break
    fi
  done
  if [[ $READY -eq 0 ]]; then
    echo "ERROR: Appium no inició después de 30s — revisa reports/${APP_ID:-tvnPass}/logs/appium.log"
    exit 1
  fi
fi

# ── 4. Ejecutar Agente 2 (Generador/Ejecutor) ────────────────────────────────
# Nota: la guardia "no hay .test.js" vive en execute_tests() de
# generator_executor.py — más fiable que manipular el JSON desde bash.
echo "--- Agente 2: Ejecutando suite ${PLATFORM^^}..."
python3 agents/generator_executor.py "$AGENT1_OUTPUT" > "$AGENT2_OUTPUT"
echo "Agente 2 completado."

# ── 4b. Si Agent 2 generó tests, ejecutarlos en el mismo run ─────────────────
# Cuando no hay tests previos, Agent 2 crea los archivos .test.js pero no los
# ejecuta. Este bloque detecta eso y lanza la ejecución inmediatamente con los
# tests recién generados — así el PR completo pasa por las 4 fases sin un
# segundo PR.
AGENT2_MODE=$(python3 -c "import json; d=json.load(open('$AGENT2_OUTPUT')); print(d.get('mode',''))")
if [ "$AGENT2_MODE" = "generate" ]; then
  echo "--- Modo generate detectado: ejecutando tests recién generados..."
  AGENT2_EXECUTE_INPUT="${TMP_DIR}/qa_agent2_execute_input.json"
  if [ "$PLATFORM" = "ios" ]; then
    DEVICE="${IOS_DEVICE_UDID:-00008140-00045DCE3422801C}"
  else
    DEVICE="${ANDROID_DEVICE_NAME:-R5CTB1W92KY}"
  fi

  python3 - "$AGENT2_EXECUTE_INPUT" "${APP_ID}" "$DEVICE" "$PLATFORM" <<'PYEOF'
import json, sys
out_path, app_id, device, platform = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
execute_input = {
    "mode":     "execute",
    "platform": platform,
    "app_id":   app_id,
    "execute_request": {
        "dod_tests": ["DOD-01", "DOD-03", "DOD-08"],
        "device":    device,
    },
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(execute_input, f, indent=2)
PYEOF

  python3 agents/generator_executor.py "$AGENT2_EXECUTE_INPUT" > "$AGENT2_OUTPUT"
  echo "--- Ejecución post-generación completada."
fi

# ── 5. Comprimir contexto para la proxima sesion ──────────────────────────────
echo "--- Comprimiendo contexto..."
APP_ID="${APP_ID}" python3 scripts/compress_context.py "$AGENT2_OUTPUT" \
  || echo "compress_context fallo — continuando sin comprimir"

# ── 6. Ejecutar Agente 3 (Validador Visual) ───────────────────────────────────
echo "--- Agente 3: Validando screenshots con Claude Vision..."
# Construir input JSON de Agent 3 usando Python para manejar rutas Windows
python3 - "$AGENT2_OUTPUT" "$AGENT3_INPUT" "${APP_ID}" <<'PYEOF'
import json, sys
agent2_path, agent3_path, app_id = sys.argv[1], sys.argv[2], sys.argv[3]
with open(agent2_path, encoding="utf-8") as f:
    d = json.load(f)
agent3_input = {
    "run_id":          d.get("run_id", ""),
    "app_id":          app_id,
    "dod_status":      d.get("dod_status", "unknown"),
    "dod_failures":    d.get("dod_failures", []),
    "screenshots_dir": d.get("screenshots_dir", ""),
    "video_path":      d.get("video_path", ""),
}
with open(agent3_path, "w", encoding="utf-8") as f:
    json.dump(agent3_input, f, indent=2)
PYEOF

python3 agents/vision_validator.py "$AGENT3_INPUT" > "$AGENT3_OUTPUT" \
  || echo "vision_validator fallo — continuando sin Fase 3"

# URL del run de GitHub Actions para el enlace de artifacts en el PR
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_ACTIONS_RUN_ID:-}"

# Nombre del dispositivo para el comentario
if [ "$PLATFORM" = "ios" ]; then
  DEVICE_LABEL="iPhone 16e"
else
  DEVICE_LABEL="${ANDROID_DEVICE_NAME:-Samsung R5CTB1W92KY}"
fi

# ── 7. Publicar comentario en el PR (edita el de sugerencias si ya existe) ───
echo "--- Publicando comentario en PR #${PR_NUMBER}..."
python3 scripts/post_pr_comment.py \
  --pr "${PR_NUMBER}" \
  --agent1 "$AGENT1_OUTPUT" \
  --agent2 "$AGENT2_OUTPUT" \
  --agent3 "$AGENT3_OUTPUT" \
  --run-id "${RUN_ID}" \
  --run-url "${RUN_URL}" \
  --platform "${PLATFORM}" \
  --device "${DEVICE_LABEL}" \
  --edit \
  || echo "post_pr_comment fallo — continuando sin comentario"

# ── 8. Verificar DOD status ───────────────────────────────────────────────────
DOD_STATUS=$(python3 -c "
import json
data = json.load(open('$AGENT2_OUTPUT'))
print(data.get('dod_status', 'unknown'))
")

echo "DOD Status: ${DOD_STATUS}"

if [ "$DOD_STATUS" = "failed" ]; then
  echo "ERROR: Tests DOD fallaron. Bloqueando pipeline."
  exit 1
fi

# ── Limpiar archivos temporales ───────────────────────────────────────────────
rm -rf "$TMP_DIR"

echo "=== Run ${PLATFORM^^} completado exitosamente ==="
