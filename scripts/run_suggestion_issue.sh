#!/usr/bin/env bash
# run_suggestion_issue.sh — Fase 0: Claude analiza un issue y publica sugerencias de tests.
# No corre Appium. No ejecuta tests reales. Solo sugiere.
#
# Uso:
#   GITHUB_REPOSITORY=owner/repo ./scripts/run_suggestion_issue.sh <issue_number>

set -euo pipefail

ISSUE_NUMBER="${1:?ISSUE_NUMBER requerido}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="qa_issue${ISSUE_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"

echo "=== QA Suggestion — Issue #${ISSUE_NUMBER} ==="
echo "Run ID: ${RUN_ID}"

# ── 1. Obtener datos del issue ────────────────────────────────────────────────
echo "--- Obteniendo datos del issue..."
ISSUE_JSON_FILE="/tmp/issue_${RUN_ID}.json"
gh api "repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}" > "$ISSUE_JSON_FILE"

# ── 2. Construir trigger JSON (Python para escapar correctamente) ─────────────
TRIGGER_FILE="/tmp/qa_trigger_${RUN_ID}.json"
python3 -c "
import json, sys
from pathlib import Path

issue = json.loads(Path('$ISSUE_JSON_FILE').read_text())
trigger = {
    'type': 'issue_comment',
    'issue_number': $ISSUE_NUMBER,
    'issue_title': issue.get('title', ''),
    'issue_body': issue.get('body') or '',
    'run_id': '$RUN_ID',
    'suggestion_only': True
}
print(json.dumps(trigger, indent=2))
" > "$TRIGGER_FILE"

# ── 3. Ejecutar Agente 1 (solo análisis, sin E2E, sin diff) ──────────────────
echo "--- Agente 1: analizando issue..."
AGENT1_OUTPUT="/tmp/qa_agent1_${RUN_ID}.json"
cd "$ROOT"
export APP_ID="${APP_ID:?APP_ID requerido}"
python agents/analyzer.py "$TRIGGER_FILE" > "$AGENT1_OUTPUT"

# Output vacío de Agent 2 (no se ejecutó)
AGENT2_OUTPUT="/tmp/qa_agent2_${RUN_ID}.json"
echo '{"mode":"suggestion","dod_status":"skipped","suggestions_only":true}' > "$AGENT2_OUTPUT"

# ── 4. Publicar sugerencias en el issue ──────────────────────────────────────
echo "--- Publicando sugerencias en issue #${ISSUE_NUMBER}..."
python scripts/post_pr_comment.py \
  --pr "${ISSUE_NUMBER}" \
  --agent1 "$AGENT1_OUTPUT" \
  --agent2 "$AGENT2_OUTPUT" \
  --run-id "${RUN_ID}" \
  --issue \
  || echo "⚠️  No se pudo publicar el comentario — continuando"

# ── Limpieza ──────────────────────────────────────────────────────────────────
rm -f "$ISSUE_JSON_FILE" "$TRIGGER_FILE"

echo "=== Sugerencia publicada en issue #${ISSUE_NUMBER} ==="
