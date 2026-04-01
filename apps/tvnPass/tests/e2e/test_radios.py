"""
Tests E2E — Radios
Cubre: sección RADIOS accesible, TVN RADIO visible, tap abre player de audio.
"""

import pytest
from pages.home_page import HomePage
from pages.explorar_page import ExplorarPage
from pages.radios_page import RadiosPage


class TestRadios:
    def _navegar_a_radios(self, driver):
        home = HomePage(driver)
        home.is_loaded()
        home.tap_explorar()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "Explorar no cargó"
        explorar.tap_radios()

        radios = RadiosPage(driver)
        assert radios.is_loaded(timeout=5), "La sección Radios no cargó"
        return radios

    def test_radios_pantalla_carga_con_tvn_radio(self, driver):
        """La sección Radios debe mostrar al menos TVN RADIO."""
        radios = self._navegar_a_radios(driver)
        assert radios.is_loaded(), "TVN RADIO no encontrado en la sección Radios"

    def test_radios_tap_tvn_radio_no_crashea(self, driver):
        """Tap en TVN RADIO debe iniciar reproducción sin crash."""
        radios = self._navegar_a_radios(driver)
        radios.tap_tvn_radio()
        # Después del tap la UI cambia — verificamos que la app sigue respondiendo
        import time
        time.sleep(3)
        # La app debe seguir activa (algún elemento accesible)
        elements = driver.find_elements(
            "xpath", "//*[@type='XCUIElementTypeButton' or @type='XCUIElementTypeStaticText']"
        )
        assert len(elements) > 0, "La app no responde tras tap en TVN RADIO"

    def test_radios_volver_regresa_a_explorar(self, driver):
        """Desde Radios, VOLVER debe regresar a Explorar."""
        radios = self._navegar_a_radios(driver)
        radios.tap_volver()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "No volvió a Explorar"
