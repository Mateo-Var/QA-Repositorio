# CLAUDE.md — QA Agent · iOS Streaming App

> Este archivo es la fuente de verdad del proyecto. Todos los agentes lo leen al iniciar.
> La sección `## Contexto de sesión` se actualiza automáticamente al final de cada run.
> No edites manualmente las secciones marcadas con `[AUTO]`.

---

## Proyecto

**Qué es:** Sistema de QA autónomo con dos agentes para testear múltiples apps iOS desde un monorepo.
**Stack:** Python 3.11 · Appium 2.x · XCUITest · pytest · Claude API (claude-sonnet-4-20250514)
**Plataformas objetivo:** iOS 16+ · iPhone (SE, 12, 14, 15 Pro) · iPad Air · iPad Pro
**Apps bajo prueba:** Múltiples apps iOS completamente distintas — cada una con su propio contexto, DOD y skills.
**Modelo de ejecución:** Una app a la vez según el trigger. El `app_id` determina qué contexto y tests cargar.

---

## Agentes del sistema

### Agente 1 — Analizador
- **Archivo:** `agents/analyzer.py`
- **Prompt:** `prompts/agent1_analyzer.md`
- **Responsabilidad:** Recibe triggers (PR, webhook, schedule), analiza qué cambió, decide qué tests ejecutar o generar, construye el input JSON para el Agente 2.
- **No ejecuta tests. No genera código. Solo decide y delega.**

### Agente 2 — Generador / Ejecutor
- **Archivo:** `agents/generator_executor.py`
- **Prompt:** `prompts/agent2_gen_exec.md`
- **Responsabilidad:** Genera tests E2E nuevos o ejecuta suites existentes según instrucción del Agente 1.
- **Modos:** `generate` | `execute`
- **Nunca actúa sin input del Agente 1.**

### Comunicación entre agentes
El Agente 1 produce un JSON estructurado. El Agente 2 lo consume.
El contrato está definido en `schemas/agent_contract.json`.
Nunca pasar contexto libre entre agentes — solo JSON validado.

### Carga de contexto por app
Ambos agentes reciben `app_id` como parámetro de entrada.
Cargan contexto desde `apps/{app_id}/` — nunca desde rutas hardcodeadas.

```python
# Patrón estándar en ambos agentes
context = load_context(app_id=os.environ["APP_ID"])
# Carga: apps/{app_id}/app_context.md
#        apps/{app_id}/dod_rules.py
#        apps/{app_id}/session_log.json  (versión comprimida)
#        apps/{app_id}/skills/           (todos los .md presentes)
```

---

## DOD — Definition of Done

Estas pruebas NUNCA pueden fallar. Si alguna falla, el run se detiene inmediatamente
y se bloquea el pipeline. No hay excepciones.

| ID | Flujo | Criterio de éxito | Timeout máx |
|----|-------|-------------------|-------------|
| DOD-01 | Login email | Usuario llega a home screen | 5s |
| DOD-02 | Login SSO | Token válido, home screen visible | 6s |
| DOD-03 | Reproducción video | Buffer inicial completado | 3s |
| DOD-04 | Búsqueda | Resultados visibles tras query | 2s |
| DOD-05 | Selector de perfiles | Grid/lista cargada tras login | 3s |
| DOD-06 | Onboarding | Flujo completo sin crash | 60s |
| DOD-07 | Pago in-app | Pantalla de confirmación visible | 8s |
| DOD-08 | Logout | Sesión cerrada, pantalla login | 3s |
| DOD-09 | Modo offline | App no crashea sin conexión | — |
| DOD-10 | Accesibilidad | VoiceOver no rompe navegación | — |

Los timeouts están centralizados en `knowledge/dod_rules.py`.
Si necesitas ajustar un timeout, edítalo ahí — nunca en el test directamente.

---

## Estructura del proyecto

```
qa-agent/
├── CLAUDE.md                            ← este archivo (sistema global)
├── schemas/
│   └── agent_contract.json              ← contrato compartido entre agentes
├── prompts/
│   ├── agent1_analyzer.md               ← compartido, genérico
│   └── agent2_gen_exec.md               ← compartido, genérico
├── agents/
│   ├── analyzer.py                      ← Agente 1 (recibe app_id)
│   └── generator_executor.py            ← Agente 2 (recibe app_id)
├── scripts/
│   ├── run_on_pr.sh                     ← trigger desde GitHub Actions
│   ├── run_scheduled.sh                 ← trigger programado (nightly)
│   ├── compress_context.py              ← [AUTO] comprime session_log al final del run
│   └── update_claude_md.py              ← [AUTO] actualiza sección de contexto
│
├── apps/                                ← workspace por app — agregar sin tocar agentes
│   ├── app_streaming_mx/
│   │   ├── app_context.md               ← Skill 1: qué es esta app
│   │   ├── dod_rules.py                 ← DOD específico de esta app
│   │   ├── session_log.json             ← [AUTO] aprendizajes de esta app
│   │   ├── failed_tests_history.json    ← [AUTO] historial de fallos de esta app
│   │   ├── skills/
│   │   │   ├── geo_rules.md
│   │   │   ├── ads_behavior.md
│   │   │   ├── subscription_states.md
│   │   │   ├── offline_patterns.md
│   │   │   └── content_risk_matrix.md
│   │   └── tests/
│   │       ├── e2e/
│   │       ├── pages/
│   │       └── fixtures/
│   │
│   ├── app_noticias/                    ← estructura idéntica, contenido diferente
│   │   ├── app_context.md
│   │   ├── dod_rules.py
│   │   ├── session_log.json
│   │   ├── failed_tests_history.json
│   │   ├── skills/
│   │   └── tests/
│   │
│   └── app_N/                           ← agregar una app = crear esta carpeta
│       └── ...
│
└── reports/
    ├── app_streaming_mx/                ← resultados separados por app
    │   ├── screenshots/
    │   ├── videos/
    │   └── runs/
    ├── app_noticias/
    └── app_N/
```

### Cómo agregar una app nueva
1. Crear carpeta `apps/nombre_app/`
2. Escribir `app_context.md` con el contexto de esa app
3. Escribir `dod_rules.py` con sus criterios críticos
4. Crear `skills/` con los `.md` relevantes para esa app
5. Agregar `APP_ID=nombre_app` como secret en GitHub Actions

**No tocar agentes, scripts ni schema.** El sistema los soporta automáticamente.

---

## Convenciones de código

### Nombres de tests
```
test_[flujo]_[escenario]_[resultado_esperado]

# Ejemplos correctos
test_login_email_credenciales_invalidas_muestra_error
test_reproductor_sin_conexion_muestra_pantalla_offline
test_busqueda_query_vacio_no_muestra_resultados

# Incorrecto
test_login_1
test_busqueda_funciona
```

### Page Objects
- Un archivo por pantalla principal
- Hereda de `BasePage` (`tests/pages/base_page.py`)
- Los locators van como constantes de clase, arriba del todo
- Los métodos describen acciones del usuario, no del driver: `tap_continuar()` no `click_button_by_id()`

### Waits
```python
# Siempre así
wait_for_element(driver, locator, timeout=DOD_TIMEOUTS["login"])

# Nunca así
time.sleep(2)
driver.implicitly_wait(5)
```

### Screenshots
- Se capturan automáticamente en cada fallo (fixture en conftest.py)
- Ruta: `reports/screenshots/[run_id]/[test_name].png`
- En suites de más de 5 tests, grabar video completo del run

---

## Configuración de dispositivos

```python
# tests/fixtures/devices.py

DEVICES = {
    "iphone_14_sim": {
        "platformName": "iOS",
        "platformVersion": "17.2",
        "deviceName": "iPhone 14",
        "automationName": "XCUITest",
        "udid": "auto",
        "noReset": False,
        "screenshotQuality": 1
    },
    "ipad_air_sim": {
        "platformName": "iOS",
        "platformVersion": "17.2",
        "deviceName": "iPad Air (5th generation)",
        "automationName": "XCUITest",
        "udid": "auto",
        "noReset": False
    }
}

# Para dispositivos físicos, los UDID van en variables de entorno
# DEVICE_UDID_IPHONE14=xxx python -m pytest ...
```

---

## Optimización de tokens — reglas del sistema

Estas reglas aplican a todos los agentes siempre:

1. **Contexto comprimido.** Los agentes nunca leen `session_log.json` completo. Solo leen el resumen generado por `compress_context.py` al final del run anterior (máx 500 tokens).

2. **Referencias, no contenido.** Si un agente necesita ver un test existente, lee solo la función específica, no el archivo completo. Prompt: `"dame solo la función test_login_sso_happy_path de tests/e2e/test_login_sso.py"`.

3. **Cache de DOD.** Si el diff del PR no toca los flujos DOD, esos tests no se incluyen en contexto. Se ejecutan en background sin pasar por el agente.

4. **Page Objects reutilizados.** Antes de generar un nuevo Page Object, el Agente 2 revisa `tests/pages/`. Si existe el 70% de lo que necesita, extiende — no crea desde cero.

5. **Output estructurado.** Los agentes nunca devuelven texto libre — siempre JSON validado contra `schemas/agent_contract.json`. Esto evita parsing costoso y re-prompting.

6. **Una sola llamada por decisión.** El Agente 1 toma todas las decisiones en una sola llamada a la API (qué tests, qué generar, qué priorizar). No hace llamadas iterativas para decidir.

---

## Flujo de trabajo completo

```
Trigger (PR / schedule / manual) + APP_ID
    │
    ▼
scripts/run_on_pr.sh
    ├── Lee APP_ID del trigger
    ├── Carga secrets de esa app
    └── Lanza Agente 1
            │
            ▼
    Agente 1 — Analizador
            ├── Lee: diff del cambio
            ├── Lee: apps/{app_id}/app_context.md
            ├── Lee: apps/{app_id}/dod_rules.py
            ├── Lee: apps/{app_id}/session_log.json (comprimido)
            ├── Lee: apps/{app_id}/skills/*.md
            └── Produce: input JSON para Agente 2
                    │
                    ▼
            Agente 2 — Gen/Exec
                    ├── Modo generate → apps/{app_id}/tests/e2e/
                    ├── Modo execute  → corre pytest + Appium
                    └── Produce: resultado JSON + knowledge_update
                            │
                            ▼
                    scripts/compress_context.py --app-id {app_id}
                            ├── Escribe en apps/{app_id}/session_log.json
                            ├── Escribe en apps/{app_id}/failed_tests_history.json
                            └── Actualiza sección [AUTO] de CLAUDE.md
                                    │
                                    ▼
                            reports/{app_id}/runs/{run_id}.json
                                    │
                                    ▼
                            Notificación (Slack / GitHub / Jira)
```

---

## Conexión con flujos externos

El sistema expone un contrato de salida estándar en `reports/{app_id}/runs/{run_id}.json`.
Cualquier sistema externo consume ese JSON sin depender de los internos del agente.

| Sistema | Cómo se conecta |
|---------|----------------|
| GitHub Actions | `run_on_pr.sh` como step en `qa_agent.yml` con `APP_ID` en el trigger |
| Slack | Webhook POST al final del run si `dod_status = failed` — mensaje incluye `app_id` |
| Jira | Script `scripts/create_jira_ticket.py --app-id {app_id}` si hay DOD violations |
| Otros agentes | Leen `reports/{app_id}/runs/latest.json` como input |
| Nightly build | `run_scheduled.sh` itera sobre todos los `apps/*/` y lanza un run por app |

Para agregar un nuevo consumidor: crea un script en `scripts/` que lea el JSON de resultado.
No modifiques los agentes.

---

## Variables de entorno requeridas

```bash
ANTHROPIC_API_KEY=           # API key de Claude
APPIUM_SERVER_URL=           # http://localhost:4723 en local
APP_ID=                      # identificador de la app a testear (ej: app_streaming_mx)
APP_BUNDLE_ID=               # com.tuempresa.tuapp — específico por app en GitHub Secrets
APP_PATH=                    # ruta al .ipa — opcional si ya está instalada
TEST_USER_EMAIL=             # usuario de prueba de esa app
TEST_USER_PASSWORD=          # password del usuario de prueba
DEVICE_UDID=                 # UDID del iPhone/iPad conectado
SLACK_WEBHOOK_URL=           # opcional, para notificaciones
JIRA_API_TOKEN=              # opcional, para tickets automáticos
```

En GitHub Actions, cada app tiene sus propios secrets prefijados:
```bash
APP_STREAMING_MX_BUNDLE_ID=com.empresa.streamingmx
APP_STREAMING_MX_TEST_USER=qa@streaming.mx
APP_NOTICIAS_BUNDLE_ID=com.empresa.noticias
APP_NOTICIAS_TEST_USER=qa@noticias.com
# etc.
```

El `run_on_pr.sh` lee el `APP_ID` del trigger y carga los secrets correctos.

---

## [AUTO] Contexto de sesión

> Esta sección es generada y sobreescrita automáticamente por scripts/update_claude_md.py
> No editar manualmente.
> El detalle por app vive en apps/{app_id}/session_log.json

```json
{
  "last_run": null,
  "last_run_app": null,
  "last_run_date": null,
  "apps_registered": [],
  "total_runs_global": 0,
  "total_tests_generated_global": 0,
  "apps_summary": {}
}
```