# UX Patterns — Streaming Platforms

> Skill base para el Agente 2. Describe patrones de UX esperados en apps de streaming iOS.
> Usar como referencia al generar assertions en tests E2E.

---

## Flujos principales y sus patrones

### Autenticación
- El botón de login es el CTA primario — debe ser visible sin scroll en todos los tamaños de pantalla.
- Errores de credenciales deben mostrar mensaje inline (no modal) dentro de los primeros 2s.
- SSO: el flujo abre Safari/webview, completa y vuelve a la app automáticamente.
- Biometría: Face ID / Touch ID debe ofrecerse tras el primer login exitoso.

### Selector de perfiles
- Grid de perfiles: máx 5 perfiles visibles, scroll horizontal si hay más.
- Tap en perfil → animación de selección (~200ms) → transición a home.
- Si solo hay 1 perfil, skip automático del selector.
- PIN infantil: teclado numérico, 4 dígitos, sin opción de pegar.

### Home / Catálogo
- Hero banner ocupa el 40-50% del viewport en iPhone, 30% en iPad.
- Carruseles horizontales con snapping al ítem más cercano.
- Títulos en carrusel: thumbnail + título + badge (Nuevo / Trending).
- Loading state: skeleton screens, nunca spinners solos.

### Reproductor de video
- Controles se ocultan automáticamente tras 3s de inactividad.
- Tap en pantalla → muestra controles por 3s más.
- Orientación: auto-rotate al girar el dispositivo.
- Buffer: indicador circular durante buffering, nunca pantalla en negro.
- Error de red: mensaje con botón "Reintentar", no crash.

### Búsqueda
- Resultados aparecen en tiempo real (debounce ~300ms).
- Query vacío: muestra secciones de "Tendencias" y "Recientes".
- Sin resultados: ilustración + sugerencias relacionadas.
- Historial de búsqueda visible al enfocar el campo.

### Onboarding
- Máximo 4 pantallas de onboarding.
- Botón "Omitir" visible en todas las pantallas menos la última.
- Progress dots en la parte inferior.
- La última pantalla siempre tiene un CTA claro (ej. "Empezar").

### Pagos in-app
- Resumen del plan antes de confirmar.
- Pantalla de confirmación con número de transacción.
- Error de pago: mensaje específico (tarjeta rechazada / saldo insuficiente).
- Nunca mostrar número de tarjeta completo.

---

## Patrones de navegación

| Gesto | Acción esperada |
|-------|----------------|
| Swipe izquierda en carrusel | Siguiente ítem |
| Swipe derecha en detalle | Volver atrás |
| Long press en thumbnail | Quick actions (agregar a lista, compartir) |
| Pull to refresh en home | Actualiza catálogo |
| Pinch en reproductor | Sin acción (no zoom) |

---

## Estados de red

- **Online → Offline:** Banner amarillo "Sin conexión" en la parte superior.
- **Offline → Online:** Banner verde "Conexión restaurada" por 3s, luego desaparece.
- **Offline en reproductor:** Pausa automática + mensaje de error recuperable.
- **Contenido descargado:** Disponible en modo offline sin ningún indicador de error.

---

## Accesibilidad (VoiceOver)

- Todos los elementos interactivos deben tener `accessibilityLabel`.
- Imágenes decorativas deben tener `accessibilityElementsHidden = true`.
- Los carruseles deben anunciarse como "X de Y" al navegar con VoiceOver.
- El reproductor debe anunciar cambios de estado (play/pause/buffering).
- Contraste mínimo WCAG AA: 4.5:1 para texto normal, 3:1 para texto grande.

---

## Diferencias iPhone vs iPad

| Elemento | iPhone | iPad |
|----------|--------|------|
| Navegación | Tab bar inferior | Sidebar lateral |
| Detalle de contenido | Push navigation | Split view |
| Reproductor | Full screen | Puede ser en ventana flotante |
| Grid de catálogo | 2 columnas | 4-5 columnas |
| Teclado en búsqueda | Ocupa mitad pantalla | Flotante o dividido |
