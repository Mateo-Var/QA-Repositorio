"""Live TV Page Object — pantalla de TVN EN VIVO con botón VER AHORA."""

from appium.webdriver.common.appiumby import AppiumBy
from dod_rules import DOD_TIMEOUTS_BY_FLOW
from pages.base_page import BasePage


class LivePage(BasePage):
    # CTA principal
    BTN_VER_AHORA = (AppiumBy.ACCESSIBILITY_ID, "VER AHORA")

    # Indicador de señal en vivo en la guía de programación
    LABEL_EN_VIVO = (AppiumBy.XPATH, '//*[contains(@name, "EN VIVO")]')

    # Botón volver desde el player al catálogo
    BTN_VOLVER = (AppiumBy.ACCESSIBILITY_ID, "VOLVER")

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.BTN_VER_AHORA, timeout=timeout)

    def tap_ver_ahora(self):
        self.tap(self.BTN_VER_AHORA)

    def tap_volver(self):
        self.tap(self.BTN_VOLVER)

    # Indicador de player activo (elemento que aparece cuando la guía de programación carga)
    PLAYER_EN_VIVO = (AppiumBy.XPATH, '//*[@name="EN VIVO" and @type="XCUIElementTypeOther"]')
    PLAYER_PROGRAMACION = (AppiumBy.ACCESSIBILITY_ID, "Programación")

    def is_player_open(self, timeout=None) -> bool:
        """Verifica que el reproductor esté activo (guía EPG visible con indicador EN VIVO)."""
        t = timeout or DOD_TIMEOUTS_BY_FLOW["video_buffer"]
        return self.is_visible(self.PLAYER_EN_VIVO, timeout=t) or \
               self.is_visible(self.PLAYER_PROGRAMACION, timeout=t)
