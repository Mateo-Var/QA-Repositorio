# Batería de Pruebas Genérica — Menú | Android

**Plataforma:** iOS (XCUITest)  
**Flujo:** Navegación y funcionalidades del menú principal  
**Selectores preferidos:** `~accessibility label` → `-ios predicate string` → `-ios class chain`  
**Nunca usar:** XPath en iOS  

> Los selectores concretos se resuelven en tiempo de ejecución contra el `ui_map_ios.json` del cliente.  
> Las features incluidas dependen del `client_config.json` del cliente (navigator + has* flags).

---

## ME-GE-01 — Validar secciones principales del menú

**Descripción:** Verificar que las secciones del menú inferior son funcionales al seleccionarlas.

**Precondiciones:**
- App instalada y abierta
- Dispositivo con conexión a internet estable

**Pasos para reproducir:**
1. Abrir la aplicación.
2. Acceder al menú principal (barra inferior).
3. Seleccionar cada tab disponible → confirmar que carga su pantalla.
4. Volver a Home → confirmar que el estado es correcto.

**Resultado esperado:**
- Cada opción del menú lleva a su sección sin errores ni crashes.
- Las secciones cargan completamente y son navegables.

**Selectores:** Resolver desde `ui_map` — buscar elementos de tipo `tab` o `bottom_nav` en la pantalla inicial.

**Severidad:** Crítica  
**DOD asociado:** DOD-01  
**Requiere feature:** `navigator.TabMain` presente

---

## ME-GE-02 — Validar componentes configurados en Home

**Descripción:** Comprobar que sliders, destacados, carruseles y contenido en Home se despliegan y son interactivos.

**Precondiciones:**
- App abierta con conexión a internet estable
- Componentes configurados en el Manager

**Pasos para reproducir:**
1. Acceder a la sección Home desde el menú principal.
2. Verificar que los componentes configurados aparecen en pantalla.
3. Hacer swipe horizontal en carruseles → confirmar que desplazan correctamente.
4. Hacer tap en un elemento → confirmar que redirige al contenido.
5. Verificar que no hay placeholders vacíos después de 5 segundos.

**Resultado esperado:**
- Los componentes cargan según la configuración del Manager.
- Cada interacción lleva al contenido relacionado sin errores.

**Selectores:** Resolver desde `ui_map` — buscar `RecyclerView` o elementos de tipo lista/carrusel en pantalla `Home`.

**Severidad:** Alta  
**DOD asociado:** DOD-03  
**Requiere feature:** `navigator.Home` presente

---

## ME-GE-03 — Validar sección Explorar / Discover

**Descripción:** Verificar que la sección Explorar despliega las subcategorías configuradas y navega correctamente.

**Precondiciones:**
- App abierta con conexión a internet estable

**Pasos para reproducir:**
1. Ir a la sección Explorar/Discover desde el menú principal.
2. Identificar las subcategorías disponibles.
3. Seleccionar cada subcategoría → verificar que el contenido aparece.
4. Hacer tap en un elemento → confirmar redirección.
5. Volver atrás → verificar que Explorar permanece en estado correcto.

**Resultado esperado:**
- Cada subcategoría despliega el contenido configurado sin errores.
- La navegación hacia atrás funciona correctamente.

**Selectores:** Resolver desde `ui_map` — buscar elementos de tipo lista en pantalla `Discover` o `AppDiscover`.

**Severidad:** Alta  
**DOD asociado:** —  
**Requiere feature:** `navigator.AppDiscover` o `navigator.Discover` presente

---

## ME-GE-06 — Búsqueda básica funcional

**Descripción:** Validar que la barra de búsqueda muestra resultados usando contenido real del catálogo.

**Precondiciones:**
- App abierta con conexión a internet estable
- Usar términos del `content_catalog.json` generado por Agente 0

**Pasos para reproducir:**
1. Acceder a la sección Buscar/Search.
2. Ingresar menos de 3 caracteres → confirmar que no aparecen resultados.
3. Ingresar un término real del catálogo (mínimo 3 caracteres) → confirmar resultados.
4. Verificar que los resultados están relacionados con el término ingresado.

**Resultado esperado:**
- Se requieren mínimo 3 caracteres para iniciar la búsqueda.
- Los resultados aparecen cuando se busca contenido existente.
- No hay errores al realizar la búsqueda.

**Nota:** Usar `search_term` inyectado desde `content_catalog.json`. Si no existe, usar el nombre de la app.

**Selectores:** Resolver desde `ui_map` — buscar `EditText` o elemento de búsqueda en pantalla `Search`.

**Severidad:** Alta  
**DOD asociado:** DOD-04  
**Requiere feature:** `config.hasSearch: true` + `navigator.Search` presente

---

## ME-GE-07 — Búsqueda avanzada con filtros

**Descripción:** Comprobar que la búsqueda avanzada filtra resultados por categoría.

**Precondiciones:**
- `advancedSearch: true` en la configuración del cliente
- Usar términos del `content_catalog.json`

**Pasos para reproducir:**
1. Navegar a la sección Buscar.
2. Confirmar que el componente de búsqueda avanzada es visible.
3. Seleccionar una categoría disponible.
4. Ingresar un término real del catálogo → confirmar resultados de esa categoría.
5. Cambiar a otra categoría → confirmar que los resultados cambian.

**Resultado esperado:**
- La búsqueda avanzada filtra resultados correctamente según la categoría.

**Selectores:** Resolver desde `ui_map` — buscar tabs o filtros en pantalla `Search`.

**Severidad:** Media  
**DOD asociado:** DOD-04  
**Requiere feature:** `config.hasSearch: true` + `screens.Search.advancedSearch: true`

---

## ME-GE-08 — Validar sección EPG / En Vivo

**Descripción:** Verificar que la guía de programación EPG carga canales y permite navegación por fecha.

**Precondiciones:**
- App con `hasEpg: true`
- Conexión a internet estable

**Pasos para reproducir:**
1. Navegar a la sección LiveEpg desde Explorar o menú.
2. Verificar que los canales configurados aparecen.
3. Navegar entre fechas (Ayer, Hoy, Mañana) → confirmar que la programación cambia.
4. Hacer tap en un programa → confirmar que navega al detalle o reproduce.

**Resultado esperado:**
- Los canales aparecen correctamente.
- La navegación por fechas funciona sin errores.
- El tap en un programa redirige correctamente.

**Selectores:** Resolver desde `ui_map` — buscar tabs de fecha y lista de canales en pantalla `LiveEpg`.

**Severidad:** Alta  
**DOD asociado:** DOD-03  
**Requiere feature:** `config.hasEpg: true` + `navigator.LiveEpg` presente

---

## ME-GE-09 — Validar sección Radios / Lives

**Descripción:** Verificar que la sección de radios/lives carga la lista y reproduce correctamente.

**Precondiciones:**
- App con `hasRadios: true` o `hasChannels: true`

**Pasos para reproducir:**
1. Navegar a la sección Lives/Radios.
2. Verificar que la lista de canales/radios aparece.
3. Hacer tap en un canal → confirmar que inicia reproducción.
4. Verificar que el reproductor carga sin error.

**Resultado esperado:**
- La lista carga correctamente.
- El reproductor inicia sin errores.

**Selectores:** Resolver desde `ui_map` — buscar elementos de lista en pantalla `Lives` o `LiveRadio`.

**Severidad:** Alta  
**DOD asociado:** DOD-03  
**Requiere feature:** `config.hasRadios: true` o `config.hasChannels: true`

---

## ME-GE-10 — Validar sección Podcasts / Audio

**Descripción:** Verificar que la sección de audios/podcasts carga y reproduce correctamente.

**Precondiciones:**
- App con `hasAudios: true`

**Pasos para reproducir:**
1. Navegar a la sección Podcasts desde Explorar o menú.
2. Verificar que las categorías/shows aparecen.
3. Hacer tap en un episodio → confirmar que inicia reproducción de audio.

**Resultado esperado:**
- La sección carga correctamente.
- La reproducción de audio inicia sin errores.

**Selectores:** Resolver desde `ui_map` — buscar elementos en pantalla `Podcasts` o `ShowPodcast`.

**Severidad:** Media  
**DOD asociado:** —  
**Requiere feature:** `config.hasAudios: true` + `navigator.Podcasts` presente

---

## ME-GE-11 — Validar sección Videos / Series

**Descripción:** Verificar que la sección de videos/series carga contenido y permite reproducción.

**Precondiciones:**
- App con `hasVideos: true`

**Pasos para reproducir:**
1. Navegar a la sección Series/Videos desde Explorar o menú.
2. Verificar que las categorías/shows aparecen.
3. Hacer tap en un episodio → confirmar que inicia reproducción.

**Resultado esperado:**
- La sección carga correctamente.
- La reproducción de video inicia sin errores.

**Selectores:** Resolver desde `ui_map` — buscar elementos en pantalla `Series` o `ShowEpisode`.

**Severidad:** Media  
**DOD asociado:** DOD-03  
**Requiere feature:** `config.hasVideos: true` + `navigator.Series` presente

---

## ME-GE-12 — Validar sección Mi Cuenta

**Descripción:** Verificar que la sección de cuenta muestra la información del usuario correctamente.

**Precondiciones:**
- App con `hasAuth: true`
- Usuario autenticado

**Pasos para reproducir:**
1. Navegar a la sección Account/Mi Cuenta.
2. Verificar que la información del usuario aparece.
3. Verificar que las opciones de cuenta son accesibles.

**Resultado esperado:**
- La información del usuario se muestra correctamente.
- Las opciones de cuenta están disponibles.

**Selectores:** Resolver desde `ui_map` — buscar elementos en pantalla `Account`.

**Severidad:** Media  
**DOD asociado:** —  
**Requiere feature:** `config.hasAuth: true` + `navigator.Account` presente

---

## ME-GE-13 — Validar sección Descargas

**Descripción:** Verificar que la sección de descargas es accesible y muestra el estado correcto.

**Precondiciones:**
- App con `features.hasDownload: true`

**Pasos para reproducir:**
1. Navegar a la sección Downloads/Descargas.
2. Verificar que la pantalla carga correctamente.
3. Si hay descargas, verificar que se listan. Si no, verificar mensaje de estado vacío.

**Resultado esperado:**
- La sección carga sin errores.
- El estado (vacío o con descargas) se muestra correctamente.

**Selectores:** Resolver desde `ui_map` — buscar elementos en pantalla `Downloads`.

**Severidad:** Baja  
**DOD asociado:** —  
**Requiere feature:** `config.features.hasDownload: true` + `navigator.Downloads` presente

---

## ME-GE-15 — Validar mensaje sin resultados en Buscar

**Descripción:** Comprobar que si no se encuentran resultados se muestra un mensaje adecuado.

**Precondiciones:**
- App abierta con conexión a internet estable

**Pasos para reproducir:**
1. Acceder a la sección Buscar.
2. Ingresar un término que no exista (usar `invalid_term` del content_catalog).
3. Verificar que el mensaje de estado vacío aparece en menos de 3 segundos.

**Resultado esperado:**
- Un mensaje de "sin resultados" aparece correctamente en menos de 3 segundos.
- No hay errores ni crashes.

**Nota:** Usar `search_term` del campo `invalid` del `content_catalog.json`.

**Selectores:** Resolver desde `ui_map` — buscar elemento de mensaje vacío en pantalla `Search`.

**Severidad:** Media  
**DOD asociado:** DOD-04  
**Requiere feature:** `config.hasSearch: true` + `navigator.Search` presente

---

## ME-GE-17 — Validar tiempo de carga en Home

**Descripción:** Comprobar que los componentes del Home cargan en menos de 5 segundos.

**Precondiciones:**
- Conexión Wi-Fi estable (mínimo 10 Mbps)

**Pasos para reproducir:**
1. Navegar a Home.
2. Medir el tiempo hasta que los componentes son interactivos.
3. Verificar que no hay placeholders por más de 5 segundos.

**Resultado esperado:**
- Los componentes del Home cargan en menos de 5 segundos.

**Selectores:** Resolver desde `ui_map` — buscar tab Home en barra inferior.

**Severidad:** Alta  
**DOD asociado:** DOD-03  
**Requiere feature:** `navigator.Home` presente

---

## ME-GE-18 — Verificar calidad y posición de imágenes

**Descripción:** Comprobar que las imágenes tienen buena calidad y están centradas en sus contenedores.

**Precondiciones:**
- Contenido con imágenes configurado en el Manager

**Pasos para reproducir:**
1. Navegar por Home, Explorar y Buscar.
2. Verificar que thumbnails y banners están centrados.
3. Verificar que no hay imágenes distorsionadas, cortadas o pixeladas.
4. Verificar que no hay imágenes rotas ni espacios en blanco.

**Resultado esperado:**
- Las imágenes tienen buena calidad visual y están correctamente posicionadas.
- No hay imágenes rotas.

**Selectores:** `android=new UiSelector().className("android.widget.ImageView")`

**Notas:** Usar `takeScreenshot()` y delegar validación al Agente 3 (Validador Visual).

**Severidad:** Media  
**DOD asociado:** —  
**Requiere feature:** `navigator.Home` presente

---

## Notas generales para el agente generador

1. **Selectores:** Resolver SIEMPRE contra el `ui_map_{platform}.json` del cliente. Los selectores en este MD son orientativos.
2. **Reset de estado:** Cada test debe comenzar con `normalizarEstadoApp()`.
3. **Screenshots:** Capturar con `takeScreenshot()` al final de cada paso crítico.
4. **Timeouts:** No usar `browser.pause()`. Usar `waitForElement()` del helper `waitFor.js`.
5. **Catálogo:** Leer `apps/{app_id}/content_catalog.json` para términos de búsqueda reales.
6. **Casos visuales (ME-GE-18):** Delegar validación al Agente 3 vía screenshot.
7. **Features ausentes:** Si una feature no está activa en el cliente, omitir el caso completamente.
