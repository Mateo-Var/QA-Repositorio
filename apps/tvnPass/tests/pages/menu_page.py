"""Menú Page Object — sidebar/menu con opciones legales y ayuda."""

from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class MenuPage(BasePage):
    # Ítems del menú (visible en modo anónimo)
    TERMINOS        = (AppiumBy.XPATH, '//*[@name="TÉRMINOS DE USO"]')
    PRIVACIDAD      = (AppiumBy.XPATH, '//*[@name="POLÍTICA DE PRIVACIDAD"]')
    AYUDA           = (AppiumBy.XPATH, '//*[@name="CENTRO DE AYUDA"]')

    # Opciones de autenticación (visibles solo si existen en esta versión)
    BTN_LOGIN       = (AppiumBy.XPATH, '//*[@name="INICIAR SESIÓN" or @name="LOGIN" or @name="ENTRAR"]')
    BTN_REGISTRO    = (AppiumBy.XPATH, '//*[@name="REGISTRARSE" or @name="CREAR CUENTA"]')

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.TERMINOS, timeout=timeout) or \
               self.is_visible(self.AYUDA, timeout=timeout)

    def has_login_option(self) -> bool:
        return self.is_visible(self.BTN_LOGIN, timeout=2)

    def tap_login(self):
        self.tap(self.BTN_LOGIN)

    def tap_terminos(self):
        self.tap(self.TERMINOS)

    def tap_ayuda(self):
        self.tap(self.AYUDA)
