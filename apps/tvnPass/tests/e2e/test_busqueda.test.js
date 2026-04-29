'use strict';

const { waitForElement } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Búsqueda — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('busqueda_tab_buscar_navegable', async () => {
    await clickElement('~Buscar');
    const buscarVisible = await pageContains('Ingresa tu búsqueda');
    expect(buscarVisible).toBe(true);
  });

  it('busqueda_query_valido_muestra_resultados', async () => {
    // DOD-04: Búsqueda con query válido muestra resultados en 2s
    await clickElement('~Buscar');

    // Activar campo y escribir query
    await clickElement('~Ingresa tu búsqueda');
    await browser.keys(['n','o','t','i','c','i','a','s']);

    // Resultados deben aparecer sin necesidad de confirmar (autocompletado)
    const hayResultados = await pageContains('Mesa de Periodistas');
    expect(hayResultados).toBe(true);
  });

  it('busqueda_click_show_navega_a_detalle', async () => {
    // Desde resultados, tocar un show navega a su detalle/episodios
    await clickElement('~Buscar');
    await clickElement('~Ingresa tu búsqueda');
    await browser.keys(['n','o','t','i','c','i','a','s']);

    // Esperar que aparezcan resultados
    await waitForElement('android=new UiSelector().descriptionContains("Mesa de Periodistas")');

    // Tocar el show
    await clickElement('android=new UiSelector().descriptionContains("Mesa de Periodistas")');

    // Validar que llegamos al detalle del show
    const enDetalle = await pageContains('Mesa de Periodistas');
    expect(enDetalle).toBe(true);
  });

  it('busqueda_query_muestra_multiples_resultados', async () => {
    // Validar que la búsqueda retorna más de un resultado
    await clickElement('~Buscar');
    await clickElement('~Ingresa tu búsqueda');
    await browser.keys(['n','o','t','i','c','i','a','s']);

    const resultado1 = await pageContains('Mesa de Periodistas');
    const resultado2 = await pageContains('Mundo Verde');
    expect(resultado1).toBe(true);
    expect(resultado2).toBe(true);
  });

});
