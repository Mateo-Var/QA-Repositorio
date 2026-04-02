"""
Tests de registro — DOD-06.

Ditu NO requiere confirmación de correo → el login es inmediato tras registro.
Se generan cuentas únicas por run con timestamp para evitar conflictos.
"""

import time
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.pages.home_page import HomePage
from tests.pages.information_page import InformationPage
from tests.pages.login_page import LoginPage
from tests.pages.register_page import RegisterPage
from tests.pages.profile_selector_page import ProfileSelectorPage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


def _unique_email() -> str:
    """Genera un email único por run — evita conflictos de cuenta ya registrada."""
    ts = int(time.time())
    return f"qa_ditu_{ts}@test-ditu.com"


@pytest.mark.dod
class TestRegisterDOD06:
    """DOD-06: Registro completo → selector de perfiles sin crash."""

    def test_registro_cuenta_nueva_llega_a_selector_perfiles(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)
        register = RegisterPage(driver)
        profile = ProfileSelectorPage(driver)

        info.go_information()
        assert info.is_loaded()

        info.tap_login()
        assert login.is_loaded()

        login.tap_register()
        assert register.is_loaded(timeout=8), "Pantalla de registro no cargó"

        email = _unique_email()
        register.register(email=email, password="QaTest1234!")

        assert (
            profile.is_loaded(timeout=DOD_TIMEOUTS_BY_FLOW["register"])
        ), f"DOD-06 FAIL: selector de perfiles no apareció en {DOD_TIMEOUTS_BY_FLOW['register']}s"


class TestRegisterErrores:
    """Validaciones del formulario de registro."""

    def test_registro_email_ya_registrado_muestra_error(self, driver):
        """Requiere que TEST_USER_EMAIL esté ya registrado (cuenta de QA fija)."""
        import os
        existing_email = os.environ.get("TEST_USER_EMAIL", "")
        if not existing_email:
            pytest.skip("TEST_USER_EMAIL no configurado")

        info = InformationPage(driver)
        login = LoginPage(driver)
        register = RegisterPage(driver)

        info.go_information()
        info.tap_login()
        login.tap_register()
        assert register.is_loaded()

        register.register(email=existing_email, password="QaTest1234!")

        assert register.error_is_visible(timeout=5), \
            "Debería mostrar error para email ya registrado"

    def test_registro_sin_email_no_avanza(self, driver):
        info = InformationPage(driver)
        login = LoginPage(driver)
        register = RegisterPage(driver)

        info.go_information()
        info.tap_login()
        login.tap_register()
        assert register.is_loaded()

        # Intentar registrar sin email
        register.tap(register.BTN_REGISTER)

        assert register.is_loaded(timeout=3), \
            "Sin email debería permanecer en registro"
