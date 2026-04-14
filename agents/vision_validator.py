"""
Agente 3 — Validador Visual

Responsabilidad:
- Lee screenshots (failures/ y happy_path/) generados por la Fase 2.
- Envía las imágenes a Claude con visión para análisis.
- Decide: passed / failed / blocking.
- Produce JSON estructurado que post_pr_comment.py usa para el PR.
- Nunca actúa sin el output del Agente 2 como contexto.

Uso:
    python agents/vision_validator.py <input.json>

Input JSON mínimo:
    {
      "run_id":          "pr42_20260408_120000",
      "app_id":          "tvnPass",
      "dod_status":      "passed",
      "dod_failures":    [],
      "screenshots_dir": "reports/tvnPass/screenshots/pr42_.../",
      "video_path":      "reports/tvnPass/videos/pr42_.../session.mp4"
    }
"""

import base64
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

ROOT        = Path(__file__).parent.parent
PROMPT_PATH = ROOT / "prompts" / "agent3_vision.md"

# Límites para no sobrepasar el contexto de la API
MAX_HAPPY_PATH = 3
MAX_FAILURES   = 5


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_prompt() -> str:
    return PROMPT_PATH.read_text()


def encode_image(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode()


def select_screenshots(screenshots_dir: Path) -> dict:
    """
    Elige las imágenes más relevantes para enviar a Claude.
    happy_path/ → máx MAX_HAPPY_PATH imágenes
    failures/   → máx MAX_FAILURES imágenes
    """
    result = {"happy_path": [], "failures": []}

    happy_dir   = screenshots_dir / "happy_path"
    failure_dir = screenshots_dir / "failures"

    if happy_dir.exists():
        result["happy_path"] = sorted(happy_dir.glob("*.png"))[:MAX_HAPPY_PATH]

    if failure_dir.exists():
        result["failures"] = sorted(failure_dir.glob("*.png"))[:MAX_FAILURES]

    return result


def build_content(context: dict, images: dict) -> list:
    """
    Construye la lista de content blocks para la API de Claude:
    texto con contexto + imágenes etiquetadas.
    Los failures van primero (son los más críticos para el diagnóstico).
    """
    content = [{"type": "text", "text": json.dumps(context, indent=2)}]

    for path in images["failures"]:
        content.append({"type": "text", "text": f"[FAILURE SCREENSHOT: {path.name}]"})
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": encode_image(path),
            },
        })

    for path in images["happy_path"]:
        content.append({"type": "text", "text": f"[HAPPY PATH SCREENSHOT: {path.name}]"})
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": encode_image(path),
            },
        })

    return content


# ── Core ──────────────────────────────────────────────────────────────────────

def analyze(input_json: dict) -> dict:
    app_id          = input_json["app_id"]
    run_id          = input_json["run_id"]
    dod_status      = input_json.get("dod_status", "unknown")
    dod_failures    = input_json.get("dod_failures", [])
    screenshots_dir = Path(input_json["screenshots_dir"])
    video_path      = input_json.get("video_path", "")

    images     = select_screenshots(screenshots_dir)
    has_images = bool(images["happy_path"] or images["failures"])

    # Sin screenshots (tests fallaron antes de arrancar o dispositivo no respondió)
    # → devolver veredicto failed sin llamar a Claude para evitar respuesta vacía
    if not has_images and dod_status != "passed":
        return {
            "vision_verdict": "failed",
            "block_merge":    False,
            "diagnosis":      "No se encontraron screenshots. Los tests fallaron antes de capturar imágenes — posiblemente el dispositivo no estaba disponible.",
            "findings":       [],
            "recommendations": ["Verificar que el dispositivo esté desbloqueado y conectado antes del run."],
            "selected_images": {"happy_path": [], "failures": []},
            "video_path":     None,
        }

    context = {
        "app_id":      app_id,
        "run_id":      run_id,
        "dod_status":  dod_status,
        "dod_failures": dod_failures,
        "has_images":  has_images,
        "image_counts": {
            "happy_path": len(images["happy_path"]),
            "failures":   len(images["failures"]),
        },
    }

    client        = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = load_prompt()

    message_content = build_content(context, images) if has_images else json.dumps(context, indent=2)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": message_content}],
    )

    raw = (response.content[0].text or "").strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Agent 3 no devolvió JSON válido: {raw[:200]!r}")
    result = json.loads(raw[start:end + 1])

    # Añadir metadata de artefactos para que post_pr_comment.py los referencia
    result["selected_images"] = {
        "happy_path": [str(p) for p in images["happy_path"]],
        "failures":   [str(p) for p in images["failures"]],
    }
    result["video_path"] = video_path if video_path and Path(video_path).exists() else None

    return result


def run(input_json: dict) -> dict:
    result = analyze(input_json)
    result["_meta"] = {
        "agent":     "vision_validator",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_id":    input_json.get("app_id"),
        "run_id":    input_json.get("run_id"),
    }
    return result


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python agents/vision_validator.py <input.json>", file=sys.stderr)
        sys.exit(1)

    input_data = json.loads(Path(sys.argv[1]).read_text())
    output     = run(input_data)
    print(json.dumps(output, indent=2))
