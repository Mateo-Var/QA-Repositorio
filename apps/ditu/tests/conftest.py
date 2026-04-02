"""
conftest.py — Fixtures globales de pytest — Ditu.

Estrategia de performance:
- `driver`    scope=session → una sola conexión WDA para toda la suite
- `reset_app` scope=class   → terminate + activate una vez por clase

Estrategia de resiliencia:
- Health check de Appium antes del run → restart automático si no responde
- Retry de sesión con backoff → cubre fallos transitorios de WDA
- WDA stuck recovery → fuerza reinstalación si el error es específico de WDA
- PiP dismissal → cierra Picture-in-Picture antes de terminate_app
"""

import os
import sys
import time
import subprocess
import requests
import pytest
from pathlib import Path
from appium import webdriver
from appium.options.common.base import AppiumOptions
from selenium.common.exceptions import WebDriverException

_TESTS_DIR = Path(__file__).parent
_APP_DIR   = _TESTS_DIR.parent
sys.path.insert(0, str(_TESTS_DIR))
sys.path.insert(0, str(_APP_DIR))

from fixtures.devices import DEVICES, DEFAULT_DEVICE

ROOT            = _APP_DIR.parent.parent  # Kit-Ott-Suite/
APP_ID          = os.environ.get("APP_ID", _APP_DIR.name)
BUNDLE_ID       = os.environ.get("APP_BUNDLE_ID", "com.caracol.ditu")
APPIUM_URL      = os.environ.get("APPIUM_SERVER_URL", "http://localhost:4723")
SCREENSHOTS_DIR = ROOT / "reports" / APP_ID / "screenshots"


# ── Helpers de infraestructura ────────────────────────────────────────────────

def _appium_is_alive() -> bool:
    try:
        r = requests.get(f"{APPIUM_URL}/status", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _restart_appium():
    print("\n[infra] Appium no responde — reiniciando...")
    subprocess.run(["pkill", "-f", "appium"], check=False)
    time.sleep(2)
    subprocess.Popen(
        ["appium"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(15):
        time.sleep(1)
        if _appium_is_alive():
            print("[infra] Appium listo.")
            return
    raise RuntimeError("Appium no levantó después de 15s")


def _dismiss_pip(driver) -> bool:
    """Cierra PiP si está activo. Llamar ANTES de terminate_app."""
    from appium.webdriver.common.appiumby import AppiumBy
    try:
        btn = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Stop Picture in Picture")
        btn.click()
        time.sleep(1)
        return True
    except Exception:
        return False


def _kill_wda_zombies():
    for proc in ("WebDriverAgentRunner", "xcodebuild", "iproxy"):
        subprocess.run(["pkill", "-f", proc], check=False)
    time.sleep(3)


def _create_session(caps: dict) -> webdriver.Remote:
    """
    Intento 1 — usePreinstalledWDA: True  (rápido)
    Intento 2 — mata zombies + rebuild WDA
    Intento 3 — restart Appium + rebuild WDA
    """
    strategies = [
        {"appium:usePreinstalledWDA": True,  "label": "WDA preinstalado"},
        {"appium:usePreinstalledWDA": False, "label": "rebuild WDA (kill zombies)"},
        {"appium:usePreinstalledWDA": False, "label": "rebuild WDA (restart Appium)"},
    ]
    last_error = None
    for attempt, strategy in enumerate(strategies, start=1):
        try:
            print(f"\n[infra] Intento {attempt}/3 — {strategy['label']}...")
            if attempt == 2:
                _kill_wda_zombies()
            elif attempt == 3:
                _restart_appium()
            attempt_caps = {**caps, **{k: v for k, v in strategy.items() if k != "label"}}
            opts = AppiumOptions()
            opts.load_capabilities(attempt_caps)
            d = webdriver.Remote(APPIUM_URL, options=opts)
            print(f"[infra] Sesión creada en intento {attempt}.")
            return d
        except WebDriverException as e:
            last_error = e
            print(f"[infra] Falló: {str(e)[:150]}")
            if attempt < len(strategies):
                time.sleep(5)
    raise last_error


# ── Fixtures ──────────────────────────────────────────────────────────────────

def pytest_addoption(parser):
    parser.addoption(
        "--device",
        action="store",
        default=DEFAULT_DEVICE,
        help="Dispositivo a usar (key en tests/fixtures/devices.py)",
    )


@pytest.fixture(scope="session", autouse=True)
def appium_server():
    if not _appium_is_alive():
        _restart_appium()
    yield


@pytest.fixture(scope="session")
def device_caps(request):
    device_key = request.config.getoption("--device")
    caps = DEVICES.get(device_key)
    if not caps:
        raise ValueError(
            f"Dispositivo desconocido: {device_key}. Opciones: {list(DEVICES.keys())}"
        )
    app_path = os.environ.get("APP_PATH", "")
    if app_path:
        caps["appium:app"] = app_path
    caps["appium:bundleId"] = BUNDLE_ID
    return caps


@pytest.fixture(scope="session")
def driver(appium_server, device_caps):
    d = _create_session(device_caps)
    yield d
    d.quit()


@pytest.fixture(scope="class", autouse=True)
def reset_app(driver):
    _dismiss_pip(driver)
    driver.terminate_app(BUNDLE_ID)
    driver.activate_app(BUNDLE_ID)
    yield


# ── Hooks ─────────────────────────────────────────────────────────────────────

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call" and rep.failed:
        drv = item.funcargs.get("driver")
        if drv:
            run_id = os.environ.get("QA_RUN_ID", "local")
            screenshot_dir = SCREENSHOTS_DIR / run_id
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            safe_name = item.name.replace("/", "_").replace("::", "__")
            path = screenshot_dir / f"{safe_name}.png"
            drv.save_screenshot(str(path))
