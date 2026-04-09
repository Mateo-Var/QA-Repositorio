#!/usr/bin/env bash
# run_on_pr.sh — Trigger del sistema QA Android al abrir/actualizar un PR.
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

echo "=== QA Agent Android — PR #${PR_NUMBER} ==="
echo "Base: ${BASE_SHA} → Head: ${HEAD_SHA}"
echo "Run ID: ${RUN_ID}"

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

echo "--- Pre-filtro: cambios relevantes detectados. Iniciando QA Android..."

# ── 1. Generar diff del PR ────────────────────────────────────────────────────
DIFF_FILE="/tmp/qa_diff_${RUN_ID}.txt"
git diff "${BASE_SHA}..${HEAD_SHA}" > "$DIFF_FILE"
echo "Diff generado: $(wc -l < "$DIFF_FILE") líneas"

# ── 2. Construir trigger JSON ─────────────────────────────────────────────────
TRIGGER_FILE="/tmp/qa_trigger_${RUN_ID}.json"
cat > "$TRIGGER_FILE" <<EOF
{
  "type": "pull_request",
  "platform": "android",
  "pr_number": ${PR_NUMBER},
  "base_sha": "${BASE_SHA}",
  "head_sha": "${HEAD_SHA}",
  "run_id": "${RUN_ID}",
  "changed_files": $(echo "$CHANGED_FILES" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip().splitlines()))")
}
EOF

# ── 3. Ejecutar Agente 1 (Analizador) ────────────────────────────────────────
echo "--- Agente 1: Analizando cambios..."
AGENT1_OUTPUT="/tmp/qa_agent1_output_${RUN_ID}.json"
cd "$ROOT"
APP_ID="${APP_ID:?APP_ID requerido}" python agents/analyzer.py "$TRIGGER_FILE" "$DIFF_FILE" > "$AGENT1_OUTPUT"
echo "Agente 1 completado."

# ── 4. Ejecutar Agente 2 Android (Generador/Ejecutor) ────────────────────────
echo "--- Agente 2: Ejecutando suite Android..."
AGENT2_OUTPUT="/tmp/qa_agent2_output_${RUN_ID}.json"
python agents/generator_executor.py "$AGENT1_OUTPUT" > "$AGENT2_OUTPUT"
echo "Agente 2 completado."

# ── 5. Comprimir contexto para la próxima sesión ─────────────────────────────
echo "--- Comprimiendo contexto..."
APP_ID="${APP_ID}" python scripts/compress_context.py "$AGENT2_OUTPUT"

# ── 6. Publicar comentario en el PR (edita el de sugerencias si ya existe) ───
echo "--- Publicando comentario en PR #${PR_NUMBER}..."
python scripts/post_pr_comment.py \
  --pr "${PR_NUMBER}" \
  --agent1 "$AGENT1_OUTPUT" \
  --agent2 "$AGENT2_OUTPUT" \
  --run-id "${RUN_ID}" \
  --edit \
  || echo "⚠️  post_pr_comment falló — continuando sin comentario"

# ── 7. Verificar DOD status ───────────────────────────────────────────────────
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
rm -f "$DIFF_FILE" "$TRIGGER_FILE"

echo "=== Run Android completado exitosamente ==="
