# CLAUDE.md — QA Agent · Android Streaming Apps

> Este archivo es la fuente de verdad del proyecto. Todos los agentes lo leen al iniciar.
> La sección `## Contexto de sesión` se actualiza automáticamente al final de cada run.
> No edites manualmente las secciones marcadas con `[AUTO]`.

---

## Proyecto

**Qué es:** Sistema de QA autónomo con cuatro agentes especialistas en Android para testear apps de streaming desde un monorepo.
**Stack:**
- Python 3.11 · pytest-cov · Claude API (claude-sonnet-4-6)
- Android: Appium 2.x · UiAutomator2 · WebdriverIO 9.x · Mocha · Jest 29
**Plataforma objetivo:**
- Android: Xiaomi 24049RN28L vía USB ADB (serial: fy9tgmv4kbtox4mj · WiFi: 192.168.1.231:5555) · UiAutomator2
**Apps bajo prueba:** `tvnPass` (Android). Cada app tiene su propio contexto, DOD y skills.
**Modelo de ejecución:** Una app a la vez según el trigger. El `app_id` determina qué contexto y tests cargar.

---

## Agentes del sistema

### Agente 0 — Explorador Android
- **Archivo:** `agents/explorer_android.py`
- **Responsabilidad:** Igual que el iOS pero para Android/UiAutomator2. Genera `apps/{app_id}/ui_map_android.json`.
- **Reglas críticas:** `waitForIdleTimeout=0` obligatorio · usar `activateApp` nunca `startActivity` (bloqueado en Android 16).
- **Cuándo usarlo:** Al agregar una nueva app Android. No corre en cada PR ni nightly.

### Agente 1 — Analizador
- **Archivo:** `agents/analyzer.py`
- **Prompt:** `prompts/agent1_analyzer.md`
- **Responsabilidad:** Recibe triggers (PR, `/qa` comment, schedule), analiza qué cambió, decide qué tests ejecutar o generar, construye el input JSON para el Agente 2.
- **Plataforma:** Android.
- **No ejecuta tests. No genera código. Solo decide y delega.**

### Agente 2 — Generador / Ejecutor
- **Archivo:** `agents/generator_executor.py`
- **Prompt:** `prompts/agent2_gen_exec.md`
- **Responsabilidad:** Genera tests E2E en JavaScript (WebdriverIO/Mocha) o ejecuta `npm run test:android`.
- **Modos:** `generate` | `execute`
- **Produce:** screenshots en `reports/{app_id}/screenshots/{run_id}/failures/` y `happy_path/`, video vía wdio-video-reporter.

### Agente 3 — Validador Visual
- **Archivo:** `agents/vision_validator.py`
- **Prompt:** `prompts/agent3_vision.md`
- **Responsabilidad:** Recibe los screenshots (failures/ y happy_path/) y resultados del Agente 2. Envía las imágenes a Claude con visión y emite un veredicto: `passed` / `failed` / `blocking`. Si es `blocking`, el merge queda bloqueado.
- **Inputs:** run_id, app_id, dod_status, dod_failures, screenshots_dir, video_path
- **Output:** JSON con vision_verdict, block_merge, diagnosis, findings, recommendations
- **Cuándo corre:** Después de cada run E2E Android. En CI: job `vision-validate` (workflow_dispatch). En local: `run_parallel.sh` lo llama automáticamente.
- **No bloquea si el agente en sí falla** — solo bloquea si `block_merge: true` en su output JSON.

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
#        apps/{app_id}/session_log.json       (versión comprimida)
#        apps/{app_id}/skills/                (todos los .md presentes)
#        apps/{app_id}/ui_map_android.json    (generado por Agente 0)
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
ott-qa-pipeline/
├── CLAUDE.md                            ← este archivo (fuente de verdad global)
├── pytest.ini                           ← config pytest-cov, norecursedirs=apps
├── requirements.txt                     ← deps Python
│
├── schemas/
│   └── agent_contract.json              ← contrato JSON entre agentes
│
├── prompts/
│   ├── agent1_analyzer.md               ← prompt Agente 1 (Android)
│   ├── agent2_gen_exec.md               ← prompt Agente 2 (Android)
│   └── agent3_vision.md                 ← prompt Agente 3 (Claude Vision)
│
├── agents/
│   ├── explorer_android.py              ← Agente 0 (BFS + UiAutomator2)
│   ├── analyzer.py                      ← Agente 1 (Android)
│   ├── generator_executor.py            ← Agente 2 (Android)
│   └── vision_validator.py              ← Agente 3 (Claude Vision)
│
├── scripts/
│   ├── run_on_pr.sh                     ← trigger PR: Fase 0 + Fase 2 Android
│   ├── run_suggestion.sh                ← trigger /qa: solo Fase 0 (sin Appium)
│   ├── run_scheduled.sh                 ← trigger nightly Android (suite completa)
│   ├── detect_ui_drift.sh               ← detección semanal drift UI — todas las apps
│   ├── run_android.sh                   ← E2E Android: npm test:android
│   ├── run_android_explorer.sh          ← wrapper Agente 0 Android
│   ├── run_parallel.sh                  ← Fase 1 + E2E + Fase 3 en local
│   ├── run_vision.sh                    ← wrapper Fase 3 validación visual
│   ├── post_pr_comment.py               ← publica comentario en PR vía gh CLI
│   ├── compress_context.py              ← [AUTO] comprime session_log post-run
│   └── update_claude_md.py              ← [AUTO] actualiza sección [AUTO] de este archivo
│
├── tests/                               ← runner npm compartido (multi-app)
│   ├── package.json                     ← WebdriverIO + Jest, type:commonjs
│   ├── jest.config.js                   ← threshold 70%, cubre helpers/
│   ├── wdio.conf.js                     ← caps UiAutomator2; specs dinámicos por APP_ID
│   ├── helpers/                         ← helpers compartidos entre todas las apps
│   │   ├── screenshot.js
│   │   ├── pageContains.js
│   │   ├── waitFor.js
│   │   ├── clickHelper.js
│   │   └── appState.js
│   └── unit/                            ← unit tests Jest (sin device, ≥70% cobertura)
│       ├── appState.test.js
│       ├── clickHelper.test.js
│       ├── pageContains.test.js
│       ├── screenshot.test.js
│       └── waitFor.test.js
│
├── apps/                                ← workspace por app — agregar sin tocar tests/
│   └── tvnPass/
│       ├── app_context.md               ← qué es esta app, flujos, stack Android
│       ├── dod_rules.py                 ← timeouts DOD centralizados
│       ├── session_log.json             ← [AUTO] aprendizajes comprimidos
│       ├── failed_tests_history.json    ← [AUTO] historial de fallos
│       ├── ui_map_android.json          ← [AUTO] generado por Agente 0
│       ├── skills/
│       │   ├── dod_rules_reference.md
│       │   └── ux_streaming.md
│       └── tests/
│           └── e2e/                     ← tests E2E por app (cargados por wdio.conf.js)
│               └── tvn-pass-live.test.js   ← 8 tests E2E Live Player
│
└── reports/
    └── tvnPass/
        ├── screenshots/
        │   └── {run_id}/
        │       ├── happy_path/
        │       └── failures/
        ├── videos/
        └── runs/
```

### Cómo agregar una app nueva
1. Crear carpeta `apps/nombre_app/`
2. Correr `Agente 0 Android` para generar `ui_map_android.json`
3. Escribir `app_context.md` y `dod_rules.py`
4. Crear `skills/` con los `.md` relevantes
5. Crear `tests/` con la misma estructura que `tvnPass`
6. Agregar secrets en GitHub Actions

**No tocar agentes, scripts ni schema.** El sistema los soporta automáticamente.

---

## Convenciones de código

### Nombres de tests Android
```javascript
// Correcto:
it('login_email_credenciales_invalidas_muestra_error', ...)
it('reproductor_live_sin_conexion_muestra_pantalla_offline', ...)
it('busqueda_query_vacio_no_muestra_resultados', ...)

// Incorrecto:
it('test login', ...)
it('test1', ...)
```

### Selectores Android — orden de preferencia
```javascript
'~content-desc'                              // 1. Mejor: accessibility label
'id:com.streann.tvnpass:id/nombre'           // 2. resource-id estable
'android=new UiSelector().text("texto")'    // 3. texto visible
// Nunca xpath — especialmente en Jetpack Compose
```

### Helpers — siempre importar, nunca inline
```javascript
const { waitForElement }      = require('../helpers/waitFor');
const { pageContains }        = require('../helpers/pageContains');
const { clickElement }        = require('../helpers/clickHelper');
const { normalizarEstadoApp } = require('../helpers/appState');
const { takeScreenshot }      = require('../helpers/screenshot');

// NUNCA:
await browser.pause(3000);
```

### Screenshots y video
- Happy path: `reports/screenshots/{run_id}/happy_path/{test}.png` (afterEach automático)
- Failures: `reports/screenshots/{run_id}/failures/{test}.png` (afterEach automático)
- Video: WebdriverIO video reporter → `reports/{app_id}/videos/`

---

## Configuración de dispositivos

```javascript
// tests/wdio.conf.js — fragmento de capabilities
{
  platformName:                    'Android',
  'appium:udid':                   'fy9tgmv4kbtox4mj', // serial USB Xiaomi 24049RN28L (WiFi: 192.168.1.231:5555)
  'appium:deviceName':             'Android',
  'appium:appPackage':             'com.streann.tvnpass',
  'appium:appActivity':            'com.streann.tvnpass.MainActivity',
  'appium:automationName':         'UiAutomator2',
  'appium:noReset':                true,
  'appium:waitForIdleTimeout':     0,   // DEC-01: CRÍTICO en apps de streaming
  'appium:waitForSelectorTimeout': 0,
}
```

---

## Optimización de tokens — reglas del sistema

Estas reglas aplican a todos los agentes siempre:

1. **Contexto comprimido.** Los agentes nunca leen `session_log.json` completo. Solo leen el resumen generado por `compress_context.py` al final del run anterior (máx 500 tokens).

2. **Referencias, no contenido.** Si un agente necesita ver un test existente, lee solo la función específica. Prompt: `"dame solo el it('login_email_happy_path') de tests/tvn-pass-live.test.js"`.

3. **Cache de DOD.** Si el diff del PR no toca los flujos DOD, esos tests no se incluyen en contexto. Se ejecutan en background sin pasar por el agente.

4. **Tests reutilizados.** Antes de generar un test nuevo, el Agente 2 revisa `existing_tests`. Si existe el 70% del flujo que necesita, agrega `it()` al describe existente — no crea archivos duplicados.

5. **Output estructurado.** Los agentes nunca devuelven texto libre — siempre JSON validado contra `schemas/agent_contract.json`. Esto evita parsing costoso y re-prompting.

6. **Una sola llamada por decisión.** El Agente 1 toma todas las decisiones en una sola llamada a la API (qué tests, qué generar, qué priorizar). No hace llamadas iterativas para decidir.

---

## Flujo de trabajo completo

```
━━━ FASE 0 — Sugerencia (sin Appium) ━━━━━━━━━━━━━━━━━━━━━━━━━
Trigger: PR abierto  →  run_on_pr.sh
Trigger: /qa comment →  run_suggestion.sh  (qa_on_comment.yml)
    │
    ▼
Agente 1 — Analizador
    ├── Lee: diff del PR
    ├── Lee: apps/{app_id}/app_context.md
    ├── Lee: apps/{app_id}/dod_rules.py
    ├── Lee: apps/{app_id}/session_log.json (comprimido)
    └── Lee: apps/{app_id}/skills/*.md (carga selectiva por keywords)
    └── Produce: JSON con sugerencias de tests + decisión execute/generate
            │
            ▼
    scripts/post_pr_comment.py
            └── Publica en el PR: casos sugeridos + riesgo + notas streaming

━━━ FASE 1 — Unit Tests (sin dispositivo) ━━━━━━━━━━━━━━━━━━━━
Android → cd tests && npm run test:unit (Jest ≥70%)
Si falla → pipeline se frena aquí.

━━━ FASE 2 — E2E Android en dispositivo físico ━━━━━━━━━━━━━━━
Agente 2 — Gen/Exec (Android)
    ├── Modo generate → apps/{app_id}/tests/e2e/*.test.js
    └── Modo execute  → npm run test:android (Xiaomi 24049RN28L fy9tgmv4kbtox4mj vía USB/WiFi ADB)

scripts/run_android.sh
    └── wdio run wdio.conf.js (UiAutomator2)

Captura screenshots (happy_path/ y failures/) + video automáticamente.
            │
            ▼
    scripts/compress_context.py
            ├── Escribe en apps/{app_id}/session_log.json
            ├── Escribe en apps/{app_id}/failed_tests_history.json
            └── Actualiza sección [AUTO] de CLAUDE.md
                    │
                    ▼
            reports/{app_id}/runs/{run_id}.json
                    │
                    ▼
            Notificación (Slack / GitHub)
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
| UI Drift Detection | `detect_ui_drift.sh` corre cada lunes via `nightly.yml` — Agente 0 por app, E2E solo si ui_map cambió, issue automático si falla |

Para agregar un nuevo consumidor: crea un script en `scripts/` que lea el JSON de resultado.
No modifiques los agentes.

---

## iOS — Roadmap (al migrar a Mac Mini)

El sistema está preparado para iOS. Al migrar, agregar:

### Agente 0 iOS
- Crear `agents/explorer_ios.py` — misma interfaz que `explorer_android.py`
- Usa XCUITest + WebDriverAgent (WDA) en lugar de UiAutomator2
- Genera `apps/{app_id}/ui_map_ios.json`

### Capabilities XCUITest en wdio.conf.js
```javascript
// Detectar plataforma desde APP_PLATFORM env var (android | ios)
// iOS caps:
{
  platformName: 'iOS',
  'appium:udid': process.env.IOS_DEVICE_UDID,
  'appium:automationName': 'XCUITest',
  'appium:bundleId': process.env.IOS_BUNDLE_ID,
  'appium:noReset': true,
  'appium:waitForIdleTimeout': 0,
}
```

### UI Drift Detection iOS
`detect_ui_drift.sh` ya detecta `ui_map_ios.json` y tiene el branch iOS listo.
Solo necesita que `explorer_ios.py` exista — el resto es automático.

### Selectores iOS — orden de preferencia
| Prioridad | Selector | Cuándo |
|-----------|----------|--------|
| 1 | `~accessibility label` | Elementos con label de accesibilidad |
| 2 | `id:com.bundle:id/nombre` | Resource-id estable |
| 3 | `-ios predicate string` | Texto visible |
| 4 | `-ios class chain` | Último recurso |

**Nunca XPath en iOS** — igual que en Android con Compose.

---

## Variables de entorno requeridas

```bash
# ── Comunes ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=           # API key de Claude
APPIUM_SERVER_URL=           # http://localhost:4723 en local
APP_ID=                      # identificador de la app (ej: tvnPass)

# ── Android ───────────────────────────────────────────────────
ANDROID_DEVICE_NAME=         # Serial ADB del Xiaomi físico (fy9tgmv4kbtox4mj)
ANDROID_APP_PACKAGE=         # com.streann.tvnpass
ANDROID_APP_ACTIVITY=        # com.streann.tvnpass.MainActivity
ANDROID_HOME=                # ruta a platform-tools de ADB
                             # fallback en wdio.conf.js si no está definida
JAVA_HOME=                   # ruta al JDK 21
TEST_USER_EMAIL=             # usuario de prueba Android
TEST_USER_PASSWORD=          # password Android

# ── Notificaciones (opcionales) ───────────────────────────────
SLACK_WEBHOOK_URL=
JIRA_API_TOKEN=
GH_TOKEN=                    # = ${{ github.token }} en Actions — para gh pr comment
```

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