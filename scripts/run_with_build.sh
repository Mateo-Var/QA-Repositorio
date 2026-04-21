#!/usr/bin/env bash
# run_with_build.sh — Recibe una APK buildeada (ej: desde Slack), la instala
# en el dispositivo y ejecuta Fase 2 → Fase 3 → Fase 4 del pipeline QA.
#
# Fase 0 y Fase 1 ya corrieron cuando se abrió el PR.
# Este script se corre manualmente cuando la build está lista para testear.
#
# Uso:
#   ./scripts/run_with_build.sh <ruta_al_apk> --pr <numero_pr>
#
# Ejemplos:
#   ./scripts/run_with_build.sh ~/Downloads/tvnpass-v2.5.0.apk --pr 31
#   APP_ID=tvnPass ./scripts/run_with_build.sh /tmp/build.apk --pr 31

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
APK_PATH="${1:?Uso: run_with_build.sh <ruta_apk> --pr <numero_pr>}"
shift

PR_NUMBER="0"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    *)    shift ;;
  esac
done

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

AGENT1_PLACEHOLDER="${TMP_DIR}/agent1_build.json"
AGENT2_INPUT="${TMP_DIR}/agent2_input.json"
AGENT2_OUTPUT="${TMP_DIR}/agent2_output.json"
AGENT3_INPUT="${TMP_DIR}/agent3_input.json"
AGENT3_OUTPUT="${TMP_DIR}/agent3_output.json"

# Placeholder Agent 1 — Fase 0 ya corrió en el PR, aquí solo necesitamos
# los campos mínimos para que post_pr_comment.py pueda armar el comentario
cat > "$AGENT1_PLACEHOLDER" <<EOF
{
  "app_id":     "${APP_ID}",
  "risk_level": "INFO",
  "reason":     "Build \`${APK_NAME}\` instalada desde Slack — ejecutando suite completa.",
  "suggestions": []
}
EOF

# Input para Agent 2 — modo execute directo, sin pasar por Agent 1
cat > "$AGENT2_INPUT" <<EOF
{
  "mode":     "execute",
  "platform": "android",
  "app_id":   "${APP_ID}",
  "execute_request": {
    "dod_tests": ["DOD-01", "DOD-02", "DOD-03", "DOD-04", "DOD-05", "DOD-08"],
    "device":    "${DEVICE}"
  }
}
EOF

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
    --agent1 "$AGENT1_PLACEHOLDER" \
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
python3 agents/generator_executor.py "$AGENT2_INPUT" > "$AGENT2_OUTPUT"
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
    --agent1  "$AGENT1_PLACEHOLDER" \
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
    --pr 1 --agent1 "$AGENT1_PLACEHOLDER" --agent2 "$AGENT2_OUTPUT" \
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
