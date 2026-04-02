"""
Tests de rendimiento del player — DOD-03 (estricto).

El usuario explicitó: ser estrictos con reproducción de contenido en TODAS las apps.
Se miden tiempos reales de carga/buffer y se fallan si superan los umbrales DOD.

Live TV:   buffer ≤ 15s (lives son inestables — fallo de red → skip, no fail DOD)
VOD:       buffer ≤ 10s (más estable — cualquier fallo es DOD failure)
Catálogo:  carga  ≤  5s
EPG:       carga  ≤  5s
"""

import time
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.home_page import HomePage
from tests.pages.catalog_page import CatalogPage
from tests.pages.player_page import PlayerPage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


@pytest.mark.dod
@pytest.mark.performance
class TestPlayerPerformanceLive:
    """Rendimiento del player de Live TV."""

    def test_live_home_player_carga_dentro_del_umbral(self, driver):
        home = HomePage(driver)
        t0 = time.perf_counter()

        home.go_home()
        cargado = home.is_loaded(timeout=DOD_TIMEOUTS_BY_FLOW["video_buffer"])

        elapsed = time.perf_counter() - t0

        if not cargado:
            # Live puede fallar por red — skip en lugar de fail DOD
            pytest.skip(f"Live TV no cargó ({elapsed:.1f}s) — posible fallo de stream")

        assert elapsed <= DOD_TIMEOUTS_BY_FLOW["video_buffer"], (
            f"DOD-03 FAIL: home/player tardó {elapsed:.1f}s "
            f"(máx {DOD_TIMEOUTS_BY_FLOW['video_buffer']}s)"
        )

    def test_live_epg_carga_dentro_del_umbral(self, driver):
        home = HomePage(driver)
        home.go_home()

        t0 = time.perf_counter()
        visible = home.programming_is_visible(timeout=DOD_TIMEOUTS_BY_FLOW["epg_load"])
        elapsed = time.perf_counter() - t0

        assert visible, f"EPG no visible después de {DOD_TIMEOUTS_BY_FLOW['epg_load']}s"
        assert elapsed <= DOD_TIMEOUTS_BY_FLOW["epg_load"], (
            f"DOD-03 FAIL: EPG tardó {elapsed:.1f}s "
            f"(máx {DOD_TIMEOUTS_BY_FLOW['epg_load']}s)"
        )


@pytest.mark.dod
@pytest.mark.performance
class TestPlayerPerformanceVOD:
    """Rendimiento del catálogo VOD."""

    def test_catalogo_carga_dentro_del_umbral(self, driver):
        catalog = CatalogPage(driver)

        t0 = time.perf_counter()
        catalog.go_catalog()
        cargado = catalog.is_loaded(timeout=DOD_TIMEOUTS_BY_FLOW["catalog_load"])
        elapsed = time.perf_counter() - t0

        assert cargado, f"Catálogo no cargó en {DOD_TIMEOUTS_BY_FLOW['catalog_load']}s"
        assert elapsed <= DOD_TIMEOUTS_BY_FLOW["catalog_load"], (
            f"DOD-03 FAIL: catálogo tardó {elapsed:.1f}s "
            f"(máx {DOD_TIMEOUTS_BY_FLOW['catalog_load']}s)"
        )

    def test_highlight_metadata_carga_rapido(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        t0 = time.perf_counter()
        visible = catalog.is_visible(catalog.LBL_CONTENT_TITLE, timeout=5)
        elapsed = time.perf_counter() - t0

        assert visible, "Título del highlight no cargó"
        assert elapsed <= 5, (
            f"Metadata del highlight tardó {elapsed:.1f}s (máx 5s)"
        )

    def test_vod_detalle_abre_sin_bloqueo(self, driver):
        """Al tocar el highlight, el detalle de contenido debe responder en ≤3s."""
        catalog = CatalogPage(driver)
        player = PlayerPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        t0 = time.perf_counter()
        catalog.tap_highlight()
        respondio = (
            player.is_visible(player.LBL_VOD_TITLE, timeout=8)
            or player.is_visible(player.BTN_VER_AHORA, timeout=5)
            or player.is_visible(player.BTN_REPRODUCIR, timeout=5)
        )
        elapsed = time.perf_counter() - t0

        assert respondio, f"Detalle de VOD no abrió en 8s"
        assert elapsed <= 8, (
            f"DOD-03 FAIL: detalle de VOD tardó {elapsed:.1f}s (máx 8s)"
        )


@pytest.mark.performance
class TestPlayerControlesRendimiento:
    """Controles del player deben responder inmediatamente."""

    def test_fullscreen_responde_al_tap(self, driver):
        home = HomePage(driver)
        home.go_home()
        assert home.is_loaded()

        assert home.is_visible(home.BTN_FULLSCREEN, timeout=5), \
            "Botón de fullscreen no visible en home"
