#!/usr/bin/env bash
# run_on_pr.sh — Trigger del sistema QA al abrir/actualizar un PR.
# Llamado desde GitHub Actions como step en .github/workflows/qa_agent.yml
#
# Uso: ./scripts/run_on_pr.sh <pr_number> <base_sha> <head_sha>

set -euo pipefail

PR_NUMBER="${1:?PR_NUMBER requerido}"
BASE_SHA="${2:?BASE_SHA requerido}"
HEAD_SHA="${3:?HEAD_SHA requerido}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="pr${PR_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"

echo "=== QA Agent — PR #${PR_NUMBER} ==="
echo "Base: ${BASE_SHA} → Head: ${HEAD_SHA}"
echo "Run ID: ${RUN_ID}"

# 1. Generar diff del PR
DIFF_FILE="/tmp/qa_diff_${RUN_ID}.txt"
git diff "${BASE_SHA}..${HEAD_SHA}" > "$DIFF_FILE"
echo "Diff generado: $(wc -l < "$DIFF_FILE") líneas"

# 2. Construir trigger JSON
TRIGGER_FILE="/tmp/qa_trigger_${RUN_ID}.json"
cat > "$TRIGGER_FILE" <<EOF
{
  "type": "pull_request",
  "pr_number": ${PR_NUMBER},
  "base_sha": "${BASE_SHA}",
  "head_sha": "${HEAD_SHA}",
  "run_id": "${RUN_ID}"
}
EOF

# 3. Ejecutar Agente 1 (Analizador)
echo "--- Agente 1: Analizando cambios..."
AGENT1_OUTPUT="/tmp/qa_agent1_output_${RUN_ID}.json"
cd "$ROOT"
python agents/analyzer.py "$TRIGGER_FILE" "$DIFF_FILE" > "$AGENT1_OUTPUT"
echo "Agente 1 completado."

# 4. Ejecutar Agente 2 (Generador/Ejecutor)
echo "--- Agente 2: Ejecutando..."
AGENT2_OUTPUT="/tmp/qa_agent2_output_${RUN_ID}.json"
python agents/generator_executor.py "$AGENT1_OUTPUT" > "$AGENT2_OUTPUT"
echo "Agente 2 completado."

# 5. Comprimir contexto para la próxima sesión
echo "--- Comprimiendo contexto..."
python scripts/compress_context.py "$AGENT2_OUTPUT"

# 6. Verificar DOD status
DOD_STATUS=$(python -c "
import json, sys
data = json.load(open('$AGENT2_OUTPUT'))
print(data.get('dod_status', 'unknown'))
")

echo "DOD Status: ${DOD_STATUS}"

if [ "$DOD_STATUS" = "failed" ]; then
  echo "ERROR: Tests DOD fallaron. Bloqueando pipeline."
  exit 1
fi

echo "=== Run completado exitosamente ==="
