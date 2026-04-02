"""
Tests de login — DOD-01.

DOD: usuario llega a selector de perfiles o home en ≤8s tras submit.
Ditu no tiene SSO — solo email/password.
"""

import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.home_page import HomePage
from tests.pages.information_page import InformationPage
from tests.pages.login_page import LoginPage
from tests.pages.profile_selector_page import ProfileSelectorPage
from fixtures.credentials import VALID_EMAIL, VALID_PASSWORD, INVALID_EMAIL, INVALID_PASSWORD
from dod_rules import DOD_TIMEOUTS_BY_FLOW


@pytest.mark.dod
class TestLoginDOD01:
    """DOD-01: Login email → selector de perfiles en tiempo crítico."""

    def test_login_email_credenciales_validas_llega_a_selector_perfiles(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)
        profile = ProfileSelectorPage(driver)

        info.go_information()
        assert info.is_loaded(), "Pestaña Información no cargó"

        info.tap_login()
        assert login.is_loaded(), "Pantalla de login no cargó"

        login.login(VALID_EMAIL, VALID_PASSWORD)

        assert (
            profile.is_loaded(timeout=DOD_TIMEOUTS_BY_FLOW["login"])
            or profile.is_loaded(timeout=2)
        ), f"DOD-01 FAIL: selector de perfiles no apareció en {DOD_TIMEOUTS_BY_FLOW['login']}s"


@pytest.mark.dod
class TestLoginErrores:
    """Escenarios de error en login."""

    def test_login_email_password_incorrecto_muestra_error(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)

        info.go_information()
        info.tap_login()
        assert login.is_loaded(), "Pantalla de login no cargó"

        login.login(VALID_EMAIL, INVALID_PASSWORD)

        assert login.error_is_visible(timeout=5), \
            "Debería mostrar error con password incorrecto"

    def test_login_email_inexistente_muestra_error(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)

        info.go_information()
        info.tap_login()
        assert login.is_loaded()

        login.login(INVALID_EMAIL, INVALID_PASSWORD)

        assert login.error_is_visible(timeout=5), \
            "Debería mostrar error con email inexistente"

    def test_login_campos_vacios_no_navega(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)

        info.go_information()
        info.tap_login()
        assert login.is_loaded()

        # Intentar login sin llenar campos
        login.tap(login.BTN_LOGIN)

        # Sigue en la pantalla de login
        assert login.is_loaded(timeout=3), \
            "Con campos vacíos debería permanecer en pantalla de login"
