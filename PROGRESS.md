# PROGRESS — Kit-Ott-Suite

> Estado real del proyecto y roadmap completo.
> Se actualiza cuando el usuario lo pide.
> Última actualización: 2026-04-14

---

## Visión del pipeline

### Fases en cada PR
| Fase | Qué hace | Quién lo corre | Estado |
|------|----------|----------------|--------|
| **Fase 0** | Claude lee el diff → sugiere tests → comenta en el PR. Incluye escenarios de streaming: red, audio, VPN, geo/país, bitrate | Agent 1 · ubuntu | ✅ Completo |
| **Fase 1** | Jest unit tests · cobertura mínima 70% · sin dispositivo | Node · ubuntu | ✅ Completo · 31 tests · 98.68% |
| **Fase 2** | E2E Android (+ iOS futuro) en dispositivo físico · screenshots + video automáticos | Agent 2 · Mac Mini self-hosted | 🔧 Demo pendiente |
| **Fase 3** | Claude Vision recibe screenshots y decide: passed / failed / blocking. Si blocking → bloquea el merge | Agent 3 · Mac Mini self-hosted | 🔧 Integrado · pendiente demo |

### Fases solo en merge a main
| Fase | Qué hace | Estado |
|------|----------|--------|
| **Fase 4** | Allure Report generado y publicado en GitHub Pages | ✅ Completo |
| **Fase 5** | Build Android AAB + iOS IPA vía Fastlane | ⏳ Pendiente — requiere keystore |
| **Fase 6** | Fastlane distribuye a Firebase App Distribution (Android) + TestFlight (iOS) → notificación Slack + 360 | ⏳ Pendiente — requiere Firebase + keystore |

### Run semanal (lunes 8AM UTC)
| Qué hace | Estado |
|----------|--------|
| **UI Drift Detection** — Agente 0 regenera ui_map por app · compara con el commiteado · E2E solo si cambió · issue en GitHub si E2E falla · ui_map se commitea automáticamente si todo pasa | ✅ Completo (Android) · ⏳ iOS pendiente |

---

## Para el equipo de QA

- Al abrir un PR aparece el comentario de Claude con los tests sugeridos basados en el diff real
- Pueden pedir análisis de cualquier issue comentando `/qa`
- Videos y screenshots de cada sesión quedan en los artifacts de GitHub por 14 días
- Reporte Allure en GitHub Pages después de cada merge (Fase 4)

## Para devs

- El pipeline bloquea el merge si Claude detecta fallo bloqueante en player, auth o live
- Fallos no críticos quedan marcados como advertencia sin bloquear
- Sin tests DOD → no hay merge

---

## Estado actual detallado

### Agentes

| Agente | Archivo | Modelo | Función | Estado |
|--------|---------|--------|---------|--------|
| Agente 0 | `agents/explorer_android.py` | — | BFS sobre la app, genera `ui_map_android.json` | ✅ Completo · usado 1 vez en tvnPass |
| Agente 1 | `agents/analyzer.py` | Haiku | Analiza diff → decide qué tests ejecutar/generar | ✅ Completo |
| Agente 2 | `agents/generator_executor.py` | Haiku | Genera tests E2E o los ejecuta en el dispositivo | ✅ Completo |
| Agente 3 | `agents/vision_validator.py` | Sonnet | Valida screenshots con visión · decide passed/failed/blocking | ✅ Completo · integrado en `run_on_pr.sh` |

### Tests existentes

| Suite | Tests | Framework | Dispositivo |
|-------|-------|-----------|-------------|
| Jest unit helpers | 31 | Jest 29 | Sin dispositivo |
| E2E tvnPass Android | 0 (se generan en el primer PR) | WebdriverIO + UiAutomator2 | Samsung físico WiFi |

### Apps registradas

| App ID | Package | Plataforma | Estado |
|--------|---------|------------|--------|
| `tvnPass` | `com.streann.tvnpass` | Android | ✅ Activo · `ui_map_android.json` generado |

---

## Dispositivos

| Dispositivo | Conexión | Uso |
|-------------|----------|-----|
| Samsung Android (físico) | WiFi ADB `192.168.1.129:5555` | tvnPass E2E |
| iPhone (futuro) | XCUITest + WDA · USB o WiFi | tvnPass iOS (tras migrar a Mac Mini) |

---

## Infraestructura

| Componente | Dónde corre | Estado |
|------------|-------------|--------|
| Runner GitHub Actions | Windows PC self-hosted · label `android` | ✅ Activo |
| Appium 3.x + UiAutomator2 | Mismo runner | ✅ Activo |
| Mac Mini | Futuro self-hosted · Android + iOS en paralelo | ⏳ Migración pendiente |
| Allure CLI | allure-commandline (npm devDep) | ✅ Configurado |
| Fastlane | — | ⏳ No configurado |

---

## Próximos pasos (en orden)

1. ~~Demo completo Fases 0-3~~ ✅
2. ~~Fase 4 — Allure~~ ✅ — `@wdio/allure-reporter` + `allure-commandline`, artifact en cada PR, GitHub Pages en merge a main
3. ~~UI Drift Detection semanal~~ ✅ — `detect_ui_drift.sh` + `nightly.yml` (lunes 8AM UTC)
4. **Habilitar GitHub Pages** — Settings → Pages → Source → "GitHub Actions" (configuración manual única en el repo)
5. **Fase 5 — Build** — `gradlew bundleRelease` (AAB) via Fastlane — pendiente keystore de firma
6. **Fase 6 — Distribución** — Firebase App Distribution + notificación Slack — pendiente keystore + Firebase App ID
7. **Migrar a Mac Mini** — Registrar runner, cambiar paths hardcodeados de Windows → variables, validar ADB WiFi
8. **Agregar iOS (al migrar a Mac Mini):**
   - Crear `agents/explorer_ios.py` (Agente 0 iOS — XCUITest + WDA)
   - Caps XCUITest en `tests/wdio.conf.js` según `platform` del app_context
   - E2E iOS en paralelo con Android desde el mismo runner
   - `detect_ui_drift.sh` ya soporta iOS — solo necesita `explorer_ios.py` y `ui_map_ios.json`
   - Allure report unificado Android + iOS

9. **Conectar repo core al pipeline (cuando den acceso):**

   El repo core contiene la lógica compartida de todas las apps. Los devs abren PRs ahí.
   El objetivo es que esos PRs activen el análisis de Claude y los tests E2E igual que hoy.

   **Estrategia elegida: trigger mínimo en core, toda la lógica queda en `ott-qa-pipeline`.**

   *Qué hacer en el core repo (una sola vez):*
   - Crear `.github/workflows/qa_trigger.yml` con estas ~10 líneas:
     ```yaml
     on:
       pull_request:
       issue_comment:
         types: [created]
     jobs:
       trigger:
         runs-on: ubuntu-latest
         steps:
           - run: |
               gh workflow run qa_agent.yml \
                 --repo mediastream/ott-qa-pipeline \
                 --field source_repo="${{ github.repository }}" \
                 --field base_sha="${{ github.event.pull_request.base.sha }}" \
                 --field head_sha="${{ github.event.pull_request.head.sha }}" \
                 --field pr_number="${{ github.event.pull_request.number }}"
             env:
               GH_TOKEN: ${{ secrets.QA_PIPELINE_TOKEN }}
     ```
   - Agregar secret `QA_PIPELINE_TOKEN` en el core repo (PAT con permiso `actions:write` en `ott-qa-pipeline`)

   *Qué hacer en `ott-qa-pipeline`:*
   - Agregar `source_repo` como input en `workflow_dispatch` de `qa_agent.yml`
   - Modificar `run_on_pr.sh`: si viene `SOURCE_REPO`, hacer `git clone $SOURCE_REPO` usando deploy key y generar el diff desde ahí
   - Agregar deploy key al runner (SSH read-only al core repo) — configuración de 5 minutos

   *Por qué esta estrategia:*
   Toda la lógica QA (agentes, tests, scripts) vive en un solo lugar. Al agregar una app nueva o cambiar el Agente 1, solo se toca `ott-qa-pipeline`. El core repo no sabe nada de QA — solo dispara el trigger.
