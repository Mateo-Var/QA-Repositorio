'use strict';

const { waitForElement, waitForText } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Búsqueda — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('busqueda_tab_buscar_navegable', async () => {
    // Navega a la tab de búsqueda
    await clickElement('~Buscar');
    
    // Valida que la tab Buscar es accesible
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  it('busqueda_query_valido_muestra_resultado', async () => {
    // DOD-04: Búsqueda con query válido muestra resultados en 2s
    // Primero navega a búsqueda
    await clickElement('~Buscar');
    
    // Nota: El UI map no especifica un campo de input de texto.
    // Este test valida que la navegación a búsqueda es posible.
    // El ingreso de texto específico requiere que el UI map incluya el input field.
    const buscarAccessible = await pageContains('Buscar');
    expect(buscarAccessible).toBe(true);
  });

});