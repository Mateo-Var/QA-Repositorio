"""
Agente 2 — Generador / Ejecutor Android

Responsabilidad:
- Consume el JSON producido por el Agente 1.
- Modo 'generate': genera tests E2E en JavaScript (WebdriverIO + Mocha).
- Modo 'execute': ejecuta npm run test:android y reporta resultados.
- Nunca actúa sin input del Agente 1.
- Devuelve siempre JSON validado, nunca texto libre.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT        = Path(__file__).parent.parent
SCHEMA_PATH = ROOT / "schemas" / "agent_contract.json"
PROMPT_PATH = ROOT / "prompts" / "agent2_gen_exec.md"


def app_dir(app_id: str) -> Path:
    return ROOT / "apps" / app_id


def tests_root() -> Path:
    """Directorio tests/ (helpers, unit, wdio.conf.js)."""
    return ROOT / "tests"


def e2e_dir(app_id: str) -> Path:
    """Directorio de tests E2E por app."""
    return app_dir(app_id) / "tests" / "e2e"


def helpers_dir() -> Path:
    """Helpers compartidos entre todas las apps."""
    return tests_root() / "helpers"


def load_prompt() -> str:
    return PROMPT_PATH.read_text()


def list_existing_tests(app_id: str) -> list[str]:
    d = e2e_dir(app_id)
    return [p.name for p in d.glob("*.test.js")] if d.exists() else []


def list_existing_helpers() -> list[str]:
    d = helpers_dir()
    return [p.name for p in d.glob("*.js")] if d.exists() else []


def _resolve_request(input_json: dict, key: str, decision_key: str) -> dict:
    """
    Soporta tanto 'decision.{key}' (schema v1) como '{key}_request' (schema v2).
    """
    return (
        input_json.get(key)
        or input_json.get("decision", {}).get(decision_key, {})
        or {}
    )


def generate_tests(input_json: dict) -> dict:
    """Llama a Claude para generar archivos de test E2E en JavaScript."""
    app_id    = input_json["app_id"]
    tests_dir = e2e_dir(app_id)
    client    = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    gen_request = _resolve_request(input_json, "generate_request", "generate")

    context = {
        "mode":              "generate",
        "platform":          "android",
        "app_id":            app_id,
        "request":           gen_request,
        "existing_tests":    list_existing_tests(app_id),
        "existing_helpers":  list_existing_helpers(),
        "agent_context":     input_json.get("context", {}),
    }

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8096,
        system=load_prompt(),
        messages=[{"role": "user", "content": json.dumps(context, indent=2)}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    # Extraer solo el objeto JSON (Haiku a veces agrega texto después del })
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start : end + 1]
    result = json.loads(raw)

    generated = []
    for file_spec in result.get("files", []):
        path = tests_dir / file_spec["filename"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(file_spec["content"])
        generated.append(str(path.relative_to(ROOT)))

    return {
        "mode":              "generate",
        "generated_files":   generated,
        "knowledge_update":  result.get("knowledge_update", {}),
    }


def execute_tests(input_json: dict) -> dict:
    """Ejecuta npm run test:android y reporta resultados."""
    app_id       = input_json["app_id"]
    exec_request = _resolve_request(input_json, "execute_request", "execute")
    dod_tests    = exec_request.get("dod_tests", [])
    device       = exec_request.get("device", "R5CTB1W92KY")

    run_id      = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    reports_dir = ROOT / "reports" / app_id / "runs"
    reports_dir.mkdir(parents=True, exist_ok=True)

    android_path = ROOT  # package.json está en root, no en tests/
    env = {
        **os.environ,
        "ANDROID_DEVICE_NAME":   device,
        "QA_RUN_ID":             run_id,
        "ANDROID_APP_PACKAGE":   os.environ.get("ANDROID_APP_PACKAGE", "com.streann.tvnpass"),
        "ANDROID_APP_ACTIVITY":  os.environ.get("ANDROID_APP_ACTIVITY", "com.streann.tvnpass.MainActivity"),
    }

    proc = subprocess.run(
        "npm run test:android",
        shell=True,
        capture_output=True,
        text=True,
        cwd=android_path,
        env=env,
    )

    # Determinar DOD status desde el exit code
    dod_status   = "passed" if proc.returncode == 0 else "failed"
    dod_failures = dod_tests if proc.returncode != 0 else []

    # Guardar log del run
    run_log = reports_dir / f"{run_id}.json"
    run_log.write_text(json.dumps({
        "run_id":      run_id,
        "exit_code":   proc.returncode,
        "dod_status":  dod_status,
        "dod_failures": dod_failures,
        "stdout":      proc.stdout[-3000:],  # últimas 3000 chars para no inflar
        "stderr":      proc.stderr[-1000:],
    }, indent=2))

    # Rutas de artefactos para Agent 3 y post_pr_comment
    screenshots_dir = ROOT / "reports" / app_id / "screenshots" / run_id
    video_path      = ROOT / "reports" / app_id / "videos" / f"qa_run_{run_id}.mp4"

    return {
        "mode":             "execute",
        "run_id":           run_id,
        "dod_status":       dod_status,
        "dod_failures":     dod_failures,
        "exit_code":        proc.returncode,
        "report_path":      str(run_log.relative_to(ROOT)),
        "screenshots_dir":  str(screenshots_dir),
        "video_path":       str(video_path),
        "knowledge_update": {
            "failed_tests": dod_failures,
            "device":       device,
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
        "agent":     "generator_executor",
        "platform":  "android",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode":      mode,
    }
    return result


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not input_path:
        print("Uso: python agents/generator_executor.py <input.json>", file=sys.stderr)
        sys.exit(1)

    input_json = json.loads(Path(input_path).read_text())
    result = run(input_json)
    print(json.dumps(result, indent=2))
