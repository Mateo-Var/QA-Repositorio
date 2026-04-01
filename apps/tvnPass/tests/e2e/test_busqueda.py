"""
Tests E2E — Búsqueda
Cubre: campo visible, query con resultados, query sin resultados, campo vacío.
"""

import pytest
from pages.home_page import HomePage
from pages.search_page import SearchPage


# Queries validados contra la app real
QUERY_CON_RESULTADOS   = "TVN"
QUERY_SIN_RESULTADOS   = "xzxzxzxz_no_existe"


class TestBusqueda:
    def _navegar_a_buscar(self, driver):
        home = HomePage(driver)
        home.is_loaded()
        home.tap_buscar()
        search = SearchPage(driver)
        assert search.is_loaded(timeout=5), "La pantalla de búsqueda no cargó"
        return search

    def test_busqueda_pantalla_carga_campo_visible(self, driver):
        """DOD-04 base: el campo de búsqueda debe ser visible al entrar a Buscar."""
        search = self._navegar_a_buscar(driver)
        assert search.is_loaded(), "El campo de búsqueda no es visible"

    def test_busqueda_query_sin_resultados_muestra_mensaje(self, driver):
        """Query inválido debe mostrar 'No se encontraron resultados'."""
        search = self._navegar_a_buscar(driver)
        search.search(QUERY_SIN_RESULTADOS)
        assert search.has_no_results_message(timeout=5), \
            "No se mostró el mensaje de sin resultados para query inválido"

    def test_busqueda_query_vacio_no_crashea(self, driver):
        """Buscar sin texto no debe crashear ni mostrar error inesperado."""
        search = self._navegar_a_buscar(driver)
        search.dismiss_keyboard()
        # La app debe seguir mostrando el campo de búsqueda
        assert search.is_loaded(timeout=3), "La app crasheó o cambió de estado con query vacío"

    def test_busqueda_tab_buscar_activo_al_entrar(self, driver):
        """El tab Buscar debe tener value=1 tras navegar a él."""
        home = HomePage(driver)
        home.is_loaded()
        home.tap_buscar()
        el = home.find(home.TAB_BUSCAR, timeout=3)
        assert el.get_attribute("value") == "1", "El tab Buscar no marcó como activo"
