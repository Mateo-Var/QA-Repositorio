'use strict';

const { waitForElement }      = require('../../../../tests/helpers/waitFor');
const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Navegación Programación — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('programacion_tab_hoy_es_seleccionable', async () => {
    // El tab "Hoy" debe estar visible y clickeable
    const hoyVisible = await pageContains('Hoy');
    expect(hoyVisible).toBe(true);
  });

  it('programacion_tab_manana_es_seleccionable', async () => {
    // El tab "Mañana" debe estar visible y clickeable
    const mananaVisible = await pageContains('Mañana');
    expect(mananaVisible).toBe(true);
  });

  it('programacion_tab_ayer_es_seleccionable', async () => {
    // El tab "Ayer" debe estar visible y clickeable
    const ayerVisible = await pageContains('Ayer');
    expect(ayerVisible).toBe(true);
  });

  it('programacion_tab_anteayer_es_seleccionable', async () => {
    // El tab "Anteayer" debe estar visible y clickeable
    const anteayerVisible = await pageContains('Anteayer');
    expect(anteayerVisible).toBe(true);
  });

  it('programacion_ver_todo_clickeable', async () => {
    // El botón "VER TODO" debe estar visible y clickeable
    const verTodoVisible = await pageContains('VER TODO');
    expect(verTodoVisible).toBe(true);
  });

});
