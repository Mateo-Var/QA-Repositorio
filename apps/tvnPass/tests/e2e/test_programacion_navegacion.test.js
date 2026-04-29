'use strict';

const { waitForElement, waitForText } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Programación EPG — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('programacion_tab_hoy_siempre_visible', async () => {
    // Valida que el tab Hoy está disponible
    const hoyVisible = await pageContains('Hoy');
    expect(hoyVisible).toBe(true);
  });

  it('programacion_navegacion_anteayer_accesible', async () => {
    // Navega al tab Anteayer
    await clickElement('~Anteayer');
    
    // Valida que Anteayer cargó
    const antayerVisible = await pageContains('Anteayer');
    expect(antayerVisible).toBe(true);
  });

  it('programacion_navegacion_ayer_accesible', async () => {
    // Navega al tab Ayer
    await clickElement('~Ayer');
    
    // Valida que Ayer cargó
    const ayerVisible = await pageContains('Ayer');
    expect(ayerVisible).toBe(true);
  });

  it('programacion_navegacion_hoy_accesible', async () => {
    // Navega al tab Hoy
    await clickElement('~Hoy');
    
    // Valida que Hoy cargó
    const hoyVisible = await pageContains('Hoy');
    expect(hoyVisible).toBe(true);
  });

  it('programacion_navegacion_manana_accesible', async () => {
    // Navega al tab Mañana
    await clickElement('~Mañana');
    
    // Valida que Mañana cargó
    const mananaVisible = await pageContains('Mañana');
    expect(mananaVisible).toBe(true);
  });

});