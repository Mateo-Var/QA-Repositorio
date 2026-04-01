"""
Tests E2E — Live TV (TVN EN VIVO)
Cubre: flujo Explorar → TVN EN VIVO → VER AHORA → player abre.
"""

import pytest
from pages.home_page import HomePage
from pages.explorar_page import ExplorarPage
from pages.live_page import LivePage


class TestLiveTV:
    def _navegar_a_live(self, driver):
        home = HomePage(driver)
        home.is_loaded()
        home.tap_explorar()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "Explorar no cargó"
        explorar.tap_tvn_en_vivo()

        return LivePage(driver)

    def test_live_tv_pantalla_carga_con_cta(self, driver):
        """Después de tap en TVN EN VIVO debe aparecer el botón VER AHORA."""
        live = self._navegar_a_live(driver)
        assert live.is_loaded(timeout=5), "El botón VER AHORA no apareció en 5s"

    def test_live_tv_tap_ver_ahora_abre_player(self, driver):
        """DOD-03 adjacente: tap VER AHORA inicia reproducción (player visible)."""
        live = self._navegar_a_live(driver)
        live.tap_ver_ahora()
        assert live.is_player_open(timeout=10), "El player no se abrió tras VER AHORA"

    def test_live_tv_tab_explorar_regresa_desde_player(self, driver):
        """Desde el player EPG, tap en tab Explorar regresa a la sección Explorar."""
        from pages.home_page import HomePage

        live = self._navegar_a_live(driver)
        live.tap_ver_ahora()

        assert live.is_player_open(timeout=10), "El player no se abrió"

        # El EPG no tiene botón VOLVER — se usa el tab bar
        home = HomePage(driver)
        home.tap_explorar()

        explorar = ExplorarPage(driver)
        assert explorar.is_loaded(timeout=5), "No volvió a Explorar desde el player"
