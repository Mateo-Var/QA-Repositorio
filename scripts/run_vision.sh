#!/usr/bin/env bash
# run_vision.sh — Fase 3: Claude valida con visión los resultados de la Fase 2.
#
# Uso:
#   ./scripts/run_vision.sh <pr_number> <agent2_output_path> <run_id>
#
# Si pr_number es 0 o vacío, se salta la publicación del comentario en el PR.

set -euo pipefail

PR_NUMBER="${1:-0}"
AGENT2_OUTPUT="${2:?AGENT2_OUTPUT requerido}"
RUN_ID="${3:?RUN_ID requerido}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_ID="${APP_ID:?APP_ID requerido}"

SCREENSHOTS_DIR="$ROOT/reports/$APP_ID/screenshots/$RUN_ID"
VIDEO_PATH="$ROOT/reports/$APP_ID/videos/$RUN_ID/session.mp4"

echo "=== Fase 3 — Validación Visual Claude ==="
echo "App: ${APP_ID} | Run: ${RUN_ID} | PR: #${PR_NUMBER}"

# ── 1. Construir JSON de entrada para el Agente 3 ─────────────────────────────
VISION_INPUT="/tmp/qa_vision_input_${RUN_ID}.json"

python3 - <<EOF > "$VISION_INPUT"
import json, pathlib, sys

agent2   = json.load(open("$AGENT2_OUTPUT"))
video    = "$VIDEO_PATH"
has_vid  = pathlib.Path(video).exists()

print(json.dumps({
    "run_id":          "$RUN_ID",
    "app_id":          "$APP_ID",
    "dod_status":      agent2.get("dod_status", "unknown"),
    "dod_failures":    agent2.get("dod_failures", []),
    "screenshots_dir": "$SCREENSHOTS_DIR",
    "video_path":      video if has_vid else "",
}, indent=2))
EOF

echo "Input preparado: $VISION_INPUT"

# ── 2. Ejecutar Agente 3 ──────────────────────────────────────────────────────
echo "--- Agente 3: analizando imágenes con Claude..."
AGENT3_OUTPUT="/tmp/qa_agent3_output_${RUN_ID}.json"
cd "$ROOT"
python agents/vision_validator.py "$VISION_INPUT" > "$AGENT3_OUTPUT"
echo "Agente 3 completado."

# ── 3. Publicar/actualizar comentario en el PR ────────────────────────────────
if [[ "$PR_NUMBER" != "0" && -n "$PR_NUMBER" ]]; then
    # Buscar agent1 output del mismo run si existe
    AGENT1_OUTPUT="/tmp/qa_agent1_output_${RUN_ID}.json"
    [[ ! -f "$AGENT1_OUTPUT" ]] && echo '{}' > "$AGENT1_OUTPUT"

    echo "--- Publicando diagnóstico visual en PR #${PR_NUMBER}..."
    python scripts/post_pr_comment.py \
      --pr "${PR_NUMBER}" \
      --agent1 "$AGENT1_OUTPUT" \
      --agent2 "$AGENT2_OUTPUT" \
      --agent3 "$AGENT3_OUTPUT" \
      --run-id "${RUN_ID}" \
      --edit \
      || echo "⚠️  No se pudo publicar el comentario — continuando"
else
    echo "--- PR_NUMBER=0: omitiendo comentario PR."
fi

# ── 4. Verificar si bloquear el merge ─────────────────────────────────────────
BLOCK_MERGE=$(python3 -c "
import json
data = json.load(open('$AGENT3_OUTPUT'))
print('true' if data.get('block_merge', False) else 'false')
")

VERDICT=$(python3 -c "
import json
data = json.load(open('$AGENT3_OUTPUT'))
print(data.get('vision_verdict', 'unknown'))
")

echo "Veredicto: ${VERDICT} | Block merge: ${BLOCK_MERGE}"

# ── 5. Limpiar temporales ─────────────────────────────────────────────────────
rm -f "$VISION_INPUT"

if [ "$BLOCK_MERGE" = "true" ]; then
    REASON=$(python3 -c "
import json
data = json.load(open('$AGENT3_OUTPUT'))
print(data.get('blocking_reason', 'Claude detectó un fallo bloqueante'))
")
    echo "ERROR: Merge bloqueado — ${REASON}"
    exit 1
fi

echo "=== Fase 3 completada: ${VERDICT} ==="
