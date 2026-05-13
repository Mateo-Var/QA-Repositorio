# ESTADO DEL PROYECTO — QA Pipeline Android Streaming
> **LEER SIEMPRE AL INICIO DE CADA SESIÓN antes de tocar cualquier archivo.**
> Actualizar al final de cada sesión o cuando cambie el estado de un test.
> Última actualización: 2026-05-12

---

## ¿Qué es este proyecto?

Sistema de QA autónomo con 4+1 agentes para testear apps Android de streaming (tvnPass, NextOTT, etc.) desde un monorepo. Los tests son genéricos — corren para cualquier cliente según `APP_ID`.

---

## Dispositivos físicos

| Dispositivo | Serial ADB | Conexión | Estado |
|---|---|---|---|
| Xiaomi 24049RN28L | `fy9tgmv4kbtox4mj` | WiFi `192.168.1.231:5555` | ✅ Activo (principal) |
| Samsung SM-A536E Galaxy A53 5G | `R5CTB1W92KY` | USB | ✅ Disponible |

---

## Apps bajo prueba

| App ID | Package Android | Estado tests |
|---|---|---|
| `tvnPass` | `com.streann.tvnpass` | Tests históricos en `apps/tvnPass/tests/e2e/` |
| `NextOTT` | `com.mediastream.next` | Tests genéricos en `tests/e2e/` — **en desarrollo activo** |

---

## Flujo completo del pipeline (cómo invocar)

```
1. Agente 0 (explorer_android.py)
   └── Genera: apps/{APP_ID}/ui_map_android.json
   └── Cuándo correr: solo al agregar una app nueva o detectar UI drift
   └── NextOTT: ui_map_android.json NO existe todavía → hasTab() asume true

2. Agente 1.5 (test_case_reader.py)
   └── Lee: test_cases/android/menu.md (u otros .md)
   └── Filtra: casos según features del client_config.json y navigator
   └── Produce: payload JSON para Agente 2

3. Agente 2 (generator_executor.py) — MODO generate
   └── Lee: payload de Agente 1.5
   └── Genera: tests/e2e/*.test.js (genéricos, usan clientConfig.js)
   └── Tests NO deben hardcodear labels ni selectores de un cliente específico

4. Agente 2 — MODO execute
   └── Corre: APP_ID=NextOTT npm run test:android
   └── Device: Xiaomi fy9tgmv4kbtox4mj (WiFi ADB)
   └── Reporter: Allure + screenshots automáticos en wdio.conf.js

5. Agente 3 (vision_validator.py)
   └── Lee: screenshots de failures/ y happy_path/
   └── Emite: veredicto passed/failed/blocking
```

### Comando para correr tests manualmente
```powershell
# Desde C:\Users\Mateo\pipeline-QA-auto\tests\
$env:APP_ID="NextOTT"; $env:ANDROID_DEVICE_NAME="fy9tgmv4kbtox4mj"; npx wdio run wdio.conf.js
```

---

## Arquitectura de tests genéricos

```
tests/
├── e2e/
│   ├── clientConfig.js        ← carga config del cliente activo (APP_ID)
│   ├── test_menu.test.js      ← ME-GE-01, 02, 03, 17, 18
│   ├── test_busqueda.test.js  ← ME-GE-06, 07, 15
│   └── test_secciones.test.js ← ME-GE-08 al 13
├── helpers/
│   ├── appState.js            ← normalizarEstadoApp, resetAgresivo, dismissPromoPopupIfVisible
│   ├── clickHelper.js         ← clickElement
│   ├── waitFor.js             ← waitForElement, waitForText
│   ├── pageContains.js        ← pageContains, pageContainsAny
│   └── screenshot.js          ← takeScreenshot
apps/
├── NextOTT/
│   ├── client_config.json     ← fuente de verdad: navigator, i18n, features, native.android.package
│   └── ui_map_android.json    ← NO EXISTE AÚN (pendiente correr Agente 0)
└── tvnPass/
    └── client_config.json     ← configurado y funcionando
```

### Cómo clientConfig.js resuelve selectores
1. Buttons del `ui_map_android.json` (si existe) — máxima prioridad
2. `bottom_bar` del ui_map
3. Valores i18n del `client_config.json` (e.g., `nav_home: "HOME"`)
4. Título del navigator como último fallback

### Reglas críticas de tests genéricos
- **NUNCA hardcodear** labels (`~HOME`, `~Inicio`) — siempre `tabSelector()` / `clickTab()`
- **`clickTab(logicalName)`** intenta múltiples selectores y hace `browser.back()` si el navbar está oculto
- **`hasTab(logicalName)`** retorna `true` cuando no hay ui_map (no skipear tests silenciosamente)
- **`resetAgresivo()` + `normalizarEstadoApp()`** solo en `before()`, NUNCA dentro de `it()`
- **`browser.back()`** para recuperar navbar oculto — NO keycode 4 (cierra la app)
- **`appState.js`** lee el package de `apps/{APP_ID}/client_config.json` para `activateApp()`

---

## Estado actual de tests — NextOTT (último run: 2026-05-12)

### test_busqueda.test.js ✅ 3/3 PASSED
| Test ID | Nombre | Estado |
|---|---|---|
| ME-GE-06 | `me_ge_06_busqueda_basica_funcional` | ✅ PASS |
| ME-GE-07 | `me_ge_07_busqueda_avanzada_filtros` | ✅ PASS (skipped, feature off) |
| ME-GE-15 | `me_ge_15_busqueda_sin_resultados_muestra_mensaje` | ✅ PASS |

### test_menu.test.js ❌ 3/5 PASSED
| Test ID | Nombre | Estado | Causa del fallo |
|---|---|---|---|
| ME-GE-01 | `me_ge_01_secciones_principales_menu` | ❌ FAIL | Loop usa `tab.name` ("AppRecommended") en lugar de alias lógico ("home"). `clickTab("AppRecommended")` no encuentra el elemento. **FIX PENDIENTE** |
| ME-GE-02 | `me_ge_02_componentes_home_interactivos` | ✅ PASS | |
| ME-GE-03 | `me_ge_03_explorar_discover_navegable` | ✅ PASS | |
| ME-GE-17 | `me_ge_17_tiempo_carga_home_bajo_5s` | ✅ PASS | |
| ME-GE-18 | `me_ge_18_imagenes_calidad_posicion` | ❌ FAIL | Usa `clickElement(tabSelector('discover'))` en lugar de `clickTab('discover')` — sin back recovery cuando navbar oculto. **FIX PENDIENTE** |

### test_secciones.test.js ⚠️ 5/6 PASSED
| Test ID | Nombre | Estado | Causa del fallo |
|---|---|---|---|
| ME-GE-08 | `me_ge_08_epg_en_vivo_carga_canales` | ✅ PASS | |
| ME-GE-09 | `me_ge_09_radios_lives_lista_carga` | ✅ PASS | |
| ME-GE-10 | `me_ge_10_podcasts_audio_lista_carga` | ✅ PASS | |
| ME-GE-11 | `me_ge_11_videos_series_lista_carga` | ❌ FAIL | Navega a Discover pero los labels buscados ('Video','Videos','Series') no aparecen en la pantalla de NextOTT. Probablemente la sección tiene otro nombre en esta app. **FIX PENDIENTE** |
| ME-GE-12 | `me_ge_12_mi_cuenta_visible` | ✅ PASS | |
| ME-GE-13 | `me_ge_13_descargas_accesible` | ✅ PASS | |

---

## Fixes ya aplicados (no repetir)

| Fix | Archivo | Descripción |
|---|---|---|
| `hasTab()` sin ui_map | `tests/e2e/clientConfig.js` | Retorna `true` cuando no hay ui_map — evita skip silencioso de todos los tests |
| `tabSelector()` orden i18n | `tests/e2e/clientConfig.js` | Ahora prioriza valores i18n (e.g., `nav_home: "HOME"`) antes del título del navigator |
| `clickTab()` back recovery | `tests/e2e/clientConfig.js` | Si navbar oculto: `browser.back()` + pausa + retry selectores |
| `appState.js` APP_ID dinámico | `tests/helpers/appState.js` | Lee `native.android.package` del `client_config.json` del cliente activo |
| `native` block en NextOTT | `apps/NextOTT/client_config.json` | Agregado `native.android.package: "com.mediastream.next"` |
| Auto-fix crash | `agents/generator_executor.py` | `_fix_failing_tests`: manejo de `file_spec` string vs dict |
| Prompt navbar recovery | `prompts/agent2_gen_exec.md` | Documentado que `browser.back()` es la solución para navbar oculto |
| ME-GE-01 loop lógico | `tests/e2e/test_menu.test.js` | Loop usa nombres lógicos `['home','discover','search','account']` en vez de `tab.name` del navigator |
| ME-GE-18 clickTab | `tests/e2e/test_menu.test.js` | Reemplazado `clickElement(tabSelector())` por `clickTab()` con back-recovery |
| ME-GE-11 variantes video | `tests/e2e/test_secciones.test.js` | Labels expandidos: Video/Series/Categorias/Vodcast/VOD en mayúsculas y minúsculas; sección siempre en Explorar |

---

## Fixes PENDIENTES

| Prioridad | Archivo | Problema | Solución |
|---|---|---|---|
| 🟡 Media | `tests/helpers/appState.js` | `mobile: queryAppState` usa `bundleId` en lugar de `appId` (Appium 3) | Cambiar parámetro a `appId` |
| 🟢 Baja | `apps/NextOTT/` | `ui_map_android.json` no existe | Correr Agente 0 para NextOTT |
| 🟡 Media | `tests/helpers/appState.js` | `mobile: queryAppState` usa `bundleId` en lugar de `appId` (Appium 3) | Cambiar parámetro a `appId` |
| 🟢 Baja | `apps/NextOTT/` | `ui_map_android.json` no existe | Correr Agente 0 para NextOTT |

---

## Errores conocidos y su solución

| Error | Causa | Solución |
|---|---|---|
| `Tab "AppRecommended" no encontrado` | `tab.name` del navigator no es alias lógico | Usar nombres lógicos en el loop de `me_ge_01` |
| `~Navegar no encontrado` | navbar oculto + usa `clickElement` sin back recovery | Usar `clickTab()` que ya tiene el recovery |
| `~Inicio no encontrado` | NextOTT usa `~HOME` (del i18n `nav_home: "HOME"`) | Ya corregido — `tabSelector()` usa i18n primero |
| App no activa / `activateApp` falla | `appState.js` usaba package hardcodeado de tvnPass | Ya corregido — lee de `client_config.json` |
| `TypeError: string indices must be integers` | `_fix_failing_tests` recibía string en lugar de dict | Ya corregido en `generator_executor.py` |

---

## Archivos clave a conocer

| Archivo | Propósito |
|---|---|
| `tests/e2e/clientConfig.js` | Bridge runtime — resuelve tabs, selectores, features para cualquier cliente |
| `tests/helpers/appState.js` | Helpers de estado de app (reset, normalize, dismiss popup) |
| `tests/wdio.conf.js` | Config WebdriverIO — capabilities, specs dinámicos por APP_ID, afterEach screenshots |
| `apps/NextOTT/client_config.json` | Config del cliente NextOTT — navigator, i18n, features, native package |
| `apps/tvnPass/client_config.json` | Config del cliente tvnPass |
| `test_cases/android/menu.md` | Casos de prueba fuente (14 casos ME-GE-01 a ME-GE-18) |
| `agents/test_case_reader.py` | Agente 1.5 — filtra casos por features y genera payload para Agente 2 |
| `agents/generator_executor.py` | Agente 2 — genera y ejecuta tests |
| `prompts/agent2_gen_exec.md` | Prompt del Agente 2 con todas las convenciones de código |
