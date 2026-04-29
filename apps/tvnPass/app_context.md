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
| Búsqueda con query | Escribir texto → resultados → click show | DOD-04 | desde en_vivo |
| Programación | Navegar Anteayer/Ayer/Hoy/Mañana | — | en_vivo (launch) |
| Logout | Via tab Menú → opción de sesión | DOD-08 | desde en_vivo → Menú |

---

## Flujo de Búsqueda — Guía técnica completa

### Pantalla Buscar (pantalla vacía)
- **Activar:** `await clickElement('~Buscar');`
- **Campo de texto:** `EditText` con placeholder `text='Buscar...'` en bounds `[151,145][1039,278]`
- **Selector del wrapper:** `~Ingresa tu búsqueda` (ViewGroup clickable que envuelve el EditText)
- **Indicador visual:** TextView `'Ingresa tu búsqueda'` visible cuando no hay query

### Escribir un query de búsqueda
```javascript
// Paso 1: navegar a Buscar
await clickElement('~Buscar');

// Paso 2: activar campo de texto (tocar el wrapper o el EditText directamente)
await clickElement('~Ingresa tu búsqueda');

// Paso 3: escribir con browser.keys (NO usar sendKeys)
await browser.keys(['n','o','t','i','c','i','a','s']);

// Paso 4: validar que aparecieron resultados
const hayResultados = await pageContains('Mesa de Periodistas');
expect(hayResultados).toBe(true);
```

### Pantalla de Resultados
- Cada resultado es un `ViewGroup` clickable con `content-desc = 'Título del Show, Descripción'`
- **Pattern de selector:** `android=new UiSelector().descriptionContains("Título")`
- **Alternativa:** `~Título del Show, Descripción completa`

### Navegar a un Show desde resultados
```javascript
// Click en un show por título parcial (más robusto que exacto)
await clickElement('android=new UiSelector().descriptionContains("Mesa de Periodistas")');

// Validar que llegamos al detalle del show
const enDetalle = await pageContains('Mesa de Periodistas');
expect(enDetalle).toBe(true);
```

### Shows conocidos (query "noticias")
| Selector | Content-desc parcial |
|----------|---------------------|
| `descriptionContains("Especial de Fin")` | Especial de Fin de Año de TVN Noticias 2024 |
| `descriptionContains("Contenido Exclusivo")` | Contenido Exclusivo, con noticias... |
| `descriptionContains("Mesa de Periodistas")` | Mesa de Periodistas, Entérate junto a... |
| `descriptionContains("Mundo Verde")` | Mundo Verde, Dale un vistazo... |
| `descriptionContains("TVMAX Deportes")` | TVMAX Deportes, La mejor información... |

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

## Hero EPG — Comportamiento crítico

- **Posición dinámica:** El Hero EPG puede cambiar de posición en pantalla en cualquier momento. NUNCA usar coordenadas fijas. Siempre localizar por content-desc o texto.
- **Tabs EPG:** Los tabs de navegación son `Anteayer`, `Ayer`, `Hoy`, `Mañana`. Los tests deben hacer click real en cada tab y validar que cargó. `Hoy` siempre debe existir.
- **Canales dinámicos:** Los canales disponibles varían en cualquier momento. Siempre detectar canales activos con `UiSelector.descriptionMatches(".*•.*")` antes de intentar cambiar de canal.
- **Georestrición:** Puede haber canales con georestrición. Señales: `no disponible en tu región`, `contenido no disponible`, `geo`, `región`. Si aparece tras cambiar canal, saltar al siguiente disponible.
- **EN VIVO variantes:** El botón/sección EN VIVO puede aparecer como `EN VIVO`, `TVN EN VIVO`, `En Vivo`. Siempre usar `pageContainsAny` con todas las variantes.
- **VER AHORA:** Botón opcional dentro de TVN EN VIVO — presionar solo si está visible (`pageContainsAny(['VER AHORA', 'Ver ahora'])`).
- **Appium `*:adb_shell`:** El servidor Appium debe arrancarse con `--allow-insecure "*:adb_shell"` para que `tapAdb`/`swipeAdb` funcionen vía `mobile: shell`.
