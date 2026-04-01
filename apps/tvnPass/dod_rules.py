"""
DOD Timeouts — fuente de verdad centralizada.
Nunca definir timeouts en los tests directamente.
Siempre importar desde aquí: from dod_rules import DOD_TIMEOUTS
"""

DOD_TIMEOUTS = {
    "DOD-01": 5,   # Login email → home screen
    "DOD-02": 6,   # Login SSO → home screen
    "DOD-03": 3,   # Buffer inicial de video
    "DOD-04": 2,   # Resultados de búsqueda
    "DOD-05": 3,   # Selector de perfiles cargado
    "DOD-06": 60,  # Onboarding completo
    "DOD-07": 8,   # Confirmación de pago
    "DOD-08": 3,   # Logout → pantalla de login
    "DOD-09": None,  # Modo offline — no aplica timeout
    "DOD-10": None,  # Accesibilidad — no aplica timeout
}

# Aliases semánticos para uso en tests
DOD_TIMEOUTS_BY_FLOW = {
    "login":            DOD_TIMEOUTS["DOD-01"],
    "login_sso":        DOD_TIMEOUTS["DOD-02"],
    "video_buffer":     DOD_TIMEOUTS["DOD-03"],
    "search":           DOD_TIMEOUTS["DOD-04"],
    "profile_selector": DOD_TIMEOUTS["DOD-05"],
    "onboarding":       DOD_TIMEOUTS["DOD-06"],
    "payment":          DOD_TIMEOUTS["DOD-07"],
    "logout":           DOD_TIMEOUTS["DOD-08"],
    "offline":          DOD_TIMEOUTS["DOD-09"],
    "accessibility":    DOD_TIMEOUTS["DOD-10"],
}

DOD_TESTS = [
    "DOD-01", "DOD-02", "DOD-03", "DOD-04", "DOD-05",
    "DOD-06", "DOD-07", "DOD-08", "DOD-09", "DOD-10",
]
