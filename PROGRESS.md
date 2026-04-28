# PROGRESS — Kit-Ott-Suite

> Estado real del proyecto y roadmap completo.
> Se actualiza cuando el usuario lo pide.
> Última actualización: 2026-04-23

---

## Visión del pipeline

### Fases en cada PR
| Fase | Qué hace | Quién lo corre | Estado |
|------|----------|----------------|--------|
| **Fase 0** | Claude lee el diff → sugiere tests → comenta en el PR. Android y iOS con comentarios separados (`<!-- QA-ANDROID -->` / `<!-- QA-IOS -->`), cada plataforma edita solo el suyo | Agent 1 · ubuntu | ✅ Completo |
| **Fase 1** | Jest unit tests · cobertura mínima 70% · sin dispositivo | Node · ubuntu | ✅ Completo · 36 tests · >70% cobertura |
| **Fase 2** | E2E Android + iOS en dispositivo físico · screenshots + video automáticos · Agent 1 output persistido para reusar en build manual | Agent 2 · Mac Mini self-hosted | ✅ Completo Android · ✅ Completo iOS |
| **Fase 3** | Claude Vision recibe screenshots y decide: passed / failed / blocking. Si blocking → bloquea el merge | Agent 3 · Mac Mini self-hosted | ✅ Integrado · corre después de cada E2E |

### Flujo build manual (APK desde Slack)
| Paso | Qué hace | Estado |
|------|----------|--------|
| `run_with_build.sh` | Detecta APK más reciente de `~/Downloads` filtrando por `ANDROID_APP_PACKAGE` (formato `com.pkg.app-version.apk`) → instala → reutiliza Agent 1 de Fase 0 → corre Fase 2→3→4 | ✅ Completo |
| APK en `run_on_pr.sh` | Si hay APK en `~/Downloads` que coincida con el package, lo instala automáticamente antes del E2E. ADB auto-detect USB/WiFi si serial no responde | ✅ Completo |
| Agent 1 reuse | `run_with_build.sh` usa `reports/{app_id}/runs/pr{N}_agent1.json` guardado por Fase 0 — no re-analiza, no gasta tokens. La carpeta `runs/` vive solo en el runner (Mac Mini), no se sube a git. Si el run viene de un PR real: guarda `pr{N}_agent1.json` (sobreescribe si el mismo PR vuelve a correr). Si viene de un push/manual: guarda `manual_{run_id}_agent1.json` (archivo nuevo por run). Bug corregido 2026-04-23: antes `PR_NUMBER=0` impedía crear la carpeta — ahora `mkdir -p` corre siempre. | ✅ Completo |
| Onboarding post-install | `normalizarEstadoApp()` detecta y pasa pantalla de bienvenida: permiso notificaciones → 2 swipes derecha→izquierda → tap "VER AHORA" | ✅ Completo |
| `--agent1-json` | Param preparado para recibir análisis desde repo externo de la empresa | ✅ Arquitectura lista · integración pendiente |

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
| Runner GitHub Actions | Mac Mini self-hosted · label `android` · binario arm64 | ✅ Activo |
| Appium 3.x + UiAutomator2 | Mismo runner Mac Mini | ✅ Activo |
| iOS runner | Mac Mini self-hosted · Appium port 4724 · XCUITest | ✅ Configurado en workflow |
| Allure CLI | allure-commandline (npm devDep) | ✅ Configurado |
| Fastlane | — | ⏳ No configurado |

---

## Próximos pasos (en orden)

1. ~~Demo completo Fases 0-3~~ ✅
2. ~~Fase 4 — Allure~~ ✅
3. ~~UI Drift Detection semanal~~ ✅
4. ~~Migrar a Mac Mini~~ ✅ — runner arm64, paths macOS, ADB WiFi
5. ~~Soporte iOS en agentes y scripts~~ ✅ — multi-platform en Agent 1/2/3, comentarios PR separados por plataforma
6. ~~Flujo build manual (APK desde Slack)~~ ✅ — `run_with_build.sh` con auto-detect y Agent 1 reuse
7. **Habilitar GitHub Pages** — Settings → Pages → Source → "GitHub Actions" (configuración manual única en el repo)
8. **Probar flujo completo build manual** — correr `./scripts/run_with_build.sh --pr <N>` con APK real de Slack
9. **Conectar repo externo** — pasar `--agent1-json` desde el pipeline de la empresa; activar `run_with_build.sh` via `workflow_dispatch` o webhook cuando llegue una build
10. **Fase 5 — Build** — `gradlew bundleRelease` (AAB) via Fastlane — pendiente keystore de firma
11. **Fase 6 — Distribución** — Firebase App Distribution + notificación Slack — pendiente keystore + Firebase App ID
12. **Agregar iOS (tests E2E reales):**
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
