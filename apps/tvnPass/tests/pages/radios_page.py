"""Radios Page Object — sección RADIOS con estaciones de radio."""

from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class RadiosPage(BasePage):
    # Título de la sección
    TITULO_RADIOS = (AppiumBy.ACCESSIBILITY_ID, "ESTACIONES DE RADIO")

    # Estación principal disponible
    TVN_RADIO_CELL = (AppiumBy.XPATH, '//*[contains(@name, "TVN RADIO")]')

    # Botón volver
    BTN_VOLVER = (AppiumBy.ACCESSIBILITY_ID, "VOLVER")

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.TVN_RADIO_CELL, timeout=timeout)

    def tap_tvn_radio(self):
        self.tap(self.TVN_RADIO_CELL)

    def tap_volver(self):
        self.tap(self.BTN_VOLVER)
