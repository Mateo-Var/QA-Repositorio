"""Register Page — registro con email/password. Sin confirmación de correo."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class RegisterPage(BasePage):
    # Fields
    TXT_EMAIL     = (AppiumBy.XPATH, '//*[@name="txt_email" or @label="Correo electrónico" or @label="Email"]')
    TXT_PASSWORD  = (AppiumBy.XPATH, '//*[@name="txt_password" or @label="Contraseña" or @label="Password"]')
    TXT_CONFIRM   = (AppiumBy.XPATH, '//*[@name="txt_confirm" or @label="Confirmar contraseña" or @label="Repetir contraseña"]')
    TXT_NAME      = (AppiumBy.XPATH, '//*[@name="txt_name" or @label="Nombre" or @label="Nombre completo"]')

    # Actions
    BTN_REGISTER  = (AppiumBy.XPATH, '//*[@name="btn_register" or @label="Registrarse" or @label="Crear cuenta"]')
    BTN_BACK      = (AppiumBy.XPATH, '//*[@name="VOLVER" or @name="Back" or @label="Atrás"]')

    # Error / validation
    LBL_ERROR     = (AppiumBy.XPATH, '//*[contains(@label,"ya está") or contains(@label,"inválido") or contains(@label,"error")]')

    def is_loaded(self, timeout=5) -> bool:
        return (
            self.is_visible(self.TXT_EMAIL, timeout=timeout)
            or self.is_visible(self.BTN_REGISTER, timeout=timeout)
        )

    def register(self, email: str, password: str, name: str = "QA Test"):
        """
        Completa el formulario de registro.
        Ditu no requiere confirmación de correo — el login es inmediato tras registro.
        """
        if self.is_visible(self.TXT_NAME, timeout=2):
            self.tap(self.TXT_NAME)
            self.type_text(self.TXT_NAME, name)

        self.tap(self.TXT_EMAIL)
        self.type_text(self.TXT_EMAIL, email)

        self.tap(self.TXT_PASSWORD)
        self.type_text(self.TXT_PASSWORD, password)

        if self.is_visible(self.TXT_CONFIRM, timeout=2):
            self.tap(self.TXT_CONFIRM)
            self.type_text(self.TXT_CONFIRM, password)

        self.dismiss_keyboard()
        self.tap(self.BTN_REGISTER)

    def dismiss_keyboard(self):
        try:
            self.driver.hide_keyboard()
        except Exception:
            pass

    def register_is_successful(self, timeout=None) -> bool:
        """Registro exitoso cuando la pantalla de registro desaparece."""
        t = timeout or DOD_TIMEOUTS_BY_FLOW["register"]
        return not self.is_visible(self.BTN_REGISTER, timeout=t)

    def error_is_visible(self, timeout=3) -> bool:
        return self.is_visible(self.LBL_ERROR, timeout=timeout)
