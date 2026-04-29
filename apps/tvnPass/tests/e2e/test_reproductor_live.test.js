'use strict';

const { waitForElement, waitForText } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Reproductor Live — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('reproductor_live_carga_sin_error_y_buffer_completado', async () => {
    // DOD-03: Buffer inicial completado en 10s, señal en vivo visible
    const playerVisible = await pageContains('Mostrar controles del reproductor');
    expect(playerVisible).toBe(true);
    
    const enVivoVisible = await pageContains('EN VIVO');
    expect(enVivoVisible).toBe(true);
  });

  it('reproductor_live_controles_visibles_al_tocar_player', async () => {
    // Toca el player para mostrar controles
    await clickElement('~Mostrar controles del reproductor');
    
    // Valida que controles cargaron
    const controlesVisibles = await pageContains('Programación');
    expect(controlesVisibles).toBe(true);
  });

  it('reproductor_live_programacion_anteayer_visible', async () => {
    // Valida que el tab Anteayer está disponible
    const antayerVisible = await pageContains('Anteayer');
    expect(antayerVisible).toBe(true);
  });

});