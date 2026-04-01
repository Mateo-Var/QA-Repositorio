"""Explorar Page Object — sección con RADIOS, ON DEMAND, PROGRAMACIÓN, TVN EN VIVO."""

from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class ExplorarPage(BasePage):
    # Header de sección
    TITULO_EXPLORAR = (AppiumBy.ACCESSIBILITY_ID, "EXPLORAR CONTENIDO")

    # Ítems de navegación (XCUIElementTypeOther — no son Buttons)
    ITEM_RADIOS        = (AppiumBy.XPATH, '//*[@name="RADIOS"]')
    ITEM_ON_DEMAND     = (AppiumBy.XPATH, '//*[@name="ON DEMAND"]')
    ITEM_PROGRAMACION  = (AppiumBy.XPATH, '//*[@name="PROGRAMACIÓN"]')
    ITEM_TVN_EN_VIVO   = (AppiumBy.XPATH, '//*[@name="TVN EN VIVO"]')

    # Versión de app (StaticText — útil para smoke checks)
    VERSION_TEXT = (AppiumBy.XPATH, '//*[contains(@name, "VERSION")]')

    def is_loaded(self, timeout=5) -> bool:
        # "EXPLORAR CONTENIDO" aparece en primera carga; fallback a cualquier ítem de la sección
        return self.is_visible(self.TITULO_EXPLORAR, timeout=timeout) or \
               self.is_visible(self.ITEM_TVN_EN_VIVO, timeout=timeout)

    def tap_radios(self):
        self.tap(self.ITEM_RADIOS)

    def tap_on_demand(self):
        self.tap(self.ITEM_ON_DEMAND)

    def tap_programacion(self):
        self.tap(self.ITEM_PROGRAMACION)

    def tap_tvn_en_vivo(self):
        self.tap(self.ITEM_TVN_EN_VIVO)

    def get_app_version(self) -> str:
        try:
            return self.find(self.VERSION_TEXT, timeout=3).get_attribute("name")
        except Exception:
            return ""
