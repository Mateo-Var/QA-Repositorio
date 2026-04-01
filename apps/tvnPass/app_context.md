# app_context.md — app_streaming_mx

> Contexto base de esta app. El Agente 1 lo lee en cada run para entender qué está testeando.

---

## Qué es esta app

App de streaming tipo Netflix para el mercado mexicano. Permite autenticarse, explorar un catálogo de contenido, reproducir video, buscar títulos, gestionar perfiles y realizar pagos in-app.

---

## Flujos principales

| Flujo | Descripción | Criticidad |
|-------|-------------|------------|
| Login email | Autenticación con email + password | DOD |
| Login SSO | Autenticación vía proveedor externo (Safari/webview) | DOD |
| Selector de perfiles | Grid de perfiles tras login | DOD |
| Reproductor de video | Playback, buffer, controles | DOD |
| Búsqueda | Query en tiempo real, historial, sugerencias | DOD |
| Onboarding | Flujo de bienvenida, máx 4 pantallas | DOD |
| Pago in-app | Selección de plan, confirmación de transacción | DOD |
| Logout | Cierre de sesión, retorno a login | DOD |
| Modo offline | App sin conexión — sin crash | DOD |
| Accesibilidad | VoiceOver navegable sin errores | DOD |

---

## Stack técnico relevante para tests

- **Autenticación:** Email/password + SSO (abre Safari, retorna con token)
- **Reproductor:** AVPlayer nativo con controles custom
- **Pagos:** StoreKit / in-app purchases
- **Navegación:** Tab bar en iPhone, sidebar en iPad
- **Imágenes:** Carga lazy con skeleton screens

---

## Dispositivos objetivo

| Device | Uso |
|--------|-----|
| iPhone SE | Pantalla más pequeña — validar layouts |
| iPhone 14 | Baseline principal |
| iPhone 15 Pro | ProMotion, Dynamic Island |
| iPad Air (5th gen) | Tablet layout — sidebar, split view |

---

## Variables de entorno específicas

```
APP_BUNDLE_ID=com.tuempresa.streamingapp
APP_PATH=      # ruta al .ipa o vacío si ya está instalada
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
DEVICE_UDID=   # del dispositivo físico
```

---

## Notas de comportamiento conocido

- El PIN infantil tiene una demora ~300ms antes de aceptar input en simulador (no en físico).
- El SSO redirige a Safari — el driver necesita manejar el cambio de app y el retorno.
- El selector de perfiles se saltea automáticamente si el usuario tiene un solo perfil.
- Los controles del reproductor se ocultan tras 3s de inactividad — timing sensible en tests.
