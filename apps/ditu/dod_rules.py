"""
DOD Timeouts — fuente de verdad centralizada para Ditu.
Nunca definir timeouts en los tests directamente.
Siempre importar desde aquí: from dod_rules import DOD_TIMEOUTS

─── Versioning ───────────────────────────────────────────────────────────────
Cada vez que cambies un timeout o criterio DOD, incrementa VERSION y agrega
una entrada al CHANGELOG.

─── Ditu: consideraciones especiales ────────────────────────────────────────
- DOD-02 no aplica (sin SSO por ahora).
- DOD-07 no aplica (sin paywall por ahora).
- DOD-03 (video): timeouts generosos porque los lives son inestables.
  El criterio DOD para live es "buffer iniciado" — si el stream no arranca
  por error de red transitorio, el test se marca como skip, no como fail DOD.
- DOD-06 = registro (no requiere confirmación de correo).
"""

VERSION = "1.0.0"

CHANGELOG = [
    {
        "version": "1.0.0",
        "date": "2026-04-01",
        "author": "julio",
        "changes": (
            "Versión inicial — generada tras exploración con Agent 0 (Ditu v2.3.0). "
            "Timeouts ajustados para live inestable (DOD-03 = 15s). "
            "Sin DOD-02 (SSO) ni DOD-07 (paywall)."
        ),
    },
]

# ── Timeouts por DOD ID (segundos) ────────────────────────────────────────────
DOD_TIMEOUTS = {
    "DOD-01": 8,    # Login email → selector perfiles
    "DOD-02": None, # N/A — sin SSO
    "DOD-03": 15,   # Buffer inicial de video (live es inestable → más margen)
    "DOD-04": 3,    # Resultados de búsqueda visibles
    "DOD-05": 5,    # Selector de perfiles cargado tras login
    "DOD-06": 30,   # Registro completo → selector perfiles (sin email confirmation)
    "DOD-07": None, # N/A — sin paywall todavía
    "DOD-08": 5,    # Logout → pantalla de login
    "DOD-09": None, # Modo offline — no aplica timeout
    "DOD-10": None, # Accesibilidad — no aplica timeout
}

# ── Aliases semánticos para uso en page objects y tests ───────────────────────
DOD_TIMEOUTS_BY_FLOW = {
    "login":            DOD_TIMEOUTS["DOD-01"],
    "video_buffer":     DOD_TIMEOUTS["DOD-03"],
    "video_buffer_vod": 10,   # VOD es más estable que live
    "search":           DOD_TIMEOUTS["DOD-04"],
    "profile_selector": DOD_TIMEOUTS["DOD-05"],
    "register":         DOD_TIMEOUTS["DOD-06"],
    "logout":           DOD_TIMEOUTS["DOD-08"],
    "offline":          DOD_TIMEOUTS["DOD-09"],
    "accessibility":    DOD_TIMEOUTS["DOD-10"],
    "epg_load":         5,    # EPG / programación visible
    "catalog_load":     5,    # Catálogo con carruseles
    "player_controls":  8,    # Controles del player visibles
}

DOD_TESTS = [
    "DOD-01", "DOD-03", "DOD-04", "DOD-05",
    "DOD-06", "DOD-08", "DOD-09", "DOD-10",
]

APP_VERSION = "2.3.0"
BUNDLE_ID   = "com.caracol.ditu"
