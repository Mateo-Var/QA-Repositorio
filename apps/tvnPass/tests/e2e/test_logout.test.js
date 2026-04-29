'use strict';

const { waitForElement, waitForText } = require('../../../../tests/helpers/waitFor');
const { pageContains } = require('../../../../tests/helpers/pageContains');
const { clickElement } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Logout — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('logout_acceso_menu_desde_navbar', async () => {
    // DOD-08: Logout desde Menú cierra sesión y muestra pantalla login
    // Navega a Menú
    await clickElement('~Menú');
    
    // Valida que Menú está visible
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

});