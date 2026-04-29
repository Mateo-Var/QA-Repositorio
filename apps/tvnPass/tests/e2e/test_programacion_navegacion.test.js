'use strict';

const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

// Navega a home y abre los controles del player live para ver el EPG
async function irAlPlayerConControles() {
  // Reset agresivo: salir de cualquier fullscreen antes de normalizar
  for (let i = 0; i < 3; i++) {
    try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
    await browser.pause(300);
  }
  await normalizarEstadoApp();
  await clickElement('~Inicio');
  await browser.pause(1500);
  // Abrir controles del reproductor live — muestra EPG con tabs de días
  await clickElement('~Mostrar controles del reproductor');
  await browser.pause(800);
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
