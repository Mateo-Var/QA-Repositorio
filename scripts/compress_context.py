"""
compress_context.py — Optimizador de tokens

Lee el output del Agente 2, extrae los aprendizajes relevantes,
y actualiza apps/{app_id}/session_log.json con un resumen comprimido.

El resumen nunca supera los 500 tokens para no saturar el contexto
del Agente 1 en la próxima sesión.

Uso:
    python scripts/compress_context.py <agent2_output.json>
    python scripts/compress_context.py  # lee de stdin
    APP_ID debe estar definido como variable de entorno.
"""

import json
import os
import sys
import shutil
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent.parent

COMPRESS_PROMPT = """Eres un optimizador de contexto para un sistema de QA automatizado.
Recibirás el resultado de un run de tests. Tu tarea es extraer solo la información
útil para la próxima sesión, en máximo 400 tokens.

Incluye:
- Qué tests fallaron (si alguno) y por qué
- Patrones recurrentes detectados
- Tiempos de ejecución fuera de lo normal
- Cualquier hallazgo que cambie cómo se deben generar tests en el futuro

Devuelve solo un JSON con esta estructura:
{
  "summary": "texto comprimido de máx 400 tokens",
  "failed_tests": ["lista de tests que fallaron"],
  "learned_patterns": ["patrones nuevos aprendidos"],
  "timing_baselines": {"login_to_home_ms": null, "search_results_ms": null, "video_buffer_ms": null}
}
"""


def _app_dir(app_id: str) -> Path:
    return ROOT / "apps" / app_id


def _session_log_path(app_id: str) -> Path:
    return _app_dir(app_id) / "session_log.json"


def _failed_tests_path(app_id: str) -> Path:
    return _app_dir(app_id) / "failed_tests_history.json"


def _backup_session_log(app_id: str) -> None:
    """
    Guarda copias rotativas de las últimas 3 versiones del session_log
    antes de sobreescribirlo. Previene pérdida total por kill -9 o disco lleno.

    Genera: session_log.1.json, session_log.2.json, session_log.3.json
    (1 = más reciente, 3 = más antigua)
    """
    path = _session_log_path(app_id)
    if not path.exists():
        return

    backup_dir = _app_dir(app_id)
    # Rotar: 2→3, 1→2, actual→1
    for i in (3, 2, 1):
        older = backup_dir / f"session_log.{i}.json"
        newer = backup_dir / f"session_log.{i - 1}.json" if i > 1 else path
        if newer.exists():
            shutil.copy2(newer, older)


def compress(agent2_output: dict) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=COMPRESS_PROMPT,
        messages=[{"role": "user", "content": json.dumps(agent2_output, indent=2)}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        import re
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def update_session_log(app_id: str, compressed: dict) -> None:
    path = _session_log_path(app_id)

    # Backup rotativo ANTES de sobreescribir
    _backup_session_log(app_id)

    if path.exists():
        with open(path) as f:
            log = json.load(f)
    else:
        log = {"sessions": [], "summary": None, "version": 0}

    session_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": compressed.get("summary"),
        "failed_tests": compressed.get("failed_tests", []),
        "learned_patterns": compressed.get("learned_patterns", []),
        "timing_baselines": compressed.get("timing_baselines", {}),
    }

    log["sessions"].append(session_entry)
    log["last_compressed"] = session_entry["timestamp"]
    log["summary"] = compressed.get("summary")
    log["version"] = log.get("version", 1) + 1

    # Mantener solo las últimas 20 sesiones
    if len(log["sessions"]) > 20:
        log["sessions"] = log["sessions"][-20:]

    with open(path, "w") as f:
        json.dump(log, f, indent=2)


def update_failed_tests(app_id: str, compressed: dict) -> None:
    path = _failed_tests_path(app_id)

    if path.exists():
        with open(path) as f:
            history = json.load(f)
    else:
        history = {"failures": [], "last_updated": None}

    timestamp = datetime.now(timezone.utc).isoformat()
    for test_name in compressed.get("failed_tests", []):
        existing = next((e for e in history["failures"] if e["test"] == test_name), None)
        if existing:
            existing["count"] = existing.get("count", 1) + 1
            existing["last_seen"] = timestamp
        else:
            history["failures"].append({
                "test": test_name,
                "count": 1,
                "first_seen": timestamp,
                "last_seen": timestamp,
            })

    history["last_updated"] = timestamp

    with open(path, "w") as f:
        json.dump(history, f, indent=2)


def update_claude_md(app_id: str, compressed: dict) -> None:
    """Actualiza la sección [AUTO] del CLAUDE.md global."""
    claude_md = ROOT / "CLAUDE.md"
    if not claude_md.exists():
        return

    content = claude_md.read_text()
    log_path = _session_log_path(app_id)
    if not log_path.exists():
        return

    with open(log_path) as f:
        log = json.load(f)

    new_context = {
        "last_run": log.get("last_compressed"),
        "last_run_app": app_id,
        "last_run_date": log.get("last_compressed", "")[:10] if log.get("last_compressed") else None,
        "dod_status": "ok" if not compressed.get("failed_tests") else "failed",
        "recurring_failures": compressed.get("failed_tests", []),
        "learned_patterns": compressed.get("learned_patterns", []),
        "timing_baselines": compressed.get("timing_baselines", {}),
        "total_runs": len(log.get("sessions", [])),
    }

    marker = "## [AUTO] Contexto de sesión"
    auto_start = "```json\n"
    auto_end = "\n```"
    if marker in content:
        start_idx = content.index(auto_start, content.index(marker)) + len(auto_start)
        end_idx = content.index(auto_end, content.index(marker))
        new_content = content[:start_idx] + json.dumps(new_context, indent=2) + content[end_idx:]
        claude_md.write_text(new_content)


def main():
    app_id = os.environ.get("APP_ID")
    if not app_id:
        print("ERROR: APP_ID no definido.", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) > 1:
        agent2_output = json.loads(Path(sys.argv[1]).read_text())
    else:
        agent2_output = json.load(sys.stdin)

    print(f"Comprimiendo contexto para app: {app_id}...")
    compressed = compress(agent2_output)

    update_session_log(app_id, compressed)
    print(f"session_log.json actualizado (con backup). Resumen: {len(compressed.get('summary', ''))} chars")

    update_failed_tests(app_id, compressed)
    print(f"failed_tests_history.json actualizado. Fallos: {compressed.get('failed_tests', [])}")

    update_claude_md(app_id, compressed)
    print("CLAUDE.md [AUTO] actualizado.")


if __name__ == "__main__":
    main()
