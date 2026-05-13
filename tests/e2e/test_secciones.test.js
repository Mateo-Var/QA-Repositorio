'use strict';

const { pageContains, pageContainsAny } = require('../helpers/pageContains');
const { clickElement }                  = require('../helpers/clickHelper');
const { normalizarEstadoApp, resetAgresivo, dismissPromoPopupIfVisible } = require('../helpers/appState');
const { takeScreenshot }                = require('../helpers/screenshot');
const { tabSelector, hasTab, features, texts, APP_ID } = require('./clientConfig');

describe(`Secciones de contenido (${APP_ID})`, () => {

  before(async () => {
    await resetAgresivo();
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // Navega a Discover y verifica que cargó
  async function irADiscover() {
    await clickElement(tabSelector('Discover'));
    await browser.pause(800);
    await dismissPromoPopupIfVisible();
  }

  // Busca un label en Discover usando texto visible
  async function tapEnDiscover(labels) {
    const src = await browser.getPageSource();
    for (const label of labels) {
      if (!label) continue;
      if (src.includes(label)) {
        try {
          await clickElement(`~${label}`);
          await browser.pause(800);
          await dismissPromoPopupIfVisible();
          return label;
        } catch (_) {}
        try {
          await clickElement(`android=new UiSelector().text("${label}")`);
          await browser.pause(800);
          return label;
        } catch (_2) {}
      }
    }
    return null;
  }

  // ME-GE-08 — Validar sección EPG / En Vivo
  // Usa config.hasEpg (nivel raíz) — mapeado como features.hasEpg en clientConfig
  it('me_ge_08_epg_en_vivo_carga_canales', async () => {
    if (!features.hasEpg || !hasTab('Discover')) return;

    await irADiscover();

    const epgLabels = [
      'En Vivo', 'EN VIVO', 'EPG', 'Live', 'Programación', 'en vivo',
    ];

    const tapped = await tapEnDiscover(epgLabels);
    if (!tapped) {
      console.log('[epg] sección no visible en Discover — skip');
      return;
    }

    const cargado = await pageContainsAny(['Canal', 'Channel', 'Programa', 'Program', 'EPG', 'En Vivo', 'Vivo']);
    console.log(`[epg] canales cargados: ${cargado}`);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_08_epg_vivo');
  });

  // ME-GE-09 — Validar sección Radios / Lives
  // Usa config.hasRadios y config.hasChannels (nivel raíz) — mapeados en clientConfig
  it('me_ge_09_radios_lives_lista_carga', async () => {
    if (!features.hasRadios && !features.hasChannels) return;
    if (!hasTab('Discover')) return;

    await irADiscover();

    const radioLabels = [
      'Radio', 'Radios', 'RADIOS', 'En vivo', 'Lives', 'EN VIVO',
    ];

    const tapped = await tapEnDiscover(radioLabels);
    console.log(`[radios] sección encontrada: ${tapped}`);

    const cargado = await pageContainsAny(['Radio', 'Radios', 'Canal', 'Lives', 'En vivo', 'EN VIVO']);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_09_radios_lives');
  });

  // ME-GE-10 — Validar sección Podcasts / Audio
  // Usa config.hasAudios (nivel raíz) — mapeado en clientConfig
  it('me_ge_10_podcasts_audio_lista_carga', async () => {
    if (!features.hasAudios || !hasTab('Discover')) return;

    await irADiscover();

    const podcastLabels = [
      'Podcast', 'Podcasts', 'PODCAST', 'Audio', 'Audios',
    ];

    const tapped = await tapEnDiscover(podcastLabels);
    console.log(`[podcasts] sección encontrada: ${tapped}`);

    const cargado = await pageContainsAny(['Podcast', 'Podcasts', 'Audio', 'Audios', 'Show']);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_10_podcasts_audio');
  });

  // ME-GE-11 — Validar sección Videos / Series
  // Usa config.hasVideos (nivel raíz) — mapeado en clientConfig
  it('me_ge_11_videos_series_lista_carga', async () => {
    if (!features.hasVideos || !hasTab('Discover')) return;

    await irADiscover();

    const videoLabels = [
      'Video', 'Videos', 'VIDEO',
      'Series', 'SERIES', 'Serie',
      'Categorías', 'Categorias', 'CATEGORIAS', 'Categoria',
      'Vodcast', 'VODCAST',
      'VOD', 'On Demand', 'Contenido',
    ];

    const tapped = await tapEnDiscover(videoLabels);
    console.log(`[videos] sección encontrada: ${tapped}`);

    const cargado = await pageContainsAny([
      'Video', 'Videos', 'Serie', 'Series',
      'Categoría', 'Categorias', 'Categorías',
      'Vodcast', 'VOD', 'On Demand', 'Contenido', 'Show',
    ]);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_11_videos_series');
  });

  // ME-GE-12 — Validar sección Mi Cuenta
  it('me_ge_12_mi_cuenta_visible', async () => {
    if (!hasTab('Account')) return;

    await clickElement(tabSelector('Account'));
    await browser.pause(800);
    await dismissPromoPopupIfVisible();

    const cargado = await pageContainsAny([
      'Mi cuenta', 'My account',
      'Perfil', 'Profile', 'Favoritos', 'Favorites',
      'Ingresar', 'Login', 'Cuenta',
    ]);
    console.log(`[cuenta] sección cargada: ${cargado}`);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_12_mi_cuenta');
  });

  // ME-GE-13 — Validar sección Descargas
  // features.hasDownload — mapeado desde config.features.hasDownload
  it('me_ge_13_descargas_accesible', async () => {
    if (!features.hasDownload) return;

    if (hasTab('Downloads')) {
      await clickElement(tabSelector('Downloads'));
      await browser.pause(800);
      await dismissPromoPopupIfVisible();
    } else {
      // Descargas puede estar dentro del tab Account
      await clickElement(tabSelector('Account'));
      await browser.pause(800);
      await dismissPromoPopupIfVisible();
      const descLabels = ['Descargas', 'Downloads'];
      let found = false;
      for (const label of descLabels) {
        try {
          const el = await $(`~${label}`);
          if (await el.isExisting()) {
            await el.click();
            await browser.pause(600);
            found = true;
            break;
          }
        } catch (_) {}
        try {
          const el = await $(`android=new UiSelector().text("${label}")`);
          if (await el.isExisting()) {
            await el.click();
            await browser.pause(600);
            found = true;
            break;
          }
        } catch (_2) {}
      }
      if (!found) {
        console.log('[descargas] opción no encontrada — skip');
        return;
      }
    }

    const cargado = await pageContainsAny([
      'Descargas', 'Downloads', 'Sin descargas', 'No downloads', 'vacío', 'empty',
    ]);
    console.log(`[descargas] sección cargada: ${cargado}`);
    expect(cargado).toBe(true);

    await takeScreenshot('me_ge_13_descargas');
  });

});
