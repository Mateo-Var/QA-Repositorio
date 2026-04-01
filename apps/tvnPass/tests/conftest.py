"""
conftest.py — Fixtures globales de pytest.
- Inicializa el driver de Appium.
- Captura screenshot automática en cada fallo.
- Graba video si la suite tiene más de 5 tests.
"""

import os
import sys
import pytest
from datetime import datetime, timezone
from pathlib import Path
from appium import webdriver
from appium.options.common.base import AppiumOptions

# Permite importar desde tests/ (fixtures, pages) y desde app root (dod_rules)
_TESTS_DIR = Path(__file__).parent
_APP_DIR = _TESTS_DIR.parent
sys.path.insert(0, str(_TESTS_DIR))
sys.path.insert(0, str(_APP_DIR))

from fixtures.devices import DEVICES, DEFAULT_DEVICE

ROOT = _APP_DIR.parent.parent  # Kit-Ott-Suite/
APP_ID = os.environ.get("APP_ID", _APP_DIR.name)
SCREENSHOTS_DIR = ROOT / "reports" / APP_ID / "screenshots"
VIDEOS_DIR = ROOT / "reports" / APP_ID / "videos"


def pytest_addoption(parser):
    parser.addoption(
        "--device",
        action="store",
        default=DEFAULT_DEVICE,
        help="Dispositivo a usar (key en tests/fixtures/devices.py)",
    )


@pytest.fixture(scope="session")
def device_caps(request):
    device_key = request.config.getoption("--device")
    caps = DEVICES.get(device_key)
    if not caps:
        raise ValueError(f"Dispositivo desconocido: {device_key}. Opciones: {list(DEVICES.keys())}")
    app_path = os.environ.get("APP_PATH", "")
    if app_path:
        caps["appium:app"] = app_path
    caps["appium:bundleId"] = os.environ.get("APP_BUNDLE_ID", "com.tvn-2.appletv")
    return caps


@pytest.fixture
def driver(device_caps):
    appium_url = os.environ.get("APPIUM_SERVER_URL", "http://localhost:4723")
    opts = AppiumOptions()
    opts.load_capabilities(device_caps)
    d = webdriver.Remote(appium_url, options=opts)
    yield d
    d.quit()


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" and rep.failed:
        driver = item.funcargs.get("driver")
        if driver:
            run_id = os.environ.get("QA_RUN_ID", "local")
            screenshot_dir = SCREENSHOTS_DIR / run_id
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            safe_name = item.name.replace("/", "_").replace("::", "__")
            path = screenshot_dir / f"{safe_name}.png"
            driver.save_screenshot(str(path))
