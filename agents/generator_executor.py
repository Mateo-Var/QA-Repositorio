"""
Agente 2 — Generador / Ejecutor (Android + iOS)

Responsabilidad:
- Consume el JSON producido por el Agente 1.
- Modo 'generate': genera tests E2E en JavaScript (WebdriverIO + Mocha).
- Modo 'execute': ejecuta npm run test:{platform} y reporta resultados.
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


def e2e_dir(app_id: str = "", platform: str = "android") -> Path:
    """Tests genéricos en tests/e2e/ — un solo set para todos los clientes."""
    base = tests_root() / "e2e"
    return base / "ios" if platform == "ios" else base


def helpers_dir() -> Path:
    """Helpers compartidos entre todas las apps."""
    return tests_root() / "helpers"


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def list_existing_tests(app_id: str, platform: str = "android") -> list[str]:
    d = e2e_dir(app_id, platform)
    return [p.name for p in d.glob("*.test.js")] if d.exists() else []


def covered_case_ids(app_id: str, platform: str = "android") -> set[str]:
    """
    Lee todos los .test.js existentes y extrae los IDs de casos ya cubiertos.
    Busca patrones como: it('me_ge_01_...') o it("me_ge_01_...")
    Los normaliza a mayúsculas con guiones: ME-GE-01
    """
    d = e2e_dir(app_id, platform)
    if not d.exists():
        return set()
    ids = set()
    pattern = re.compile(r"""it\(['"]([\w-]+)""")
    for f in d.glob("*.test.js"):
        text = f.read_text(encoding="utf-8", errors="replace")
        for m in pattern.finditer(text):
            raw = m.group(1)
            # me_ge_01_... → ME-GE-01
            parts = raw.upper().split("_")
            if len(parts) >= 3:
                candidate = f"{parts[0]}-{parts[1]}-{parts[2]}"
                ids.add(candidate)
    return ids


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


def _extract_it_blocks(code: str) -> str:
    """
    Extrae todos los bloques it('...', async () => { ... }) de un archivo generado.
    Se usa para inyectar solo casos nuevos en un archivo existente.
    """
    blocks = []
    i = 0
    while i < len(code):
        m = re.search(r"\n\s{2}it\(", code[i:])
        if not m:
            break
        start = i + m.start()
        # Buscar el cierre del it() contando llaves
        depth = 0
        j = start
        in_string = None
        while j < len(code):
            ch = code[j]
            if in_string:
                if ch == in_string and code[j-1:j] != "\\":
                    in_string = None
            elif ch in ('"', "'", "`"):
                in_string = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(code[start:j+2])  # incluye ');\n'
                    i = j + 1
                    break
            j += 1
        else:
            break
    return "\n".join(blocks)


def _invoke_test_case_reader(app_id: str, platform: str, flow: str) -> dict:
    """Invoca el Agente 1.5 (test_case_reader) y retorna su payload."""
    import subprocess as _sp
    reader = ROOT / "agents" / "test_case_reader.py"
    result = _sp.run(
        [sys.executable, str(reader), "--app-id", app_id, "--platform", platform, "--flow", flow],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=ROOT,
    )
    try:
        return json.loads(result.stdout)
    except Exception:
        return {}


def generate_tests(input_json: dict) -> dict:
    """Llama a Claude para generar archivos de test E2E en JavaScript."""
    app_id   = input_json["app_id"]
    platform = (input_json.get("platform") or os.environ.get("APP_PLATFORM", "android")).lower()
    tests_dir = e2e_dir(app_id, platform)
    client    = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    gen_request = _resolve_request(input_json, "generate_request", "generate")

    # Cargar UI map — fuente de verdad para selectores reales
    ui_map_path = app_dir(app_id) / f"ui_map_{platform}.json"
    ui_map = json.loads(ui_map_path.read_text(encoding="utf-8", errors="replace")) if ui_map_path.exists() else {}

    # Cargar app_context — fuente de verdad para prioridades de negocio
    app_ctx_path = app_dir(app_id) / "app_context.md"
    app_ctx_text = app_ctx_path.read_text(encoding="utf-8") if app_ctx_path.exists() else ""

    # ── Agente 1.5: obtener test_cases filtrados para este cliente ──────────────
    # Si el input ya viene del Agente 1.5 (tiene test_cases), usarlo directamente.
    # Si no, invocarlo ahora para que filtre los MDs genéricos según client_config.
    reader_payload = (
        input_json
        if "test_cases" in input_json
        else _invoke_test_case_reader(app_id, platform, gen_request.get("flow", "menu"))
    )
    test_cases = reader_payload.get("test_cases", [])
    setup_block = reader_payload.get("setup", {})

    bottom_tabs = reader_payload.get("bottom_tabs", [])

    context = {
        "mode":              "generate",
        "platform":          platform,
        "app_id":            app_id,
        "request":           gen_request,
        "existing_tests":    list_existing_tests(app_id, platform),
        "existing_helpers":  list_existing_helpers(),
        "agent_context":     input_json.get("context", {}),
        "ui_map":            ui_map,
        "app_context":       app_ctx_text,
        "test_cases":        test_cases,
        "setup":             setup_block,
        "bottom_tabs":       bottom_tabs,
        # Tests genéricos — se guardan en tests/e2e/, no por app
        "output_dir":        "tests/e2e/",
        # Helper de config disponible en runtime — leer del cliente activo
        "client_config_helper": {
            "import":       "const { tabs, tabSelector, features, texts, credentials, APP_ID } = require('./clientConfig');",
            "description":  "Importar siempre en tests genéricos. Provee tabs, features y textos del cliente activo via APP_ID.",
        },
        # Rutas de helpers — tests están en tests/e2e/, helpers en tests/helpers/
        "helper_paths": {
            "waitFor":      "require('../helpers/waitFor')",
            "pageContains": "require('../helpers/pageContains')",
            "clickHelper":  "require('../helpers/clickHelper')",
            "appState":     "require('../helpers/appState')",
            "screenshot":   "require('../helpers/screenshot')",
            "clientConfig": "require('./clientConfig')",
        },
    }

    # Filtrar casos ya cubiertos — no regenerar lo que ya existe
    BATCH_SIZE  = 3
    all_cases   = context.pop("test_cases", [])
    already     = covered_case_ids(app_id, platform)
    # pyrefly: ignore [bad-index]
    new_cases   = [c for c in all_cases if c["id"] not in already]

    if not new_cases:
        print("[generator] Todos los casos ya están cubiertos — nada que generar.", file=sys.stderr)
        return {"mode": "generate", "generated_files": [], "knowledge_update": {}}

    print(f"[generator] {len(already)} casos ya cubiertos, {len(new_cases)}/{len(all_cases)} nuevos.", file=sys.stderr)
    batches  = [new_cases[i:i + BATCH_SIZE] for i in range(0, len(new_cases), BATCH_SIZE)]
    generated = []

    for batch_idx, batch in enumerate(batches):
        print(f"[generator] Lote {batch_idx + 1}/{len(batches)} — {len(batch)} casos...", file=sys.stderr)
        # Pasar archivos ya generados para evitar duplicados entre lotes
        batch_context = {
            **context,
            "test_cases":     batch,
            "existing_tests": list_existing_tests(app_id, platform),
        }
        messages  = [{"role": "user", "content": json.dumps(batch_context, indent=2)}]
        result    = None
        last_err  = None

        for attempt in range(2):
            call_messages = messages + ([{"role": "assistant", "content": "{"}] if attempt == 0 else [])
            # pyrefly: ignore [no-matching-overload]
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=8096,
                system=load_prompt(),
                messages=call_messages,
            )
            raw = ("{" if attempt == 0 else "") + response.content[0].text.strip()
            start = raw.find("{")
            end   = raw.rfind("}")
            if start != -1 and end != -1:
                raw = raw[start:end + 1]
            try:
                result = json.loads(raw)
                break
            except json.JSONDecodeError as e:
                last_err = e
                print(f"[generator] Lote {batch_idx+1} intento {attempt+1}: JSON inválido — {e}. Repair...", file=sys.stderr)
                try:
                    from json_repair import repair_json
                    repaired = json.loads(repair_json(raw))
                    if isinstance(repaired, list):
                        repaired = repaired[0] if repaired else {}
                    if isinstance(repaired, dict) and "files" in repaired:
                        result = repaired
                        print(f"[generator] json_repair exitoso en lote {batch_idx+1}.", file=sys.stderr)
                        break
                except Exception:
                    pass
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user", "content": (
                    "El JSON anterior no es válido. Devuelve SOLO JSON válido con la estructura "
                    "{ 'files': [{ 'filename': '...', 'content': '...' }] }. "
                    "Usa comillas simples en el código JavaScript."
                )})

        if result is None:
            print(f"[generator] Lote {batch_idx+1} falló tras 2 intentos: {last_err}", file=sys.stderr)
            continue

        for file_spec in result.get("files", []):
            if not isinstance(file_spec, dict) or not file_spec.get("filename"):
                continue
            fpath = tests_dir / file_spec["filename"]
            fpath.parent.mkdir(parents=True, exist_ok=True)
            code = file_spec.get("content") or file_spec.get("content_base64", "")
            if fpath.exists():
                # Archivo ya existe — inyectar los it() nuevos antes del último '});'
                existing = fpath.read_text(encoding="utf-8")
                new_its = _extract_it_blocks(code)
                if new_its:
                    insert_point = existing.rfind("});")
                    if insert_point != -1:
                        code = existing[:insert_point] + "\n" + new_its + "\n" + existing[insert_point:]
                    else:
                        code = existing  # no modificar si no se puede ubicar el punto
            fpath.write_text(code, encoding="utf-8")
            generated.append(str(fpath.relative_to(ROOT)))

    # pyrefly: ignore [unbound-name]
    last_result = result  # puede ser None si todos los lotes fallaron
    return {
        "mode":             "generate",
        "generated_files":  generated,
        "knowledge_update": last_result.get("knowledge_update", {}) if isinstance(last_result, dict) else {},
    }


def execute_tests(input_json: dict) -> dict:
    """Ejecuta npm run test:{platform} y reporta resultados."""
    app_id       = input_json["app_id"]
    platform     = (input_json.get("platform") or os.environ.get("APP_PLATFORM", "android")).lower()
    exec_request = _resolve_request(input_json, "execute_request", "execute")
    dod_tests    = exec_request.get("dod_tests", [])

    # Prioridad: variable de entorno del runner > sugerencia de Agent 1.
    if platform == "ios":
        device = os.environ.get("IOS_DEVICE_UDID") or exec_request.get("device", "00008140-00045DCE3422801C")
    else:
        # Agent 1 puede sugerir el serial USB (R5CTB1W92KY) pero en CI
        # ANDROID_DEVICE_NAME siempre tiene la IP WiFi correcta.
        device = os.environ.get("ANDROID_DEVICE_NAME") or exec_request.get("device", "R5CTB1W92KY")

    # Guardia: si no hay .test.js, generar antes de ejecutar.
    # Evita "No specs found" cuando Agent 1 elige execute pero los tests
    # aún no existen en el repo (primer run después de borrar los tests).
    spec_dir = e2e_dir(app_id, platform)
    if not spec_dir.exists() or not list(spec_dir.glob("*.test.js")):
        print(f"[guardia] No hay .test.js en {spec_dir} — generando tests primero...", file=sys.stderr)
        gen_input = {
            "app_id":   app_id,
            "platform": platform,
            "generate_request": input_json.get("generate_request") or {
                "flow": "dod_flows",
                "scenarios": ["login_email", "reproductor_live", "logout", "busqueda"],
            },
            "context": input_json.get("context", {}),
        }
        gen_result = generate_tests(gen_input)
        print(f"[guardia] Generados: {gen_result.get('generated_files', [])}", file=sys.stderr)

    run_id      = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    reports_dir = ROOT / "reports" / app_id / "runs"
    reports_dir.mkdir(parents=True, exist_ok=True)

    if platform == "ios":
        env = {
            **os.environ,
            "APP_PLATFORM":    "ios",
            "APP_ID":          app_id,
            "QA_RUN_ID":       run_id,
            "IOS_DEVICE_UDID": device,
            "IOS_BUNDLE_ID":   os.environ.get("IOS_BUNDLE_ID", "com.tvn-2.appletv").strip(),
        }
    else:
        # Leer package y activity desde client_config.json["native"]["android"] del cliente
        _cfg_path = app_dir(app_id) / "client_config.json"
        _native = {}
        if _cfg_path.exists():
            with open(_cfg_path, encoding="utf-8") as _f:
                _native = json.load(_f).get("native", {}).get("android", {})
        _package  = os.environ.get("ANDROID_APP_PACKAGE")  or _native.get("package", "")
        _activity = os.environ.get("ANDROID_APP_ACTIVITY") or _native.get("activity", "")
        if not _package:
            raise ValueError(
                f"[execute] ANDROID_APP_PACKAGE no definido y client_config.json de '{app_id}' "
                "no tiene native.android.package. Define la variable de entorno o completa el config."
            )
        env = {
            **os.environ,
            "ANDROID_DEVICE_NAME":   device,
            "QA_RUN_ID":             run_id,
            "APP_ID":                app_id,
            "ANDROID_APP_PACKAGE":   _package,
            "ANDROID_APP_ACTIVITY":  _activity,
        }

    proc = subprocess.run(
        f"npm run test:{platform}",
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
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
        "stdout":      (proc.stdout or "")[-3000:],
        "stderr":      (proc.stderr or "")[-1000:],
    }, indent=2), encoding="utf-8")

    # Rutas de artefactos para Agent 3 y post_pr_comment
    screenshots_dir = ROOT / "reports" / app_id / "screenshots" / run_id
    video_path      = ROOT / "reports" / app_id / "videos" / f"qa_run_{run_id}.mp4"

    return {
        "mode":             "execute",
        "platform":         platform,
        "run_id":           run_id,
        "dod_status":       dod_status,
        "dod_failures":     dod_failures,
        "exit_code":        proc.returncode,
        "report_path":      str(run_log.relative_to(ROOT)),
        "screenshots_dir":  str(screenshots_dir),
        "video_path":       str(video_path),
        "stdout":           proc.stdout or "",
        "stderr":           proc.stderr or "",
        "knowledge_update": {
            "failed_tests": dod_failures,
            "device":       device,
        },
    }


# Patrones que indican fallo de la APP (no del test) — no intentar corregir el test
_APP_FAILURE_PATTERNS = [
    r"ERR_CONNECTION_REFUSED", r"ERR_NETWORK", r"net::ERR",
    r"500 Internal Server", r"502 Bad Gateway", r"503 Service",
    r"Cannot GET /", r"ECONNREFUSED",
    r"Application crashed", r"App crashed",
    r"instrumentationProcess is not running",   # UiAutomator2 crash del dispositivo
    r"is not running \(probably crashed\)",
]

# Patrones que indican fallo del TEST (selector malo, timing, lógica)
_TEST_FAILURE_PATTERNS = [
    r"no encontrado\. Candidatos",   # clickTab no encontró el tab
    r"Tab .* no encontrado",
    r"element not found",
    r"isExisting.*false",
    r"expect\(received\)\.toBe\(expected\)",  # assertion falló
    r"Selector .* did not match",
    r"Cannot read propert",
    r"is not a function",
    r"timeout.*waiting",
    r"WebDriverError.*stale",
]


def _classify_failure(output: str) -> str:
    """
    Devuelve 'app' si el fallo es de la aplicación/infraestructura,
    'test' si es un problema del código del test, 'unknown' si no está claro.
    """
    for pat in _APP_FAILURE_PATTERNS:
        if re.search(pat, output, re.IGNORECASE):
            return "app"
    for pat in _TEST_FAILURE_PATTERNS:
        if re.search(pat, output, re.IGNORECASE):
            return "test"
    return "unknown"


def _optimize_timings(app_id: str, platform: str, run_output: str) -> list[str]:
    """
    Si TODOS los tests del run pasaron, optimiza browser.pause() en todos los archivos.
    Regla conservadora: reduce pausas >= 3000ms a la mitad (mínimo 1500ms).
    No actúa si hay algún test fallido — evita romper algo que ya funciona.
    """
    tests_dir = e2e_dir(app_id, platform)
    modified  = []

    # Si hay algún fallo, no optimizar
    if re.search(r"✖|failing", run_output):
        return modified

    passing_count = len(re.findall(r"✓", run_output))
    if passing_count == 0:
        return modified

    print(f"[optimize] Run limpio ({passing_count} tests pasando) — optimizando tiempos...", file=sys.stderr)

    def reducir_pausa(m: re.Match) -> str:
        ms = int(m.group(1))
        if ms >= 3000:
            return f"browser.pause({max(1500, ms // 2)})"
        return m.group(0)

    for f in tests_dir.glob("*.test.js"):
        content = f.read_text(encoding="utf-8")
        nuevo   = re.sub(r"browser\.pause\((\d+)\)", reducir_pausa, content)
        if nuevo != content:
            f.write_text(nuevo, encoding="utf-8")
            modified.append(f.name)
            print(f"[optimize] {f.name} — pausas >= 3000ms reducidas", file=sys.stderr)

    return modified


def _fix_failing_tests(failing_output: str, app_id: str, platform: str, max_attempts: int = 3) -> dict:
    """
    Clasifica el fallo (test vs app), corrige los tests si es problema del test,
    y reintenta hasta max_attempts veces.
    """
    failure_type = _classify_failure(failing_output)
    print(f"[fix] Tipo de fallo detectado: {failure_type}", file=sys.stderr)

    if failure_type == "app":
        print("[fix] Fallo de app/infraestructura — no se corrigen los tests.", file=sys.stderr)
        return {
            "dod_status":    "failed",
            "auto_fixed":    False,
            "fix_skipped":   True,
            "fix_reason":    "app_failure",
            "stdout":        failing_output,
        }

    ai_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    tests_dir = e2e_dir(app_id, platform)
    exec_result: dict = {"dod_status": "failed", "stdout": "", "stderr": ""}

    for attempt in range(1, max_attempts + 1):
        print(f"[fix] Intento de corrección {attempt}/{max_attempts}...", file=sys.stderr)

        current_files = {}
        for f in tests_dir.glob("*.test.js"):
            current_files[f.name] = f.read_text(encoding="utf-8")

        ui_map: dict = {}
        client_config: dict = {}
        try:
            ui_map_path = ROOT / "apps" / app_id / f"ui_map_{platform}.json"
            if ui_map_path.exists():
                ui_map = json.loads(ui_map_path.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass
        try:
            cfg_path = ROOT / "apps" / app_id / "client_config.json"
            if cfg_path.exists():
                client_config = json.loads(cfg_path.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass

        fix_context = {
            "task":           "fix_failing_tests",
            "app_id":         app_id,
            "platform":       platform,
            "failure_type":   failure_type,
            "failing_output": failing_output[-5000:],
            "current_files":  current_files,
            "ui_map":         ui_map,
            "client_config":  client_config,
            "instructions": (
                "Eres el auto-corrector de tests E2E. El runner falló por un problema en el TEST (no en la app). "
                "Analiza el output del runner, los archivos de test actuales, el ui_map y el client_config. "
                "REGLAS:\n"
                "1. El ui_map contiene los elementos REALES del dispositivo — usa sus selectores exactos.\n"
                "2. Los Buttons en ui_map.screens[*].elements son los tabs reales del bottom bar (name = accessibility label).\n"
                "3. client_config.i18n.es contiene los textos reales de la UI para este cliente.\n"
                "4. Solo corrige los tests que fallaron. NO toques tests que están pasando.\n"
                "5. Si el error es 'Tab X no encontrado', revisa TAB_ALIASES en clientConfig.js y añade el label real.\n"
                "6. Si el error es 'expect(received).toBe(true) / Received: false', amplía los textos buscados con pageContainsAny.\n"
                "7. No reduzcas los browser.pause() — solo corrije la lógica y selectores.\n"
                "Devuelve JSON: { 'files': [{ 'filename': '...', 'content': '...' }], 'diagnosis': '...' }\n"
                "Solo los archivos que cambiaste. Usa comillas simples en el código JavaScript."
            ),
        }

        response = ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=load_prompt(),
            messages=[{"role": "user", "content": json.dumps(fix_context, indent=2)}],
        )
        raw = response.content[0].text.strip()
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end + 1]
        try:
            fixed = json.loads(raw)
        except Exception:
            try:
                from json_repair import repair_json
                fixed = json.loads(repair_json(raw))
                if isinstance(fixed, list):
                    fixed = fixed[0] if fixed else {}
            except Exception:
                print(f"[fix] No se pudo parsear respuesta en intento {attempt}.", file=sys.stderr)
                continue

        if not isinstance(fixed, dict):
            continue

        diagnosis = fixed.get("diagnosis", "")
        if diagnosis:
            print(f"[fix] Diagnóstico: {diagnosis}", file=sys.stderr)

        files_written = []
        for file_spec in fixed.get("files", []):
            if isinstance(file_spec, str):
                continue
            filename = file_spec.get("filename") or file_spec.get("name", "")
            content  = file_spec.get("content", "")
            if not filename or not content:
                continue
            (tests_dir / filename).write_text(content, encoding="utf-8")
            files_written.append(filename)
            print(f"[fix] Corregido: {filename}", file=sys.stderr)

        if not files_written:
            print(f"[fix] No se escribieron archivos en intento {attempt} — abortando.", file=sys.stderr)
            break

        exec_input  = {"app_id": app_id, "platform": platform, "mode": "execute"}
        exec_result = execute_tests(exec_input)

        if exec_result["dod_status"] == "passed":
            print(f"[fix] ✓ Tests pasando tras corrección {attempt}.", file=sys.stderr)
            # Optimizar timings solo tras un run completamente exitoso
            _optimize_timings(app_id, platform, exec_result.get("stdout", ""))
            exec_result["auto_fixed"]   = True
            exec_result["fix_attempts"] = attempt
            exec_result["diagnosis"]    = diagnosis
            return exec_result

        failing_output = exec_result.get("stdout", "") + exec_result.get("stderr", "")
        failure_type   = _classify_failure(failing_output)
        if failure_type == "app":
            print("[fix] Fallo cambió a problema de app — deteniendo corrección.", file=sys.stderr)
            break

    print(f"[fix] Tests aún fallando tras {max_attempts} intentos.", file=sys.stderr)
    exec_result["auto_fixed"]   = False
    exec_result["fix_attempts"] = max_attempts
    return exec_result


def run(input_json: dict) -> dict:
    platform = (input_json.get("platform") or os.environ.get("APP_PLATFORM", "android")).lower()
    mode = input_json.get("mode")
    auto_fix = input_json.get("auto_fix", True)

    if mode == "generate":
        result = generate_tests(input_json)

    elif mode == "execute":
        result = execute_tests(input_json)
        # Si falla y auto_fix está activo, intentar corregir automáticamente
        if result["dod_status"] != "passed" and auto_fix:
            app_id = input_json["app_id"]
            failing_output = result.get("stdout", "") + result.get("stderr", "")
            print(f"[run] Tests fallando — iniciando auto-corrección...", file=sys.stderr)
            result = _fix_failing_tests(failing_output, app_id, platform)

    elif mode == "generate_and_execute":
        # Modo combinado: generar tests y ejecutarlos en un solo paso
        gen_result = generate_tests({**input_json, "mode": "generate"})
        exec_result = execute_tests({**input_json, "mode": "execute"})
        if exec_result["dod_status"] != "passed" and auto_fix:
            app_id = input_json["app_id"]
            failing_output = exec_result.get("stdout", "") + exec_result.get("stderr", "")
            print(f"[run] Tests fallando post-generación — iniciando auto-corrección...", file=sys.stderr)
            exec_result = _fix_failing_tests(failing_output, app_id, platform)
        result = {**gen_result, **exec_result}

    else:
        raise ValueError(f"Modo desconocido: {mode!r}. Debe ser 'generate', 'execute' o 'generate_and_execute'.")

    result["_meta"] = {
        "agent":     "generator_executor",
        "platform":  platform,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode":      mode,
    }
    return result


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not input_path:
        print("Uso: python agents/generator_executor.py <input.json>", file=sys.stderr)
        sys.exit(1)

    input_json = json.loads(Path(input_path).read_text(encoding="utf-8"))
    result = run(input_json)
    print(json.dumps(result, indent=2))
