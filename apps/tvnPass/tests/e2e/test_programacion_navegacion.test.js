'use strict';

const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

async function irAlPlayerConControles() {
  await normalizarEstadoApp();
  await clickElement('~Inicio');
  await browser.pause(800);
  // Tocar el área del player (cuarto superior de pantalla) para mostrar controles EPG
  const { width, height } = await browser.getWindowSize();
  await browser.action('pointer')
    .move({ x: Math.floor(width / 2), y: Math.floor(height * 0.20) })
    .down().up()
    .perform();
  await browser.pause(500);
}

describe('Programación EPG — tvnPass Android', () => {

  it('programacion_tab_hoy_siempre_visible', async () => {
    await irAlPlayerConControles();
    const hoyVisible = await pageContains('Hoy');
    expect(hoyVisible).toBe(true);
  });

  it('programacion_tab_programacion_visible', async () => {
    await irAlPlayerConControles();
    const progVisible = await pageContains('Programación');
    expect(progVisible).toBe(true);
  });

  it('programacion_navegacion_anteayer_accesible', async () => {
    await irAlPlayerConControles();
    await clickElement('~Anteayer');
    const antayerVisible = await pageContains('Anteayer');
    expect(antayerVisible).toBe(true);
  });

  it('programacion_navegacion_ayer_accesible', async () => {
    await irAlPlayerConControles();
    await clickElement('~Ayer');
    const ayerVisible = await pageContains('Ayer');
    expect(ayerVisible).toBe(true);
  });

  it('programacion_navegacion_manana_accesible', async () => {
    await irAlPlayerConControles();
    await clickElement('~Mañana');
    const mananaVisible = await pageContains('Mañana');
    expect(mananaVisible).toBe(true);
  });

});
