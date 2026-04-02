"""
Credenciales de prueba — Ditu.
Los valores reales van en variables de entorno (nunca hardcodeados).
"""

import os

VALID_EMAIL    = os.environ.get("TEST_USER_EMAIL", "")
VALID_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "")

INVALID_EMAIL    = "usuario_inexistente@ditu-qa.com"
INVALID_PASSWORD = "ContraseñaIncorrecta123!"
