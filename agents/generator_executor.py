"""
Agente 2 — Generador / Ejecutor

Responsabilidad:
- Consume el JSON producido por el Agente 1.
- Modo 'generate': genera tests E2E en tests/e2e/.
- Modo 'execute': ejecuta pytest + Appium y reporta resultados.
- Nunca actúa sin input del Agente 1.
- Devuelve siempre JSON validado, nunca texto libre.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent.parent
SCHEMA_PATH = ROOT / "schemas" / "agent_contract.json"
PROMPT_PATH = ROOT / "prompts" / "agent2_gen_exec.md"


def app_dir(app_id: str) -> Path:
    return ROOT / "apps" / app_id


def load_prompt() -> str:
    with open(PROMPT_PATH) as f:
        return f.read()


def list_existing_page_objects(app_id: str) -> list[str]:
    pages_dir = app_dir(app_id) / "tests" / "pages"
    return [p.name for p in pages_dir.glob("*.py") if p.name != "__init__.py"]


def list_existing_tests(app_id: str) -> list[str]:
    e2e_dir = app_dir(app_id) / "tests" / "e2e"
    return [p.name for p in e2e_dir.glob("test_*.py")]


def generate_tests(input_json: dict) -> dict:
    """Llama a Claude para generar archivos de test E2E."""
    app_id = input_json["app_id"]
    e2e_dir = app_dir(app_id) / "tests" / "e2e"
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = load_prompt()

    context = {
        "mode": "generate",
        "app_id": app_id,
        "request": input_json.get("generate_request", {}),
        "existing_page_objects": list_existing_page_objects(app_id),
        "existing_tests": list_existing_tests(app_id),
        "agent_context": input_json.get("context", {}),
    }

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8096,
        system=system_prompt,
        messages=[{"role": "user", "content": json.dumps(context, indent=2)}],
    )

    result = json.loads(response.content[0].text)

    # Escribe los archivos generados
    generated = []
    for file_spec in result.get("files", []):
        path = e2e_dir / file_spec["filename"]
        path.write_text(file_spec["content"])
        generated.append(str(path.relative_to(ROOT)))

    return {
        "mode": "generate",
        "generated_files": generated,
        "knowledge_update": result.get("knowledge_update", {}),
    }


def execute_tests(input_json: dict) -> dict:
    """Ejecuta los tests indicados con pytest y reporta resultados."""
    app_id = input_json["app_id"]
    exec_request = input_json.get("execute_request", {})
    test_files = exec_request.get("test_files", [])
    dod_tests = exec_request.get("dod_tests", [])
    device = exec_request.get("device", "iphone_14_sim")

    if not test_files and not dod_tests:
        return {"mode": "execute", "status": "skipped", "reason": "No test files specified"}

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_path = ROOT / "reports" / app_id / "runs" / f"{run_id}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)

    all_tests = list(set(dod_tests + test_files))
    cmd = [
        "python", "-m", "pytest",
        *all_tests,
        "--json-report", f"--json-report-file={report_path}",
        "-v",
        f"--device={device}",
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)

    # Lee el reporte generado por pytest-json-report
    result_data = {}
    if report_path.exists():
        with open(report_path) as f:
            result_data = json.load(f)

    dod_status = "passed"
    dod_failures = []
    for test in dod_tests:
        test_result = result_data.get("tests", {}).get(test, {})
        if test_result.get("outcome") != "passed":
            dod_status = "failed"
            dod_failures.append(test)

    return {
        "mode": "execute",
        "run_id": run_id,
        "dod_status": dod_status,
        "dod_failures": dod_failures,
        "exit_code": proc.returncode,
        "report_path": str(report_path.relative_to(ROOT)),
        "knowledge_update": {
            "failed_tests": dod_failures,
            "device": device,
        },
    }


def run(input_json: dict) -> dict:
    mode = input_json.get("mode")
    if mode == "generate":
        result = generate_tests(input_json)
    elif mode == "execute":
        result = execute_tests(input_json)
    else:
        raise ValueError(f"Modo desconocido: {mode!r}. Debe ser 'generate' o 'execute'.")

    result["_meta"] = {
        "agent": "generator_executor",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
    }
    return result


if __name__ == "__main__":
    # Uso: python agents/generator_executor.py input.json
    input_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not input_path:
        print("Uso: python agents/generator_executor.py <input.json>", file=sys.stderr)
        sys.exit(1)

    input_json = json.loads(Path(input_path).read_text())
    result = run(input_json)
    print(json.dumps(result, indent=2))
