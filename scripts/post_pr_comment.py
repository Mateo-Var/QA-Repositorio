"""
post_pr_comment.py — Genera y publica comentario de QA en un PR de GitHub.

Lee los outputs del Agente 1 y Agente 2, construye un comentario Markdown
y lo publica vía `gh pr comment`.

Notas (ver LEARNINGS.md):
- DEC-05: GH_TOKEN debe estar explícito en el env del step de Actions
- DEC-06: Si gh falla, el script sale con 0 para no bloquear el pipeline
- PAT-05: --dry-run para probar sin publicar

Uso:
    python scripts/post_pr_comment.py \\
        --pr 42 \\
        --agent1 /tmp/agent1_output.json \\
        --agent2 /tmp/agent2_output.json \\
        --run-id pr42_20260407_120000

    # Ver comentario sin publicar:
    python scripts/post_pr_comment.py --pr 42 --agent1 ... --agent2 ... --dry-run
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent


# ── Formateo del comentario ───────────────────────────────────────────────────

def formato_riesgo(nivel: str) -> str:
    iconos = {
        "CRITICO": "🔴",
        "ALTO":    "🟠",
        "MEDIO":   "🟡",
        "BAJO":    "🟢",
        "SKIP":    "⚪",
    }
    return f"{iconos.get(nivel, '⚪')} {nivel}"


def formato_dod(dod_status: str, dod_failures: list) -> str:
    if dod_status == "passed":
        return "✅ **DOD: PASSED** — todos los tests críticos pasaron."
    if dod_status == "failed":
        failures_md = "\n".join(f"  - `{f}`" for f in dod_failures)
        return f"🔴 **DOD: FAILED** — tests bloqueantes fallaron:\n{failures_md}"
    return "⚪ **DOD: sin datos**"


def formato_verdict(verdict: str) -> str:
    iconos = {
        "passed":   "✅",
        "failed":   "❌",
        "blocking": "🚨",
        "unknown":  "⚪",
    }
    return f"{iconos.get(verdict, '⚪')} **{verdict.upper()}**"


def build_vision_section(agent3: dict, run_url: str = "") -> list:
    """
    Sección de validación visual (Fase 3).

    Si todo pasó  → lista las 3 fotos happy path + video.
    Si algo falló → lista capturas del error + diagnóstico + recomendaciones.
    """
    if not agent3 or not agent3.get("vision_verdict"):
        return []

    verdict          = agent3.get("vision_verdict", "unknown")
    block_merge      = agent3.get("block_merge", False)
    diagnosis        = agent3.get("diagnosis", "")
    findings         = agent3.get("findings", [])
    blocking_reason  = agent3.get("blocking_reason")
    recommendations  = agent3.get("recommendations", [])
    video_path       = agent3.get("video_path")
    selected_images  = agent3.get("selected_images", {})

    happy_paths = selected_images.get("happy_path", [])
    failures    = selected_images.get("failures", [])

    artifacts_link = f"[📁 Descargar artifacts]({run_url})" if run_url.startswith("http") else ""

    lines = ["### 👁️ Validación Visual — Claude", ""]

    if block_merge and blocking_reason:
        lines += [f"🚨 **Merge bloqueado:** {blocking_reason}", ""]

    if verdict == "passed":
        # ── PASÓ: mostrar fotos happy path + video ───────────────────────────
        lines += [f"**Veredicto:** {formato_verdict(verdict)}", ""]

        if diagnosis:
            lines += [f"> {diagnosis}", ""]

        if happy_paths:
            lines += ["**Screenshots — Happy path:**", ""]
            for p in happy_paths:
                lines.append(f"- `{Path(p).name}`")
            lines.append("")

        if video_path and Path(video_path).exists():
            lines += [f"**Video de la sesión:** `{Path(video_path).name}`", ""]

        if artifacts_link:
            lines += [artifacts_link, ""]

    else:
        # ── FALLÓ: capturas del error + diagnóstico + recomendaciones ────────
        lines += [f"**Veredicto:** {formato_verdict(verdict)}", ""]

        if diagnosis:
            lines += ["**Diagnóstico:**", f"> {diagnosis}", ""]

        if failures:
            lines += ["**Screenshots del error:**", ""]
            for p in failures:
                lines.append(f"- `{Path(p).name}`")
            lines.append("")

        # Findings por pantalla
        if findings:
            severity_icon = {"blocking": "🚨", "warning": "⚠️", "ok": "✅"}
            lines += ["**Observaciones:**", ""]
            for f in findings:
                icon = severity_icon.get(f.get("severity", "ok"), "⚪")
                lines.append(f"- {icon} `{f.get('screenshot', '')}` — {f.get('observation', '')}")
            lines.append("")

        # Recomendaciones
        if recommendations:
            lines += ["**Qué corregir:**", ""]
            for r in recommendations:
                lines.append(f"- {r}")
            lines.append("")

        if artifacts_link:
            lines += [artifacts_link, ""]

    return lines


PLATFORM_ICONS = {
    "android": "🤖",
    "ios":     "🍎",
}
DEVICE_DEFAULTS = {
    "android": "Samsung R5CTB1W92KY",
    "ios":     "iPhone 16e",
}


def build_comment(agent1: dict, agent2: dict, run_id: str, agent3: dict | None = None,
                  run_url: str = "", platform: str = "android", device: str = "") -> str:
    app_id      = agent1.get("app_id", "desconocido")
    risk        = agent1.get("risk_level", "DESCONOCIDO")
    razon       = agent1.get("reason", "")
    sugerencias = agent1.get("suggestions", [])

    mode         = agent2.get("mode", "")
    dod_status   = agent2.get("dod_status", "unknown")
    dod_failures = agent2.get("dod_failures", [])
    exit_code    = agent2.get("exit_code", -1)
    report_path  = agent2.get("report_path", "")
    generated    = agent2.get("generated_files", [])
    tests_passed = agent2.get("tests_passed")
    tests_total  = agent2.get("tests_total")

    plat_icon   = PLATFORM_ICONS.get(platform, "📱")
    plat_label  = platform.upper()
    device_name = device or DEVICE_DEFAULTS.get(platform, "")

    lines = [
        f"## 🤖 QA Agent — Run `{run_id}`",
        "",
        f"**App:** `{app_id}` &nbsp;|&nbsp; **Riesgo:** {formato_riesgo(risk)}",
        "",
        f"### {plat_icon} {plat_label} — {device_name}",
        "",
    ]

    if razon:
        lines += [f"> {razon}", ""]

    # ── DOD Status ────────────────────────────────────────────────────────────
    lines += [formato_dod(dod_status, dod_failures), ""]

    # ── Resultado de ejecución ────────────────────────────────────────────────
    if mode == "execute":
        status_icon = "✅" if exit_code == 0 else "❌"
        tests_str = f"{tests_passed}/{tests_total} tests pasaron" if tests_passed is not None else f"exit code `{exit_code}`"
        lines += [
            f"### {status_icon} Resultado E2E",
            "",
            f"- **{tests_str}**",
        ]
        if report_path:
            lines.append(f"- Reporte: `{report_path}`")
        lines.append("")

    # ── Tests generados ───────────────────────────────────────────────────────
    if mode == "generate" and generated:
        lines += ["### 📝 Tests generados", ""]
        for f in generated:
            lines.append(f"- `{f}`")
        lines.append("")

    # ── Sugerencias del Agente 1 ──────────────────────────────────────────────
    if sugerencias:
        lines += ["### 💡 Casos de prueba sugeridos por Claude", ""]
        for s in sugerencias:
            titulo = s.get("title") or s.get("flow", "")
            desc   = s.get("description") or s.get("scenario", "")
            prio   = s.get("priority", "")
            prio_str = f" _{prio}_" if prio else ""
            lines.append(f"- **{titulo}**{prio_str}")
            if desc:
                lines.append(f"  {desc}")
        lines.append("")

    # ── Nota de streaming / reglas especiales ─────────────────────────────────
    notas = agent1.get("streaming_notes") or agent1.get("context", {}).get("notes", [])
    if notas:
        lines += ["### 📡 Consideraciones de streaming", ""]
        if isinstance(notas, list):
            for n in notas:
                lines.append(f"- {n}")
        else:
            lines.append(str(notas))
        lines.append("")

    # ── Validación visual (Fase 3) ────────────────────────────────────────────
    vision_lines = build_vision_section(agent3 or {}, run_url=run_url)
    if vision_lines:
        lines += vision_lines

    lines += [
        "---",
        "_Generado por [QA Agent](../../actions) · Kit-Ott-Suite_",
    ]

    return "\n".join(lines)


# ── Publicar comentario ───────────────────────────────────────────────────────

def post_comment(pr_number: int, body: str, repo: str | None, dry_run: bool, edit: bool = False, issue_mode: bool = False) -> bool:
    if dry_run:
        mode_label = "EDITAR último" if edit else "CREAR nuevo"
        target = f"issue #{pr_number}" if issue_mode else f"PR #{pr_number}"
        print(f"── DRY RUN ({mode_label}) — comentario que se publicaría en {target} ──")
        print(body)
        print("────────────────────────────────────────────")
        return True

    if issue_mode:
        base_cmd = ["gh", "issue", "comment", str(pr_number), "--body", body]
    else:
        base_cmd = ["gh", "pr", "comment", str(pr_number), "--body", body]
    if repo:
        base_cmd += ["--repo", repo]

    target_label = f"issue #{pr_number}" if issue_mode else f"PR #{pr_number}"
    try:
        if edit and not issue_mode:
            # gh issue comment no soporta --edit-last — solo aplica en PRs
            edit_result = subprocess.run(
                base_cmd + ["--edit-last"], capture_output=True, text=True,
                encoding="utf-8", timeout=30
            )
            if edit_result.returncode == 0:
                print(f"✅ Comentario actualizado en {target_label}")
                return True
            print("ℹ️  Sin comentario previo del bot, creando uno nuevo...")

        result = subprocess.run(base_cmd, capture_output=True, text=True,
                                encoding="utf-8", timeout=30)
        if result.returncode == 0:
            print(f"✅ Comentario publicado en {target_label}")
            return True
        else:
            print(f"⚠️  gh falló (exit {result.returncode}): {result.stderr.strip()}")
            return False
    except FileNotFoundError:
        print("⚠️  gh CLI no encontrado — instalar desde https://cli.github.com")
        return False
    except subprocess.TimeoutExpired:
        print("⚠️  gh timed out al publicar comentario")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Windows cp1252 no puede encodear emoji — forzar UTF-8 en stdout/stderr
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Publica comentario de QA en un PR")
    parser.add_argument("--pr",      required=True, type=int, help="Número del PR")
    parser.add_argument("--agent1",  required=True, help="Path al JSON output del Agente 1")
    parser.add_argument("--agent2",  required=True, help="Path al JSON output del Agente 2")
    parser.add_argument("--agent3",  default=None,  help="Path al JSON output del Agente 3 (visión, opcional)")
    parser.add_argument("--run-id",  default="unknown", help="ID del run")
    parser.add_argument("--repo",    default=None,  help="owner/repo (opcional)")
    parser.add_argument("--dry-run", action="store_true", help="Imprimir sin publicar")
    parser.add_argument("--edit",    action="store_true", help="Editar el último comentario del bot en lugar de crear uno nuevo")
    parser.add_argument("--issue",   action="store_true", help="Publicar en issue (gh issue comment) en vez de PR")
    parser.add_argument("--run-url",  default="", help="URL del run de GitHub Actions para link de artifacts")
    parser.add_argument("--platform", default="android", choices=["android", "ios"], help="Plataforma del run")
    parser.add_argument("--device",   default="", help="Nombre del dispositivo (ej: Samsung R5CTB1W92KY)")
    args = parser.parse_args()

    try:
        agent1 = json.loads(Path(args.agent1).read_text())
    except Exception as e:
        print(f"⚠️  No se pudo leer agent1 output: {e}")
        agent1 = {}

    try:
        agent2 = json.loads(Path(args.agent2).read_text())
    except Exception as e:
        print(f"⚠️  No se pudo leer agent2 output: {e}")
        agent2 = {}

    agent3 = None
    if args.agent3:
        try:
            agent3 = json.loads(Path(args.agent3).read_text())
        except Exception as e:
            print(f"⚠️  No se pudo leer agent3 output: {e}")

    comment = build_comment(agent1, agent2, args.run_id, agent3,
                            run_url=args.run_url, platform=args.platform, device=args.device)
    post_comment(args.pr, comment, args.repo, args.dry_run, args.edit, issue_mode=args.issue)

    # DEC-06: no bloquear el pipeline si gh falla
    sys.exit(0)


if __name__ == "__main__":
    main()
