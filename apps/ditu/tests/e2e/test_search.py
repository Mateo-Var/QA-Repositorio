"""
Tests de búsqueda — DOD-04.

DOD: resultados visibles en ≤3s tras enviar query.
La búsqueda tiene barra y un CollectionView (car_catalog) para resultados.
"""

import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.search_page import SearchPage
from tests.pages.home_page import HomePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


@pytest.mark.dod
class TestSearchDOD04:
    """DOD-04: Resultados visibles tras query en tiempo crítico."""

    def test_busqueda_query_valido_muestra_resultados(self, driver):
        search = SearchPage(driver)
        search.go_search()
        assert search.is_loaded(), "Pantalla de búsqueda no cargó"

        search.type_query("Caracol")
        search.dismiss_keyboard()

        assert search.results_are_visible(
            timeout=DOD_TIMEOUTS_BY_FLOW["search"]
        ), f"DOD-04 FAIL: resultados no visibles en {DOD_TIMEOUTS_BY_FLOW['search']}s"


class TestSearchNavegacion:
    """Funcionalidad de búsqueda."""

    def test_busqueda_pantalla_carga_con_barra(self, driver):
        search = SearchPage(driver)
        search.go_search()
        assert search.is_loaded(), "Barra de búsqueda no visible"

    def test_busqueda_icono_search_visible(self, driver):
        search = SearchPage(driver)
        search.go_search()
        assert search.is_visible(search.ICN_SEARCH, timeout=5), \
            "Ícono de búsqueda no visible"

    def test_busqueda_query_novela_muestra_resultados(self, driver):
        search = SearchPage(driver)
        search.go_search()
        assert search.is_loaded()

        search.type_query("novela")
        search.dismiss_keyboard()

        assert search.results_are_visible(timeout=5), \
            "Búsqueda de 'novela' debería mostrar resultados"

    def test_busqueda_query_deportes_muestra_resultados(self, driver):
        search = SearchPage(driver)
        search.go_search()
        assert search.is_loaded()

        search.type_query("deportes")
        search.dismiss_keyboard()

        assert search.results_are_visible(timeout=5), \
            "Búsqueda de 'deportes' debería mostrar resultados"

    def test_busqueda_y_volver_home_no_crashea(self, driver):
        search = SearchPage(driver)
        home = HomePage(driver)

        search.go_search()
        assert search.is_loaded()

        search.type_query("Caracol")
        search.dismiss_keyboard()

        home.go_home()
        assert home.is_loaded(timeout=8), \
            "Después de búsqueda, home debe cargar sin crash"
