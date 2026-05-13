# Batería de Pruebas Genérica — Login | Android

**Plataforma:** Android (UiAutomator2)  
**Flujo:** Autenticación y recuperación de cuenta  
**Selectores preferidos:** `~content-desc` → `id:resource-id` → `android=UiSelector().text()`  
**Nunca usar:** XPath en vistas Jetpack Compose

> Los selectores concretos se resuelven en tiempo de ejecución contra el `ui_map_android.json` del cliente.  
> Las features incluidas dependen del `client_config.json` del cliente (`hasAuth` + flags de pantalla de login).

---

## IN-LG-01 — Validar formato de correo en el formulario de inicio de sesión

**Descripción:** Comprobar que el campo de correo valida correctamente el formato ingresado antes de enviar el formulario.

**Precondiciones:**
- App instalada y abierta
- Pantalla de inicio de sesión visible

**Pasos para reproducir:**
1. Abrir la aplicación y acceder al formulario de inicio de sesión.
2. Ingresar un correo con formato incorrecto (ej: `usuario.com` o `usuario@com`).
3. Intentar enviar el formulario.
4. Verificar que aparece el mensaje de error correspondiente.

**Resultado esperado:**
- El sistema muestra un mensaje de error de formato de correo.
- El formulario no se envía mientras el formato sea incorrecto.

**Textos esperados (pageContainsAny):**
- `"Formato de correo inválido"`, `"Email inválido"`, `"Invalid email"`, `"Invalid email format"`, `"correo inválido"`, `"email no válido"`

**Selectores:** Resolver desde `ui_map` — buscar `EditText` de tipo email en pantalla `Login`.

**Severidad:** Media  
**DOD asociado:** —  
**Requiere feature:** `config.hasAuth: true` + `navigator.Login` presente

---

## IN-LG-02 — Validar campo de contraseña vacío en el formulario de inicio de sesión

**Descripción:** Verificar que el sistema no permite enviar el formulario si el campo de contraseña está vacío.

**Precondiciones:**
- App instalada y abierta
- Pantalla de inicio de sesión visible

**Pasos para reproducir:**
1. Acceder al formulario de inicio de sesión.
2. Ingresar un correo válido en el campo correspondiente.
3. Dejar el campo de contraseña vacío.
4. Intentar enviar el formulario.
5. Verificar que aparece el mensaje de error correspondiente.

**Resultado esperado:**
- El sistema muestra un mensaje de error indicando que la contraseña es requerida.
- El formulario no se envía con el campo vacío.

**Textos esperados (pageContainsAny):**
- `"La contraseña es obligatoria"`, `"Contraseña requerida"`, `"Password required"`, `"campo requerido"`, `"required"`, `"obligatorio"`

**Selectores:** Resolver desde `ui_map` — buscar `EditText` de tipo password en pantalla `Login`.

**Severidad:** Media  
**DOD asociado:** —  
**Requiere feature:** `config.hasAuth: true` + `navigator.Login` presente

---

## IN-LG-03 — Validar inicio de sesión exitoso con credenciales correctas

**Descripción:** Verificar que el usuario puede iniciar sesión correctamente con credenciales válidas y es redirigido a la pantalla principal.

**Precondiciones:**
- App instalada y abierta
- Dispositivo con conexión a internet estable
- Variables de entorno `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` definidas

**Pasos para reproducir:**
1. Acceder al formulario de inicio de sesión.
2. Ingresar credenciales válidas (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`).
3. Enviar el formulario.
4. Verificar que el usuario es redirigido a la pantalla principal.
5. Confirmar que la sesión está activa y el contenido carga correctamente.

**Resultado esperado:**
- El usuario inicia sesión exitosamente y llega a la pantalla principal en menos de 5 segundos.
- No hay errores ni mensajes de advertencia visibles.

**Validación post-login:**
- El login exitoso no muestra mensaje ni alerta — simplemente navega.
- Para validar: navegar al tab Account/Menú después del login.
- Si el login fue exitoso, ese tab mostrará el perfil autenticado (Mi Cuenta, Favoritos, Descargas).
- Si el login falló, seguirá mostrando el formulario de ingreso.

**Textos esperados en Account post-login (pageContainsAny):**
- `"Mi cuenta"`, `"My account"`, `"Favoritos"`, `"Favorites"`, `"Descargas"`, `"Downloads"`, `"Perfil"`, `"Profile"`

**Selectores:** Resolver desde `ui_map` — buscar botón de submit en pantalla `Login`, luego navegar al tab Account/Menú para confirmar sesión activa.

**Severidad:** Crítica  
**DOD asociado:** DOD-01  
**Requiere feature:** `config.hasAuth: true` + `navigator.Login` presente  
**Nota:** Ejecutar este caso primero — los demás no dependen de sesión activa.

---

## IN-LG-04 — Validar funcionalidad "¿Olvidaste tu contraseña?"

**Descripción:** Comprobar que la opción de recuperación de contraseña navega al flujo correcto y muestra confirmación en pantalla. No se valida recepción del email (fuera del alcance de E2E móvil).

**Precondiciones:**
- App instalada y abierta
- Pantalla de inicio de sesión visible

**Pasos para reproducir:**
1. Acceder al formulario de inicio de sesión.
2. Seleccionar la opción `"¿Olvidaste tu contraseña?"`.
3. Ingresar un correo válido en el formulario de recuperación.
4. Enviar el formulario.
5. Verificar que aparece el mensaje de confirmación en pantalla.
6. Repetir con un correo no registrado → verificar que aparece mensaje de error.

**Resultado esperado:**
- Con correo registrado: aparece mensaje de confirmación de envío en pantalla.
- Con correo no registrado: aparece mensaje de error y el flujo no continúa.

**Textos esperados — confirmación (pageContainsAny):**
- `"correo enviado"`, `"email enviado"`, `"revisa tu correo"`, `"check your email"`, `"enlace enviado"`, `"link sent"`

**Textos esperados — error correo no registrado (pageContainsAny):**
- `"correo no registrado"`, `"email not found"`, `"no existe"`, `"not found"`, `"usuario no encontrado"`

**Selectores:** Resolver desde `ui_map` — buscar enlace/botón `forgotPassword` en pantalla `Login` y `EditText` en pantalla `RecoverPassword`.

**Severidad:** Alta  
**DOD asociado:** —  
**Requiere feature:** `config.hasAuth: true` + `config.auth.recoverPasswordURL` presente en `client_config.json`

---

## IN-LG-05 — Validar inicio de sesión con credenciales incorrectas

**Descripción:** Verificar que el sistema muestra un error claro cuando el usuario ingresa credenciales inválidas y no permite el acceso.

**Precondiciones:**
- App instalada y abierta
- Pantalla de inicio de sesión visible

**Pasos para reproducir:**
1. Acceder al formulario de inicio de sesión.
2. Ingresar un correo válido con una contraseña incorrecta.
3. Enviar el formulario.
4. Verificar que aparece el mensaje de error correspondiente.
5. Confirmar que el usuario permanece en la pantalla de login.

**Resultado esperado:**
- El sistema muestra un mensaje de error de credenciales.
- El usuario no es redirigido a la pantalla principal.

**Textos esperados (pageContainsAny):**
- `"Credenciales inválidas"`, `"Contraseña incorrecta"`, `"Usuario o contraseña incorrectos"`, `"Invalid credentials"`, `"Wrong password"`, `"incorrect password"`, `"acceso denegado"`

**Selectores:** Resolver desde `ui_map` — buscar `EditText` email y password en pantalla `Login`, botón submit.

**Severidad:** Alta  
**DOD asociado:** —  
**Requiere feature:** `config.hasAuth: true` + `navigator.Login` presente

---

## IN-LG-06 — Validar cierre de sesión

**Descripción:** Verificar que el usuario puede cerrar sesión correctamente y es redirigido a la pantalla de login o home sin sesión.

**Precondiciones:**
- App instalada y abierta
- Usuario autenticado (usar credenciales de `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`)

**Pasos para reproducir:**
1. Iniciar sesión con credenciales válidas.
2. Navegar al tab de cuenta/perfil.
3. Seleccionar la opción de cerrar sesión.
4. Confirmar el cierre de sesión si aparece diálogo de confirmación.
5. Verificar que la sesión se cierra y se muestra la pantalla de login o home sin sesión.

**Resultado esperado:**
- El usuario es desconectado correctamente.
- Se muestra la pantalla de login o acceso público sin datos de sesión.

**Textos esperados post-logout (pageContainsAny):**
- `"Ingresar"`, `"Iniciar sesión"`, `"Login"`, `"Ingresa"`, `"Regístrate"`, `"Sign in"`

**Selectores:** Resolver desde `ui_map` — buscar opción logout en pantalla `Account` o `Menu`.

**Severidad:** Alta  
**DOD asociado:** DOD-08  
**Requiere feature:** `config.hasAuth: true`

---

## Notas generales para el agente generador

1. **Orden de ejecución:** Correr IN-LG-03 primero — los demás casos no requieren sesión activa. IN-LG-06 debe correr al final.
2. **Selectores:** Resolver SIEMPRE contra el `ui_map_android.json` del cliente. Los selectores en este MD son orientativos.
3. **Reset de estado:** Cada test debe comenzar con `normalizarEstadoApp()` en el `before()`.
4. **Screenshots:** Capturar con `takeScreenshot()` al final de cada caso.
5. **Credenciales:** Leer siempre desde `credentials.email` y `credentials.password` de `clientConfig.js`. Nunca hardcodear.
6. **Textos esperados:** Usar siempre `pageContainsAny([...variantes...])` — nunca `pageContains` con un solo string.
7. **Features ausentes:** Si `hasAuth: false` en el cliente, omitir toda la suite con `if (!features.hasAuth) return`.
8. **Evitar:** `browser.pause()` fijo — preferir `waitForElement()` del helper `waitFor.js`. Si es necesario usar pausa, máximo 1000ms.
