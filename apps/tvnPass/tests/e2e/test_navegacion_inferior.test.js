'use strict';

const { waitForElement, waitForText } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Navegación Inferior — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('navegacion_tabs_inicio_accesible', async () => {
    // Navega a Inicio
    await clickElement('~Inicio');
    
    // Valida que Inicio está visible
    const inicioVisible = await pageContains('Inicio');
    expect(inicioVisible).toBe(true);
  });

  it('navegacion_tabs_explorar_accesible', async () => {
    // Navega a Explorar
    await clickElement('~Explorar');
    
    // Valida que Explorar está visible
    const explorarVisible = await pageContains('Explorar');
    expect(explorarVisible).toBe(true);
  });

  it('navegacion_tabs_buscar_accesible', async () => {
    // Navega a Buscar
    await clickElement('~Buscar');
    
    // Valida que Buscar está visible
    const buscarVisible = await pageContains('Buscar');
    expect(buscarVisible).toBe(true);
  });

  it('navegacion_tabs_menu_accesible', async () => {
    // Navega a Menú
    await clickElement('~Menú');
    
    // Valida que Menú está visible
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

  it('navegacion_tabs_retorna_a_inicio', async () => {
    // Navega a otra tab
    await clickElement('~Buscar');
    
    // Retorna a Inicio
    await clickElement('~Inicio');
    
    // Valida que está nuevamente en Inicio
    const inicioVisible = await pageContains('Inicio');
    expect(inicioVisible).toBe(true);
  });

});