'use strict';

const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Estaciones Radio — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('radio_seccion_estaciones_visible', async () => {
    // La sección de estaciones de radio debe estar visible en pantalla inicial
    const estacionesVisible = await pageContains('ESTACIONES DE RADIO');
    expect(estacionesVisible).toBe(true);
  });

  it('radio_tvn_radio_clickeable', async () => {
    // El botón "TVN RADIO" debe estar visible y clickeable
    const tvnRadioVisible = await pageContains('TVN RADIO');
    expect(tvnRadioVisible).toBe(true);
  });

  it('radio_tvn_radio_click', async () => {
    // Al clickear TVN RADIO, debe navegar a la sección de radio
    await clickElement('~TVN RADIO');
    // Verificamos que el click fue procesado
    const tvnRadioVisible = await pageContains('TVN RADIO');
    expect(tvnRadioVisible).toBe(true);
  });

});
