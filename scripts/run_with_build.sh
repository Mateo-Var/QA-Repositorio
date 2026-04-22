#!/usr/bin/env bash
# run_with_build.sh — Recibe una APK buildeada (ej: desde Slack), la instala
# en el dispositivo y ejecuta Fase 2 → Fase 3 → Fase 4 del pipeline QA.
#
# Fase 0 y Fase 1 ya corrieron cuando se abrió el PR.
# Este script se corre manualmente cuando la build está lista para testear.
#
# Uso:
#   ./scripts/run_with_build.sh [ruta_al_apk] --pr <numero_pr> [--agent1-json <ruta>]
#   Si no se pasa ruta APK, se usa el más reciente de ~/Downloads.
#   Si no se pasa --agent1-json, se busca el análisis guardado del PR automáticamente.
#
# Ejemplos:
#   ./scripts/run_with_build.sh --pr 31
#   ./scripts/run_with_build.sh ~/Downloads/tvnpass-v2.5.0.apk --pr 31
#   APP_ID=tvnPass ./scripts/run_with_build.sh /tmp/build.apk --pr 31
#
# Integración con repo externo (futuro):
#   El repo de la empresa puede pasar su propio análisis vía --agent1-json:
#   ./scripts/run_with_build.sh build.apk --pr 31 --agent1-json /tmp/analysis.json
#   Esto permite que Agent 1 corra en el contexto del repo de la empresa y los
#   resultados del análisis de código viajen al pipeline QA sin re-analizar aquí.

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
APK_PATH=""
if [[ $# -gt 0 && "${1}" != --* ]]; then
  APK_PATH="${1}"
  shift
fi

PR_NUMBER="0"
EXTERNAL_AGENT1_JSON=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)          PR_NUMBER="$2";          shift 2 ;;
    --agent1-json) EXTERNAL_AGENT1_JSON="$2"; shift 2 ;;
    *)             shift ;;
  esac
done

# Auto-detectar el APK más reciente de ~/Downloads si no se especificó ruta
if [[ -z "$APK_PATH" ]]; then
  DOWNLOADS_DIR="${HOME}/Downloads"
  _APP_PKG="${ANDROID_APP_PACKAGE:-com.streann.tvnpass}"
  # El APK empieza con el package completo: com.empresa.app-version-build.apk
  APK_PATH=$(ls -t "${DOWNLOADS_DIR}/${_APP_PKG}"*.apk 2>/dev/null | head -1 || true)
  if [[ -z "$APK_PATH" ]]; then
    echo "ERROR: No se encontró APK de ${_APP_PKG} en ${DOWNLOADS_DIR}"
    echo "Uso: ./scripts/run_with_build.sh [ruta_apk] --pr <numero_pr>"
    exit 1
  fi
  echo "   Auto-detectado: $(basename "$APK_PATH")"
fi

# ── Config ────────────────────────────────────────────────────────────────────
APP_ID="${APP_ID:-tvnPass}"
APP_PACKAGE="${ANDROID_APP_PACKAGE:-com.streann.tvnpass}"
APP_ACTIVITY="${ANDROID_APP_ACTIVITY:-com.streann.tvnpass.MainActivity}"
DEVICE="${ANDROID_DEVICE_NAME:-R5CTB1W92KY}"
APPIUM_PORT="4723"
APK_NAME="$(basename "$APK_PATH")"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="build_pr${PR_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"

export PATH="/opt/homebrew/bin:${PATH}"
export APPIUM_HOME="$HOME/.appium"
export ANDROID_HOME="${ANDROID_HOME:-/Users/mediastream/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home}"
export PATH="${ANDROID_HOME}/platform-tools:${JAVA_HOME}/bin:${PATH}"

echo "=== QA Build Runner — PR #${PR_NUMBER} ==="
echo "APK:    ${APK_NAME}"
echo "Device: ${DEVICE}"
echo "Run ID: ${RUN_ID}"

cd "$ROOT"

# ── Verificar APK ─────────────────────────────────────────────────────────────
if [[ ! -f "$APK_PATH" ]]; then
  echo "ERROR: APK no encontrado: ${APK_PATH}"
  exit 1
fi

# ── 1. Detectar si la app está instalada → desinstalar → instalar nueva ───────
echo ""
echo "--- [Fase 2a] Instalando build en dispositivo..."

INSTALLED=$(adb -s "${DEVICE}" shell pm list packages 2>/dev/null \
  | grep "^package:${APP_PACKAGE}$" || true)

if [[ -n "$INSTALLED" ]]; then
  echo "   App encontrada en dispositivo — desinstalando versión anterior..."
  adb -s "${DEVICE}" uninstall "${APP_PACKAGE}" > /dev/null
  echo "   ✓ Versión anterior eliminada"
else
  echo "   App no estaba instalada — instalando directo"
fi

echo "   Instalando ${APK_NAME}..."
adb -s "${DEVICE}" install -r "${APK_PATH}"
echo "   ✓ APK instalado correctamente"
sleep 3

# ── Directorios temporales ────────────────────────────────────────────────────
TMP_DIR=".qa_tmp/${RUN_ID}"
mkdir -p "$TMP_DIR"

AGENT1_FILE="${TMP_DIR}/agent1_build.json"
AGENT2_OUTPUT="${TMP_DIR}/agent2_output.json"
AGENT3_INPUT="${TMP_DIR}/agent3_input.json"
AGENT3_OUTPUT="${TMP_DIR}/agent3_output.json"

# ── Resolver Agent 1: externo > guardado del PR > placeholder ─────────────────
# Prioridad:
#   1. --agent1-json <ruta>  → viene del repo externo de la empresa
#   2. reports/.../pr{N}_agent1.json → guardado por run_on_pr.sh en Fase 0
#   3. placeholder mínimo   → fallback si el PR no corrió Fase 0 todavía
AGENT1_PERSIST="reports/${APP_ID}/runs/pr${PR_NUMBER}_agent1.json"

if [[ -n "$EXTERNAL_AGENT1_JSON" && -f "$EXTERNAL_AGENT1_JSON" ]]; then
  echo "   Usando análisis externo: ${EXTERNAL_AGENT1_JSON}"
  cp "$EXTERNAL_AGENT1_JSON" "$AGENT1_FILE"
elif [[ "${PR_NUMBER}" != "0" && -f "$AGENT1_PERSIST" ]]; then
  echo "   Reutilizando análisis de Fase 0 (PR #${PR_NUMBER})..."
  cp "$AGENT1_PERSIST" "$AGENT1_FILE"
else
  echo "   Sin análisis previo — usando placeholder (suite DOD completa)"
  cat > "$AGENT1_FILE" <<EOF
{
  "app_id":     "${APP_ID}",
  "platform":   "android",
  "risk_level": "INFO",
  "reason":     "Build \`${APK_NAME}\` instalada desde Slack — ejecutando suite completa.",
  "suggestions": [],
  "execute_request": {
    "dod_tests": ["DOD-01", "DOD-02", "DOD-03", "DOD-04", "DOD-05", "DOD-08"],
    "device":    "${DEVICE}"
  }
}
EOF
fi

# Asegurar mode=execute en Agent 1 para que Agent 2 siempre ejecute (no genere)
python3 - "$AGENT1_FILE" "${DEVICE}" <<'PYEOF'
import json, sys
path, device = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))
data["mode"] = "execute"
if "execute_request" not in data:
    data["execute_request"] = {
        "dod_tests": ["DOD-01", "DOD-02", "DOD-03", "DOD-04", "DOD-05", "DOD-08"],
        "device": device,
    }
elif "device" not in data.get("execute_request", {}):
    data["execute_request"]["device"] = device
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
PYEOF

# ── 2. Verificar / iniciar Appium ─────────────────────────────────────────────
echo ""
echo "--- [Fase 2b] Verificando Appium en puerto ${APPIUM_PORT}..."

_appium_up() {
  python3 -c "
import socket, sys
try:
    s = socket.create_connection(('127.0.0.1', ${APPIUM_PORT}), timeout=5)
    s.close()
except Exception:
    sys.exit(1)
sys.exit(0)
" 2>/dev/null
}

if _appium_up; then
  echo "   ✓ Appium ya corriendo en ${APPIUM_PORT}"
else
  lsof -ti :"${APPIUM_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 2
  mkdir -p "reports/${APP_ID}/logs"
  appium --port "${APPIUM_PORT}" --relaxed-security \
    --log "reports/${APP_ID}/logs/appium_build.log" > /dev/null 2>&1 &
  READY=0
  for i in $(seq 1 30); do
    sleep 1
    if _appium_up; then
      echo "   ✓ Appium listo (${i}s)"
      READY=1; break
    fi
  done
  [[ $READY -eq 0 ]] && echo "ERROR: Appium no inició" && exit 1
fi

# ── 3. Comentario inicial en el PR (⏳ tests corriendo) ───────────────────────
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-smontealegrel/pipeline-QA-auto}/actions/runs/${GITHUB_ACTIONS_RUN_ID:-0}"

if [[ "${PR_NUMBER}" != "0" ]]; then
  python3 - "${TMP_DIR}/agent2_running.json" <<'PYEOF'
import json, sys
json.dump({"mode": "running", "platform": "android", "dod_status": "running"}, open(sys.argv[1], "w"))
PYEOF
  python3 scripts/post_pr_comment.py \
    --pr  "${PR_NUMBER}" \
    --agent1 "$AGENT1_FILE" \
    --agent2 "${TMP_DIR}/agent2_running.json" \
    --run-id "${RUN_ID}" \
    --run-url "${RUN_URL}" \
    --platform android \
    --device  "${DEVICE}" \
    --repo    "${GITHUB_REPOSITORY:-smontealegrel/pipeline-QA-auto}" \
    || true
  echo "   ✓ Comentario inicial publicado en PR #${PR_NUMBER}"
fi

# ── 4. Fase 2 — Ejecutar Agent 2 (tests E2E) ─────────────────────────────────
echo ""
echo "--- [Fase 2c] Ejecutando suite E2E Android..."
python3 agents/generator_executor.py "$AGENT1_FILE" > "$AGENT2_OUTPUT"
echo "--- Fase 2 completada."

# ── 5. Comprimir contexto ─────────────────────────────────────────────────────
APP_ID="${APP_ID}" python3 scripts/compress_context.py "$AGENT2_OUTPUT" \
  || echo "compress_context falló — continuando"

# ── 6. Fase 3 — Agent 3 (validación visual) ──────────────────────────────────
echo ""
echo "--- [Fase 3] Validando screenshots con Claude Vision..."
python3 - "$AGENT2_OUTPUT" "$AGENT3_INPUT" "${APP_ID}" <<'PYEOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
json.dump({
    "run_id":          d.get("run_id", ""),
    "app_id":          sys.argv[3],
    "dod_status":      d.get("dod_status", "unknown"),
    "dod_failures":    d.get("dod_failures", []),
    "screenshots_dir": d.get("screenshots_dir", ""),
    "video_path":      d.get("video_path", ""),
}, open(sys.argv[2], "w", encoding="utf-8"), indent=2)
PYEOF

python3 agents/vision_validator.py "$AGENT3_INPUT" > "$AGENT3_OUTPUT" \
  || echo "vision_validator falló — continuando sin Fase 3"

# ── 7. Fase 4 — Publicar resultados en PR ────────────────────────────────────
# (El reporte Allure se publica automáticamente vía onComplete en wdio.conf.js)
echo ""
echo "--- [Fase 4] Publicando resultados en PR #${PR_NUMBER}..."
if [[ "${PR_NUMBER}" != "0" ]]; then
  python3 scripts/post_pr_comment.py \
    --pr      "${PR_NUMBER}" \
    --agent1  "$AGENT1_FILE" \
    --agent2  "$AGENT2_OUTPUT" \
    --agent3  "$AGENT3_OUTPUT" \
    --run-id  "${RUN_ID}" \
    --run-url "${RUN_URL}" \
    --platform android \
    --device  "${DEVICE}" \
    --repo    "${GITHUB_REPOSITORY:-smontealegrel/pipeline-QA-auto}" \
    || echo "post_pr_comment falló — continuando"
else
  echo "   PR_NUMBER=0 — resultados solo en consola"
  python3 scripts/post_pr_comment.py \
    --pr 1 --agent1 "$AGENT1_FILE" --agent2 "$AGENT2_OUTPUT" \
    --run-id "${RUN_ID}" --platform android --device "${DEVICE}" --dry-run
fi

# ── DOD final ─────────────────────────────────────────────────────────────────
DOD_STATUS=$(python3 -c "
import json
print(json.load(open('${AGENT2_OUTPUT}', encoding='utf-8')).get('dod_status', 'unknown'))
")
echo ""
echo "DOD Status: ${DOD_STATUS}"
rm -rf "$TMP_DIR"
echo "=== Build run completado ==="

[[ "$DOD_STATUS" = "failed" ]] && echo "ERROR: Tests DOD fallaron." && exit 1
exit 0
