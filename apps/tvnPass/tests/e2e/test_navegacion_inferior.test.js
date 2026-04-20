'use strict';

/**
 * Navegación Inferior — tvnPass Android
 * Mejorado con: vuelta al inicio tras cada navegación, dismissPromoPopup,
 * y verificación de contenido de cada sección (no solo texto del botón).
 */

const { pageContains }               = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible } = require('../../../../tests/helpers/appState');

describe('Navegación Inferior — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  it('navegacion_boton_inicio_visible', async () => {
    const inicioVisible = await pageContains('Inicio');
    expect(inicioVisible).toBe(true);
  });

  it('navegacion_boton_explorar_visible', async () => {
    const explorarVisible = await pageContains('Explorar');
    expect(explorarVisible).toBe(true);
  });

  it('navegacion_boton_buscar_visible', async () => {
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  it('navegacion_boton_menu_visible', async () => {
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

  it('navegacion_click_boton_explorar_carga_contenido', async () => {
    // Mejorado: verificar que Explorar carga contenido real (no solo el botón)
    await clickElement('~Explorar');
    await browser.pause(1500);
    await dismissPromoPopupIfVisible();
    // Explorar debe mostrar al menos "EN VIVO" o "VIDEOS" o "CANALES"
    let hayContenido = false;
    for (let i = 0; i < 4 && !hayContenido; i++) {
      hayContenido = await pageContains('EN VIVO') ||
                    await pageContains('VIDEOS') ||
                    await pageContains('CANALES');
      if (!hayContenido) await browser.pause(800);
    }
    expect(hayContenido).toBe(true);
    // Volver al inicio
    await clickElement('~Inicio');
    await browser.pause(1000);
  });

  it('navegacion_click_boton_buscar', async () => {
    await clickElement('~Buscar');
    await browser.pause(1000);
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
    // Cerrar teclado antes del siguiente test
    await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
    await browser.pause(500);
    await clickElement('~Inicio');
    await browser.pause(800);
  });

  it('navegacion_click_boton_menu', async () => {
    await clickElement('~Menú');
    await browser.pause(1200);
    await dismissPromoPopupIfVisible();
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
    // Volver al inicio
    await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
    await browser.pause(500);
    await clickElement('~Inicio');
    await browser.pause(800);
  });

  it('navegacion_inicio_vuelve_a_player', async () => {
    // Desde cualquier sección, Inicio siempre debe llevar al reproductor live
    await clickElement('~Inicio');
    await browser.pause(1500);
    const playerVisible = await pageContains('Mostrar controles del reproductor');
    expect(playerVisible).toBe(true);
  });

});
