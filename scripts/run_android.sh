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
