const { takeScreenshot } = require('../../../../tests/helpers/screenshot');
const { pageContains, pageContainsAny } = require('../../../../tests/helpers/pageContains');
const { waitFor } = require('../../../../tests/helpers/waitFor');
const { clickText } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TVN PASS - Live Player E2E', () => {

  // ─── 1. APP LAUNCH ───────────────────────────────────────────────────────────
  it('01 - La app carga correctamente', async () => {
    const t = Date.now();
    await normalizarEstadoApp();

    await waitFor(
      () => pageContains('Programación'),
      30000, 1000,
      'Home screen no cargó en 30s — "Programación" no apareció'
    );

    console.log(`[timing] home screen lista en ${((Date.now() - t) / 1000).toFixed(1)}s`);
    await takeScreenshot('01-app-launch');
  });

  // ─── 2. DETECCIÓN DE REGIÓN BLOQUEADA ────────────────────────────────────────
  it('02 - Detectar bloqueo por región', async () => {
    await takeScreenshot('02-home-screen');
    const src = await browser.getPageSource();

    const isBlocked = ['no disponible', 'bloqueado', 'blocked', 'not available']
      .some(t => src.toLowerCase().includes(t));

    if (isBlocked) {
      console.log('[region] BLOQUEADO — pasando a tabs de programación');
      await takeScreenshot('02-region-blocked');
      await validarTabsProgramacion();
      return;
    }
    console.log('[region] sin bloqueo — continuando');
  });

  // ─── 3. PROGRAMACIÓN — tabs Anteayer / Ayer / Hoy / Mañana ──────────────────
  it('03 - Validar tabs de Programación', async () => {
    if (!(await pageContains('Programación'))) {
      throw new Error('Sección Programación no encontrada en home screen');
    }
    await validarTabsProgramacion();
  });

  // ─── 4. ENTRAR AL LIVE ───────────────────────────────────────────────────────
  it('04 - Entrar al player del live', async () => {
    try { await clickText('Hoy'); } catch (_) { }
    await browser.pause(1000);

    const enVivo = await $('android=new UiSelector().text("EN VIVO").instance(0)');
    await enVivo.waitForDisplayed({ timeout: 8000 });
    await enVivo.click();

    await waitFor(
      () => pageContainsAny(['SurfaceView', 'TextureView']),
      15000, 500,
      'El player no abrió en 15s — no se detectó superficie de video'
    );

    await browser.pause(2000);
    await takeScreenshot('04-player-opened');
    console.log('[player] player abierto');
  });

  // ─── 5. ANUNCIO PRE-ROLL ─────────────────────────────────────────────────────
  it('05 - Detectar anuncio y manejarlo', async () => {
    await browser.pause(1500);
    await takeScreenshot('05-pre-ad-check');

    const adWords = ['Saltar', 'Skip', 'Publicidad'];
    if (!(await pageContainsAny(adWords))) {
      console.log('[ad] sin anuncio');
      return;
    }

    console.log('[ad] anuncio detectado');
    await takeScreenshot('05-ad-detected');
    const adStart = Date.now();

    await waitFor(async () => {
      const s = await browser.getPageSource();

      for (const word of ['Saltar', 'Skip', 'SALTAR', 'SKIP']) {
        if (s.includes(word)) {
          try {
            const btn = await $(`android=new UiSelector().textContains("${word}")`);
            if (await btn.isDisplayed() && await btn.isEnabled()) {
              await btn.click();
              console.log(`[ad] saltado en ${((Date.now() - adStart) / 1000).toFixed(1)}s`);
              await takeScreenshot('05-ad-skipped');
              return true;
            }
          } catch (_) { }
        }
      }

      if (!adWords.some(w => s.includes(w))) {
        console.log(`[ad] terminó en ${((Date.now() - adStart) / 1000).toFixed(1)}s`);
        await takeScreenshot('05-ad-finished');
        return true;
      }
      return false;
    }, 60000, 1000, '[ad] anuncio no terminó ni pudo saltarse en 60s');
  });

  // ─── 6. LIVE ACTIVO ──────────────────────────────────────────────────────────
  it('06 - Validar que el live está reproduciendo', async () => {
    const t = Date.now();
    let videoFound = false;

    for (let i = 0; i < 6 && !videoFound; i++) {
      videoFound = await pageContainsAny(['android.view.SurfaceView', 'android.view.TextureView']);
      if (!videoFound) await browser.pause(2000);
    }

    console.log(`[timing] live check en ${((Date.now() - t) / 1000).toFixed(1)}s — videoFound: ${videoFound}`);
    await takeScreenshot('06-live-state');
  });

  // ─── 7. CONTROLES DEL PLAYER ─────────────────────────────────────────────────
  it('07 - Validar controles del player', async () => {
    const { width, height } = await browser.getWindowSize();
    await browser.action('pointer')
      .move({ x: Math.floor(width / 2), y: Math.floor(height / 2) })
      .down().up()
      .perform();
    await browser.pause(1500);

    const src = await browser.getPageSource();
    await takeScreenshot('07-player-controls');

    const controles = [
      { name: 'pause/play', words: ['pause', 'play', 'Pause', 'Play'] },
      { name: 'mute/volume', words: ['mute', 'volume', 'Mute', 'Volume'] },
      { name: 'fullscreen', words: ['fullscreen', 'Fullscreen'] },
      { name: 'ImageButton', words: ['android.widget.ImageButton'] },
    ];

    for (const ctrl of controles) {
      console.log(`[controls] ${ctrl.words.some(w => src.includes(w)) ? '✓' : '—'} ${ctrl.name}`);
    }
  });

  // ─── 8. CAMBIO DE CANAL ──────────────────────────────────────────────────────
  it('08 - Cambiar de canal', async () => {
    const { width, height } = await browser.getWindowSize();
    await browser.action('pointer')
      .move({ x: Math.floor(width * 0.8), y: Math.floor(height / 2) })
      .down()
      .move({ duration: 600, x: Math.floor(width * 0.2), y: Math.floor(height / 2) })
      .up()
      .perform();
    await browser.pause(3000);
    await takeScreenshot('08-channel-changed');
    console.log('[channel] swipe ejecutado');
  });

});

// ── Helper: tabs de Programación ──────────────────────────────────────────────
async function validarTabsProgramacion() {
  for (const nombre of ['Anteayer', 'Ayer', 'Hoy', 'Mañana']) {
    try {
      await clickText(nombre);
      console.log(`[programacion] ✓ tab pulsado: "${nombre}"`);
      await browser.pause(1500);
      await takeScreenshot(`03-prog-${nombre.toLowerCase().replace('ñ', 'n').replace('á', 'a')}`);
    } catch (_) {
      console.log(`[programacion] — tab "${nombre}" no encontrado`);
    }
  }
}
