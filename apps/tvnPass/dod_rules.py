"""
DOD Timeouts — fuente de verdad centralizada para TVN Pass.
Nunca definir timeouts en los tests directamente.
Siempre importar desde aquí: from dod_rules import DOD_TIMEOUTS

─── Versioning ───────────────────────────────────────────────────────────────
Cada vez que cambies un timeout o criterio DOD, incrementa VERSION y agrega
una entrada al CHANGELOG. Esto permite diagnosticar regresiones: si un DOD
empieza a fallar, el historial revela si el timeout cambió recientemente.
"""

VERSION = "1.9.0"

CHANGELOG = [
    {
        "version": "1.0.0",
        "date": "2026-04-01",
        "author": "julio",
        "changes": "Versión inicial — timeouts base para TVN Pass Android físico (Samsung R5CTB1W92KY).",
    },
    {
        "version": "1.1.0",
        "date": "2026-04-01",
        "author": "julio",
        "changes": (
            "Agregado versioning y changelog. "
            "Sin cambio en valores de timeout — baseline establecido tras primer run 19/19."
        ),
    },
    {
        "version": "1.2.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "DOD-03 ajustado a 10s para dispositivo físico. Trigger para demo pipeline completo Fases 0-3.",
    },
    {
        "version": "1.3.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "DOD-03 corregido a 10s (valor correcto según changelog — estaba en 12s por error de demo).",
    },
    {
        "version": "1.4.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "DOD-04 ajustado a 3s — búsqueda requiere navegar al tab primero, 2s era insuficiente para red real.",
    },
    {
        "version": "1.5.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "Trigger PR — validar generacion de tests con UI map real + fix encoding utf-8.",
    },
    {
        "version": "1.6.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "Trigger PR — validar generacion de tests con UI map UTF-8 corregido.",
    },
    {
        "version": "1.7.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "Trigger PR — validar fix encoding write_text utf-8 en generacion de tests.",
    },
    {
        "version": "1.8.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "Trigger PR — validar maxInstances=1 + no afterEach + no-login rule.",
    },
    {
        "version": "1.9.0",
        "date": "2026-04-14",
        "author": "santi",
        "changes": "Trigger PR — validar fix JSON single quotes + retry en generacion.",
    },
]

# ── Timeouts por DOD ID (segundos) ────────────────────────────────────────────
DOD_TIMEOUTS = {
    "DOD-01": 5,    # Login email → home screen
    "DOD-02": 6,    # Login SSO → home screen
    "DOD-03": 10,   # Buffer inicial de video (físico necesita más margen que simulador)
    "DOD-04": 3,    # Resultados de búsqueda (tab Buscar + query + red)
    "DOD-05": 3,    # Selector de perfiles cargado
    "DOD-06": 60,   # Onboarding completo
    "DOD-07": 8,    # Confirmación de pago
    "DOD-08": 3,    # Logout → pantalla de login
    "DOD-09": None, # Modo offline — no aplica timeout
    "DOD-10": None, # Accesibilidad — no aplica timeout
}

# ── Aliases semánticos para uso en page objects y tests ───────────────────────
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

# DOD validado 2026-04-14 — trim fix en wdio.conf.js y generator_executor.py
