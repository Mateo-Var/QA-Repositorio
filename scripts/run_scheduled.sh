#!/usr/bin/env bash
# run_scheduled.sh — Trigger nightly del sistema QA.
# Ejecuta el suite completo contra todos los dispositivos de la matriz.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="nightly_$(date -u +%Y%m%d_%H%M%S)"

echo "=== QA Agent — Nightly Run ==="
echo "Run ID: ${RUN_ID}"
export QA_RUN_ID="$RUN_ID"

TRIGGER_FILE="/tmp/qa_trigger_${RUN_ID}.json"
cat > "$TRIGGER_FILE" <<EOF
{
  "type": "scheduled",
  "schedule": "nightly",
  "run_id": "${RUN_ID}",
  "full_suite": true
}
EOF

AGENT1_OUTPUT="/tmp/qa_agent1_output_${RUN_ID}.json"
cd "$ROOT"
python agents/analyzer.py "$TRIGGER_FILE" /dev/null > "$AGENT1_OUTPUT"

AGENT2_OUTPUT="/tmp/qa_agent2_output_${RUN_ID}.json"
python agents/generator_executor.py "$AGENT1_OUTPUT" > "$AGENT2_OUTPUT"

python scripts/compress_context.py "$AGENT2_OUTPUT"

DOD_STATUS=$(python -c "
import json
data = json.load(open('$AGENT2_OUTPUT'))
print(data.get('dod_status', 'unknown'))
")

echo "DOD Status: ${DOD_STATUS}"
[ "$DOD_STATUS" = "failed" ] && exit 1 || exit 0
