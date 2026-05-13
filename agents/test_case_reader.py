"""
Agente 1.5 — Lector de Casos de Prueba (Opción C)

Lee los MDs genéricos de test_cases/{platform}/ y los filtra según:
  1. El navigator del client_config.json → qué pantallas realmente existen
  2. Los flags has* y features del client_config.json → qué comportamiento está activo
  3. Ambos deben pasar para incluir el caso (lógica AND)

Luego enriquece con ui_map_{platform}.json del cliente para resolver selectores reales.
"""

import os
import re
import json
import time
from pathlib import Path
from typing import Optional


# Rutas globales
TEST_CASES_BASE = Path("test_cases")


# Mapeo: qué claves del navigator indican qué pantalla está presente
NAVIGATOR_SCREEN_MAP = {
    "Home":         ["Home", "AppRecommended"],
    "Discover":     ["Discover", "AppDiscover"],
    "Search":       ["Search", "SearchStack"],
    "LiveEpg":      ["LiveEpg"],
    "Lives":        ["Lives"],
    "LiveRadio":    ["LiveRadio"],
    "Podcasts":     ["Podcasts"],
    "Series":       ["Series"],
    "Account":      ["Account", "AccountStack"],
    "Downloads":    ["Downloads", "DownloadsStack"],
    "TabMain":      ["TabMain"],
}


def _extract_navigator_screens(navigator: list) -> set:
    """Recorre el navigator recursivamente y extrae todos los nombres de pantalla."""
    screens = set()
    if not isinstance(navigator, list):
        return screens
    for item in navigator:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        if name:
            screens.add(name)
        # Recursivo en navigators anidados
        sub = item.get("navigators", [])
        if sub:
            screens |= _extract_navigator_screens(sub)
    return screens


def _navigator_has(screens: set, logical_key: str) -> bool:
    """Verifica si alguna de las pantallas asociadas al logical_key está presente."""
    candidates = NAVIGATOR_SCREEN_MAP.get(logical_key, [logical_key])
    return any(c in screens for c in candidates)


def _resolve_feature_requirement(requirement: str, config: dict, navigator_screens: set) -> bool:
    """
    Evalúa si el requisito del caso aplica al cliente.

    Formato del requisito (campo 'Requiere feature' en el MD):
      - 'config.hasSearch: true'          → verifica flag en config
      - 'navigator.Search presente'       → verifica pantalla en navigator
      - 'config.features.hasDownload: true'  → verifica feature anidada
      - múltiples con '+' → AND de todas
    """
    if not requirement or requirement.strip() == "—":
        return True

    parts = [p.strip() for p in requirement.split("+")]
    for part in parts:
        part = part.strip()

        # navigator.X presente
        nav_match = re.match(r"navigator\.(\w+)\s+presente", part)
        if nav_match:
            key = nav_match.group(1)
            if not _navigator_has(navigator_screens, key):
                return False
            continue

        # config.features.X: true/false
        feat_match = re.match(r"config\.features\.(\w+):\s*(true|false)", part)
        if feat_match:
            key = feat_match.group(1)
            expected = feat_match.group(2) == "true"
            features = config.get("features", {})
            if bool(features.get(key, False)) != expected:
                return False
            continue

        # config.screens.X.Y: true/false
        screen_match = re.match(r"config\.screens\.(\w+)\.(\w+):\s*(true|false)", part)
        if screen_match:
            screen = screen_match.group(1)
            prop = screen_match.group(2)
            expected = screen_match.group(3) == "true"
            screens_cfg = config.get("screens", {})
            screen_cfg = screens_cfg.get(screen, {})
            # Buscar en components props
            for comp in screen_cfg.get("components", []):
                props = comp.get("props", {})
                if prop in props:
                    if bool(props[prop]) != expected:
                        return False
            continue

        # config.X: true/false
        cfg_match = re.match(r"config\.(\w+):\s*(true|false)", part)
        if cfg_match:
            key = cfg_match.group(1)
            expected = cfg_match.group(2) == "true"
            if bool(config.get(key, False)) != expected:
                return False
            continue

    return True


def load_client_config(app_id: str) -> dict:
    """Carga el client_config.json del cliente."""
    config_path = Path(f"apps/{app_id}/client_config.json")
    if not config_path.exists():
        return {}
    with open(config_path, encoding="utf-8") as f:
        raw = json.load(f)
    # Soporta tanto { "config": {...}, "navigator": [...] } como el objeto directo
    if "config" in raw:
        result = raw["config"].copy()
        if "navigator" in raw:
            result["_navigator"] = raw["navigator"]
        if "navigatorOptions" in raw:
            result["_navigatorOptions"] = raw["navigatorOptions"]
        if "screens" not in result and "screens" in raw:
            result["screens"] = raw["screens"]
        # i18n y native suelen estar en el nivel raíz, no dentro de config
        if "i18n" not in result and "i18n" in raw:
            result["i18n"] = raw["i18n"]
        if "native" not in result and "native" in raw:
            result["native"] = raw["native"]
        return result
    return raw


def load_ui_map(app_id: str, platform: str) -> dict:
    """Carga el ui_map del cliente para la plataforma dada."""
    ui_map_path = Path(f"apps/{app_id}/ui_map_{platform}.json")
    if not ui_map_path.exists():
        return {}
    with open(ui_map_path, encoding="utf-8") as f:
        return json.load(f)


def load_content_catalog(app_id: str) -> dict:
    """Carga el catálogo de contenido del cliente."""
    catalog_path = Path(f"apps/{app_id}/content_catalog.json")
    if not catalog_path.exists():
        return {}
    with open(catalog_path, encoding="utf-8") as f:
        return json.load(f)


def _parse_md(md_path: Path, platform: str) -> list:
    """Parsea un MD genérico de test cases y extrae cada caso como dict."""
    content = md_path.read_text(encoding="utf-8")
    flow_name = md_path.stem

    case_blocks = re.split(r"\n## ", content)
    cases = []
    for block in case_blocks:
        if not re.match(r"[A-Z]{2}-[A-Z]{2}-\d+", block.strip()):
            continue
        case = _parse_case_block(block, platform, flow_name, md_path)
        if case:
            cases.append(case)
    return cases


def _parse_case_block(block: str, platform: str, flow_name: str, md_path: Path = Path("")) -> Optional[dict]:
    """Extrae campos estructurados de un bloque de caso de prueba."""
    header_match = re.match(r"([\w-]+) — (.+)", block.strip())
    if not header_match:
        return None
    case_id = header_match.group(1)
    title = header_match.group(2).strip()

    desc_match = re.search(r"\*\*Descripción:\*\*\s*(.+?)(?=\n\n|\*\*)", block, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else ""

    pre_match = re.search(r"\*\*Precondiciones:\*\*\s*\n((?:- .+\n?)+)", block)
    preconditions = [
        line.lstrip("- ").strip()
        for line in pre_match.group(1).splitlines()
        if line.strip().startswith("-")
    ] if pre_match else []

    steps_match = re.search(r"\*\*Pasos para reproducir:\*\*\s*\n((?:\d+\..+\n?)+)", block)
    steps = [
        re.sub(r"^\d+\.\s*", "", line).strip()
        for line in steps_match.group(1).splitlines()
        if re.match(r"^\d+\.", line.strip())
    ] if steps_match else []

    result_match = re.search(r"\*\*Resultado esperado:\*\*\s*\n((?:- .+\n?|.+\n?)+?)(?=\n\*\*|\n---|\Z)", block)
    expected = result_match.group(1).strip() if result_match else ""

    selectors_match = re.search(r"```(?:javascript)?\n([\s\S]+?)```", block)
    selectors = [
        line.strip()
        for line in selectors_match.group(1).splitlines()
        if line.strip() and not line.strip().startswith("//")
    ] if selectors_match else []

    sev_match = re.search(r"\*\*Severidad:\*\*\s*(.+)", block)
    dod_match = re.search(r"\*\*DOD asociado:\*\*\s*(.+)", block)
    req_match = re.search(r"\*\*Requiere feature:\*\*\s*(.+)", block)

    severity = sev_match.group(1).strip() if sev_match else "Media"
    dod = dod_match.group(1).strip() if dod_match else "—"
    requirement = req_match.group(1).strip() if req_match else ""

    return {
        "id": case_id,
        "title": title,
        "flow": flow_name,
        "platform": platform,
        "description": description,
        "preconditions": preconditions,
        "steps": steps,
        "expected_result": expected,
        "selectors": selectors,
        "severity": severity,
        "dod_associated": dod if dod != "—" else None,
        "feature_requirement": requirement,
        "source_md": str(md_path),
    }


def _summarize_ui_map(ui_map: dict) -> dict:
    """Extrae un resumen liviano del ui_map para no saturar el contexto."""
    if not ui_map:
        return {}
    screens = ui_map.get("screens", {})
    if not isinstance(screens, dict):
        return {}
    summary = {}
    for screen, screen_data in screens.items():
        elements = screen_data.get("elements", []) if isinstance(screen_data, dict) else []
        items = [
            {"name": e.get("name", ""), "resource": e.get("resource", ""), "type": e.get("type", "")}
            for e in elements
            if isinstance(e, dict) and (e.get("name") or e.get("resource"))
        ][:20]
        if items:
            summary[screen] = items
    return summary


def load_test_cases_md(app_id: str, platform: str, flow: Optional[str] = None) -> dict:
    """
    Lee los MDs genéricos, carga el config del cliente y filtra los casos
    que aplican según navigator (pantallas reales) + has* flags (features activas).
    """
    base_dir = TEST_CASES_BASE / platform
    if not base_dir.exists():
        raise FileNotFoundError(f"No se encontró directorio de test cases: {base_dir}")

    if flow:
        md_files = [base_dir / f"{flow}.md"]
        if not md_files[0].exists():
            raise FileNotFoundError(f"Flujo no encontrado: {md_files[0]}")
    else:
        md_files = sorted(base_dir.glob("*.md"))

    # Cargar config del cliente
    config = load_client_config(app_id)
    navigator_raw = config.pop("_navigator", [])
    navigator_screens = _extract_navigator_screens(navigator_raw)

    # Parsear todos los casos
    all_cases = []
    for md_path in md_files:
        cases = _parse_md(md_path, platform)
        all_cases.extend(cases)

    # Filtrar: navigator + features (Opción C)
    filtered = []
    excluded = []
    for case in all_cases:
        req = case.get("feature_requirement", "")
        if _resolve_feature_requirement(req, config, navigator_screens):
            filtered.append(case)
        else:
            excluded.append({"id": case["id"], "reason": req})

    return {
        "app_id": app_id,
        "platform": platform,
        "total_cases": len(filtered),
        "excluded_cases": len(excluded),
        "exclusion_detail": excluded,
        "navigator_screens_detected": sorted(navigator_screens),
        "test_cases": filtered,
    }


def _build_setup_block(config: dict, ui_map_summary: dict) -> dict:
    """
    Construye el bloque setup para el Agente 2.
    Si hasAuth es true, resuelve los selectores de login desde el ui_map
    y construye el beforeAll con credenciales del entorno.
    """
    has_auth = bool(config.get("hasAuth", False))

    if not has_auth:
        return {"requires_login": False}

    # Buscar selectores de login en el ui_map
    login_selectors = {}
    login_screen_candidates = ["Login", "login", "Auth", "auth", "app_launch"]
    for screen in login_screen_candidates:
        if screen not in ui_map_summary:
            continue
        for el in ui_map_summary[screen]:
            name = el.get("name", "").lower()
            resource = el.get("resource", "").lower()
            etype = el.get("type", "").lower()
            # Campo email/usuario
            if not login_selectors.get("email_field"):
                if any(k in name for k in ["email", "correo", "usuario", "user"]) or \
                   any(k in resource for k in ["email", "user", "login"]) or \
                   (etype == "edittext" and not login_selectors.get("email_field")):
                    login_selectors["email_field"] = (
                        f'~{el["name"]}' if el.get("name") else
                        f'id:{el["resource"]}' if el.get("resource") else
                        'android=new UiSelector().className("android.widget.EditText").instance(0)'
                    )
            # Campo password
            if not login_selectors.get("password_field"):
                if any(k in name for k in ["password", "contraseña", "pass"]) or \
                   any(k in resource for k in ["password", "pass"]):
                    login_selectors["password_field"] = (
                        f'~{el["name"]}' if el.get("name") else
                        f'id:{el["resource"]}' if el.get("resource") else
                        'android=new UiSelector().className("android.widget.EditText").instance(1)'
                    )
            # Botón submit
            if not login_selectors.get("submit_button"):
                if any(k in name for k in ["ingresar", "iniciar", "login", "entrar", "sign in", "continuar"]):
                    login_selectors["submit_button"] = f'~{el["name"]}' if el.get("name") else f'id:{el["resource"]}'

    # Fallbacks genéricos si no se encontraron en el ui_map
    if not login_selectors.get("email_field"):
        login_selectors["email_field"] = 'android=new UiSelector().className("android.widget.EditText").instance(0)'
    if not login_selectors.get("password_field"):
        login_selectors["password_field"] = 'android=new UiSelector().className("android.widget.EditText").instance(1)'
    if not login_selectors.get("submit_button"):
        login_selectors["submit_button"] = 'android=new UiSelector().text("Ingresar")'

    # URLs de auth desde el config
    auth_cfg = config.get("auth", {})

    # ── Detectar el tab que lleva a cuenta/login ──────────────────────────────
    # Es el último tab del TabMain que contiene AccountStack o similar
    navigator_raw = config.get("_navigator_raw", [])
    auth_tab_title = _find_auth_tab_title(navigator_raw)

    # ── Textos que indican pantalla de LOGIN / CUENTA — derivados del i18n del cliente ──
    # Se recopilan de TODOS los idiomas para cubrir apps bilingües.
    # Se itera por cada lang_dict por separado para no sobreescribir valores al hacer update().
    i18n = config.get("i18n", {})

    LOGIN_KEYS   = ["login", "signup", "ingresar", "register", "session", "sign_in"]
    ACCOUNT_KEYS = ["favorites", "favoritos", "plans", "planes", "menu", "account",
                    "profile", "perfil", "downloads", "descargas", "settings", "logout",
                    "cerrar", "suscri"]

    login_indicators: list = []
    account_indicators: list = []

    for lang_texts in i18n.values():
        if not isinstance(lang_texts, dict):
            continue
        for k, v in lang_texts.items():
            if not isinstance(v, str) or len(v) > 50:
                continue
            # Ignorar valores con caracteres de reemplazo (encoding corrupto en el JSON fuente)
            if "�" in v or "?" in v:
                continue
            k_low = k.lower()
            if any(x in k_low for x in LOGIN_KEYS) and v not in login_indicators:
                login_indicators.append(v)
            if any(x in k_low for x in ACCOUNT_KEYS) and v not in account_indicators:
                account_indicators.append(v)

    # auth_tab_title también es indicador de cuenta activa
    if auth_tab_title and auth_tab_title not in account_indicators:
        account_indicators.insert(0, auth_tab_title)

    return {
        "requires_login": True,
        "auth": {
            "base_url":    auth_cfg.get("baseUrl", ""),
            "login_url":   auth_cfg.get("getTokenURL", ""),
            "client_id":   auth_cfg.get("clientID", ""),
            "social":      config.get("social", {}),
        },
        "credentials": {
            "email":    "${TEST_USER_EMAIL}",
            "password": "${TEST_USER_PASSWORD}",
        },
        "selectors":          login_selectors,
        "success_indicator":  auth_cfg.get("viewOnLoginSuccess", "Home"),
        "auth_tab":           auth_tab_title,
        "login_indicators":   login_indicators,
        "account_indicators": account_indicators,
        "instructions": (
            "Usar auth_tab para navegar a la sección de cuenta. "
            "En before(): tap auth_tab → si aparecen login_indicators → skip test. "
            "Si aparecen account_indicators → sesión activa → correr normal. "
            "Leer credenciales desde process.env.TEST_USER_EMAIL y TEST_USER_PASSWORD."
        ),
    }


def _find_auth_tab_title(navigator_raw: list) -> str:
    """
    Encuentra el título del tab que contiene la sección de cuenta/auth.
    Busca en TabMain el stack que contenga AccountStack, Account, Auth o similar.
    """
    AUTH_NAMES = {"AccountStack", "Account", "Auth", "AuthStack", "Profile", "ProfileStack"}

    def _find_tab_main(items):
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("name") == "TabMain":
                return item.get("navigators", [])
            found = _find_tab_main(item.get("navigators", []))
            if found:
                return found
        return []

    def _contains_auth(stack):
        name = stack.get("name", "")
        if name in AUTH_NAMES:
            return True
        for sub in stack.get("navigators", []):
            if _contains_auth(sub):
                return True
        return False

    tab_stacks = _find_tab_main(navigator_raw)
    for stack in tab_stacks:
        if _contains_auth(stack):
            nav_opts = stack.get("navigatorOptions", {}).get("navigationOptions", {})
            return nav_opts.get("title") or stack.get("name", "Account")

    # Fallback: último tab del TabMain (convencionalmente es cuenta)
    if tab_stacks:
        last = tab_stacks[-1]
        nav_opts = last.get("navigatorOptions", {}).get("navigationOptions", {})
        return nav_opts.get("title") or last.get("name", "Account")

    return "Account"


def _extract_tab_titles(navigator_raw: list) -> list:
    """
    Extrae los títulos de los tabs del TabMain desde el navigator.
    Retorna lista de dicts: [{"name": "Home", "title": "Inicio"}, ...]
    """
    def _find_tab_main(items):
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("name") == "TabMain":
                return item.get("navigators", [])
            found = _find_tab_main(item.get("navigators", []))
            if found:
                return found
        return []

    tab_stacks = _find_tab_main(navigator_raw)
    tabs = []
    for stack in tab_stacks:
        nav_opts = stack.get("navigatorOptions", {}).get("navigationOptions", {})
        title = nav_opts.get("title", "")
        name = stack.get("name", "")
        if title or name:
            tabs.append({"name": name, "title": title or name})
    return tabs


def build_generator_payload(
    app_id: str,
    platform: str,
    flow: Optional[str] = None,
    filter_severity: Optional[list] = None,
) -> dict:
    """
    Construye el payload completo para el Agente 2 (Generador).
    Combina: casos filtrados + setup de login + ui_map del cliente + catálogo de contenido.
    """
    data = load_test_cases_md(app_id, platform, flow)

    if filter_severity:
        data["test_cases"] = [
            c for c in data["test_cases"]
            if c["severity"] in filter_severity
        ]
        data["total_cases"] = len(data["test_cases"])

    ui_map = load_ui_map(app_id, platform)
    content_catalog = load_content_catalog(app_id)
    config = load_client_config(app_id)
    navigator_raw = config.pop("_navigator", [])
    config.pop("_navigatorOptions", None)

    # Pasar navigator_raw al setup para que _find_auth_tab_title lo use
    config["_navigator_raw"] = navigator_raw

    # Extraer tabs reales del navigator (títulos configurados en TabMain)
    bottom_tabs = _extract_tab_titles(navigator_raw)

    search_terms = content_catalog.get("search_terms", {})
    valid_terms = search_terms.get("valid") or [app_id.lower()]
    invalid_term = search_terms.get("invalid") or f"zzznoresult{int(time.time())}"

    # Inyectar términos reales en casos de búsqueda
    SEARCH_CASE_IDS = {"ME-GE-06", "ME-GE-07", "ME-GE-15"}
    for case in data["test_cases"]:
        if case["id"] in SEARCH_CASE_IDS:
            if case["id"] == "ME-GE-15":
                case["search_term"] = invalid_term
            else:
                case["search_term"] = valid_terms[0]
            case["search_terms_available"] = valid_terms

    ui_map_summary = _summarize_ui_map(ui_map)
    setup = _build_setup_block(config, ui_map_summary)

    scenarios = [c["id"].lower().replace("-", "_") for c in data["test_cases"]]
    flows = list({c["flow"] for c in data["test_cases"]})

    payload = {
        "agent": "test_case_reader",
        "app_id": app_id,
        "platform": platform,
        "mode": "generate",
        "setup": setup,
        "test_cases": data["test_cases"],
        "total_cases": data["total_cases"],
        "excluded_cases": data["excluded_cases"],
        "exclusion_detail": data["exclusion_detail"],
        "navigator_screens_detected": data["navigator_screens_detected"],
        "bottom_tabs": bottom_tabs,
        "ui_map_available": bool(ui_map),
        "ui_map_summary": ui_map_summary,
        "content_catalog_available": bool(content_catalog),
        "search_terms": {
            "valid": valid_terms,
            "invalid": invalid_term,
        },
        "generate_request": {
            "flow": flows[0] if len(flows) == 1 else "multi_flow",
            "scenarios": scenarios,
            "source": "test_case_reader",
            "test_cases": data["test_cases"],
        },
        "instructions": (
            "Genera tests E2E en WebdriverIO/Mocha para cada caso incluido. "
            "IMPORTANTE: Los selectores en los MDs son orientativos — resuelve los selectores REALES "
            "contra ui_map_summary buscando el elemento por nombre o tipo de pantalla. "
            "Para tests de búsqueda usa SIEMPRE el campo 'search_term' del caso. "
            "Los casos ya fueron filtrados según el navigator y features del cliente — no omitas ninguno. "
            "Sigue las convenciones de CLAUDE.md: helpers, screenshots, sin browser.pause()."
        ),
    }

    # Escribir setup.json en apps/{app_id}/ para que clientConfig.js lo lea en runtime
    setup_path = Path(f"apps/{app_id}/setup.json")
    setup_path.write_text(json.dumps(payload["setup"], indent=2, ensure_ascii=False), encoding="utf-8")

    return payload


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="Agente 1.5 — Lector de Casos de Prueba (Opción C)")
    parser.add_argument("--app-id",   required=True, help="ID de la app (ej: tvnPass, NextOTT)")
    parser.add_argument("--platform", required=True, choices=["android", "ios"])
    parser.add_argument("--flow",     default=None,  help="Flujo específico (ej: menu). Default: todos.")
    parser.add_argument("--severity", nargs="*",     help="Filtrar por severidad: Crítica Alta Media Baja")
    parser.add_argument("--output",   default=None,  help="Archivo de salida JSON (default: stdout)")
    parser.add_argument("--dry-run",  action="store_true", help="Solo mostrar qué casos aplican/se excluyen")
    args = parser.parse_args()

    if args.dry_run:
        data = load_test_cases_md(args.app_id, args.platform, args.flow)
        print(f"\n{'='*60}")
        print(f"Cliente: {args.app_id} | Plataforma: {args.platform}")
        print(f"Pantallas detectadas en navigator: {len(data['navigator_screens_detected'])}")
        for s in data["navigator_screens_detected"]:
            print(f"  + {s}")
        print(f"\nCasos incluidos: {data['total_cases']}")
        for c in data["test_cases"]:
            print(f"  + {c['id']} -- {c['title']}")
        print(f"\nCasos excluidos: {data['excluded_cases']}")
        for e in data["exclusion_detail"]:
            print(f"  - {e['id']} -- no cumple: {e['reason']}")
        print('='*60)
        sys.exit(0)

    payload = build_generator_payload(
        app_id=args.app_id,
        platform=args.platform,
        flow=args.flow,
        filter_severity=args.severity,
    )

    output_json = json.dumps(payload, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"Payload escrito en: {args.output} ({payload['total_cases']} casos incluidos, {payload['excluded_cases']} excluidos)")
    else:
        print(output_json)
