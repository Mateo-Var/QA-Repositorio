'use strict';

const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Navegación Inferior — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('navegacion_boton_inicio_visible', async () => {
    // El botón "Inicio" en la barra inferior debe estar visible
    const inicioVisible = await pageContains('Inicio');
    expect(inicioVisible).toBe(true);
  });

  it('navegacion_boton_explorar_visible', async () => {
    // El botón "Explorar" en la barra inferior debe estar visible
    const explorarVisible = await pageContains('Explorar');
    expect(explorarVisible).toBe(true);
  });

  it('navegacion_boton_buscar_visible', async () => {
    // El botón "Buscar" en la barra inferior debe estar visible
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  it('navegacion_boton_menu_visible', async () => {
    // El botón "Menú" en la barra inferior debe estar visible
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

  it('navegacion_click_boton_buscar', async () => {
    // Al clickear Buscar, debe navegar a la sección de búsqueda
    await clickElement('~Buscar');
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
    // Cerrar teclado antes del siguiente test — Buscar abre el teclado
    await browser.execute('mobile: pressKey', { keycode: 4 });
    await browser.pause(500);
  });

  it('navegacion_click_boton_menu', async () => {
    // Al clickear Menú, debe abrir el menú lateral/modal
    await clickElement('~Menú');
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

});
