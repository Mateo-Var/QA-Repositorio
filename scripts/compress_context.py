"""
compress_context.py — Optimizador de tokens

Lee el output del Agente 2, extrae los aprendizajes relevantes,
y actualiza knowledge/session_log.json con un resumen comprimido.

El resumen nunca supera los 500 tokens para no saturar el contexto
del Agente 1 en la próxima sesión.

Uso:
    python scripts/compress_context.py <agent2_output.json>
    python scripts/compress_context.py  # lee de stdin
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent.parent
SESSION_LOG_PATH = ROOT / "knowledge" / "session_log.json"
FAILED_TESTS_PATH = ROOT / "knowledge" / "failed_tests.json"
CLAUDE_MD_PATH = ROOT / "CLAUDE.md"

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


def compress(agent2_output: dict) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=COMPRESS_PROMPT,
        messages=[{"role": "user", "content": json.dumps(agent2_output, indent=2)}],
    )
    return json.loads(response.content[0].text)


def update_session_log(compressed: dict) -> None:
    with open(SESSION_LOG_PATH) as f:
        log = json.load(f)

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

    # Mantener solo las últimas 20 sesiones para controlar el tamaño
    if len(log["sessions"]) > 20:
        log["sessions"] = log["sessions"][-20:]

    with open(SESSION_LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)


def update_failed_tests(compressed: dict) -> None:
    with open(FAILED_TESTS_PATH) as f:
        history = json.load(f)

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

    with open(FAILED_TESTS_PATH, "w") as f:
        json.dump(history, f, indent=2)


def update_claude_md(compressed: dict) -> None:
    """Actualiza la sección [AUTO] del CLAUDE.md."""
    content = CLAUDE_MD_PATH.read_text()

    auto_section_start = "```json\n"
    auto_section_end = "\n```"

    with open(SESSION_LOG_PATH) as f:
        log = json.load(f)

    new_context = {
        "last_run": log.get("last_compressed"),
        "last_run_date": log.get("last_compressed", "")[:10] if log.get("last_compressed") else None,
        "dod_status": "ok" if not compressed.get("failed_tests") else "failed",
        "recurring_failures": compressed.get("failed_tests", []),
        "learned_patterns": compressed.get("learned_patterns", []),
        "timing_baselines": compressed.get("timing_baselines", {}),
        "total_runs": len(log.get("sessions", [])),
        "total_tests_generated": 0,
    }

    marker_start = "## [AUTO] Contexto de sesión"
    if marker_start in content:
        before = content[:content.index(auto_section_start, content.index(marker_start)) + len(auto_section_start)]
        after_start = content.index(auto_section_end, content.index(marker_start))
        after = content[after_start:]
        new_content = before + json.dumps(new_context, indent=2) + after
        CLAUDE_MD_PATH.write_text(new_content)


def main():
    if len(sys.argv) > 1:
        agent2_output = json.loads(Path(sys.argv[1]).read_text())
    else:
        agent2_output = json.load(sys.stdin)

    print("Comprimiendo contexto de sesión...")
    compressed = compress(agent2_output)

    update_session_log(compressed)
    print(f"session_log.json actualizado. Resumen: {len(compressed.get('summary', ''))} chars")

    update_failed_tests(compressed)
    print(f"failed_tests.json actualizado. Fallos: {compressed.get('failed_tests', [])}")

    update_claude_md(compressed)
    print("CLAUDE.md [AUTO] actualizado.")


if __name__ == "__main__":
    main()
