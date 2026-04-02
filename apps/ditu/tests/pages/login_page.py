"""Login Page — email/password (sin SSO)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class LoginPage(BasePage):
    # Fields
    TXT_EMAIL    = (AppiumBy.XPATH, '//*[@name="txt_email" or @name="email" or @label="Correo electrónico" or @label="Email"]')
    TXT_PASSWORD = (AppiumBy.XPATH, '//*[@name="txt_password" or @name="password" or @label="Contraseña" or @label="Password"]')

    # Actions
    BTN_LOGIN    = (AppiumBy.XPATH, '//*[@name="btn_login" or @name="Iniciar sesión" or @label="Iniciar sesión"]')
    BTN_REGISTER = (AppiumBy.XPATH, '//*[@name="btn_register" or @name="Registrarse" or @label="Registrarse" or @name="Crear cuenta"]')
    BTN_FORGOT   = (AppiumBy.XPATH, '//*[@name="btn_forgot" or @label="¿Olvidaste tu contraseña?" or @label="Olvidé mi contraseña"]')

    # Error state
    LBL_ERROR    = (AppiumBy.XPATH, '//*[@name="lbl_error" or contains(@label,"incorrecto") or contains(@label,"inválido") or contains(@label,"no existe")]')

    # Page identity
    LBL_TITLE    = (AppiumBy.XPATH, '//*[@label="Iniciar sesión" and @type="XCUIElementTypeStaticText"]')

    def is_loaded(self, timeout=5) -> bool:
        return (
            self.is_visible(self.TXT_EMAIL, timeout=timeout)
            or self.is_visible(self.BTN_LOGIN, timeout=timeout)
        )

    def login(self, email: str, password: str):
        self.tap(self.TXT_EMAIL)
        self.type_text(self.TXT_EMAIL, email)
        self.tap(self.TXT_PASSWORD)
        self.type_text(self.TXT_PASSWORD, password)
        self.dismiss_keyboard()
        self.tap(self.BTN_LOGIN)

    def dismiss_keyboard(self):
        try:
            self.driver.hide_keyboard()
        except Exception:
            pass

    def login_is_successful(self, timeout=None) -> bool:
        """Login exitoso cuando la pantalla de login desaparece."""
        t = timeout or DOD_TIMEOUTS_BY_FLOW["login"]
        return not self.is_visible(self.TXT_EMAIL, timeout=t)

    def error_is_visible(self, timeout=3) -> bool:
        return self.is_visible(self.LBL_ERROR, timeout=timeout)

    def tap_register(self):
        self.tap(self.BTN_REGISTER)

    def tap_forgot_password(self):
        self.tap(self.BTN_FORGOT)
