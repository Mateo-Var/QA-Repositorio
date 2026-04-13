"""
Agente 1 — Analizador

Responsabilidad:
- Recibe triggers (PR diff, webhook, schedule).
- Analiza qué cambió y decide qué tests ejecutar o generar.
- Construye el JSON de input para el Agente 2.
- NO ejecuta tests. NO genera código. Solo decide y delega.
- Una sola llamada a la API de Claude por ejecución.
"""

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

import anthropic

ROOT = Path(__file__).parent.parent
SCHEMA_PATH = ROOT / "schemas" / "agent_contract.json"
PROMPT_PATH = ROOT / "prompts" / "agent1_analyzer.md"


def app_dir(app_id: str) -> Path:
    return ROOT / "apps" / app_id


def load_compressed_session_log(app_id: str) -> str:
    """Lee solo el resumen comprimido del session_log (máx ~500 tokens)."""
    path = app_dir(app_id) / "session_log.json"
    with open(path) as f:
        data = json.load(f)
    summary = data.get("summary")
    if not summary:
        return "No hay sesiones previas."
    return summary


def load_app_context(app_id: str) -> str:
    path = app_dir(app_id) / "app_context.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def load_dod_rules(app_id: str) -> str:
    path = app_dir(app_id) / "dod_rules.py"
    return path.read_text(encoding="utf-8") if path.exists() else ""


# Mapeo de palabras clave en el diff → skills relevantes.
# Si el diff no contiene ninguna keyword de una skill, esa skill no se carga.
# Esto reduce el contexto enviado a Claude en ~60% para PRs focalizados.
_SKILL_KEYWORDS: dict[str, list[str]] = {
    "geo_rules":           ["geo", "location", "region", "country", "latam", "panama"],
    "ads_behavior":        ["ad", "ads", "advertising", "ima", "vast", "player", "video"],
    "subscription_states": ["subscription", "premium", "paywall", "purchase", "plan", "billing"],
    "offline_patterns":    ["offline", "network", "connectivity", "reachability", "no_connection"],
    "content_risk_matrix": ["content", "catalog", "rating", "age", "parental", "risk"],
}


def _infer_relevant_skills(diff: str) -> set[str] | None:
    """
    Infiere qué skills son relevantes a partir del diff.
    Retorna None si el diff está vacío → cargar todas (scheduled run, manual).
    Retorna set vacío si hay diff pero ninguna skill aplica → cargar todas igualmente
    para no perder contexto en casos ambiguos.
    """
    if not diff.strip():
        return None
    diff_lower = diff.lower()
    relevant = {
        skill for skill, keywords in _SKILL_KEYWORDS.items()
        if any(re.search(r'\b' + re.escape(kw) + r'\b', diff_lower) for kw in keywords)
    }
    # Si ninguna skill matchea, cargar todas (más seguro que cargar ninguna)
    return relevant if relevant else None


def load_skills(app_id: str, diff: str = "") -> str:
    skills_dir = app_dir(app_id) / "skills"
    if not skills_dir.exists():
        return ""

    relevant = _infer_relevant_skills(diff)
    parts = []
    skipped = []
    for md in sorted(skills_dir.glob("*.md")):
        if relevant is None or md.stem in relevant:
            parts.append(f"### {md.stem}\n{md.read_text()}")
        else:
            skipped.append(md.stem)

    if skipped:
        # Informar al modelo qué skills existen pero no se cargaron
        header = f"<!-- Skills no cargadas (no relevantes para este diff): {', '.join(skipped)} -->\n\n"
        return header + "\n\n".join(parts)
    return "\n\n".join(parts)


def load_prompt() -> str:
    with open(PROMPT_PATH, encoding="utf-8") as f:
        return f.read()


def build_user_message(trigger: dict, diff: str, app_id: str) -> str:
    session_summary = load_compressed_session_log(app_id)
    app_context = load_app_context(app_id)
    dod_rules = load_dod_rules(app_id)
    skills = load_skills(app_id, diff=diff)  # carga selectiva basada en el diff
    return f"""## App
{app_id}

## Trigger
{json.dumps(trigger, indent=2)}

## Diff del cambio
```
{diff}
```

## Contexto de la app
{app_context}

## DOD Rules
```python
{dod_rules}
```

## Skills
{skills}

## Contexto de sesión (comprimido)
{session_summary}
"""


def call_claude(trigger: dict, diff: str, app_id: str) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = load_prompt()
    user_message = build_user_message(trigger, diff, app_id)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    # Haiku a veces envuelve el JSON en ```json ... ``` — lo extraemos
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def validate_output(output: dict) -> None:
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)
    # Validación básica de campos obligatorios
    required = schema.get("required", [])
    for field in required:
        if field not in output:
            raise ValueError(f"Campo requerido ausente en output del agente: {field}")


def run(trigger: dict, diff: str, app_id: str) -> dict:
    output = call_claude(trigger, diff, app_id)
    validate_output(output)
    output["app_id"] = app_id
    output["_meta"] = {
        "agent": "analyzer",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "trigger_type": trigger.get("type"),
    }
    return output


if __name__ == "__main__":
    # Uso: python agents/analyzer.py trigger.json diff.txt
    # APP_ID debe estar definido como variable de entorno
    app_id = os.environ["APP_ID"]
    trigger_path = sys.argv[1] if len(sys.argv) > 1 else None
    diff_path = sys.argv[2] if len(sys.argv) > 2 else None

    trigger = json.loads(Path(trigger_path).read_text(encoding="utf-8")) if trigger_path else {"type": "manual"}
    diff = Path(diff_path).read_text(encoding="utf-8") if diff_path else ""

    result = run(trigger, diff, app_id)
    print(json.dumps(result, indent=2))
