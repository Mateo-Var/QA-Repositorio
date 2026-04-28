/**
 * appState — Normalización del estado de la app antes de cada test.
 * PAT-03: punto de entrada universal para dejar la app en home screen.
 * DEC-03: usar activateApp, nunca startActivity (bloqueado en Android 16).
 * GOT-04: getPageSource() reemplazado por isExisting() — no cuelga en streaming.
 */

const IS_IOS = (process.env.APP_PLATFORM || 'android').trim().toLowerCase() === 'ios';
const APP_ID = IS_IOS
  ? (process.env.IOS_BUNDLE_ID || 'com.tvn-2.appletv')
  : (process.env.ANDROID_APP_PACKAGE || 'com.streann.tvnpass');

async function _enHomeScreen() {
  try {
    if (IS_IOS) {
      const el = await $('~Inicio');
      return await el.isExisting();
    }
    const el = await $('android=new UiSelector().text("Programación")');
    return await el.isExisting();
  } catch (_) {
    return false;
  }
}

async function _manejarOnboarding() {
  // Flujo post-instalación limpia:
  // 1. Permiso de notificaciones → "Permitir"
  // 2. Carrusel de bienvenida → 2 swipes derecha→izquierda
  // 3. Botón "VER AHORA" en la última pantalla

  try {
    // Paso 1 — permiso de notificaciones (diálogo del sistema Android)
    await browser.pause(1500);
    const permitir = await $('android=new UiSelector().textContains("Permitir")');
    if (await permitir.isExisting()) {
      await permitir.click();
      console.log('[onboarding] ✓ permiso notificaciones aceptado');
      await browser.pause(1000);
    }
  } catch (_) {}

  try {
    // Detectar si hay carrusel — busca "VER AHORA" que aparece en la última slide
    // Si no está visible aún, igual intentamos los swipes y luego buscamos el botón
    const { width, height } = await browser.getWindowSize();
    const midY = Math.round(height * 0.5);
    const startX = Math.round(width * 0.8); // derecha
    const endX   = Math.round(width * 0.2); // izquierda → avanza al siguiente slide

    // Verificar si estamos en el carrusel buscando "VER AHORA" o ausencia de home
    const enHome = await _enHomeScreen();
    if (enHome) return;

    const verAhora = await $('android=new UiSelector().text("VER AHORA")');
    const yaEnUltima = await verAhora.isExisting();

    if (!yaEnUltima) {
      console.log('[onboarding] carrusel detectado — deslizando slides...');
      for (let i = 0; i < 2; i++) {
        await browser.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: startX, y: midY })
          .down()
          .move({ x: endX, y: midY, duration: 400 })
          .up()
          .perform();
        await browser.pause(800);
      }
    }

    // Tap en "VER AHORA"
    const btn = await $('android=new UiSelector().text("VER AHORA")');
    if (await btn.isExisting()) {
      await btn.click();
      await browser.pause(2500);
      console.log('[onboarding] ✓ onboarding completado');
    }
  } catch (_) {}
}

async function normalizarEstadoApp() {
  let estado = 0;
  try {
    estado = await browser.execute('mobile: queryAppState', { bundleId: APP_ID });
  } catch (_) {
    try {
      estado = await browser.execute('mobile: queryAppState', { appId: APP_ID });
    } catch (_) {}
  }
  console.log(`[estado] app state: ${estado}`);

  if (estado < 4) {
    console.log('[estado] app no activa — activando...');
    try {
      await browser.execute('mobile: activateApp', { bundleId: APP_ID });
    } catch (_) {
      try {
        await browser.execute('mobile: activateApp', { appId: APP_ID });
      } catch (_) {
        await browser.activateApp(APP_ID);
      }
    }
    await browser.pause(3000);
  }

  await _manejarOnboarding();

  if (await _enHomeScreen()) {
    console.log('[estado] ✓ ya en home screen');
    return;
  }

  console.log('[estado] no en home — buscando botón Inicio...');
  try {
    const selector = IS_IOS ? '~Inicio' : 'android=new UiSelector().text("Inicio")';
    const inicio = await $(selector);
    if (await inicio.isExisting()) {
      await inicio.click();
      await browser.pause(2000);
      console.log('[estado] ✓ tap en Inicio ejecutado');
      return;
    }
  } catch (_) {}

  if (!IS_IOS) {
    // HOME solo disponible en Android
    console.log('[estado] Inicio no visible — usando tecla HOME del sistema...');
    try {
      await browser.execute('mobile: pressKey', { keycode: 3 });
      await browser.pause(1500);
      await browser.execute('mobile: activateApp', { appId: APP_ID });
      await browser.pause(2000);
    } catch (_) {}

    try {
      const inicio = await $('android=new UiSelector().text("Inicio")');
      if (await inicio.isExisting()) {
        await inicio.click();
        await browser.pause(1500);
        console.log('[estado] ✓ tap en Inicio post-HOME ejecutado');
      }
    } catch (_) {}
  }

  if (await _enHomeScreen()) {
    console.log('[estado] ✓ home screen confirmada');
  } else {
    console.log('[estado] ADVERTENCIA: no se pudo confirmar home screen — continuando de todos modos');
  }
}

/**
 * Cierra el popup promocional si aparece ("OMITIR" button).
 * Portado de appium-test/utils/helpers.js — aparece tras algunas navegaciones.
 * Retorna true si cerró el popup, false si no había popup.
 */
async function dismissPromoPopupIfVisible() {
  try {
    const el = await $('android=new UiSelector().textContains("OMITIR")');
    if (await el.isExisting()) {
      await el.click();
      await browser.pause(600);
      console.log('[estado] popup promo descartado');
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Verifica que la app esté en foreground.
 * Portado de appium-test/utils/helpers.js — útil en beforeEach de suites largas.
 * No lanza excepción si falla — continúa de todos modos.
 */
async function ensureAppInForeground() {
  try {
    const pkg = await browser.getCurrentPackage();
    if (pkg === APP_ID) return true;
  } catch (_) {}
  try {
    await browser.execute('mobile: activateApp', { appId: APP_ID });
    await browser.pause(2000);
    return true;
  } catch (_) {}
  try {
    await browser.activateApp(APP_ID);
    await browser.pause(2000);
    return true;
  } catch (_) {}
  console.log('[estado] ADVERTENCIA: no se pudo confirmar app en foreground — continuando');
  return false;
}

module.exports = { normalizarEstadoApp, dismissPromoPopupIfVisible, ensureAppInForeground, APP_ID };
