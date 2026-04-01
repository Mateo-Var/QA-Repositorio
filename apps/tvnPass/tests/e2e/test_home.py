"""
Tests E2E — Pantalla de Inicio (Home)
Cubre: carruseles visibles, tab bar activo, navegación entre tabs.
"""

import pytest
from pages.home_page import HomePage


class TestHome:
    def test_home_carga_carruseles_tras_launch(self, driver):
        """DOD adjacente: home screen cargada con contenido visible."""
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded(timeout=8), "No apareció contenido en Home en 8s"

    def test_home_tab_inicio_seleccionado_por_defecto(self, driver):
        """El tab Inicio debe estar activo (value=1) tras navegar a él."""
        home = HomePage(driver)
        home.go_home()
        assert home.is_inicio_tab_selected(), "El tab Inicio no está seleccionado"

    def test_home_muestra_al_menos_un_carrusel(self, driver):
        """Debe haber contenido en la pantalla de inicio."""
        home = HomePage(driver)
        home.go_home()
        assert home.has_carousels(), "No se encontró ningún carrusel en Home"

    def test_home_tab_bar_muestra_cuatro_tabs(self, driver):
        """Los cuatro tabs deben ser accesibles desde cualquier pantalla."""
        home = HomePage(driver)
        for locator in [home.TAB_INICIO, home.TAB_EXPLORAR, home.TAB_BUSCAR, home.TAB_MENU]:
            assert home.is_visible(locator, timeout=3), f"Tab no encontrado: {locator[1]}"

    def test_home_navegacion_explorar_y_volver(self, driver):
        """Tap en Explorar → pantalla Explorar cargada → tap Inicio regresa a home."""
        from pages.explorar_page import ExplorarPage

        home = HomePage(driver)
        home.go_home()
        home.tap_explorar()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "La pantalla Explorar no cargó"

        home.tap_inicio()
        assert home.is_loaded(timeout=8), "Home no cargó tras volver desde Explorar"

    def test_home_navegacion_buscar_y_volver(self, driver):
        """Tap en Buscar → pantalla de búsqueda visible → volver a Home."""
        from pages.search_page import SearchPage

        home = HomePage(driver)
        home.go_home()
        home.tap_buscar()

        search = SearchPage(driver)
        assert search.is_loaded(timeout=5), "La pantalla de búsqueda no cargó"

        home.tap_inicio()
        assert home.is_loaded(timeout=8), "Home no cargó tras volver desde Buscar"
