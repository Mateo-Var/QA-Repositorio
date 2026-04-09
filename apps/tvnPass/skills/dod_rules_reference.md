"""
apps/tvn_pass/dod_rules.py

Definition of Done para TVN Pass.
Importado por ambos agentes al iniciar cualquier run con APP_ID=tvn_pass.

Reglas que NUNCA pueden fallar. Si alguna falla, el run se detiene
y se bloquea el pipeline sin excepción.

Para modificar un timeout o criterio: editar aquí.
Nunca hardcodear valores en los tests directamente.
"""

# ---------------------------------------------------------------------------
# Timeouts críticos (en segundos)
# Basados en el comportamiento conocido de TVN Pass Android (Samsung físico)
# ---------------------------------------------------------------------------

DOD_TIMEOUTS = {

    # Home y navegación
    "home_load":              6,   # splash → home screen visible
    "carousel_load":          4,   # primer carousel visible con contenidos
    "thumbnail_load":         3,   # imagen de thumbnail visible en carousel

    # Reproductor VOD
    "ad_preroll_start":       8,   # tiempo máximo para que el pre-roll inicie
    "ad_preroll_max":        35,   # duración máxima aceptable del pre-roll
    "content_start_after_ad": 5,   # tiempo máximo entre fin del ad y inicio del contenido
    "player_controls_appear": 3,   # controles visibles al tocar la pantalla
    "player_fullscreen":      2,   # transición a pantalla completa

    # Live TV
    "live_stream_start":     10,   # tiempo máximo para que la señal en vivo inicie
    # Nota: el delay de 20-40s respecto al broadcast es esperado — no es timeout
    # live_tv_signal_delay no es un criterio DOD, es comportamiento normal

    # Búsqueda
    "search_results":         3,   # resultados visibles tras query con debounce (400ms incluido)
    "search_keyboard":        2,   # teclado visible tras tap en campo de búsqueda

    # Podcasts
    "podcast_player_load":    4,   # player de audio visible y listo
    "podcast_background":     5,   # audio continúa tras salir de la app (verificar en background)

    # Login
    "login_success":          8,   # home visible tras login exitoso
    "login_error_message":    3,   # mensaje de error visible tras credenciales inválidas

    # Navegación general
    "screen_transition":      2,   # transición entre pantallas
    "back_navigation":        2,   # volver a pantalla anterior
}

# ---------------------------------------------------------------------------
# DOD — criterios que nunca pueden fallar
# Si cualquiera de estos falla → run detenido → pipeline bloqueado
# ---------------------------------------------------------------------------

DOD_RULES = {

    "DOD-01": {
        "id":          "DOD-01",
        "flow":        "home_load",
        "description": "Home screen carga con al menos un carousel visible",
        "timeout":     DOD_TIMEOUTS["home_load"],
        "test":        "test_home_carga_carousel_visible",
        "requires_login": False,
        "notes":       "Sin login debe cargar igualmente con contenido gratuito",
    },

    "DOD-02": {
        "id":          "DOD-02",
        "flow":        "vod_playback",
        "description": "Reproductor VOD inicia contenido después del pre-roll",
        "timeout":     DOD_TIMEOUTS["ad_preroll_start"] + DOD_TIMEOUTS["ad_preroll_max"] + DOD_TIMEOUTS["content_start_after_ad"],
        "test":        "test_vod_preroll_y_contenido_inician",
        "requires_login": False,
        "notes": (
            "El pre-roll es obligatorio — no fallar por su presencia. "
            "Fallar si: el pre-roll no inicia, dura más de 35s, "
            "o el contenido no inicia después del ad."
        ),
    },

    "DOD-03": {
        "id":          "DOD-03",
        "flow":        "live_tv",
        "description": "Señal en vivo de TVN inicia dentro del timeout",
        "timeout":     DOD_TIMEOUTS["live_stream_start"],
        "test":        "test_live_tv_senal_inicia",
        "requires_login": False,
        "notes": (
            "El delay de 20-40s respecto al broadcast real es ESPERADO — no es fallo. "
            "Fallar solo si la señal no inicia en absoluto. "
            "En horario 00:00-06:00 hora Chile la señal puede ser pantalla negra — no es crash."
        ),
    },

    "DOD-04": {
        "id":          "DOD-04",
        "flow":        "search",
        "description": "Búsqueda retorna resultados para query conocido",
        "timeout":     DOD_TIMEOUTS["search_results"],
        "test":        "test_busqueda_retorna_resultados",
        "requires_login": False,
        "query":       "telediario",   # usar siempre TEST_CONTENT["search_query"]
        "notes":       "Sin resultados debe mostrar sugerencias editoriales, no pantalla vacía",
    },

    "DOD-05": {
        "id":          "DOD-05",
        "flow":        "podcast_playback",
        "description": "Reproductor de podcast inicia y controles son visibles",
        "timeout":     DOD_TIMEOUTS["podcast_player_load"],
        "test":        "test_podcast_player_inicia",
        "requires_login": False,
        "notes":       "Verificar controles de velocidad (0.5x, 1x, 1.5x, 2x) visibles",
    },

    "DOD-06": {
        "id":          "DOD-06",
        "flow":        "login",
        "description": "Login con email lleva al home con sesión activa",
        "timeout":     DOD_TIMEOUTS["login_success"],
        "test":        "test_login_email_happy_path",
        "requires_login": True,
        "notes":       "Usar credenciales de TEST_USERS['standard'] — nunca credenciales reales",
    },

    "DOD-07": {
        "id":          "DOD-07",
        "flow":        "navigation",
        "description": "Navegación entre secciones principales no produce crash",
        "timeout":     DOD_TIMEOUTS["screen_transition"] * 5,  # 5 transiciones
        "test":        "test_navegacion_secciones_principales",
        "requires_login": False,
        "sequence":    ["home", "live", "busqueda", "podcasts", "home"],
        "notes":       "Recorre todas las secciones del tab bar y vuelve a home",
    },

    "DOD-08": {
        "id":          "DOD-08",
        "flow":        "ad_failure_fallback",
        "description": "Si el ad falla, el contenido inicia de todos modos",
        "timeout":     10,  # 5s de espera del fallback + margen
        "test":        "test_ad_falla_contenido_inicia_igual",
        "requires_login": False,
        "notes": (
            "Simular falla de ad cortando red durante pre-roll. "
            "El contenido debe iniciar dentro de 5s tras la falla del ad. "
            "Este es un DOD crítico de experiencia de usuario."
        ),
    },

    "DOD-09": {
        "id":          "DOD-09",
        "flow":        "offline_graceful",
        "description": "App no crashea al perder conexión durante navegación",
        "timeout":     4,
        "test":        "test_offline_no_crash_en_navegacion",
        "requires_login": False,
        "notes": (
            "Cortar conexión mientras el usuario navega el catálogo. "
            "Debe mostrar mensaje de sin conexión — no pantalla en blanco ni crash. "
            "El contenido cacheado (últimas 24h) debe seguir visible."
        ),
    },

    "DOD-10": {
        "id":          "DOD-10",
        "flow":        "player_controls",
        "description": "Controles del reproductor responden al toque",
        "timeout":     DOD_TIMEOUTS["player_controls_appear"],
        "test":        "test_player_controles_responden",
        "requires_login": False,
        "notes": (
            "Tocar pantalla durante reproducción — controles deben aparecer en < 3s. "
            "Play/pause debe responder. "
            "Double tap avanza/retrocede 10s."
        ),
    },
}

# ---------------------------------------------------------------------------
# Orden de ejecución del DOD
# Los agentes siguen este orden exacto — no modificar sin análisis de impacto
# ---------------------------------------------------------------------------

DOD_EXECUTION_ORDER = [
    "DOD-01",   # home primero — si no carga nada, el resto no tiene sentido
    "DOD-06",   # login antes de cualquier flujo autenticado
    "DOD-02",   # VOD + ads — flujo de negocio principal
    "DOD-03",   # live TV
    "DOD-04",   # búsqueda
    "DOD-05",   # podcasts
    "DOD-07",   # navegación
    "DOD-08",   # fallback de ads
    "DOD-09",   # offline
    "DOD-10",   # controles del player
]

# ---------------------------------------------------------------------------
# Comportamientos que NUNCA son fallo DOD
# El Agente 1 y el Agente 2 deben conocer estas excepciones
# ---------------------------------------------------------------------------

DOD_FALSE_POSITIVES = {
    "live_tv_delay": (
        "El delay de 20-40s de la señal en vivo respecto al broadcast real "
        "es comportamiento esperado. No es buffering. No es fallo."
    ),
    "preroll_ad_presence": (
        "El pre-roll antes de contenido VOD es obligatorio por modelo de negocio. "
        "Su presencia no es un fallo — su ausencia sí podría serlo."
    ),
    "overnight_black_screen": (
        "Entre 00:00 y 06:00 hora Chile (UTC-3) la señal puede emitir "
        "pantalla negra o señal de prueba. No es crash."
    ),
    "content_changes_daily": (
        "El catálogo cambia diariamente. Tests que busquen títulos específicos "
        "pueden fallar por indisponibilidad del contenido — no por bug de la app. "
        "Siempre usar TEST_CONTENT del app_context."
    ),
    "exclusive_content_blocked": (
        "El contenido exclusivo bloqueado para usuarios sin login "
        "es comportamiento correcto — no es un fallo de acceso."
    ),
    "geo_block_outside_chile": (
        "Contenido geo-restringido no disponible fuera de Chile "
        "es comportamiento esperado — no es bug."
    ),
}

# ---------------------------------------------------------------------------
# Helpers para los agentes
# ---------------------------------------------------------------------------

def get_dod_tests() -> list[str]:
    """Retorna la lista de test names en orden de ejecución."""
    return [DOD_RULES[dod_id]["test"] for dod_id in DOD_EXECUTION_ORDER]


def get_dod_by_flow(flow: str) -> dict | None:
    """Retorna el DOD rule correspondiente a un flujo dado."""
    return next(
        (rule for rule in DOD_RULES.values() if rule["flow"] == flow),
        None
    )


def get_timeout(key: str) -> int:
    """Retorna el timeout para una acción específica con fallback seguro."""
    return DOD_TIMEOUTS.get(key, 5)  # 5s como fallback seguro


def is_false_positive(pattern: str) -> bool:
    """Verifica si un patrón de fallo es un falso positivo conocido."""
    return pattern in DOD_FALSE_POSITIVES


def get_false_positive_explanation(pattern: str) -> str | None:
    """Retorna la explicación de por qué un patrón no es fallo."""
    return DOD_FALSE_POSITIVES.get(pattern)