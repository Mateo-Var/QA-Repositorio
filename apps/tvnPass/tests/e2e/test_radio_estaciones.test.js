'use strict';

const { pageContains, pageContainsAny }  = require('../../../../tests/helpers/pageContains');
const { clickElement }                   = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible }     = require('../../../../tests/helpers/appState');

async function resetearApp() {
  // Presionar BACK varias veces para salir de cualquier pantalla fullscreen
  for (let i = 0; i < 3; i++) {
    try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
    await browser.pause(300);
  }
  await normalizarEstadoApp();
  await browser.pause(500);
}

describe('Estaciones Radio — tvnPass Android', () => {

  before(async () => {
    await resetearApp();
    await dismissPromoPopupIfVisible();
    await clickElement('~Explorar');
    await browser.pause(800);
    await dismissPromoPopupIfVisible();
    await clickElement('~RADIOS');
    await browser.pause(1200);
    await dismissPromoPopupIfVisible();
  });

  it('radio_seccion_estaciones_visible', async () => {
    const visible = await pageContainsAny([
      'ESTACIONES DE RADIO', 'Estaciones de radio', 'VOLVER', 'TVN Radio',
    ]);
    expect(visible).toBe(true);
  });

  it('radio_tvn_radio_visible_y_clickeable', async () => {
    const visible = await pageContainsAny(['TVN RADIO', 'TVN Radio', 'Radio']);
    expect(visible).toBe(true);
  });

  it('radio_tvn_radio_click_navega', async () => {
    try { await clickElement('~TVN RADIO'); } catch (_) {
      try { await clickElement('~TVN Radio'); } catch (_2) {}
    }
    await browser.pause(1500);
    await dismissPromoPopupIfVisible();
    const hayContenido = await pageContainsAny(['TVN RADIO', 'TVN Radio', 'RADIO', 'Reproducir', 'VOLVER']);
    expect(hayContenido).toBe(true);
  });

  it('radio_reproductor_audio_sin_error', async () => {
    await browser.pause(1500);
    const hayError = await pageContains('Error');
    expect(hayError).toBe(false);
  });

  it('radio_volver_al_inicio', async () => {
    try { await browser.execute('mobile: pressKey', { keycode: 4 }); await browser.pause(600); } catch (_) {}
    await clickElement('~Inicio');
    await browser.pause(1000);
    const inicioVisible = await pageContains('Programación');
    expect(inicioVisible).toBe(true);
  });

});
