"""
Credenciales de prueba — nunca hardcodear en los tests.
Los valores se cargan desde variables de entorno.
"""

import os

TEST_CREDENTIALS = {
    "email": {
        "email": os.environ.get("TEST_USER_EMAIL", ""),
        "password": os.environ.get("TEST_USER_PASSWORD", ""),
    },
    "sso": {
        "email": os.environ.get("TEST_SSO_EMAIL", ""),
        "password": os.environ.get("TEST_SSO_PASSWORD", ""),
    },
    "sso_expired_token": {
        "email": os.environ.get("TEST_SSO_EXPIRED_EMAIL", ""),
        "password": os.environ.get("TEST_SSO_EXPIRED_PASSWORD", ""),
    },
    "invalid": {
        "email": "invalid@test.invalid",
        "password": "wrong_password_123",
    },
}
