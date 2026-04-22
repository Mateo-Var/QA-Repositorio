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
  // Detecta la pantalla de bienvenida que aparece en instalación limpia.
  // Flujo: 2 swipes a la derecha → tap en "Ver ahora".
  try {
    const verAhora = await $('android=new UiSelector().textContains("Ver ahora")');
    const tieneOnboarding = await verAhora.isExisting();
    if (!tieneOnboarding) return;

    console.log('[estado] onboarding detectado — navegando...');
    const { width, height } = await browser.getWindowSize();
    const midY = Math.round(height * 0.5);

    for (let i = 0; i < 2; i++) {
      await browser.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: Math.round(width * 0.2), y: midY })
        .down()
        .move({ x: Math.round(width * 0.8), y: midY, duration: 300 })
        .up()
        .perform();
      await browser.pause(600);
    }

    const btn = await $('android=new UiSelector().textContains("Ver ahora")');
    if (await btn.isExisting()) {
      await btn.click();
      await browser.pause(2000);
      console.log('[estado] ✓ onboarding completado');
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

module.exports = { normalizarEstadoApp, APP_ID };
