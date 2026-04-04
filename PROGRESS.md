# PROGRESS — Kit-Ott-Suite

> Resumen acumulado del estado del proyecto.
> Se actualiza cuando el usuario lo pide.
> Última actualización: 2026-04-04

---

## Estado del pipeline

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase 0** | Claude analiza el PR y publica comentario con sugerencias + resultado | ✅ Completo |
| **Fase 1** | Unit tests Jest, cobertura mínima 70% | ✅ Completo |
| **Fase 2** | E2E en dispositivos físicos (iOS + Android) | ✅ Completo |
| **Fase 3** | Claude valida con visión (screenshots + video) | ⏳ Pendiente (necesita API Vision) |
| **Fase 4** | Allure Report en GitHub Pages | ⏳ Pendiente |
| **Fase 5** | Build AAB (Android) + IPA (iOS) vía Fastlane | ⏳ Pendiente |
| **Fase 6** | Distribución Firebase App Distribution + TestFlight + Slack | ⏳ Pendiente |

---

## Apps registradas

| App ID | Bundle / Package | Plataforma | Tests | Estado |
|--------|-----------------|------------|-------|--------|
| `ditu` | com.caracol.ditu | iOS 16+ | 36 pytest | ✅ Activo |
| `tvnPass` | com.streann.tvnpass | iOS + Android | 19 iOS · 8 Android | ✅ Activo |

---

## Agentes

| Agente | Archivo | Plataforma | Estado |
|--------|---------|------------|--------|
| Agente 0 iOS | `agents/explorer.py` | iOS (XCUITest) | ✅ Completo |
| Agente 0 Android | `agents/explorer_android.py` | Android (UiAutomator2) | ✅ Completo |
| Agente 1 | `agents/analyzer.py` | Ambas | ✅ Completo |
| Agente 2 | `agents/generator_executor.py` | Ambas | ✅ Completo |

---

## Tests

### Fase 1 — Jest (unit tests de helpers Android)

| Archivo | Tests | Qué cubre |
|---------|-------|-----------|
| `tests/__tests__/pageContains.test.js` | 6 | Búsqueda en page source XML |
| `tests/__tests__/waitFor.test.js` | 6 | Timeout custom con reintentos |
| `tests/__tests__/clickHelper.test.js` | 6 | Click por texto + validación previa |
| `tests/__tests__/appState.test.js` | 7 | Normalización de estado de la app |
| `tests/__tests__/screenshot.test.js` | 6 | Captura con timestamp |
| **Total** | **31** | Cobertura ≥ 70% obligatoria |

### Tests de agentes Python (pytest)

| Archivo | Tests | Qué cubre |
|---------|-------|-----------|
| `tests/agents/test_analyzer.py` | 20 | Agente 1: skills, validación, pipeline completo |
| `tests/agents/test_generator_executor.py` | 19 | Agente 2: execute, generate, dispatcher |
| `tests/scripts/test_post_pr_comment.py` | 22 | Generador de comentarios PR |
| **Total** | **61** | Mock de Claude API y subprocess |

### Fase 2 — E2E

| Suite | Tests | Framework |
|-------|-------|-----------|
| Ditu iOS | 36 | pytest + Appium XCUITest |
| TVN Pass iOS | 19 | pytest + Appium XCUITest |
| TVN Pass Android | 8 | WebdriverIO + UiAutomator2 |
| **Total** | **63** | |

---

## Archivos clave creados / modificados

### Nuevos
```
agents/explorer_android.py                 — Agente 0 Android (BFS + XML parsing + sugerencias)
scripts/post_pr_comment.py                 — Genera y publica comentario en PR vía gh CLI
scripts/run_android_explorer.sh            — Wrapper para correr el explorador Android
scripts/run_android.sh                     — Entry point E2E Android en CI
scripts/run_local_tests.sh                 — Script de prueba local (Jest + pytest + syntax)
scripts/test_data/mock_agent1_passed.json  — Datos mock Agente 1 (DOD passed)
scripts/test_data/mock_agent1_failed.json  — Datos mock Agente 1 (CRITICO)
scripts/test_data/mock_agent2_passed.json  — Datos mock Agente 2 (todo passed)
scripts/test_data/mock_agent2_failed.json  — Datos mock Agente 2 (DOD violations)
apps/tvnPass/tests/android/jest.config.js  — Config Jest con threshold 70%
apps/tvnPass/tests/android/tests/helpers/pageContains.js
apps/tvnPass/tests/android/tests/helpers/waitFor.js
apps/tvnPass/tests/android/tests/helpers/clickHelper.js
apps/tvnPass/tests/android/tests/helpers/appState.js
apps/tvnPass/tests/android/tests/__tests__/pageContains.test.js
apps/tvnPass/tests/android/tests/__tests__/waitFor.test.js
apps/tvnPass/tests/android/tests/__tests__/clickHelper.test.js
apps/tvnPass/tests/android/tests/__tests__/appState.test.js
apps/tvnPass/tests/android/tests/__tests__/screenshot.test.js
tests/agents/conftest.py
tests/agents/test_analyzer.py
tests/agents/test_generator_executor.py
tests/scripts/test_post_pr_comment.py
pytest.ini
```

### Modificados
```
apps/tvnPass/tests/android/package.json          — agregado Jest como devDependency
apps/tvnPass/tests/android/tests/tvn-pass-live.test.js — refactor: importa desde helpers
scripts/run_on_pr.sh                             — paso 6: llama a post_pr_comment.py
.github/workflows/qa_agent.yml                  — Jest unit tests + GH_TOKEN + Android job
```

---

## Cómo correr todo localmente

```bash
# Todo junto (sin dispositivo ni GitHub)
bash scripts/run_local_tests.sh

# Solo Jest
cd apps/tvnPass/tests/android && npm run test:unit

# Solo pytest (agentes)
python -m pytest tests/ -v

# Ver comentario PR sin publicar
python scripts/post_pr_comment.py \
  --pr 42 \
  --agent1 scripts/test_data/mock_agent1_failed.json \
  --agent2 scripts/test_data/mock_agent2_failed.json \
  --run-id pr42_test --dry-run

# Explorador Android (necesita dispositivo + Appium)
APP_ID=tvnPass APP_PACKAGE=com.streann.tvnpass \
  APP_ACTIVITY=com.streann.tvnpass.MainActivity \
  bash scripts/run_android_explorer.sh --device <serial-adb>
```

---

## Próximos pasos

1. **Fase 3** — Integrar Claude Vision: recibir screenshots del Agente 2 y analizarlos con la API de visión
2. **Fase 4** — Allure Report: agregar `pytest-allure` y generar HTML en GitHub Pages
3. **Fase 5** — Builds: configurar `xcodebuild` (iOS) y `gradlew assembleRelease` (Android)
4. **Fase 6** — Fastlane + Firebase App Distribution + TestFlight + Slack rich messages
5. **iOS TVN Pass** — Migrar a Mac Mini cuando esté disponible
