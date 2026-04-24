#!/usr/bin/env bash
# detect_ui_drift.sh — Detección semanal de cambios de UI en todas las apps.
#
# Por cada app en apps/*/: regenera ui_map via Agente 0, compara con el
# commiteado. Si cambió → lanza E2E. Si E2E falla → crea issue en GitHub.
#
# Uso:
#   ANDROID_DEVICE_NAME=fy9tgmv4kbtox4mj GH_TOKEN=xxx bash scripts/detect_ui_drift.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="drift_$(date -u +%Y%m%d_%H%M%S)"
APPS_DIR="$ROOT/apps"
REPORT=()

echo "=== UI Drift Detection — ${RUN_ID} ==="

for APP_CTX in "$APPS_DIR"/*/app_context.md; do
  APP_DIR="$(dirname "$APP_CTX")"
  APP_ID="$(basename "$APP_DIR")"

  echo ""
  echo "── App: ${APP_ID} ──────────────────────────"

  # ── Detectar plataforma por ui_map existente ──────────────────────────────
  if [[ -f "$APP_DIR/ui_map_android.json" ]]; then
    PLATFORM="android"
    UI_MAP="$APP_DIR/ui_map_android.json"
  elif [[ -f "$APP_DIR/ui_map_ios.json" ]]; then
    PLATFORM="ios"
    UI_MAP="$APP_DIR/ui_map_ios.json"
  else
    echo "  ⚠️  Sin ui_map — saltando (correr Agente 0 primero)"
    REPORT+=("${APP_ID}: sin ui_map — saltado")
    continue
  fi

  # ── Detectar package desde app_context.md ────────────────────────────────
  APP_BUNDLE_ID=$(grep -E "^ANDROID_APP_PACKAGE=" "$APP_CTX" | cut -d= -f2 | tr -d '[:space:]' || echo "")
  if [[ -z "$APP_BUNDLE_ID" && "$PLATFORM" == "android" ]]; then
    echo "  ⚠️  ANDROID_APP_PACKAGE no encontrado en app_context.md — saltando"
    REPORT+=("${APP_ID}: package no detectado — saltado")
    continue
  fi

  # ── Guardar snapshot del ui_map actual ────────────────────────────────────
  UI_MAP_BACKUP="/tmp/ui_map_${APP_ID}_${RUN_ID}.json"
  cp "$UI_MAP" "$UI_MAP_BACKUP"

  # ── Regenerar ui_map via Agente 0 ─────────────────────────────────────────
  echo "  Ejecutando Agente 0 (${PLATFORM})..."
  cd "$ROOT"
  export APP_ID
  export APP_BUNDLE_ID

  if [[ "$PLATFORM" == "android" ]]; then
    DEVICE="${ANDROID_DEVICE_NAME:-fy9tgmv4kbtox4mj}"
    python agents/explorer_android.py --device "$DEVICE" 2>/dev/null || {
      echo "  ⚠️  Agente 0 falló — restaurando ui_map anterior"
      cp "$UI_MAP_BACKUP" "$UI_MAP"
      REPORT+=("${APP_ID}: Agente 0 falló — saltado")
      rm -f "$UI_MAP_BACKUP"
      continue
    }
  else
    # iOS — pendiente Agente 0 iOS (explorer_ios.py)
    echo "  ⚠️  iOS: Agente 0 aún no implementado — saltando"
    REPORT+=("${APP_ID}: iOS pendiente — saltado")
    rm -f "$UI_MAP_BACKUP"
    continue
  fi

  # ── Comparar ui_maps ──────────────────────────────────────────────────────
  if diff -q "$UI_MAP_BACKUP" "$UI_MAP" > /dev/null 2>&1; then
    echo "  ✅ Sin cambios en UI — nada que hacer"
    REPORT+=("${APP_ID}: sin cambios")
    rm -f "$UI_MAP_BACKUP"
    continue
  fi

  echo "  🔄 Cambios detectados en UI — lanzando E2E..."
  DIFF_SUMMARY=$(diff "$UI_MAP_BACKUP" "$UI_MAP" | head -50 || true)

  # ── E2E ───────────────────────────────────────────────────────────────────
  E2E_EXIT=0
  bash "$SCRIPT_DIR/run_android.sh" || E2E_EXIT=$?

  if [[ $E2E_EXIT -eq 0 ]]; then
    echo "  ✅ E2E pasó tras cambio de UI — commiteando ui_map actualizado"
    cd "$ROOT"
    git config user.email "qa-agent@mediastream.com" 2>/dev/null || true
    git config user.name  "QA Agent"                 2>/dev/null || true
    git add "$UI_MAP"
    git commit -m "chore(${APP_ID}): actualizar ui_map — drift semanal ${RUN_ID}" || true
    REPORT+=("${APP_ID}: UI cambió · E2E pasó · ui_map actualizado")
  else
    echo "  ❌ E2E falló tras cambio de UI"
    cp "$UI_MAP_BACKUP" "$UI_MAP"   # restaurar — no commitear ui_map roto

    # Crear issue en GitHub
    if command -v gh &>/dev/null && [[ -n "${GH_TOKEN:-}" ]]; then
      gh issue create \
        --title "UI drift detectado — ${APP_ID} (${RUN_ID})" \
        --body "## Cambio de UI detectado con tests fallando

**App:** \`${APP_ID}\`
**Run ID:** \`${RUN_ID}\`
**Plataforma:** \`${PLATFORM}\`

### Diff del ui_map (primeras 50 líneas)
\`\`\`diff
${DIFF_SUMMARY}
\`\`\`

### Qué hacer
Revisar si los selectores en \`apps/${APP_ID}/tests/e2e/\` necesitan actualización.
El ui_map anterior se restauró — el nuevo está en \`/tmp/ui_map_${APP_ID}_${RUN_ID}.json\` del runner.

_Generado por detect_ui_drift.sh — run ${RUN_ID}_" \
        --label "ui-drift" \
        --repo "${GITHUB_REPOSITORY:-}" \
        || echo "  ⚠️  No se pudo crear issue (gh o GITHUB_REPOSITORY no disponible)"
    fi

    REPORT+=("${APP_ID}: UI cambió · E2E FALLÓ · issue creado")
  fi

  rm -f "$UI_MAP_BACKUP"
done

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Resumen drift detection ==="
for line in "${REPORT[@]}"; do
  echo "  • $line"
done
echo ""
echo "=== Drift Detection completo — ${RUN_ID} ==="
