#!/usr/bin/env bash
# run_parallel.sh — Corre Fase 1 + E2E Android + Fase 3 Visual desde el Mac Mini local.
# Uso: APP_ID=tvnPass bash scripts/run_parallel.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="${APP_ID:?ERROR: APP_ID requerido}"
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"

LOG_DIR="$ROOT/reports/$APP_ID/runs"
mkdir -p "$LOG_DIR"
RUN_ID="parallel_$(date -u +%Y%m%d_%H%M%S)"

echo "════════════════════════════════════════════════════════════"
echo "  Run Android — $APP_ID"
echo "  Run ID: $RUN_ID"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Fase 1: Unit tests (deben pasar antes de E2E) ─────────────────────────────
echo "▶ Fase 1 — Unit tests Android (Jest)..."
npm --prefix "$ROOT" run test:unit \
  || { echo "❌ Unit tests Android fallaron. Abortando."; exit 1; }

echo ""
echo "✅ Fase 1 pasó. Iniciando E2E Android..."
echo ""

# ── Fase 2: E2E Android ───────────────────────────────────────────────────────
ANDROID_LOG="$LOG_DIR/${RUN_ID}_android.log"
export QA_RUN_ID="$RUN_ID"

APP_ID="$APP_ID" bash "$ROOT/scripts/run_android.sh" > "$ANDROID_LOG" 2>&1
ANDROID_EXIT=$?

echo "════════════════════════════════════════════════════════════"
echo "  Resultado run $RUN_ID"
echo "════════════════════════════════════════════════════════════"
echo "  Android: $([ $ANDROID_EXIT -eq 0 ] && echo '✅ PASÓ' || echo '❌ FALLÓ') (exit: $ANDROID_EXIT)"
echo ""
echo "  Log: $ANDROID_LOG"
echo "════════════════════════════════════════════════════════════"

# ── Fase 3: Validación visual ─────────────────────────────────────────────────
echo ""
echo "▶ Fase 3 — Validación Visual Claude..."

LATEST_AGENT2=$(ls -t /tmp/qa_agent2_output_*.json 2>/dev/null | head -1 || echo "")

if [[ -n "$LATEST_AGENT2" && -f "$LATEST_AGENT2" ]]; then
  PHASE3_RUN_ID=$(basename "$LATEST_AGENT2" | sed 's/qa_agent2_output_//' | sed 's/\.json//')
  APP_ID="$APP_ID" bash "$ROOT/scripts/run_vision.sh" "0" "$LATEST_AGENT2" "$PHASE3_RUN_ID" \
    || echo "⚠️  Fase 3 falló — continuando"
else
  echo "⚠️  No se encontró agent2 output. Skipping Fase 3."
fi

# Falla si E2E falló
if [[ $ANDROID_EXIT -ne 0 ]]; then
  exit 1
fi
