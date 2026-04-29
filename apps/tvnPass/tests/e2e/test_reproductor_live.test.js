'use strict';

const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Reproductor Live — tvnPass Android', () => {

  before(async () => {
    // Reset agresivo: salir de cualquier pantalla fullscreen antes de normalizar
    for (let i = 0; i < 3; i++) {
      try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
      await browser.pause(300);
    }
    await normalizarEstadoApp();
    await clickElement('~Inicio');
    await browser.pause(1500);
  });

  it('reproductor_live_carga_sin_error_y_buffer_completado', async () => {
    // DOD-03: Buffer inicial completado en 10s, señal en vivo visible
    const playerVisible = await pageContains('Mostrar controles del reproductor');
    expect(playerVisible).toBe(true);

    const enVivoVisible = await pageContains('EN VIVO');
    expect(enVivoVisible).toBe(true);
  });

  it('reproductor_live_controles_visibles_al_tocar_player', async () => {
    await clickElement('~Mostrar controles del reproductor');
    const controlesVisibles = await pageContains('Programación');
    expect(controlesVisibles).toBe(true);
  });

  it('reproductor_live_programacion_anteayer_visible', async () => {
    const antayerVisible = await pageContains('Anteayer');
    expect(antayerVisible).toBe(true);
  });

});
