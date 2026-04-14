# app_context.md — tvnPass Android

> Contexto base de esta app. El Agente 1 lo lee en cada run para entender qué está testeando.

---

## Qué es esta app

App de streaming para el mercado latinoamericano (TVN Pass). Transmite señal en vivo y programación bajo demanda. No requiere login activo en el dispositivo de pruebas — el dispositivo está siempre pre-autenticado (`noReset: true`).

---

## Pantalla de inicio real (según UI map)

El Explorer encontró que la app abre directamente al **reproductor en vivo** (`en_vivo`). No hay pantalla de login al lanzar la app en el dispositivo de pruebas.

**Elementos reales en pantalla inicial:**
- `~Mostrar controles del reproductor` (player_view, clickable)
- `~EN VIVO` — tab de programación en vivo
- `~Anteayer`, `~Ayer`, `~Hoy`, `~Mañana` — navegación de programación
- `~VER TODO`, `~TVN RADIO`
- Botones de navegación inferior: `~Inicio`, `~Explorar`, `~Buscar`, `~Menú`

---

## Flujos testeables con el UI map actual

| Flujo | Descripción | Criticidad | Pantalla de entrada |
|-------|-------------|------------|---------------------|
| Reproductor Live | Señal en vivo cargada, buffer completado | DOD-03 | en_vivo (launch) |
| Navegación tabs | Cambio entre Inicio, Explorar, Buscar, Menú | — | en_vivo (launch) |
| Búsqueda | Click en tab Buscar, query, resultados | DOD-04 | desde en_vivo |
| Programación | Navegar Anteayer/Ayer/Hoy/Mañana | — | en_vivo (launch) |
| Logout | Via tab Menú → opción de sesión | DOD-08 | desde en_vivo → Menú |

## Flujos NO testeables sin configuración adicional

| Flujo | Razón | Qué requiere |
|-------|-------|--------------|
| Login email (DOD-01) | Dispositivo siempre pre-autenticado | Logout previo + credenciales |
| Login SSO (DOD-02) | Igual que login email | Logout previo |
| Pago in-app (DOD-07) | Requiere cuenta con plan activo/test | Cuenta de prueba específica |
| Onboarding (DOD-06) | Solo en primera instalación | App limpia sin sesión |

---

## Stack técnico relevante para tests

- **Reproductor:** ExoPlayer con controles custom
- **Navegación:** Bottom navigation bar (Inicio, Explorar, Buscar, Menú)
- **Contenido:** EPG (guía de programación) navegable por fecha

---

## Dispositivo objetivo

| Device | Conexión ADB | IP WiFi |
|--------|-------------|---------|
| Samsung físico | WiFi ADB | 192.168.1.129:5555 |

---

## Variables de entorno específicas

```bash
ANDROID_DEVICE_NAME=192.168.1.129:5555
ANDROID_APP_PACKAGE=com.streann.tvnpass
ANDROID_APP_ACTIVITY=com.streann.tvnpass.MainActivity
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

---

## Notas de comportamiento conocido

- `waitForIdleTimeout: 0` es obligatorio — las animaciones del reproductor impiden que la UI quede idle.
- Usar `activateApp` (no `startActivity`) — bloqueado en Android 16+.
- Los controles del reproductor se ocultan tras 3s de inactividad — timing sensible en tests.
- Delay de 20-40s en live TV respecto al broadcast es comportamiento esperado, no fallo.
- `browser.getPageSource()` + `.includes()` es 3-5x más rápido que `findElement` para checks de presencia.
- El popup de "Appium Settings actualizando" puede aparecer al iniciar sesión — es transitorio, no es fallo del test.
