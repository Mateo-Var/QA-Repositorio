"""
Agente 0 Android — Explorador

Responsabilidad:
- Conecta Appium al dispositivo Android (UiAutomator2)
- Navega la app sistemáticamente (BFS sobre el grafo de pantallas)
- Guarda apps/{app_id}/ui_map_android.json con todos los elementos encontrados

Notas críticas (ver LEARNINGS.md):
- DEC-01: waitForIdleTimeout=0 es obligatorio en apps de streaming
- DEC-03: usar activateApp, nunca startActivity (bloqueado en Android 16)
- DEC-04: herramienta de onboarding, no para runs diarios

Uso:
    APP_ID=tvnPass APP_BUNDLE_ID=com.streann.tvnpass python agents/explorer_android.py
    APP_ID=tvnPass APP_BUNDLE_ID=com.streann.tvnpass python agents/explorer_android.py --device R5CTB1W92KY
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

# ── Constantes ────────────────────────────────────────────────────────────────

# Tipos de widgets Android que pueden ser tappables
TAPPABLE_TYPES = {
    "android.widget.Button",
    "android.widget.ImageButton",
    "android.widget.TextView",
    "android.widget.LinearLayout",
    "android.widget.FrameLayout",
    "android.widget.RelativeLayout",
}

# Textos de botones de navegación a ignorar
BACK_NAMES = {"Navigate up", "Back", "Atrás", "←", "Close", "Cerrar"}

# Textos a ignorar (teclado, sistema, etc.)
SKIP_NAMES = {
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    "Delete", "Space", "Return", "Shift", "done", "Done",
    "More options", "Navigation bar",
}

MAX_DEPTH  = 3
TAP_WAIT   = 2.5
MAX_SCROLLS = 5  # máximo de scrolls por pantalla


# ── Helpers ───────────────────────────────────────────────────────────────────

def screen_signature(driver) -> str:
    """Hash del page source actual — detecta si la pantalla cambió."""
    try:
        src = driver.page_source
        return hashlib.md5(src[:3000].encode()).hexdigest()
    except Exception:
        return ""


def capture_elements(driver) -> list[dict]:
    """Captura elementos interactivos del XML de la UI actual."""
    elements = []
    try:
        raw  = driver.find_elements(AppiumBy.XPATH, "//*[@content-desc and string-length(@content-desc) > 1]")
        seen = set()
        for el in raw:
            try:
                name     = el.get_attribute("content-desc") or ""
                text     = el.get_attribute("text") or ""
                etype    = el.get_attribute("class") or ""
                resource = el.get_attribute("resource-id") or ""
                clickable = el.get_attribute("clickable") == "true"

                label = name or text
                if label and label not in seen and label not in SKIP_NAMES:
                    seen.add(label)
                    elements.append({
                        "type":      etype.split(".")[-1],
                        "class":     etype,
                        "name":      label,
                        "resource":  resource,
                        "clickable": clickable,
                    })
            except StaleElementReferenceException:
                continue

        # También capturar por texto si no tiene content-desc
        raw_text = driver.find_elements(AppiumBy.XPATH, "//*[@text and string-length(@text) > 1]")
        for el in raw_text:
            try:
                text     = el.get_attribute("text") or ""
                etype    = el.get_attribute("class") or ""
                resource = el.get_attribute("resource-id") or ""
                clickable = el.get_attribute("clickable") == "true"
                if text and text not in seen and text not in SKIP_NAMES:
                    seen.add(text)
                    elements.append({
                        "type":      etype.split(".")[-1],
                        "class":     etype,
                        "name":      text,
                        "resource":  resource,
                        "clickable": clickable,
                    })
            except StaleElementReferenceException:
                continue

    except Exception:
        pass
    return elements


def find_tappable(driver) -> list[dict]:
    return [
        e for e in capture_elements(driver)
        if (e["clickable"] or e["class"] in TAPPABLE_TYPES)
        and e["name"] not in SKIP_NAMES
        and e["name"] not in BACK_NAMES
        and len(e["name"]) < 80
    ]


def _adb_tap_from_source(driver, name: str) -> bool:
    """
    Fallback: extrae bounds del page source y hace tap via ADB shell.
    Portado de appium-test/AUTOMATION_LESSONS.md — el.click() falla silenciosamente
    en MIUI y algunos dispositivos Samsung con GestureController activo.
    """
    try:
        src = driver.page_source
        for attr in [f'content-desc="{name}"', f'text="{name}"']:
            idx = src.find(attr)
            if idx == -1:
                continue
            tag_start = src.rfind("<", 0, idx)
            tag_end   = src.find(">", idx)
            if tag_start == -1 or tag_end == -1:
                continue
            tag = src[tag_start:tag_end + 1]
            import re as _re
            m = _re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
            if not m:
                continue
            x = (int(m.group(1)) + int(m.group(3))) // 2
            y = (int(m.group(2)) + int(m.group(4))) // 2
            driver.execute_script("mobile: shell", {"command": "input", "args": ["tap", str(x), str(y)]})
            time.sleep(TAP_WAIT)
            return True
    except Exception:
        pass
    return False


def try_tap(driver, name: str) -> bool:
    try:
        # Intentar por content-desc primero, luego por texto
        for strategy, value in [
            (AppiumBy.ACCESSIBILITY_ID, name),
            (AppiumBy.ANDROID_UIAUTOMATOR, f'new UiSelector().text("{name}")'),
        ]:
            try:
                el = driver.find_element(strategy, value)
                el.click()
                time.sleep(TAP_WAIT)
                return True
            except Exception:
                continue
        # Fallback ADB: más confiable en MIUI y Samsung con GestureController
        return _adb_tap_from_source(driver, name)
    except Exception:
        return False


def go_back(driver) -> bool:
    """En Android el botón Back del sistema siempre funciona."""
    try:
        driver.back()
        time.sleep(TAP_WAIT)
        return True
    except Exception:
        return False


def scroll_down(driver) -> bool:
    """Scroll hacia abajo usando UiAutomator2."""
    try:
        size = driver.get_window_size()
        w, h = size["width"], size["height"]
        driver.swipe(w // 2, int(h * 0.75), w // 2, int(h * 0.25), 800)
        time.sleep(1.2)
        return True
    except Exception:
        return False


def capture_all_elements(driver) -> list[dict]:
    """Captura elementos haciendo scroll hasta el final de la pantalla."""
    all_elements = []
    seen_names = set()

    for _ in range(MAX_SCROLLS):
        new_elements = capture_elements(driver)
        added = 0
        for el in new_elements:
            if el["name"] not in seen_names:
                seen_names.add(el["name"])
                all_elements.append(el)
                added += 1

        if added == 0:
            break  # no hay elementos nuevos — llegamos al final
        scroll_down(driver)

    return all_elements


# ── Screen Walker ─────────────────────────────────────────────────────────────

class ScreenWalker:
    def __init__(self, driver):
        self.driver         = driver
        self.screens: dict  = {}
        self.nav_graph: dict = {}
        self.bottom_bar: list = []
        self.visited_sigs: set = set()

    def _screen_label(self, trigger: str, depth: int) -> str:
        """Nombre descriptivo basado en el contenido actual."""
        try:
            # Buscar toolbar title o header
            els = self.driver.find_elements(
                AppiumBy.XPATH,
                "//*[@class='android.widget.TextView' and @text and string-length(@text) > 2]"
            )
            for el in els:
                text = el.get_attribute("text") or ""
                if text and text.isupper() and len(text) < 40:
                    candidate = text.lower().replace(" ", "_")
                    if candidate not in self.screens:
                        return candidate
        except Exception:
            pass
        base = trigger.lower().replace("tap:", "").replace(" ", "_")[:35]
        suffix = f"_{depth}" if base in self.screens else ""
        return base + suffix

    def _detect_bottom_bar(self) -> list[str]:
        """
        Detecta tabs de la barra de navegación inferior.
        Lección de AUTOMATION_LESSONS.md: en React Native los tabs usan content-desc,
        no text — hay que buscar en ambos atributos.
        """
        tabs = []
        seen = set()
        try:
            # Estrategia 1: BottomNavigationView / LinearLayout con tabs
            els = self.driver.find_elements(
                AppiumBy.XPATH,
                "//android.widget.LinearLayout[@resource-id]//android.widget.TextView"
            )
            for el in els[:6]:
                label = el.get_attribute("content-desc") or el.get_attribute("text") or ""
                if label and label not in SKIP_NAMES and label not in seen:
                    seen.add(label)
                    tabs.append(label)
        except Exception:
            pass

        if not tabs:
            try:
                # Estrategia 2: Buttons con content-desc en la parte inferior de la pantalla
                size = self.driver.get_window_size()
                bottom_y = size["height"] * 0.85
                els = self.driver.find_elements(AppiumBy.XPATH, "//android.widget.Button")
                for el in els:
                    try:
                        loc = el.location
                        if loc["y"] >= bottom_y:
                            label = el.get_attribute("content-desc") or el.get_attribute("text") or ""
                            if label and label not in SKIP_NAMES and label not in seen:
                                seen.add(label)
                                tabs.append(label)
                    except Exception:
                        continue
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

        # Capturar todos los elementos con scroll
        elements     = capture_all_elements(self.driver)
        actual_label = self._screen_label(trigger, depth)
        self.screens[actual_label] = {"trigger": trigger, "depth": depth, "elements": elements}
        self.nav_graph.setdefault(actual_label, [])

        indent = "  " * depth
        print(f"  {indent}📱 [{actual_label}] — {len(elements)} elementos")

        if depth == 0:
            self.bottom_bar = self._detect_bottom_bar()

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

            # Intentar volver: primero back, si falla tap al primer tab del bottom bar
            go_back(self.driver)
            time.sleep(TAP_WAIT)

            if screen_signature(self.driver) != pre_sig:
                # Back no funcionó — resetear vía primer tab del bottom bar
                if self.bottom_bar:
                    try_tap(self.driver, self.bottom_bar[0])
                    time.sleep(TAP_WAIT)
                # Si aún no volvimos, terminar esta rama
                if screen_signature(self.driver) != pre_sig:
                    break

    def _explore_bottom_bar(self):
        """Navega cada tab del bottom bar y lo mapea."""
        if not self.bottom_bar:
            return
        print(f"\n  📊 Explorando {len(self.bottom_bar)} tabs del bottom bar...")
        for tab in self.bottom_bar:
            if try_tap(self.driver, tab):
                time.sleep(TAP_WAIT)
                self._wait_for_load(timeout=8)
                self.explore(label=tab, trigger=f"tap_tab:{tab}", depth=1)

    def run(self) -> dict:
        print("\n🔍 Explorando la app Android...")
        self._wait_for_load()
        self.explore()
        self._explore_bottom_bar()
        return {
            "screens":          self.screens,
            "navigation_graph": self.nav_graph,
            "bottom_bar":       self.bottom_bar,
            "total_screens":    len(self.screens),
            "total_elements":   sum(len(s["elements"]) for s in self.screens.values()),
        }


# ── Conexión Appium ───────────────────────────────────────────────────────────

def connect_appium(package: str, activity: str, device_serial: str) -> webdriver.Remote:
    caps = {
        "platformName":                    "Android",
        "appium:automationName":           "UiAutomator2",
        "appium:deviceName":               device_serial,
        "appium:appPackage":               package,
        "appium:appActivity":              activity,
        "appium:noReset":                  True,
        "appium:newCommandTimeout":        120,
        "appium:adbExecTimeout":           60000,  # 60s — MIUI y dispositivos lentos necesitan más tiempo
        # DEC-01: crítico en apps con animaciones continuas
        "appium:waitForIdleTimeout":       0,
        "appium:waitForSelectorTimeout":   0,
        # Compatibilidad con MIUI y Android 11+ (de AUTOMATION_LESSONS.md del proyecto hermano)
        "appium:skipDeviceInitialization": True,
        "appium:ignoreHiddenApiPolicyError": True,
    }

    appium_url = os.environ.get("APPIUM_SERVER_URL", "http://localhost:4723")
    print(f"🔌 Conectando a Appium ({appium_url}) — device: {device_serial}...")

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

def run(app_id: str, package: str, activity: str, device_serial: str) -> None:
    print(f"\n{'═' * 60}")
    print(f"  Agente 0 Android — Explorador: {app_id}")
    print(f"  Package:  {package}")
    print(f"  Activity: {activity}")
    print(f"  Device:   {device_serial}")
    print(f"{'═' * 60}")

    driver = connect_appium(package, activity, device_serial)
    try:
        exploration = ScreenWalker(driver).run()
    finally:
        driver.quit()

    print(f"\n📊 Resultado:")
    print(f"   Pantallas:   {exploration['total_screens']}")
    print(f"   Elementos:   {exploration['total_elements']}")
    print(f"   Bottom bar:  {exploration['bottom_bar']}")

    app_dir = ROOT / "apps" / app_id
    app_dir.mkdir(parents=True, exist_ok=True)

    ui_map = {
        "app_id":       app_id,
        "platform":     "android",
        "package":      package,
        "activity":     activity,
        "device":       device_serial,
        "explored_at":  datetime.now(timezone.utc).isoformat(),
        "version":      "1.0.0",
        **exploration,
    }

    map_path = app_dir / "ui_map_android.json"
    map_path.write_text(json.dumps(ui_map, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ ui_map_android.json guardado en {map_path.relative_to(ROOT)}")
    print(f"\n👉 Siguiente paso: dile a Claude Code que analice apps/{app_id}/ui_map_android.json")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agente 0 Android — Explorador")
    parser.add_argument("--device", default=None, help="Serial ADB del dispositivo")
    args = parser.parse_args()

    app_id   = os.environ.get("APP_ID")
    package  = os.environ.get("APP_BUNDLE_ID") or os.environ.get("ANDROID_APP_PACKAGE")
    activity = os.environ.get("ANDROID_APP_ACTIVITY", "")
    device   = args.device or os.environ.get("ANDROID_DEVICE_NAME", "")

    if not app_id or not package:
        print("ERROR: APP_ID y APP_BUNDLE_ID (o ANDROID_APP_PACKAGE) son requeridos.")
        sys.exit(1)

    if not device:
        print("ERROR: --device <serial-adb> o ANDROID_DEVICE_NAME requerido.")
        sys.exit(1)

    run(app_id, package, activity, device)
