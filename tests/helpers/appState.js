/**
 * appState — Normalización del estado de la app antes de cada test.
 *
 * REGLA CRÍTICA: NUNCA usar browser.back() en apps OTT.
 * Back cierra la app desde home, desde el player, y desde cualquier pantalla principal.
 * Estrategia: reset por keycode 4 (Back nativo Android) x5 para salir de fullscreen,
 * luego tap directo en el tab Home. Si los tabs siguen ocultos → terminateApp + activateApp.
 * Doble fallback de selector: ~label (content-desc) y UiSelector.text().
 */

'use strict';

const IS_IOS     = (process.env.APP_PLATFORM || 'android').trim().toLowerCase() === 'ios';
const _CLIENT_ID = (process.env.APP_ID || '').trim();

let _pkgAndroid = process.env.ANDROID_APP_PACKAGE || 'com.streann.tvnpass';
let _pkgIos     = process.env.IOS_BUNDLE_ID       || 'com.tvn-2.appletv';
try {
  const _path = require('path');
  const _cfg  = require(_path.resolve(__dirname, `../../apps/${_CLIENT_ID}/client_config.json`));
  const _nat  = (_cfg.native || {});
  if (_nat.android && _nat.android.package) _pkgAndroid = _nat.android.package;
  if (_nat.ios     && _nat.ios.bundleId)    _pkgIos     = _nat.ios.bundleId;
} catch (_) {}

const APP_ID = IS_IOS ? _pkgIos : _pkgAndroid;

const HOME_TAB_LABELS = ['HOME', 'Inicio', 'Home', 'INICIO'];

async function _appEnForeground() {
  try {
    let estado = 0;
    try {
      estado = await browser.execute('mobile: queryAppState', { bundleId: APP_ID });
    } catch (_) {
      estado = await browser.execute('mobile: queryAppState', { appId: APP_ID });
    }
    return estado >= 4;
  } catch (_) {
    return false;
  }
}

async function _activarApp() {
  try {
    await browser.execute('mobile: activateApp', { bundleId: APP_ID });
  } catch (_) {
    try {
      await browser.execute('mobile: activateApp', { appId: APP_ID });
    } catch (_) {
      await browser.activateApp(APP_ID);
    }
  }
  await browser.pause(1500);
}

async function _salirALauncher() {
  // Keycode 3 = botón HOME de Android — backgroundea la app sin cerrarla nunca.
  // Luego activateApp la trae al frente. Jamás usar terminateApp ni Back aquí.
  try {
    await browser.execute('mobile: pressKey', { keycode: 3 });
  } catch (_) {
    try { await browser.pressKeyCode(3); } catch (_) {}
  }
  await browser.pause(800);
  await _activarApp();
}

async function _tabExiste(label) {
  // Doble fallback: content-desc (~label) y text attribute (UiSelector.text).
  try {
    const byDesc = await $(`~${label}`);
    if (await byDesc.isExisting()) return { el: byDesc, found: true };
  } catch (_) {}
  try {
    const byText = await $(`android=new UiSelector().text("${label}")`);
    if (await byText.isExisting()) return { el: byText, found: true };
  } catch (_) {}
  return { el: null, found: false };
}

async function _enHomeScreen() {
  try {
    if (IS_IOS) {
      const el = await $('~Inicio');
      return await el.isExisting();
    }
    for (const label of HOME_TAB_LABELS) {
      const { found } = await _tabExiste(label);
      if (found) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function _tapHomeTab() {
  for (const label of HOME_TAB_LABELS) {
    const { el, found } = await _tabExiste(label);
    if (found && el) {
      try {
        await el.click();
        await browser.pause(1200);
        if (await _enHomeScreen()) {
          console.log(`[estado] ✓ tap home tab: ${label}`);
          return true;
        }
      } catch (_) {}
    }
  }
  return false;
}

async function _manejarOnboarding() {
  try {
    await browser.pause(600);
    const permitir = await $('android=new UiSelector().textContains("Permitir")');
    if (await permitir.isExisting()) {
      await permitir.click();
      console.log('[onboarding] ✓ permiso notificaciones aceptado');
      await browser.pause(800);
    }
  } catch (_) {}

  try {
    if (await _enHomeScreen()) return;
    const verAhora = await $('android=new UiSelector().text("VER AHORA")');
    if (!await verAhora.isExisting()) {
      const { width, height } = await browser.getWindowSize();
      const midY = Math.round(height * 0.5);
      for (let i = 0; i < 2; i++) {
        await browser.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: Math.round(width * 0.8), y: midY })
          .down()
          .move({ x: Math.round(width * 0.2), y: midY, duration: 400 })
          .up()
          .perform();
        await browser.pause(700);
      }
    }
    const btn = await $('android=new UiSelector().text("VER AHORA")');
    if (await btn.isExisting()) {
      await btn.click();
      await browser.pause(1200);
      console.log('[onboarding] ✓ onboarding completado');
    }
  } catch (_) {}
}

/**
 * Reset agresivo del estado de la app.
 * Usa keycode 3 (Android HOME) — backgroundea sin cerrar la app nunca.
 * NUNCA keycode 4 (Back): cierra la app en OTT desde home o desde el player.
 */
async function resetAgresivo() {
  // Si ya está en foreground y en home, no hace falta reset completo
  if (await _appEnForeground() && await _enHomeScreen()) {
    console.log('[reset] app ya en foreground y home — skip reset');
    return;
  }
  try {
    await browser.execute('mobile: pressKey', { keycode: 3 });
  } catch (_) {
    try { await browser.pressKeyCode(3); } catch (_) {}
  }
  await browser.pause(600);
  await _activarApp();
}

/**
 * Normaliza el estado de la app dejándola en el home screen.
 * Flujo (el beforeEach ya llamó resetAgresivo() antes):
 *   1. Asegurar foreground
 *   2. Si ya estamos en home → return
 *   3. Tap directo en tab Home
 *   4. Si los tabs siguen ocultos → HOME (keycode 3) + activateApp
 *   5. Manejar onboarding
 *   6. Segundo intento tap Home
 */
async function normalizarEstadoApp() {
  // 1. Asegurar foreground — NO llamar resetAgresivo() aquí.
  // El beforeEach de cada test ya llama resetAgresivo() antes de normalizarEstadoApp().
  // Llamarlo dos veces genera doble ciclo open/close visible en pantalla.
  if (!await _appEnForeground()) {
    console.log('[estado] app no activa — activando...');
    await _activarApp();
    await _manejarOnboarding();
  }

  // 3. Ya en home
  if (await _enHomeScreen()) {
    console.log('[estado] ✓ ya en home screen');
    return;
  }

  // 4. Tap directo en tab Home (caso más común: otra tab o pantalla interna)
  if (await _tapHomeTab()) return;

  // 5. Tabs no visibles — player fullscreen u otra pantalla sin bottom bar.
  // NUNCA usar browser.back() ni terminateApp — ambos cierran/matan la app en OTT.
  // Usar HOME de Android (keycode 3) para backgroundear y luego activateApp.
  console.log('[estado] bottom bar oculto — enviando al launcher y reactivando...');
  await _salirALauncher();
  await _manejarOnboarding();

  // 6. Segundo intento
  if (await _tapHomeTab()) return;

  // 7. Último intento
  if (!await _appEnForeground()) await _activarApp();
  await _tapHomeTab();

  if (await _enHomeScreen()) {
    console.log('[estado] ✓ home screen confirmada');
  } else {
    console.log('[estado] ADVERTENCIA: no se pudo confirmar home screen — continuando');
  }
}

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

async function ensureAppInForeground() {
  try {
    const pkg = await browser.getCurrentPackage();
    if (pkg === APP_ID) return true;
  } catch (_) {}
  try {
    await browser.execute('mobile: activateApp', { appId: APP_ID });
    await browser.pause(1000);
    return true;
  } catch (_) {}
  try {
    await browser.activateApp(APP_ID);
    await browser.pause(1000);
    return true;
  } catch (_) {}
  console.log('[estado] ADVERTENCIA: no se pudo confirmar app en foreground — continuando');
  return false;
}

module.exports = {
  normalizarEstadoApp,
  resetAgresivo,
  dismissPromoPopupIfVisible,
  ensureAppInForeground,
  APP_ID,
};
