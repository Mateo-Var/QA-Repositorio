# Pipeline Debugging — Metodología de Investigación de Errores

> Skill global del sistema QA. Aplica a todos los agentes y plataformas.
> Cada método tiene un nivel de profundidad: rápido (< 2 min), medio (2-10 min), profundo (> 10 min).
> Ir siempre de rápido a profundo — no saltarse niveles.

---

## Método 1 — Leer el reporte de run (rápido)

**Cuándo usarlo:** Primer paso ante cualquier fallo. El JSON del run contiene el estado completo.

```bash
# Leer el reporte más reciente
cat reports/{app_id}/runs/{run_id}.json

# O buscar el último run
ls -t reports/{app_id}/runs/ | head -1
```

**Qué buscar:**

| Campo | Qué indica |
|-------|------------|
| `exit_code` | 0 = éxito, 1 = fallo, otro = crash |
| `dod_status` | `passed` / `failed` / `unknown` |
| `dod_failures` | Lista de DOD IDs que fallaron |
| `stdout` | Últimas 3000 chars del output de npm/wdio |
| `stderr` | Últimas 1000 chars de errores del proceso |

**Señales críticas en stdout/stderr:**

```
"No specs found to run"           → tests E2E no existen en disco
"No device found"                 → ADB no conectado / IP incorrecta
"ECONNREFUSED"                    → Appium no está corriendo
"Error: Cannot find module"       → dependencia npm faltante
"adb: error: device offline"      → USB conectado pero pantalla apagada
"com.android.commands.am.Am"      → activateApp bloqueado (Android 16+)
"TimeoutError"                    → selector no encontrado en el timeout
```

---

## Método 2 — Inspeccionar outputs intermedios de agentes (medio)

**Cuándo usarlo:** El run falló pero el reporte no da suficiente contexto. Los archivos `.qa_tmp/` se preservan cuando el pipeline muere antes del cleanup.

```bash
# Listar runs temporales disponibles
ls .qa_tmp/

# Leer lo que decidió Agent 1
cat .qa_tmp/{run_id}/qa_agent1_output.json

# Leer lo que hizo Agent 2
cat .qa_tmp/{run_id}/qa_agent2_output.json

# Leer el input que se le pasó a Agent 3
cat .qa_tmp/{run_id}/qa_agent3_input.json

# Leer el veredicto de Agent 3
cat .qa_tmp/{run_id}/qa_agent3_output.json
```

**Checklist de validación cruzada:**

```
Agent 1 output:
  □ mode = "execute" o "generate" (no vacío ni null)
  □ app_id correcto
  □ Si mode = execute: test_files lista archivos que EXISTEN en disco
  □ device = IP WiFi (192.168.x.x:5555), no serial USB (R5CTB1W92KY)

Agent 2 output:
  □ mode coincide con lo que Agent 1 pidió (o "execute" si hubo guardia)
  □ run_id presente
  □ screenshots_dir apunta a ruta existente
  □ dod_failures vacío si exit_code = 0

Agent 3 output:
  □ vision_verdict = "passed" / "failed" / "blocking"
  □ block_merge = true solo si hay evidencia visual de fallo crítico
  □ Si no había screenshots: diagnosis explica el motivo
```

**Error silencioso frecuente:** Agent 1 lista un archivo de test en `execute_request.test_files` que no existe en disco. Esto hace que Agent 2 vaya directo a execute y wdio encuentre cero specs. Verificar:

```bash
# Confirmar que los archivos que Agent 1 menciona existen en el runner
ls apps/{app_id}/tests/e2e/
# O en GitHub Actions:
# find /home/runner/work/.../apps/{app_id}/tests/e2e -name "*.test.js"
```

---

## Método 3 — Trazar el flujo de datos entre agentes (profundo)

**Cuándo usarlo:** Hay un bug difícil de reproducir, o el agente toma decisiones incorrectas de forma consistente.

### 3a. Verificar el contrato JSON

```bash
# El contrato define qué campos son obligatorios entre agentes
cat schemas/agent_contract.json
```

Comparar el JSON real de cada agente contra el schema. Si un campo requerido falta o tiene tipo incorrecto, el agente receptor puede fallar silenciosamente.

### 3b. Reproducir el fallo localmente

```bash
# Correr solo Agent 1 con el trigger del PR
APP_ID=tvnPass python agents/analyzer.py .qa_tmp/{run_id}/qa_trigger.json .qa_tmp/{run_id}/qa_diff.txt

# Correr solo Agent 2 con el output anterior
python agents/generator_executor.py .qa_tmp/{run_id}/qa_agent1_output.json

# Correr solo Agent 3
python agents/vision_validator.py .qa_tmp/{run_id}/qa_agent3_input.json
```

Esto aisla en qué agente está el problema sin necesitar un PR completo.

### 3c. Comparar decisión vs realidad en disco

**Hipótesis de trabajo:** si el agente dice que hizo X pero el comportamiento es Y, hay una divergencia entre lo que el LLM planificó y lo que el código ejecutó.

```
Divergencia común:
  Agent 1 decide:  mode = "execute", test_files = ["tvn-pass-live.test.js"]
  Realidad en disco: apps/tvnPass/tests/e2e/ (directorio vacío o inexistente)
  Resultado:        wdio lanza "No specs found"

  Agent 1 decide:  device = "R5CTB1W92KY" (serial USB del runner)
  Realidad:        dispositivo conectado vía WiFi ADB a 192.168.1.129:5555
  Resultado:       "No device found" o tests en dispositivo incorrecto
```

---

## Método 4 — Inspección de estado ADB (medio)

**Cuándo usarlo:** El pipeline falla en la fase E2E y la sospecha es el dispositivo físico.

```bash
# Ver todos los dispositivos conectados
adb devices -l

# Verificar conectividad WiFi
adb connect 192.168.1.129:5555
adb -s 192.168.1.129:5555 shell getprop ro.product.model

# Ver si Appium puede ver el dispositivo
curl http://localhost:4723/status

# Listar sesiones activas de Appium
curl http://localhost:4723/sessions

# Forzar desconexión de sesión colgada
curl -X DELETE http://localhost:4723/session/{session_id}
```

**Checklist de dispositivo:**

```
□ Pantalla desbloqueada (no en lock screen)
□ USB debugging habilitado
□ WiFi ADB activo: adb tcpip 5555 + adb connect IP:5555
□ Misma red WiFi que la máquina de CI
□ ANDROID_DEVICE_NAME = IP:puerto, no serial USB
□ App instalada: adb shell pm list packages | grep tvnpass
```

---

## Método 5 — Leer logs de GitHub Actions (rápido, solo en CI)

**Cuándo usarlo:** El fallo ocurrió en CI y no tienes acceso directo al runner.

```bash
# Ver los últimos runs del workflow
gh run list --workflow=qa_agent.yml --limit=5

# Ver el log de un run específico
gh run view {run_id} --log

# Ver solo los pasos que fallaron
gh run view {run_id} --log-failed

# Descargar artifacts del run
gh run download {run_id}
```

**Qué buscar en los logs de Actions:**

```
"=== Agente 1"     → buscar si Agent 1 terminó o crasheó
"=== Agente 2"     → buscar el modo (generate/execute) y exit code
"=== Agente 3"     → buscar vision_verdict
"ERROR:"           → cualquier bloqueo explícito del pipeline
"continuando sin"  → algún agente falló pero no bloqueó (revisar si debería)
```

---

## Patrones de fallo conocidos

| Síntoma | Causa raíz | Solución |
|---------|------------|----------|
| "No specs found to run" | tests E2E no existen en disco cuando mode=execute | La guardia en `execute_tests()` los genera automáticamente |
| Agent 2 usa device R5CTB1W92KY en CI | `ANDROID_DEVICE_NAME` no está en el env del runner | Verificar secrets en GitHub Actions |
| vision_validator JSONDecodeError | Claude devolvió respuesta vacía (sin screenshots) | Fallback implementado en `vision_validator.py` |
| Pipeline muere en línea 42 | `set -euo pipefail` + comando que retorna != 0 | Agregar `|| true` o `|| echo "..."` al comando |
| Agent 1 alucina nombres de tests | Lee `app_context.md` y asume que los tests mencionados existen | La guardia de `execute_tests()` mitiga esto |
| `.qa_tmp/` no existe post-fallo | El cleanup (`rm -rf`) corrió antes del fallo | Si el fallo es en DOD check (al final), los tmp ya se borraron — buscar en `reports/` |

---

## Agregar métodos nuevos

Este archivo es vivo. Cuando encuentres un patrón de investigación nuevo:

1. Agregar una sección `## Método N — Nombre descriptivo (nivel)`
2. Incluir: cuándo usarlo, comandos exactos, qué buscar, señales de éxito/fallo
3. Si es un patrón de fallo recurrente, agregarlo a la tabla de "Patrones conocidos"
4. Actualizar `LEARNINGS.md` con el BUG o GOT correspondiente si aplica

**Métodos pendientes de documentar:**
- [ ] Análisis de screenshots con Agent 3 en modo manual
- [ ] Debugging de selectores UiAutomator2 con `uiautomatorviewer`
- [ ] Inspección de logs de Appium (`~/.appium/logs/`)
- [ ] Diagnóstico de performance (test que tarda más de 2x el timeout DOD)
