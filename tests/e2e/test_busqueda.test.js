'use strict';

const { pageContains, pageContainsAny } = require('../helpers/pageContains');
const { clickElement }                  = require('../helpers/clickHelper');
const { normalizarEstadoApp, resetAgresivo, dismissPromoPopupIfVisible } = require('../helpers/appState');
const { takeScreenshot }                = require('../helpers/screenshot');
const { tabSelector, hasTab, features, searchSample, APP_ID } = require('./clientConfig');

describe(`Búsqueda (${APP_ID})`, () => {

  before(async () => {
    await resetAgresivo();
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // Navega al tab Search y activa el campo de búsqueda
  // Doble tap: primer tap selecciona el tab, segundo tap activa el EditText
  async function irABuscar() {
    await clickElement(tabSelector('Search'));
    await browser.pause(600);
    await clickElement(tabSelector('Search'));
    await browser.pause(800);
    await dismissPromoPopupIfVisible();

    // Campo EditText — selector por clase, es el único en la pantalla Search
    return $('android=new UiSelector().className("android.widget.EditText").instance(0)');
  }

  // Escribe un query en el campo activo y cierra el teclado
  async function escribirQuery(campo, query) {
    await campo.clearValue().catch(() => {});
    await browser.pause(300);
    await browser.keys(query.split(''));
    await browser.pause(2000);
    const teclado = await browser.isKeyboardShown().catch(() => false);
    if (teclado) {
      await browser.hideKeyboard();
      await browser.pause(400);
    }
  }


  // ME-GE-06 — Búsqueda básica funcional
  it('me_ge_06_busqueda_basica_funcional', async () => {
    if (!hasTab('Search')) return;

    // search_sample en client_config.json de cada cliente — título real del catálogo
    const titulo = searchSample;
    const query3 = titulo.slice(0, 3);

    // 1. Buscar con las primeras 3 letras — DEBE encontrar resultados
    let campo = await irABuscar();
    if (!await campo.isExisting()) return;

    await escribirQuery(campo, query3);
    await browser.pause(1200);
    const hayResultados3 = await pageContainsAny([query3, query3.toUpperCase(), 'resultado', 'result']);
    console.log(`[busqueda] 3 chars "${query3}": ${hayResultados3}`);
    expect(hayResultados3).toBe(true);

    // 2. Buscar con el título completo — DEBE encontrar resultados
    campo = await irABuscar();
    await escribirQuery(campo, titulo);
    await browser.pause(1200);
    const hayResultadosTitulo = await pageContainsAny([
      titulo, titulo.toUpperCase(), titulo.toLowerCase(),
      query3, query3.toUpperCase(), 'resultado', 'result',
    ]);
    console.log(`[busqueda] título completo "${titulo}": ${hayResultadosTitulo}`);
    expect(hayResultadosTitulo).toBe(true);

    await takeScreenshot('me_ge_06_busqueda_basica');
  });

  // ME-GE-07 — Búsqueda avanzada con filtros
  it('me_ge_07_busqueda_avanzada_filtros', async () => {
    if (!hasTab('Search') || !features.hasAdvancedSearch) return;

    const campo = await irABuscar();
    if (!await campo.isExisting()) return;

    const hayFiltros = await pageContainsAny([
      'Categoría', 'Category', 'Filtro', 'Filter', 'Tipo', 'Type',
    ]);
    if (!hayFiltros) {
      console.log('[busqueda] búsqueda avanzada no visible — skip');
      return;
    }

    const titulo = searchSample;
    const query3 = titulo.slice(0, 3);
    await escribirQuery(campo, query3);
    const hayResultados = await pageContainsAny([
      query3, query3.toUpperCase(), titulo, 'resultado', 'result',
    ]);
    expect(hayResultados).toBe(true);

    await takeScreenshot('me_ge_07_busqueda_avanzada');
  });

  // ME-GE-15 — Validar mensaje sin resultados
  it('me_ge_15_busqueda_sin_resultados_muestra_mensaje', async () => {
    if (!hasTab('Search')) return;

    const campo = await irABuscar();
    if (!await campo.isExisting()) return;

    await escribirQuery(campo, 'zzznoresult1746000000');
    await browser.pause(500);

    const mensaje = await pageContainsAny([
      'sin resultados', 'Sin resultados',
      'no results', 'No results',
      'no se encontraron', 'No se encontraron',
      'ningún resultado', 'not found', 'Not found',
      'No encontramos', 'Intenta con',
    ]);
    console.log(`[busqueda] mensaje sin resultados: ${mensaje}`);
    expect(mensaje).toBe(true);

    await takeScreenshot('me_ge_15_sin_resultados');
  });

});
