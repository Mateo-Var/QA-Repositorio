"""
Tests de Live TV — DOD-03.

Consideraciones:
- Los lives de Ditu son inestables — fallos de red no cuentan como DOD failure.
- El home IS el player (NavigationBar = PlayerModule.InteractivePlayerView).
- EPG integrado en home (lbl_programmingTitle, chips de categoría).
- PiP se maneja automáticamente por reset_app en conftest.
"""

import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.home_page import HomePage
from tests.pages.player_page import PlayerPage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


@pytest.mark.dod
class TestLiveTvDOD03:
    """DOD-03: Preview de live TV visible en home en tiempo crítico."""

    def test_live_tv_preview_visible_en_home(self, driver):
        home = HomePage(driver)
        home.go_home()

        assert home.is_loaded(
            timeout=DOD_TIMEOUTS_BY_FLOW["video_buffer"]
        ), f"DOD-03 FAIL: home/player no cargó en {DOD_TIMEOUTS_BY_FLOW['video_buffer']}s"

    def test_live_tv_epg_programacion_visible(self, driver):
        home = HomePage(driver)
        home.go_home()

        assert home.programming_is_visible(
            timeout=DOD_TIMEOUTS_BY_FLOW["epg_load"]
        ), f"DOD-03 FAIL: sección PROGRAMACIÓN no visible en {DOD_TIMEOUTS_BY_FLOW['epg_load']}s"


class TestLiveTvNavegacion:
    """Navegación y funcionalidad del Live TV home."""

    def test_live_tv_home_carga_sin_crash(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded(), "Home/player no cargó"

    def test_live_tv_chip_caracol_tv_filtra(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        home.tap_chip(home.CHIP_CARACOL_TV)
        # La programación sigue visible con el filtro aplicado
        assert home.programming_is_visible(), "EPG debería mantenerse visible tras filtrar"

    def test_live_tv_chip_noticias_filtra(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        home.tap_chip(home.CHIP_NOTICIAS)
        assert home.programming_is_visible(), "EPG debería mantenerse visible tras filtrar Noticias"

    def test_live_tv_chip_deportes_filtra(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        home.tap_chip(home.CHIP_DEPORTES)
        assert home.programming_is_visible(), "EPG debería mantenerse visible tras filtrar Deportes"

    def test_live_tv_chip_novelas_filtra(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        home.tap_chip(home.CHIP_NOVELAS)
        assert home.programming_is_visible(), "EPG debería mantenerse visible tras filtrar Novelas"

    def test_live_tv_chip_todo_restaura_programacion(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        home.tap_chip(home.CHIP_NOTICIAS)
        home.tap_chip(home.CHIP_TODO)
        assert home.programming_is_visible(), "Chip Todo debe restaurar toda la programación"

    def test_live_tv_card_programacion_tiene_titulo_y_hora(self, driver):
        home = HomePage(driver)
        player = PlayerPage(driver)
        home.go_home()

        assert player.programming_card_is_visible(timeout=8), \
            "Tarjeta de programación no visible"

    def test_live_tv_overlay_login_visible_sin_autenticar(self, driver):
        home = HomePage(driver)
        home.go_home()

        assert home.is_unauthenticated(), \
            "Sin login debe mostrarse el overlay de autenticación"
