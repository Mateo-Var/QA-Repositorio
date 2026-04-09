#!/usr/bin/env bash
# run_suggestion.sh — Fase 0: Claude analiza el diff y publica sugerencias de tests en el PR.
# No corre Appium. No ejecuta tests reales. Solo sugiere.
#
# Uso:
#   ./scripts/run_suggestion.sh <pr_number> <base_sha> <head_sha>

set -euo pipefail

PR_NUMBER="${1:?PR_NUMBER requerido}"
BASE_SHA="${2:?BASE_SHA requerido}"
HEAD_SHA="${3:?HEAD_SHA requerido}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="qa_pr${PR_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"

echo "=== QA Suggestion — PR #${PR_NUMBER} ==="
echo "Run ID: ${RUN_ID}"

# ── Pre-filtro: saltar si solo cambiaron docs ─────────────────────────────────
CHANGED_FILES=$(git diff --name-only "${BASE_SHA}..${HEAD_SHA}" 2>/dev/null || echo "")
SKIP_PATTERNS=("^README" "^docs/" "^\.github/" "^.*\.md$" "^.*\.png$" "^.*\.svg$")

RELEVANT=false
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  skip=false
  for pattern in "${SKIP_PATTERNS[@]}"; do
    echo "$file" | grep -qE "$pattern" && skip=true && break
  done
  [[ "$skip" = false ]] && RELEVANT=true && break
done <<< "$CHANGED_FILES"

if [[ "$RELEVANT" = false ]]; then
  echo "--- Solo cambios en docs. Skipping."
  exit 0
fi

# ── 1. Generar diff ───────────────────────────────────────────────────────────
DIFF_FILE="/tmp/qa_diff_${RUN_ID}.txt"
git diff "${BASE_SHA}..${HEAD_SHA}" > "$DIFF_FILE" 2>/dev/null || echo "" > "$DIFF_FILE"

# ── 2. Construir trigger JSON ─────────────────────────────────────────────────
TRIGGER_FILE="/tmp/qa_trigger_${RUN_ID}.json"
cat > "$TRIGGER_FILE" <<EOF
{
  "type": "qa_comment",
  "pr_number": ${PR_NUMBER},
  "base_sha": "${BASE_SHA}",
  "head_sha": "${HEAD_SHA}",
  "run_id": "${RUN_ID}",
  "suggestion_only": true
}
EOF

# ── 3. Ejecutar Agente 1 (solo análisis, sin E2E) ─────────────────────────────
echo "--- Agente 1: analizando diff..."
AGENT1_OUTPUT="/tmp/qa_agent1_${RUN_ID}.json"
cd "$ROOT"
export APP_ID="${APP_ID:?APP_ID requerido}"
python agents/analyzer.py "$TRIGGER_FILE" "$DIFF_FILE" > "$AGENT1_OUTPUT"

# Output vacío de Agent 2 (no se ejecutó)
AGENT2_OUTPUT="/tmp/qa_agent2_${RUN_ID}.json"
echo '{"mode":"suggestion","dod_status":"skipped","suggestions_only":true}' > "$AGENT2_OUTPUT"

# ── 4. Publicar sugerencias en el PR ─────────────────────────────────────────
echo "--- Publicando sugerencias en PR #${PR_NUMBER}..."
python scripts/post_pr_comment.py \
  --pr "${PR_NUMBER}" \
  --agent1 "$AGENT1_OUTPUT" \
  --agent2 "$AGENT2_OUTPUT" \
  --run-id "${RUN_ID}" \
  || echo "⚠️  No se pudo publicar el comentario — continuando"

# ── Limpieza ──────────────────────────────────────────────────────────────────
rm -f "$DIFF_FILE" "$TRIGGER_FILE"

echo "=== Sugerencia publicada en PR #${PR_NUMBER} ==="
