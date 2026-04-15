#!/usr/bin/env bash
# run_android.sh — Entry point E2E Android en CI y local
#
# Uso local:
#   APP_ID=tvnPass bash scripts/run_android.sh
#
# En CI (GitHub Actions), lo llama el workflow con los secrets ya inyectados.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="${APP_ID:?ERROR: APP_ID requerido}"

# ── Cargar .env si existe ─────────────────────────────────────────────────────
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"

TESTS_DIR="$ROOT/tests"

if [[ ! -d "$TESTS_DIR" ]]; then
  echo "ERROR: No existe directorio tests/ en $TESTS_DIR"
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "  E2E Android — $APP_ID"
echo "  Device: ${ANDROID_DEVICE_NAME:-no definido}"
echo "  Package: ${ANDROID_APP_PACKAGE:-no definido}"
echo "════════════════════════════════════════════════════════════"

# ── Verificar/iniciar Appium (DEC-04) ─────────────────────────────────────────
# wdio.conf.js usa Appium externo — no arranca el suyo propio.
# Si Appium ya corre (usuario manual o CI previo) se reutiliza; si no, lo inicia.
APPIUM_URL="${APPIUM_SERVER_URL:-http://localhost:4723}"
APPIUM_PORT="${APPIUM_URL##*:}"
APPIUM_PORT="${APPIUM_PORT%%/*}"

echo "🔌 Verificando Appium en $APPIUM_URL..."
if curl -sf "$APPIUM_URL/status" > /dev/null 2>&1; then
  echo "   ✓ Appium ya está corriendo en el puerto $APPIUM_PORT"
else
  echo "   Appium no responde — iniciando en puerto $APPIUM_PORT..."
  mkdir -p "$ROOT/reports/$APP_ID/logs"
  appium --port "$APPIUM_PORT" --relaxed-security \
    --log "$ROOT/reports/$APP_ID/logs/appium.log" &
  APPIUM_PID=$!
  echo "   PID: $APPIUM_PID — esperando que esté listo..."
  READY=0
  for i in $(seq 1 30); do
    sleep 1
    if curl -sf "$APPIUM_URL/status" > /dev/null 2>&1; then
      echo "   ✓ Appium listo (${i}s)"
      READY=1
      break
    fi
  done
  if [[ $READY -eq 0 ]]; then
    echo "ERROR: Appium no inició después de 30s — revisa el log en reports/$APP_ID/logs/appium.log"
    exit 1
  fi
fi

# ── Instalar dependencias si hace falta ───────────────────────────────────────
if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "📦 Instalando dependencias npm..."
  npm install --prefix "$ROOT"
fi

# ── Correr tests ──────────────────────────────────────────────────────────────
echo ""
echo "▶ Corriendo suite Android..."

cd "$ROOT"
set +e
npm run test:android
EXIT_CODE=$?
set -e

# ── Comprimir contexto post-run ───────────────────────────────────────────────
echo ""
echo "📦 Comprimiendo contexto..."

# Construir knowledge_update mínimo para compress_context
RUN_ID="android_$(date -u +%Y%m%d_%H%M%S)"
RESULT_JSON=$(cat <<EOF
{
  "mode": "execute",
  "platform": "android",
  "run_id": "$RUN_ID",
  "dod_status": "$([ $EXIT_CODE -eq 0 ] && echo 'passed' || echo 'failed')",
  "exit_code": $EXIT_CODE,
  "knowledge_update": {}
}
EOF
)

echo "$RESULT_JSON" | python scripts/compress_context.py \
  --app-id "$APP_ID" \
  --agent2-output /dev/stdin || echo "⚠️  compress_context falló — continuando"

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ Suite Android pasó."
else
  echo "❌ Suite Android falló (exit code: $EXIT_CODE)."
fi

exit $EXIT_CODE
