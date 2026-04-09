# app_context.md — tvnPass Android

> Contexto base de esta app. El Agente 1 lo lee en cada run para entender qué está testeando.

---

## Qué es esta app

App de streaming tipo Netflix para el mercado mexicano. Permite autenticarse, explorar un catálogo de contenido, reproducir video en vivo y VOD, buscar títulos, gestionar perfiles y realizar pagos in-app.

---

## Flujos principales

| Flujo | Descripción | Criticidad |
|-------|-------------|------------|
| Login email | Autenticación con email + password | DOD |
| Login SSO | Autenticación vía proveedor externo (WebView) | DOD |
| Reproductor VOD | Playback, buffer, controles | DOD |
| Live TV | Señal en vivo, buffer inicial | DOD |
| Búsqueda | Query en tiempo real, historial, sugerencias | DOD |
| Onboarding | Flujo de bienvenida | DOD |
| Pago in-app | Selección de plan, confirmación de transacción | DOD |
| Logout | Cierre de sesión, retorno a login | DOD |
| Modo offline | App sin conexión — sin crash | DOD |
| Navegación | Tab bar entre secciones principales | DOD |

---

## Stack técnico relevante para tests

- **Autenticación:** Email/password + SSO (abre WebView, retorna con token)
- **Reproductor:** ExoPlayer con controles custom
- **Pagos:** Google Play Billing
- **Navegación:** Bottom navigation bar (Android)
- **Imágenes:** Carga lazy con skeleton screens

---

## Dispositivo objetivo

| Device | Serial ADB | Conexión |
|--------|-----------|---------|
| Samsung (físico) | R5CTB1W92KY | WiFi ADB |

---

## Variables de entorno específicas

```bash
ANDROID_DEVICE_NAME=R5CTB1W92KY
ANDROID_APP_PACKAGE=com.streann.tvnpass
ANDROID_APP_ACTIVITY=com.streann.tvnpass.MainActivity
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

---

## Notas de comportamiento conocido

- `waitForIdleTimeout: 0` es obligatorio — las animaciones del reproductor impiden que la UI quede idle.
- Usar `activateApp` (no `startActivity`) — bloqueado en Android 16+.
- El SSO abre WebView — el driver necesita manejar el cambio de contexto y el retorno.
- Los controles del reproductor se ocultan tras 3s de inactividad — timing sensible en tests.
- Delay de 20-40s en live TV respecto al broadcast es comportamiento esperado, no fallo.
- `browser.getPageSource()` + `.includes()` es 3-5x más rápido que `findElement` para checks de presencia.
