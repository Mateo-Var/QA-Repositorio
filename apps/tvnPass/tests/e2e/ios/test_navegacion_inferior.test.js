'use strict';

const { pageContains }        = require('../../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../../tests/helpers/appState');

describe('Navegación Inferior — tvnPass iOS', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('navegacion_tab_inicio_visible', async () => {
    const visible = await pageContains('Inicio');
    expect(visible).toBe(true);
  });

  it('navegacion_tab_explorar_visible', async () => {
    const visible = await pageContains('Explorar');
    expect(visible).toBe(true);
  });

  it('navegacion_tab_buscar_visible', async () => {
    const visible = await pageContains('Buscar');
    expect(visible).toBe(true);
  });

  it('navegacion_tab_menu_visible', async () => {
    const visible = await pageContains('Menú');
    expect(visible).toBe(true);
  });

  it('navegacion_tap_explorar_muestra_contenido', async () => {
    await clickElement('Explorar');
    await browser.pause(2000);
    const visible = await pageContains('EXPLORAR CONTENIDO');
    expect(visible).toBe(true);
  });

  it('navegacion_tap_buscar_muestra_campo', async () => {
    await clickElement('Buscar');
    await browser.pause(2000);
    const visible = await pageContains('Ingresa tu búsqueda');
    expect(visible).toBe(true);
  });

  it('navegacion_tap_inicio_vuelve_al_home', async () => {
    await clickElement('Inicio');
    await browser.pause(2000);
    const visible = await pageContains('Inicio');
    expect(visible).toBe(true);
  });

});
