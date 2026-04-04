# LEARNINGS — Kit-Ott-Suite

> Patrones aprendidos, errores encontrados y decisiones tomadas.
> Objetivo: reducir el tiempo de arranque en cada sesión nueva.
> No reemplaza CLAUDE.md — ese es el contrato del sistema. Este es el diario técnico.
> Última actualización: 2026-04-04

---

## Bugs encontrados en código existente

### [BUG-01] Desconexión de claves entre Agente 1 y Agente 2
**Archivo:** `agents/generator_executor.py` · `execute_tests()` y `generate_tests()`
**Problema:** El Agente 1 produce `decision.execute` y `decision.generate`, pero el Agente 2 lee `execute_request` y `generate_request` — claves distintas. `run_on_pr.sh` pasa el output del Agente 1 directamente al Agente 2 sin transformar las claves.
**Estado:** Detectado, no corregido (requiere decisión del equipo sobre qué clave usar).
**Impacto:** Si se activa el pipeline real, el Agente 2 recibirá dicts vacíos y ejecutará `skipped`.

### [BUG-02] `execute_tests` espera `tests` como dict, pytest-json-report entrega lista
**Archivo:** `agents/generator_executor.py` línea 119
**Problema:** El código hace `result_data.get("tests", {}).get(test, {})` asumiendo que `tests` es un dict keyed por nombre de test. En realidad `pytest-json-report` devuelve `tests` como lista de objetos.
**Estado:** Detectado, no corregido.
**Impacto:** El chequeo DOD siempre falla silenciosamente (nunca encuentra el test en el dict vacío → marca todo como failed).

---

## Decisiones de arquitectura

### [DEC-01] `waitForIdleTimeout: 0` en Android es crítico
**Por qué:** Sin esto, cada comando de Appium espera hasta 20s para que la UI esté "idle". En una app de streaming con animaciones continuas, la UI nunca queda idle → timeouts constantes.
**Dónde:** `wdio.conf.js` y `explorer_android.py` capabilities.
**Regla:** Siempre incluirlo en caps de Android. Nunca borrarlo.

### [DEC-02] Page source XML >> findElement en Android
**Por qué:** `browser.getPageSource()` + `src.includes(text)` es 3-5x más rápido que buscar un elemento por UiSelector cuando solo necesitas verificar presencia.
**Cuándo usarlo:** Checks de estado, verificación de pantalla, detección de ads. No para interacción (ahí sí usar `$(...).click()`).
**Implementado en:** `pageContains.js`, `normalizarEstadoApp()`, toda la detección del live player.

### [DEC-03] `mobile: startActivity` bloqueado en Android 16
**Por qué:** Google bloqueó esta API en Android 16 por restricciones de seguridad.
**Alternativa:** `mobile: activateApp` + `mobile: pressKey` (keycode 3 = HOME).
**Implementado en:** `appState.js` → `normalizarEstadoApp()`.
**Regla:** Nunca usar `startActivity` en tests Android. Siempre `activateApp`.

### [DEC-04] El explorador Android es herramienta de onboarding, no pipeline diario
**Por qué:** El Agente 0 Android se diseñó para descubrir una app nueva. TVN Pass ya tiene suite completa.
**Cuándo usarlo:** Al agregar una nueva app Android, o cuando el UI cambia radicalmente.
**No usarlo:** En cada PR ni en nightly.

### [DEC-05] `gh pr comment` requiere `GH_TOKEN` explícito en el step de Actions
**Por qué:** GitHub Actions no inyecta `GITHUB_TOKEN` como `GH_TOKEN` automáticamente — son variables distintas. El CLI de `gh` lee `GH_TOKEN`.
**Solución:** Agregar `GH_TOKEN: ${{ github.token }}` en el `env:` del step que llama a `run_on_pr.sh`.
**Implementado en:** `.github/workflows/qa_agent.yml` step "Run QA Agent (PR)".

### [DEC-06] El comentario PR no bloquea el pipeline si `gh` falla
**Por qué:** Si el runner no tiene `gh` instalado o el token falla, no queremos que eso rompa los tests.
**Implementado en:** `run_on_pr.sh` → `post_pr_comment.py ... || echo "⚠️  continúa"`.

---

## Patrones que funcionan

### [PAT-01] Helpers como módulos separados (no inline en el test)
**Por qué:** Los helpers inline no se pueden unit testear con Jest sin arrancar Appium. Al extraerlos a `helpers/*.js` se mockean limpiamente con `global.browser = jest.fn()`.
**Aplica a:** Cualquier función que use `browser.*` o `$()`.

### [PAT-02] Mock de Claude API con `make_claude_mock(response_text)`
**Patrón:**
```python
from unittest.mock import patch
mock_client = make_claude_mock(json.dumps(expected_output))
with patch("agents.analyzer.anthropic.Anthropic", return_value=mock_client):
    result = analyzer.run(trigger, diff, app_id)
```
**Dónde está el helper:** `tests/agents/conftest.py` → `make_claude_mock()`.

### [PAT-03] `normalizarEstadoApp()` como punto de entrada universal
**Por qué:** La app puede estar en 5 estados distintos entre tests (background, PiP, fullscreen, home, no corriendo). Esta función normaliza todos a home screen antes de cada test, eliminando el 80% de los flaky tests de estado.
**Regla:** Llamarla siempre en el `it('01 - La app carga...')` y cuando hay duda del estado.

### [PAT-04] Datos mock para el generador de comentarios
**Ubicación:** `scripts/test_data/`
**Uso:** `python scripts/post_pr_comment.py --dry-run --agent1 mock_agent1_failed.json ...`
**Sirve para:** Ver el formato del comentario PR sin necesitar un run real.

### [PAT-05] `--dry-run` en scripts que tienen side effects externos
**Por qué:** Permite probar la lógica de formateo/construcción sin publicar a GitHub, Slack, etc.
**Implementado en:** `post_pr_comment.py`.
**Patrón a seguir:** Cualquier script nuevo que llame a APIs externas debe tener `--dry-run`.

---

## Gotchas de testing

### [GOT-01] `pytest.ini` debe excluir `apps/` para no conflictuar con los E2E de Appium
**Por qué:** `apps/tvnPass/tests/conftest.py` importa fixtures de Appium que no están disponibles fuera del contexto del runner físico.
**Solución:** `norecursedirs = apps` en `pytest.ini`.

### [GOT-02] `browser.pause` debe estar en el mock de `waitFor` para que los tests sean rápidos
**Por qué:** Si no se mockea, `browser.pause` no existe como global en Jest y el test lanza `ReferenceError`. Al mockearlo con `jest.fn().mockResolvedValue(undefined)` las pausas son instantáneas.

### [GOT-03] Los tests de `appState` necesitan `mockImplementation` no `mockResolvedValue`
**Por qué:** `browser.execute` se llama con distintos primeros argumentos (`queryAppState`, `activateApp`, `pressKey`). Con `mockResolvedValue` fijo no se puede distinguir cuál llamada es cuál.
**Solución:**
```js
browser.execute.mockImplementation(async (cmd) => {
  if (cmd === 'mobile: queryAppState') return 4;
  return undefined;
});
```

### [GOT-04] El `type: "commonjs"` en `package.json` afecta cómo Jest resuelve módulos
**Por qué:** Con `type: "commonjs"`, Jest funciona sin Babel ni transformers adicionales. Si se cambia a `"module"` (ESM), Jest necesita configuración adicional (`transform`, `extensionsToTreatAsEsm`).
**Regla:** Mantener `"type": "commonjs"` en el `package.json` de Android mientras se use Jest sin Babel.

---

## Contexto de dispositivos

| Dispositivo | Serial ADB / UDID | Uso |
|-------------|------------------|-----|
| Samsung Android (físico) | `R5CTB1W92KY` | TVN Pass Android E2E |
| iPhone (pendiente) | — | TVN Pass iOS (cuando llegue a Mac Mini) |

---

## Variables de entorno requeridas (resumen rápido)

```bash
# Mínimo para correr agentes localmente
ANTHROPIC_API_KEY=sk-...
APP_ID=tvnPass
APPIUM_SERVER_URL=http://localhost:4723

# Android
ANDROID_DEVICE_NAME=R5CTB1W92KY
ANDROID_APP_PACKAGE=com.streann.tvnpass
ANDROID_APP_ACTIVITY=com.streann.tvnpass.MainActivity
ANDROID_HOME=C:\Users\santi\AppData\Local\...\platform-tools
JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot

# GitHub Actions (automático)
GH_TOKEN   # = ${{ github.token }} — para gh pr comment
```
