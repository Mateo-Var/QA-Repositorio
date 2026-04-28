#!/usr/bin/env bash
# run_ios.sh — Suite E2E iOS en iPhone físico.
# Inicia Appium en 4724, corre los tests y publica comentario en el PR.
#
# Uso: ./scripts/run_ios.sh <pr_number>

set -euo pipefail

PR_NUMBER="${1:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ID="ios_pr${PR_NUMBER}_$(date -u +%Y%m%d_%H%M%S)"
APP_ID="${APP_ID:-tvnPass}"
DEVICE_NAME="iPhone 16e (${IOS_DEVICE_UDID:-unknown})"

echo "=== QA Agent iOS — PR #${PR_NUMBER} ==="
echo "Run ID: ${RUN_ID}"
echo "Device: ${DEVICE_NAME}"

cd "$ROOT"

# ── Iniciar Appium iOS ────────────────────────────────────────────────────────
APPIUM_PORT="${IOS_APPIUM_PORT:-4724}"

_appium_up() {
  python3 -c "
import socket, sys
try:
    s = socket.create_connection(('127.0.0.1', ${APPIUM_PORT}), timeout=5)
    s.close()
except Exception:
    sys.exit(1)
sys.exit(0)
" 2>/dev/null
}

echo "🔌 Verificando Appium iOS en puerto ${APPIUM_PORT}..."
lsof -ti :"${APPIUM_PORT}" | xargs kill -9 2>/dev/null || true
sleep 2

mkdir -p "reports/${APP_ID}/logs"
APPIUM_HOME=~/.appium appium --port "${APPIUM_PORT}" --relaxed-security \
  --log "reports/${APP_ID}/logs/appium_ios.log" > /dev/null 2>&1 &

READY=0
for i in $(seq 1 30); do
  sleep 1
  if _appium_up; then
    echo "   ✓ Appium iOS listo (${i}s)"
    READY=1
    break
  fi
done

if [[ $READY -eq 0 ]]; then
  echo "ERROR: Appium iOS no inició después de 30s"
  exit 1
fi

# ── Limpiar resultados anteriores ─────────────────────────────────────────────
rm -rf "reports/${APP_ID}/allure-results"
mkdir -p "reports/${APP_ID}/allure-results"

# ── Correr tests iOS ──────────────────────────────────────────────────────────
echo "--- Corriendo suite iOS..."
EXIT_CODE=0
APP_PLATFORM=ios APP_ID="${APP_ID}" npm run test:android || EXIT_CODE=$?
echo "--- Suite iOS finalizada (exit code: ${EXIT_CODE})"

# ── Parsear resultados de Allure ──────────────────────────────────────────────
TMP_DIR=".qa_tmp/${RUN_ID}"
mkdir -p "$TMP_DIR"
AGENT2_OUTPUT="${TMP_DIR}/agent2_ios.json"

python3 - "$AGENT2_OUTPUT" "$APP_ID" "$EXIT_CODE" "$RUN_ID" <<'PYEOF'
import json, sys, glob
from pathlib import Path

out_path, app_id, exit_code, run_id = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]

results_dir = f"reports/{app_id}/allure-results"
test_cases = []
passed = 0
failed = 0

for f in sorted(glob.glob(f"{results_dir}/*.json")):
    try:
        data = json.load(open(f))
        if "name" not in data:
            continue
        status = data.get("status", "unknown")
        name   = data.get("name", "unknown")
        test_cases.append({"name": name, "status": status})
        if status == "passed":
            passed += 1
        else:
            failed += 1
    except Exception:
        continue

total = passed + failed
dod_status = "passed" if exit_code == 0 and failed == 0 else "failed"
failures = [t["name"] for t in test_cases if t["status"] != "passed"]

output = {
    "mode":          "execute",
    "app_id":        app_id,
    "run_id":        run_id,
    "platform":      "ios",
    "dod_status":    dod_status,
    "dod_failures":  failures,
    "exit_code":     exit_code,
    "tests_passed":  passed,
    "tests_total":   total,
    "test_cases":    test_cases,
}
json.dump(output, open(out_path, "w"), indent=2)
print(f"  Resultado: {passed}/{total} tests pasaron")
PYEOF

# ── Publicar comentario en PR ─────────────────────────────────────────────────
if [[ "${PR_NUMBER}" != "0" ]]; then
  echo '{"app_id": "'"${APP_ID}"'", "risk_level": "INFO", "reason": "Suite E2E iOS completada.", "suggestions": []}' \
    > "${TMP_DIR}/agent1_ios.json"

  RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_ACTIONS_RUN_ID:-}"

  echo "--- Publicando comentario iOS en PR #${PR_NUMBER}..."
  python3 scripts/post_pr_comment.py \
    --pr "${PR_NUMBER}" \
    --agent1 "${TMP_DIR}/agent1_ios.json" \
    --agent2 "${AGENT2_OUTPUT}" \
    --run-id "${RUN_ID}" \
    --run-url "${RUN_URL}" \
    --platform ios \
    --device "iPhone 16e" \
    --repo "${GITHUB_REPOSITORY:-}" \
    || echo "post_pr_comment falló — continuando"
fi

# ── Verificar DOD ─────────────────────────────────────────────────────────────
DOD_STATUS=$(python3 -c "import json; print(json.load(open('${AGENT2_OUTPUT}')).get('dod_status','unknown'))")
echo "DOD Status iOS: ${DOD_STATUS}"

rm -rf "$TMP_DIR"
echo "=== Run iOS completado ==="

if [ "$DOD_STATUS" = "failed" ]; then
  echo "ERROR: Tests DOD iOS fallaron."
  exit 1
fi
