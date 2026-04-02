# App Context — Ditu (com.caracol.ditu)

## Qué es
Ditu es la app de streaming de Caracol TV para el mercado colombiano. Ofrece TV en vivo, contenido on demand (series, películas, novelas), radio y EPG integrado. La app es gratuita con registro; en el futuro habrá contenido premium de pago. El registro es inmediato — no requiere confirmación de correo electrónico.

## Flujos principales

| Flujo | Descripción |
|-------|-------------|
| Registro | Crear cuenta con email/password → seleccionar perfil → home |
| Login | Email/password → selector de perfiles → home |
| Logout | Información → Cerrar sesión → pantalla de login |
| Live TV | Home → preview canal → tap fullscreen o VER MÁS → player en vivo |
| EPG | Home → sección PROGRAMACIÓN → programas por canal y horario |
| VOD | Catálogo → highlight o carrusel → detalle → reproducir |
| Búsqueda | Tab Buscar → query → resultados → detalle → reproducir |
| Selector de perfiles | Post-login → grid de perfiles → seleccionar → home |

## Pantallas mapeadas

| Pantalla | Trigger | Elementos clave |
|----------|---------|-----------------|
| Home (unauthenticated) | app_launch | player_previewContent, player_login_prompt_overlay, btn_chip_*, lbl_programmingTitle, "Vamos allá" |
| Home (authenticated) | login+profile | player_previewContent, btn_fullScreen, lbl_programmingTitle, chip filters |
| Catálogo | tap:btn_tbCatalog | lbl_posterCarouselTitle, lbl_hightlightContentTitle, img_highlightDisplayedImage |
| Buscar | tap:btn_tbSearch | searchBar, car_catalog, icn_search |
| Información | tap:btn_tbInformation | lbl_informationTitle, "Iniciar sesión" / "Cerrar sesión", lbl_appVersion, v2.3.0 |

## Tab Bar

```
btn_tbLiveTv | btn_tbCatalog | btn_tbSearch | btn_tbInformation | GCKUICastButton
```

## DOD Map

| Flujo crítico | DOD ID |
|--------------|--------|
| Login email | DOD-01 |
| Registro / Onboarding | DOD-06 |
| Reproducción video (live + VOD) | DOD-03 |
| EPG y rendimiento del player | DOD-03 |
| Búsqueda | DOD-04 |
| Selector de perfiles | DOD-05 |
| Logout | DOD-08 |
| Sin conexión | DOD-09 |
| Accesibilidad | DOD-10 |

## Comportamientos conocidos

- **Lives inestables**: los streams en vivo fallan con frecuencia. Los tests de live TV deben tener timeouts generosos (15s para buffer inicial) y no marcar como DOD failure si es un error de red transitorio.
- **Registro sin confirmación de correo**: se puede crear una cuenta y hacer login inmediatamente. Los tests pueden generar cuentas únicas por run sin flujo de email verification.
- **PiP del sistema**: al salir de la app mientras hay video reproduciéndose, iOS activa Picture-in-Picture. Siempre llamar `_dismiss_pip()` antes de `terminate_app()` en conftest.
- **Estado post-login**: el home puede quedar en cualquier tab al reabrir. Siempre navegar a la tab correcta antes de assertions.
- **Google Cast**: GCKUICastButton siempre presente en tab bar — ignorar en tests (es SDK de terceros).
- **App version**: v2.3.0 (1) — actualizar en dod_rules.py si cambia.

## Targets

- **Mercado**: Colombia únicamente
- **Dispositivos primarios**: iPhone físico (iOS 16+), iPhone 14 sim, iPad Air sim
- **Plataformas**: iOS 16+
