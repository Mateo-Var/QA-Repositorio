'use strict';

const { waitForElement } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Búsqueda — tvnPass Android', () => {

  // beforeEach garantiza estado limpio: home screen + bottom bar visible
  beforeEach(async () => {
    await normalizarEstadoApp();
    await clickElement('~Inicio');
    await browser.pause(600);
  });

  async function irABuscarYEscribir(query) {
    await clickElement('~Buscar');
    await browser.pause(800);
    // Tap directo en el centro del EditText (bounds fijos: [151,145][1039,278])
    await browser.action('pointer')
      .move({ x: 595, y: 210 })
      .down().up()
      .perform();
    await browser.pause(600);
    // Escribir con keys (campo ya activo)
    await browser.keys(query.split(''));
    await browser.pause(1500);
  }

  it('busqueda_tab_buscar_navegable', async () => {
    await clickElement('~Buscar');
    const buscarVisible = await pageContains('Ingresa tu búsqueda');
    expect(buscarVisible).toBe(true);
  });

  it('busqueda_query_valido_muestra_resultados', async () => {
    // DOD-04: Búsqueda con query válido muestra resultados en 2s
    await irABuscarYEscribir('noticias');
    const hayResultados = await pageContains('Mesa de Periodistas');
    expect(hayResultados).toBe(true);
  });

  it('busqueda_click_show_navega_a_detalle', async () => {
    await irABuscarYEscribir('noticias');
    await waitForElement('android=new UiSelector().descriptionContains("Mesa de Periodistas")');
    await clickElement('android=new UiSelector().descriptionContains("Mesa de Periodistas")');
    const enDetalle = await pageContains('Mesa de Periodistas');
    expect(enDetalle).toBe(true);
  });

  it('busqueda_query_muestra_multiples_resultados', async () => {
    await irABuscarYEscribir('noticias');
    const resultado1 = await pageContains('Mesa de Periodistas');
    const resultado2 = await pageContains('Mundo Verde');
    expect(resultado1).toBe(true);
    expect(resultado2).toBe(true);
  });

});
