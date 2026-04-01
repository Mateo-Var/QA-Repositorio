"""Datos de prueba controlados — no usar datos de producción."""

SEARCH_QUERIES = {
    "valid": "Breaking Bad",
    "partial": "Break",
    "empty": "",
    "no_results": "xyzzy_no_existe_12345",
    "special_chars": "¿Quién?",
}

VIDEO_CONTENT = {
    "available": {
        "title": "Test Video — Available",
        "content_id": os.environ.get("TEST_CONTENT_ID_AVAILABLE", "test-content-001"),
    },
    "offline_only": {
        "title": "Test Video — Offline",
        "content_id": os.environ.get("TEST_CONTENT_ID_OFFLINE", "test-content-002"),
    },
}

PROFILES = {
    "adult": "Perfil Principal",
    "kids": "Perfil Infantil",
    "kids_pin": os.environ.get("TEST_KIDS_PIN", "0000"),
}

import os
