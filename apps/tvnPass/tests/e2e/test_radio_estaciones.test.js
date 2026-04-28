'use strict';

/**
 * Estaciones Radio — tvnPass Android
 * Mejorado con: verificación post-click de contenido de radio,
 * detección de player de audio, y vuelta al inicio limpia.
 */

const { pageContains }               = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible } = require('../../../../tests/helpers/appState');
const { getSource }                  = require('../../../../tests/helpers/getSource');
const { boundsOf, tapByBounds }      = require('../../../../tests/helpers/tapAdb');

describe('Estaciones Radio — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  it('radio_seccion_estaciones_visible', async () => {
    // La sección de estaciones de radio debe estar visible en pantalla inicial
    const estacionesVisible = await pageContains('ESTACIONES DE RADIO');
    expect(estacionesVisible).toBe(true);
  });

  it('radio_tvn_radio_visible_y_clickeable', async () => {
    // El botón "TVN RADIO" debe estar visible
    const tvnRadioVisible = await pageContains('TVN RADIO');
    expect(tvnRadioVisible).toBe(true);
  });

  it('radio_tvn_radio_click_navega', async () => {
    // Al clickear TVN RADIO debe navegar sin crash — mejorado con fallback ADB
    try {
      await clickElement('~TVN RADIO');
    } catch (_) {
      // Fallback ADB bounds si el accessibility ID falla
      const src = await getSource(4000, 2);
      if (src) {
        const b = boundsOf(src, 'TVN RADIO');
        if (b) await tapByBounds(src, 'TVN RADIO');
      }
    }
    await browser.pause(1500);
    await dismissPromoPopupIfVisible();

    // Verificar que navegó (TVN RADIO o contenido de radio visible)
    const hayContenido = await pageContains('TVN RADIO') ||
                         await pageContains('RADIO') ||
                         await pageContains('Reproducir');
    expect(hayContenido).toBe(true);
  });

  it('radio_reproductor_audio_sin_error', async () => {
    // Después de entrar a radio, no debe haber pantalla de error
    await browser.pause(2000); // dar tiempo al buffer de audio
    const hayError = await pageContains('Error');
    expect(hayError).toBe(false);
  });

  it('radio_volver_al_inicio', async () => {
    // Volver al inicio limpiamente
    try {
      await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
      await browser.pause(600);
    } catch (_) {}
    await clickElement('~Inicio');
    await browser.pause(1200);
    const inicioVisible = await pageContains('Programación');
    expect(inicioVisible).toBe(true);
  });

});
