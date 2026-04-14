# Comandos del sistema QA Android

## Setup inicial (una sola vez)

### Instalar dependencias Python
```powershell
python -m pip install -r requirements.txt
```
Instala todas las librerías Python necesarias (anthropic, appium-python-client, etc.)

### Instalar dependencias Node
```powershell
npm install
```
Instala WebdriverIO, Appium, drivers y todo el stack de tests E2E.

### Instalar driver UiAutomator2 (una sola vez por máquina)
```powershell
$env:APPIUM_HOME = "C:\Users\santi\.appium"
node_modules\.bin\appium driver install uiautomator2@2
```
Instala el driver de Android para Appium. Solo se necesita hacer una vez.

---

## Conexión al dispositivo

### Conectar Samsung por WiFi ADB
```bash
adb connect 192.168.1.129:5555
```
Conecta el Samsung físico por WiFi. Correr antes de cualquier test.

### Verificar dispositivos conectados
```bash
adb devices
```
Lista los dispositivos ADB conectados. Debe aparecer `192.168.1.129:5555  device`.

### Fijar puerto ADB (evita que cambie al reiniciar debugging)
```bash
adb tcpip 5555
```
Fija el puerto ADB al 5555 permanentemente hasta el próximo reboot.

---

## Arrancar Appium

### Iniciar servidor Appium (terminal dedicada)
```powershell
$env:APPIUM_HOME = "C:\Users\santi\.appium"
npx appium
```
Arranca el servidor Appium en `localhost:4723`. Debe estar corriendo antes del Explorer. Los tests E2E lo inician automáticamente via wdio.conf.js.

---

## Agente 0 — Explorer (una sola vez por app nueva)

### Explorar la app y generar ui_map_android.json
```powershell
$env:APP_ID = "tvnPass"
$env:APP_BUNDLE_ID = "com.streann.tvnpass"
$env:ANDROID_DEVICE_NAME = "192.168.1.129:5555"
$env:APPIUM_HOME = "C:\Users\santi\.appium"
$env:ANDROID_HOME = "C:\Users\santi\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools"
$env:ANTHROPIC_API_KEY = "sk-ant-..."
python agents/explorer_android.py
```
Navega automaticamente por la app, mapea todos los elementos UI y genera `apps/tvnPass/ui_map_android.json`. Requiere Appium corriendo.

---

## Tests E2E — Correr localmente

### Correr suite completa Android
```powershell
$env:APP_ID = "tvnPass"
$env:ANDROID_DEVICE_NAME = "192.168.1.129:5555"
$env:APPIUM_HOME = "C:\Users\santi\.appium"
npm run test:android
```
Corre todos los tests E2E en el Samsung. WebdriverIO arranca y detiene Appium automáticamente.

### Correr solo unit tests (sin dispositivo)
```powershell
npm run test:unit
```
Corre los tests Jest de los helpers. No requiere dispositivo ni Appium.

---

## GitHub Actions runner

### Arrancar el runner (terminal dedicada)
```
C:\actions-runner\run.cmd
```
Inicia el runner que escucha jobs de GitHub Actions. Debe estar corriendo siempre para que el pipeline funcione.

---

## Variables de entorno requeridas

| Variable | Valor | Para qué |
|----------|-------|---------|
| `APP_ID` | `tvnPass` | Identifica la app a testear |
| `ANDROID_DEVICE_NAME` | `192.168.1.129:5555` | IP:puerto del Samsung por WiFi ADB |
| `APPIUM_HOME` | `C:\Users\santi\.appium` | Donde están los drivers de Appium |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | API key de Claude (Agentes 1, 2, 3) |
| `APP_BUNDLE_ID` | `com.streann.tvnpass` | Package ID de la app Android |

---

## Flujo completo del pipeline (automatico en cada PR)

```
PR abierto
    │
    ├── Fase 0: Agent 1 analiza el diff → publica sugerencias en el PR
    ├── Fase 1: Jest unit tests (sin dispositivo)
    ├── Fase 2: Agent 1 + Agent 2 → tests E2E en Samsung (con dispositivo)
    └── Fase 3: Agent 3 valida screenshots con Claude Vision
```
