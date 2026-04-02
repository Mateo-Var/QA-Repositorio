"""
Agente 0 — Explorador (Modo 1: Onboarding de app nueva)

Responsabilidad:
- Conecta Appium al dispositivo
- Navega la app sistemáticamente (BFS sobre el grafo de pantallas)
- Guarda apps/{app_id}/ui_map.json con todos los elementos encontrados

El análisis, las preguntas al dev y la generación de archivos los hace
Claude Code directamente en la conversación — no se necesita API key.

Uso:
    APP_ID=miApp APP_BUNDLE_ID=com.empresa.app python agents/explorer.py
    APP_ID=miApp APP_BUNDLE_ID=com.empresa.app python agents/explorer.py --device iphone_physical
"""

import json
import os
import sys
import time
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from appium import webdriver
from appium.options.common.base import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import WebDriverException, StaleElementReferenceException

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

# ── Constantes de exploración ─────────────────────────────────────────────────

TAPPABLE_TYPES = {
    "XCUIElementTypeButton",
    "XCUIElementTypeCell",
    "XCUIElementTypeOther",
    "XCUIElementTypeTab",
}

BACK_NAMES = {"VOLVER", "Back", "Atrás", "Cancel", "Cancelar", "Close", "Cerrar", "✕", "×"}

SKIP_NAMES = {
    "shift", "emoji", "dictation", "Done", "delete", "space", "return", "Next keyboard",
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
}

MAX_DEPTH  = 3
TAP_WAIT   = 2.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def screen_signature(driver) -> str:
    try:
        elements = driver.find_elements(AppiumBy.XPATH, "//*[@name and string-length(@name) > 1]")
        names = sorted({e.get_attribute("name") for e in elements[:30] if e.get_attribute("name")})
        return hashlib.md5("|".join(names).encode()).hexdigest()
    except Exception:
        return ""


def capture_elements(driver) -> list[dict]:
    elements = []
    try:
        raw  = driver.find_elements(AppiumBy.XPATH, "//*[@name and string-length(@name) > 1]")
        seen = set()
        for el in raw:
            try:
                name  = el.get_attribute("name") or ""
                label = el.get_attribute("label") or ""
                etype = el.get_attribute("type") or ""
                value = el.get_attribute("value") or ""
                if name and name not in seen and name not in SKIP_NAMES:
                    seen.add(name)
                    elements.append({
                        "type":  etype.replace("XCUIElementType", ""),
                        "name":  name,
                        "label": label,
                        "value": value,
                    })
            except StaleElementReferenceException:
                continue
    except Exception:
        pass
    return elements


def find_tappable(driver) -> list[dict]:
    return [
        e for e in capture_elements(driver)
        if ("XCUIElementType" + e["type"]) in TAPPABLE_TYPES
        and e["name"] not in SKIP_NAMES
        and e["name"] not in BACK_NAMES
        and len(e["name"]) < 80
    ]


def try_tap(driver, name: str) -> bool:
    try:
        el = driver.find_element(AppiumBy.XPATH, f'//*[@name="{name}"]')
        el.click()
        time.sleep(TAP_WAIT)
        return True
    except Exception:
        return False


def go_back(driver) -> bool:
    for back_name in BACK_NAMES:
        try:
            el = driver.find_element(AppiumBy.XPATH, f'//*[@name="{back_name}"]')
            el.click()
            time.sleep(TAP_WAIT)
            return True
        except Exception:
            continue
    try:
        size = driver.get_window_size()
        driver.swipe(
            start_x=5, start_y=size["height"] // 2,
            end_x=size["width"] // 2, end_y=size["height"] // 2,
            duration=300,
        )
        time.sleep(TAP_WAIT)
        return True
    except Exception:
        return False


# ── Screen Walker ─────────────────────────────────────────────────────────────

class ScreenWalker:
    def __init__(self, driver):
        self.driver        = driver
        self.screens: dict = {}
        self.nav_graph: dict = {}
        self.tab_bar: list   = []
        self.visited_sigs: set = set()

    def _screen_label(self, trigger: str, depth: int) -> str:
        """Nombre descriptivo basado en el contenido actual de la pantalla."""
        els = capture_elements(self.driver)
        for e in els:
            if e["type"] == "StaticText" and e["name"].isupper() and len(e["name"]) < 40:
                candidate = e["name"].lower().replace(" ", "_")
                if candidate not in self.screens:
                    return candidate
        base = trigger.lower().replace("tap:", "").replace(" ", "_")[:35]
        suffix = f"_{depth}" if base in self.screens else ""
        return base + suffix

    def _detect_tab_bar(self) -> list[str]:
        tabs = []
        try:
            for btn in self.driver.find_elements(AppiumBy.XPATH, "//XCUIElementTypeButton"):
                name = btn.get_attribute("name") or ""
                if name and name not in SKIP_NAMES and name not in BACK_NAMES:
                    tabs.append(name)
                if len(tabs) >= 6:
                    break
        except Exception:
            pass
        return tabs[:6]

    def _wait_for_load(self, timeout: int = 15) -> None:
        print("  ⏳ Esperando carga...", end="", flush=True)
        deadline = time.time() + timeout
        while time.time() < deadline:
            if len(capture_elements(self.driver)) >= 3:
                print(" OK")
                return
            time.sleep(1)
            print(".", end="", flush=True)
        print(" (timeout)")

    def explore(self, label: str = "home", trigger: str = "app_launch", depth: int = 0):
        sig = screen_signature(self.driver)
        if sig in self.visited_sigs or depth > MAX_DEPTH:
            return
        self.visited_sigs.add(sig)

        elements     = capture_elements(self.driver)
        actual_label = self._screen_label(trigger, depth)
        self.screens[actual_label] = {"trigger": trigger, "depth": depth, "elements": elements}
        self.nav_graph.setdefault(actual_label, [])

        indent = "  " * depth
        print(f"  {indent}📱 [{actual_label}] — {len(elements)} elementos")

        if depth == 0:
            self.tab_bar = self._detect_tab_bar()

        for el in find_tappable(self.driver):
            name    = el["name"]
            pre_sig = screen_signature(self.driver)

            if not try_tap(self.driver, name):
                continue

            post_sig = screen_signature(self.driver)
            if post_sig == pre_sig or post_sig in self.visited_sigs:
                continue

            child_label = name.lower().replace(" ", "_")[:35]
            self.nav_graph[actual_label].append(child_label)
            self.explore(child_label, trigger=f"tap:{name}", depth=depth + 1)

            go_back(self.driver)
            time.sleep(TAP_WAIT)

            if screen_signature(self.driver) != pre_sig:
                break  # no pudimos volver — terminar rama

    def run(self) -> dict:
        print("\n🔍 Explorando la app...")
        self._wait_for_load()
        self.explore()
        return {
            "screens":          self.screens,
            "navigation_graph": self.nav_graph,
            "tab_bar":          self.tab_bar,
            "total_screens":    len(self.screens),
            "total_elements":   sum(len(s["elements"]) for s in self.screens.values()),
        }


# ── Conexión Appium ───────────────────────────────────────────────────────────

def connect_appium(bundle_id: str, device_key: str) -> webdriver.Remote:
    caps = None
    app_id = os.environ.get("APP_ID", "")
    candidates = [ROOT / "apps" / app_id / "tests"]
    for other in sorted((ROOT / "apps").glob("*/tests")):
        if other not in candidates:
            candidates.append(other)

    for tests_dir in candidates:
        if not (tests_dir / "fixtures" / "devices.py").exists():
            continue
        if str(tests_dir) not in sys.path:
            sys.path.insert(0, str(tests_dir))
        try:
            for mod in list(sys.modules):
                if "fixtures" in mod:
                    del sys.modules[mod]
            from fixtures.devices import DEVICES
            caps = dict(DEVICES.get(device_key) or DEVICES.get("iphone_physical") or {})
            if caps:
                print(f"  📋 Caps desde: {tests_dir.relative_to(ROOT)}/fixtures")
                break
        except Exception:
            continue

    if not caps:
        print("  ⚠️  Usando caps por env vars.")
        caps = {
            "platformName":                "iOS",
            "automationName":              "XCUITest",
            "appium:udid":                 os.environ.get("DEVICE_UDID", ""),
            "appium:noReset":              True,
            "appium:xcodeOrgId":           os.environ.get("XCODE_TEAM_ID", ""),
            "appium:xcodeSigningId":       "Apple Development",
            "appium:updatedWDABundleId":   os.environ.get("WDA_BUNDLE_ID", ""),
            "appium:wdaLaunchTimeout":     120000,
            "appium:wdaConnectionTimeout": 120000,
        }

    caps["appium:bundleId"] = bundle_id
    appium_url = os.environ.get("APPIUM_SERVER_URL", "http://localhost:4723")

    print(f"🔌 Conectando a Appium ({appium_url})...")
    for attempt in range(1, 4):
        try:
            opts = AppiumOptions()
            opts.load_capabilities(caps)
            d = webdriver.Remote(appium_url, options=opts)
            print(f"  ✅ Sesión iniciada (intento {attempt})")
            return d
        except WebDriverException as e:
            print(f"  ⚠️  Intento {attempt}: {str(e)[:80]}")
            if attempt < 3:
                time.sleep(5 * attempt)
    raise RuntimeError("No se pudo conectar a Appium después de 3 intentos.")


# ── Punto de entrada ──────────────────────────────────────────────────────────

def run(app_id: str, bundle_id: str, device_key: str = "iphone_physical") -> None:
    print(f"\n{'═' * 60}")
    print(f"  Agente 0 — Explorador: {app_id}")
    print(f"  Bundle ID: {bundle_id}")
    print(f"{'═' * 60}")

    # Exploración con Appium
    driver = connect_appium(bundle_id, device_key)
    try:
        exploration = ScreenWalker(driver).run()
    finally:
        driver.quit()

    print(f"\n📊 Resultado:")
    print(f"   Pantallas: {exploration['total_screens']}")
    print(f"   Elementos: {exploration['total_elements']}")
    print(f"   Tab bar:   {exploration['tab_bar']}")

    # Guardar ui_map.json
    app_dir = ROOT / "apps" / app_id
    app_dir.mkdir(parents=True, exist_ok=True)

    ui_map = {
        "app_id":       app_id,
        "bundle_id":    bundle_id,
        "explored_at":  datetime.now(timezone.utc).isoformat(),
        "version":      "1.0.0",
        **exploration,
    }
    map_path = app_dir / "ui_map.json"
    map_path.write_text(json.dumps(ui_map, indent=2, ensure_ascii=False))
    print(f"\n✅ ui_map.json guardado en {map_path.relative_to(ROOT)}")
    print(f"\n👉 Siguiente paso: dile a Claude Code que analice apps/{app_id}/ui_map.json")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agente 0 — Explorador")
    parser.add_argument("--device", default="iphone_physical")
    args = parser.parse_args()

    app_id    = os.environ.get("APP_ID")
    bundle_id = os.environ.get("APP_BUNDLE_ID")

    if not app_id or not bundle_id:
        print("ERROR: APP_ID y APP_BUNDLE_ID son requeridos.")
        sys.exit(1)

    run(app_id, bundle_id, device_key=args.device)
