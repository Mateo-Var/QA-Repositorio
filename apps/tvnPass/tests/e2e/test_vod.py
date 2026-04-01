"""
Tests E2E — VOD / ON DEMAND
Cubre: sección ON DEMAND accesible, carruseles nativos cargados, volver a Explorar.

Hallazgo de exploración: ON DEMAND carga contenido nativo (no WebView) con secciones
"NOTICIAS", "EL MUNDIAL 2026 SE VIVE EN TVMAX", "¿QUIERES VER ALGO DIFERENTE?"
y botones "VER TODO" por sección.
"""

import pytest
from appium.webdriver.common.appiumby import AppiumBy
from pages.home_page import HomePage
from pages.explorar_page import ExplorarPage
from pages.base_page import BasePage


class TestVOD:
    # Secciones confirmadas en exploración real
    SECTION_NOTICIAS    = (AppiumBy.ACCESSIBILITY_ID, "NOTICIAS")
    SECTION_MUNDIAL     = (AppiumBy.ACCESSIBILITY_ID, "EL MUNDIAL 2026 SE VIVE EN TVMAX")
    BTN_VER_TODO        = (AppiumBy.XPATH, '//*[@name="VER TODO"]')
    BTN_VOLVER          = (AppiumBy.XPATH, '//*[@name="VOLVER"]')

    def _navegar_a_on_demand(self, driver):
        home = HomePage(driver)
        home.is_loaded()
        home.tap_explorar()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "Explorar no cargó"
        explorar.tap_on_demand()

    def test_on_demand_carga_con_seccion_noticias(self, driver):
        """ON DEMAND debe cargar con al menos la sección NOTICIAS visible."""
        self._navegar_a_on_demand(driver)
        base = BasePage(driver)
        assert base.is_visible(self.SECTION_NOTICIAS, timeout=8), \
            "La sección NOTICIAS no apareció en ON DEMAND"

    def test_on_demand_muestra_boton_ver_todo(self, driver):
        """Cada sección tiene un botón VER TODO para ver más contenido."""
        self._navegar_a_on_demand(driver)
        base = BasePage(driver)
        assert base.is_visible(self.BTN_VER_TODO, timeout=8), \
            "Ningún botón VER TODO encontrado en ON DEMAND"

    def test_on_demand_volver_regresa_a_explorar(self, driver):
        """VOLVER desde ON DEMAND regresa a Explorar."""
        self._navegar_a_on_demand(driver)
        base = BasePage(driver)
        assert base.is_visible(self.BTN_VOLVER, timeout=5), \
            "Botón VOLVER no encontrado en ON DEMAND"
        base.tap(self.BTN_VOLVER)

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "No volvió a Explorar tras VOLVER"
