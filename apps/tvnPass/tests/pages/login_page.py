"""Login Page Object.

Nota: TVN Pass usa autenticación SSO — no hay formulario de email/password nativo
visible en modo anónimo. Este PO modela el flujo SSO vía WebView.
"""

from appium.webdriver.common.appiumby import AppiumBy
from dod_rules import DOD_TIMEOUTS_BY_FLOW
from pages.base_page import BasePage


class LoginPage(BasePage):
    # Botones de login (SSO — se abren como WebView/Safari)
    BTN_LOGIN_SSO    = (AppiumBy.XPATH, '//*[@name="Iniciar sesión" or @name="LOGIN" or @name="Entrar"]')

    # WebView SSO — campos dentro del navegador embebido
    SSO_EMAIL_FIELD  = (AppiumBy.XPATH, '//XCUIElementTypeTextField')
    SSO_PASS_FIELD   = (AppiumBy.XPATH, '//XCUIElementTypeSecureTextField')
    SSO_SUBMIT       = (AppiumBy.XPATH, '//*[@name="Continuar" or @name="Aceptar" or @name="Submit"]')

    # Confirmación de home tras login
    HOME_INDICATOR   = (AppiumBy.ACCESSIBILITY_ID, "Inicio")

    def tap_sso_button(self):
        self.tap(self.BTN_LOGIN_SSO)

    def complete_sso_flow(self, email: str, password: str):
        self.type_text(self.SSO_EMAIL_FIELD, email)
        self.type_text(self.SSO_PASS_FIELD, password)
        self.tap(self.SSO_SUBMIT)

    def is_home_visible(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["login"]
        return self.is_visible(self.HOME_INDICATOR, timeout=t)
