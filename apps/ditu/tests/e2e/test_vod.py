"""
Tests de VOD — DOD-03 (reproducción).

El catálogo muestra movies, series y novelas.
El highlight hero es la entrada principal a contenido VOD.
Timeouts más estrictos que live (VOD es más estable).
"""

import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.catalog_page import CatalogPage
from tests.pages.player_page import PlayerPage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


@pytest.mark.dod
class TestVodDOD03:
    """DOD-03: Catálogo carga y contenido VOD es accesible."""

    def test_vod_catalogo_carga_con_contenido(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()

        assert catalog.is_loaded(
            timeout=DOD_TIMEOUTS_BY_FLOW["catalog_load"]
        ), f"DOD-03 FAIL: catálogo no cargó en {DOD_TIMEOUTS_BY_FLOW['catalog_load']}s"

    def test_vod_highlight_tiene_titulo_y_metadata(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        assert catalog.is_visible(catalog.LBL_CONTENT_TITLE, timeout=5), \
            "DOD-03 FAIL: título del highlight no visible"
        assert catalog.is_visible(catalog.LBL_CONTENT_TYPE, timeout=3), \
            "Tipo de contenido (Película/Serie) no visible"


class TestVodNavegacion:
    """Navegación y metadatos del catálogo VOD."""

    def test_vod_catalogo_muestra_carrusel_con_titulo(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        assert catalog.is_visible(catalog.LBL_CAROUSEL_TITLE, timeout=5), \
            "Título del carrusel no visible"

    def test_vod_highlight_tiene_año(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        assert catalog.is_visible(catalog.LBL_METADATA_YEAR, timeout=5), \
            "Año del contenido highlight no visible"

    def test_vod_highlight_tiene_genero(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        assert catalog.is_visible(catalog.LBL_GENRE, timeout=5), \
            "Género del contenido highlight no visible"

    def test_vod_poster_image_visible(self, driver):
        catalog = CatalogPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        assert catalog.is_visible(catalog.IMG_POSTER, timeout=5), \
            "Imagen de poster no visible en catálogo"

    def test_vod_highlight_es_tapeable(self, driver):
        catalog = CatalogPage(driver)
        player = PlayerPage(driver)
        catalog.go_catalog()
        assert catalog.is_loaded()

        titulo_original = catalog.highlight_title()
        catalog.tap_highlight()

        # Tras tap, debe mostrar detalle o player — no debe crashear
        assert (
            player.is_visible(player.LBL_VOD_TITLE, timeout=8)
            or player.is_visible(player.BTN_VER_AHORA, timeout=5)
            or player.is_visible(player.BTN_REPRODUCIR, timeout=5)
        ), f"Al tocar highlight '{titulo_original}' debería abrirse detalle o player"
