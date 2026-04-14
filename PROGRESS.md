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
| **Fase 4** | Allure Report generado y publicado en GitHub Pages | ⏳ Pendiente |
| **Fase 5** | Build Android AAB + iOS IPA vía Fastlane | ⏳ Pendiente |
| **Fase 6** | Fastlane distribuye a Firebase App Distribution (Android) + TestFlight (iOS) → notificación Slack + 360 | ⏳ Pendiente |

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
| Allure CLI | — | ⏳ No instalado |
| Fastlane | — | ⏳ No configurado |

---

## Próximos pasos (en orden)

1. **Demo completo Fases 0-3** — Abrir PR con cambio mínimo en `dod_rules.py`, verificar que el Samsung se mueve, que se toman screenshots, que Agent 3 comenta en el PR con fotos + diagnóstico
2. **Migrar a Mac Mini** — Registrar runner, cambiar `APPIUM_HOME` a secret, reemplazar step PowerShell por bash, validar ADB WiFi
3. **Agregar iOS** — Agente 0 iOS (`explorer_ios.py`), XCUITest caps, correr E2E en paralelo con Android
4. **Fase 4 — Allure** — `allure-commandline`, generar HTML post-merge, publicar en GitHub Pages
5. **Fase 5 — Build** — `gradlew bundleRelease` (AAB) + `xcodebuild archive` (IPA) via Fastlane
6. **Fase 6 — Distribución** — Firebase App Distribution (Android) + TestFlight (iOS) + notificación Slack + 360
