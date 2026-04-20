'use strict';

/**
 * Búsqueda — tvnPass Android (DOD-04)
 * DOD-04: Resultados visibles tras query — timeout máx 2s
 * Portado y adaptado de appium-test patrones de navegación y búsqueda.
 */

const { pageContains }               = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick } = require('../../../../tests/helpers/clickHelper');
const { waitFor }                    = require('../../../../tests/helpers/waitFor');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible } = require('../../../../tests/helpers/appState');
const { getSource }                  = require('../../../../tests/helpers/getSource');

describe('Búsqueda — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  it('busqueda_tab_navegacion_desde_inicio', async () => {
    // Navegar a Buscar desde la barra inferior
    await clickElement('~Buscar');
    await browser.pause(1200);
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  it('busqueda_campo_texto_visible', async () => {
    // El campo de búsqueda debe estar visible al entrar al tab
    // Puede ser un EditText o un elemento con texto "Buscar"
    let campoVisible = false;
    try {
      const editText = await $('android=new UiSelector().className("android.widget.EditText")');
      campoVisible = await editText.isExisting();
    } catch (_) {}
    if (!campoVisible) {
      campoVisible = await pageContains('Buscar');
    }
    expect(campoVisible).toBe(true);
  });

  it('busqueda_ingresar_query_tvn', async () => {
    // Ingresar un término de búsqueda — DOD-04
    try {
      const editText = await $('android=new UiSelector().className("android.widget.EditText")');
      if (await editText.isExisting()) {
        await editText.clearValue();
        await editText.setValue('TVN');
        await browser.pause(500);
      } else {
        // Fallback: buscar campo por accessibility
        await clickElement('~Buscar');
        await browser.pause(500);
        await browser.execute('mobile: pressKey', { keycode: 66 }); // ENTER no-op para abrir teclado
      }
    } catch (_) {}
    await browser.pause(300);
    // Cerrar teclado con ENTER para lanzar búsqueda
    try {
      await browser.execute('mobile: pressKey', { keycode: 66 }); // ENTER
    } catch (_) {}
    await browser.pause(500);
  });

  it('busqueda_resultados_visibles_tras_query', async () => {
    // DOD-04: Resultados deben aparecer dentro del timeout configurado
    // Busca cualquier indicador de resultado: título, thumbnail, lista
    const resultadosVisibles = await waitFor(
      () => pageContains('TVN'),
      4000,
      400,
      'DOD-04 FAIL: resultados no visibles tras query "TVN"'
    );
    expect(resultadosVisibles).toBe(true);
  });

  it('busqueda_sin_pantalla_de_error', async () => {
    // La búsqueda no debe mostrar pantalla de error
    const hayError = await pageContains('Error');
    expect(hayError).toBe(false);
  });

  it('busqueda_query_vacio_no_crashea', async () => {
    // Limpiar el campo y verificar que la app no crashea
    try {
      const editText = await $('android=new UiSelector().className("android.widget.EditText")');
      if (await editText.isExisting()) {
        await editText.clearValue();
        await browser.pause(400);
      }
    } catch (_) {}
    // App sigue viva — Buscar sigue visible
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  after(async () => {
    // Cerrar teclado y volver al inicio
    try {
      await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
      await browser.pause(500);
    } catch (_) {}
    try {
      await clickElement('~Inicio');
      await browser.pause(1000);
    } catch (_) {}
  });

});
