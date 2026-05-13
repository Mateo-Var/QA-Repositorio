'use strict';

const { pageContains, pageContainsAny } = require('../helpers/pageContains');
const { clickElement }                  = require('../helpers/clickHelper');
const { normalizarEstadoApp, resetAgresivo, dismissPromoPopupIfVisible } = require('../helpers/appState');
const { takeScreenshot }                = require('../helpers/screenshot');
const { tabSelector, hasTab, APP_ID } = require('./clientConfig');

// Variantes i18n por nombre lógico de tab — sin depender de texts[name]
const TAB_SCREEN_VARIANTS = {
  Home:      ['Home', 'Inicio', 'HOME', 'INICIO'],
  Discover:  ['Explorar', 'Discover', 'Navegar', 'Browse', 'EXPLORAR', 'NAVEGAR'],
  Search:    ['Buscar', 'Search', 'BUSCAR', 'Búsqueda', 'BUSQUEDA'],
  Account:   ['Mi cuenta', 'Account', 'Perfil', 'MI CUENTA', 'My account'],
  Downloads: ['Descargas', 'Downloads', 'DESCARGAS'],
};

describe(`Menú y navegación (${APP_ID})`, () => {

  before(async () => {
    await resetAgresivo();
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // ME-GE-01 — Validar secciones principales del menú
  it('me_ge_01_secciones_principales_menu', async () => {
    const logicalTabs = ['Home', 'Discover', 'Search', 'Account'];

    for (const name of logicalTabs) {
      if (!hasTab(name)) continue;

      await clickElement(tabSelector(name));
      await browser.pause(800);
      await dismissPromoPopupIfVisible();

      const variants = TAB_SCREEN_VARIANTS[name] || [];
      const loaded = await pageContainsAny(variants);
      console.log(`[menu] tab "${name}": ${loaded}`);
      expect(loaded).toBe(true);
    }

    // Volver al home
    await clickElement(tabSelector('Home'));
    await browser.pause(600);
    await takeScreenshot('me_ge_01_tabs_navegables');
  });

  // ME-GE-02 — Validar componentes configurados en Home
  it('me_ge_02_componentes_home_interactivos', async () => {
    await clickElement(tabSelector('Home'));
    await browser.pause(800);
    await dismissPromoPopupIfVisible();

    // Esperar hasta 5s a que carguen componentes (DOD-03)
    let loaded = false;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const src = await browser.getPageSource();
      if (src.includes('ImageView') || src.includes('RecyclerView')) {
        loaded = true;
        break;
      }
      await browser.pause(500);
    }
    expect(loaded).toBe(true);

    // Swipe horizontal en carrusel
    const { width, height } = await browser.getWindowSize();
    const y = Math.floor(height * 0.5);
    await browser.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.floor(width * 0.8), y }).down()
      .move({ x: Math.floor(width * 0.2), y, duration: 400 }).up()
      .perform();
    await browser.pause(400);

    await takeScreenshot('me_ge_02_home_componentes');
  });

  // ME-GE-03 — Validar sección Explorar / Discover
  it('me_ge_03_explorar_discover_navegable', async () => {
    if (!hasTab('Discover')) return;

    await clickElement(tabSelector('Discover'));
    await browser.pause(800);
    await dismissPromoPopupIfVisible();

    const loaded = await pageContainsAny(TAB_SCREEN_VARIANTS.Discover);
    expect(loaded).toBe(true);

    await takeScreenshot('me_ge_03_discover_cargado');
  });

  // ME-GE-17 — Validar tiempo de carga en Home (< 5 s)
  it('me_ge_17_tiempo_carga_home_bajo_5s', async () => {
    const start = Date.now();

    await clickElement(tabSelector('Home'));
    await browser.pause(300);
    await dismissPromoPopupIfVisible();

    let loaded = false;
    while (Date.now() - start < 5000) {
      const src = await browser.getPageSource();
      if (src.includes('ImageView') || src.includes('RecyclerView')) {
        loaded = true;
        break;
      }
      await browser.pause(300);
    }

    const elapsed = Date.now() - start;
    console.log(`[menu] home cargó en ${elapsed}ms`);
    expect(loaded).toBe(true);
    expect(elapsed).toBeLessThan(5000);

    await takeScreenshot('me_ge_17_home_carga_rapida');
  });

  // ME-GE-18 — Verificar calidad y posición de imágenes (delegado a Agente 3)
  it('me_ge_18_imagenes_calidad_posicion', async () => {
    const sections = ['Home', 'Discover', 'Search'];

    for (const name of sections) {
      if (!hasTab(name)) continue;
      await clickElement(tabSelector(name));
      await browser.pause(600);
      await dismissPromoPopupIfVisible();
      await takeScreenshot(`me_ge_18_imagenes_${name.toLowerCase()}`);
    }
  });

});
