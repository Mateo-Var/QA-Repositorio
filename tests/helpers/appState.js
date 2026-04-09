/**
 * appState — Normalización del estado de la app antes de cada test.
 * PAT-03: punto de entrada universal para dejar la app en home screen.
 * DEC-03: usar activateApp, nunca startActivity (bloqueado en Android 16).
 * GOT-03: browser.execute necesita mockImplementation por cmd en tests.
 */

const APP_ID = process.env.ANDROID_APP_PACKAGE || 'com.streann.tvnpass';

async function normalizarEstadoApp() {
  // queryAppState: 0=no instalada, 1=no corriendo, 2=background/PiP, 3=suspendida, 4=foreground
  let estado = 0;
  try {
    estado = await browser.execute('mobile: queryAppState', { appId: APP_ID });
  } catch (_) {}
  console.log(`[estado] app state: ${estado}`);

  if (estado < 4) {
    console.log('[estado] app no activa — activando...');
    try {
      await browser.execute('mobile: activateApp', { appId: APP_ID });
    } catch (_) {
      await browser.activateApp(APP_ID);
    }
    await browser.pause(3000);
  }

  let src = '';
  try { src = await browser.getPageSource(); } catch (_) {}

  if (src.includes('Programación')) {
    console.log('[estado] ✓ ya en home screen');
    return;
  }

  console.log('[estado] no en home — buscando botón Inicio...');
  try {
    const inicio = await $('android=new UiSelector().text("Inicio")');
    if (await inicio.isExisting()) {
      await inicio.click();
      await browser.pause(2000);
      console.log('[estado] ✓ tap en Inicio ejecutado');
      return;
    }
  } catch (_) {}

  // App puede estar en fullscreen player — HOME del sistema y reabrir
  console.log('[estado] Inicio no visible — usando tecla HOME del sistema...');
  try {
    await browser.execute('mobile: pressKey', { keycode: 3 });
    await browser.pause(1500);
    await browser.execute('mobile: activateApp', { appId: APP_ID });
    await browser.pause(2000);
  } catch (_) {}

  src = '';
  try { src = await browser.getPageSource(); } catch (_) {}
  if (src.includes('Programación')) {
    console.log('[estado] ✓ home screen confirmada');
  } else {
    console.log('[estado] ADVERTENCIA: no se pudo confirmar home screen — continuando de todos modos');
  }
}

module.exports = { normalizarEstadoApp, APP_ID };
