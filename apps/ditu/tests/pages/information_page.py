"""Information Page — cuenta, versión, logout (Tab btn_tbInformation)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class InformationPage(BasePage):
    # Tab
    TAB_INFORMATION = (AppiumBy.ACCESSIBILITY_ID, "btn_tbInformation")

    # Page identity
    LBL_TITLE       = (AppiumBy.ACCESSIBILITY_ID, "lbl_informationTitle")

    # Version
    CELL_VERSION    = (AppiumBy.ACCESSIBILITY_ID, "lbl_appVersion")
    LBL_VERSION_NUM = (AppiumBy.XPATH, '//*[contains(@label,"v2.") or contains(@label,"v3.")]')

    # Auth actions (unauthenticated)
    BTN_LOGIN       = (AppiumBy.XPATH, '//*[@label="Iniciar sesión"]')

    # Auth actions (authenticated)
    BTN_LOGOUT      = (AppiumBy.XPATH, '//*[@label="Cerrar sesión" or @name="btn_logout" or @label="Salir"]')

    # Sections
    LBL_PLATFORM    = (AppiumBy.XPATH, '//*[@label="Plataforma"]')

    def go_information(self):
        self.tap(self.TAB_INFORMATION)

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.LBL_TITLE, timeout=timeout)

    def is_unauthenticated(self, timeout=3) -> bool:
        return self.is_visible(self.BTN_LOGIN, timeout=timeout)

    def tap_login(self):
        self.tap(self.BTN_LOGIN)

    def tap_logout(self):
        self.tap(self.BTN_LOGOUT)

    def logout_is_successful(self, timeout=None) -> bool:
        """Logout exitoso cuando aparece "Iniciar sesión" en la pantalla de Información."""
        t = timeout or DOD_TIMEOUTS_BY_FLOW["logout"]
        return self.is_visible(self.BTN_LOGIN, timeout=t)

    def get_app_version(self) -> str:
        try:
            return self.get_text(self.LBL_VERSION_NUM)
        except Exception:
            return ""
