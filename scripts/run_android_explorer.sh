#!/usr/bin/env bash
# run_android_explorer.sh — Corre el Agente 0 Android (exploración de app nueva)
# DEC-04: herramienta de onboarding, no para runs diarios.
#
# Uso:
#   APP_ID=tvnPass APP_BUNDLE_ID=com.streann.tvnpass \
#     bash scripts/run_android_explorer.sh --device fy9tgmv4kbtox4mj

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Validar parámetros ────────────────────────────────────────────────────────
APP_ID="${APP_ID:?ERROR: APP_ID requerido (ej: APP_ID=tvnPass)}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:?ERROR: APP_BUNDLE_ID requerido (ej: APP_BUNDLE_ID=com.streann.tvnpass)}"

DEVICE_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE_ARG="--device $2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

if [[ -z "$DEVICE_ARG" && -z "${ANDROID_DEVICE_NAME:-}" ]]; then
  echo "ERROR: --device <serial-adb> o ANDROID_DEVICE_NAME requerido."
  echo "Ejemplo: bash scripts/run_android_explorer.sh --device R5CTB1W92KY"
  exit 1
fi

# ── Cargar .env si existe ─────────────────────────────────────────────────────
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"

echo "════════════════════════════════════════════════════════════"
echo "  Agente 0 Android — Explorador"
echo "  App ID:  $APP_ID"
echo "  Package: $APP_BUNDLE_ID"
echo "════════════════════════════════════════════════════════════"

export APP_ID
export APP_BUNDLE_ID

cd "$ROOT"
python agents/explorer_android.py $DEVICE_ARG

echo ""
echo "✅ Exploración completa."
echo "   Siguiente paso: abre Claude Code y pídele que analice:"
echo "   apps/$APP_ID/ui_map_android.json"
