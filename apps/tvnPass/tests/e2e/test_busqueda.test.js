'use strict';

const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');
const { takeScreenshot }      = require('../../../../tests/helpers/screenshot');

const NAV_LABELS = ['Inicio', 'Explorar', 'Buscar', 'Menú'];

// Verifica si la pantalla de búsqueda está activa
// Usa el content-desc del contenedor del campo, estable con o sin texto ingresado
async function enPantallaBuscar() {
  return pageContains('Ingresa tu búsqueda');
}

// Vuelve al buscador desde cualquier pantalla (show detail, player, etc.)
// NO llama normalizarEstadoApp() entre tests — evita swipes accidentales en resultados
async function irABuscar() {
  if (await enPantallaBuscar()) return;

  // Si el tab ~Buscar ya está visible, puede que estemos en el buscador con texto
  // (enPantallaBuscar() falla cuando el campo tiene texto porque el placeholder desaparece)
  const navVisibleInicial = await browser.$('~Buscar').isExisting().catch(() => false);
  if (navVisibleInicial) {
    await clickElement('~Buscar');
    await browser.pause(600);
    await clickElement('~Buscar');
    await browser.pause(800);
    // Limpiar campo por si tenía texto
    const { width } = await browser.getWindowSize();
    await browser.action('pointer')
      .move({ x: Math.floor(width / 2), y: 210 })
      .down().up()
      .perform();
    await browser.pause(300);
    const campo = await browser.$('android=new UiSelector().focused(true)');
    await campo.clearValue().catch(() => {});
    const isKeyboardShown = await browser.isKeyboardShown();
    if (isKeyboardShown) { await browser.hideKeyboard(); await browser.pause(400); }
    return;
  }

  // Presionar BACK hasta ver el navbar ~Buscar o la pantalla de búsqueda
  // Cubre: player (fullscreen, sin navbar) → show detail → search results → navbar visible
  for (let i = 0; i < 5; i++) {
    await browser.back();
    await browser.pause(800);
    if (await enPantallaBuscar()) return;
    const navVisible = await browser.$('~Buscar').isExisting().catch(() => false);
    if (navVisible) {
      await clickElement('~Buscar');
      await browser.pause(600);
      await clickElement('~Buscar');
      await browser.pause(800);
      return;
    }
  }

  // Último recurso solo si el loop no encontró la navbar (ej: app cerrada)
  await normalizarEstadoApp();
  await clickElement('~Buscar');
  await browser.pause(600);
  await clickElement('~Buscar');
  await browser.pause(800);
}

// Limpia el campo y escribe el query; cierra teclado al terminar
async function escribirQuery(query) {
  const { width } = await browser.getWindowSize();
  await browser.action('pointer')
    .move({ x: Math.floor(width / 2), y: 210 })
    .down().up()
    .perform();
  await browser.pause(400);
  const campo = await browser.$('android=new UiSelector().focused(true)');
  await campo.clearValue().catch(() => {});
  await browser.pause(300);
  await browser.keys(query.split(''));
  await browser.pause(2000);
  const isKeyboardShown = await browser.isKeyboardShown();
  if (isKeyboardShown) {
    await browser.hideKeyboard();
    await browser.pause(500);
  }
}

// Devuelve el primer elemento clickeable que no sea nav ni los labels excluidos
async function obtenerPrimerResultado(excluirDesc = []) {
  const excluir = [...NAV_LABELS, ...excluirDesc];
  const elementos = await browser.$$('android=new UiSelector().clickable(true)');
  for (const el of elementos) {
    const desc  = await el.getAttribute('content-desc').catch(() => '');
    const txt   = await el.getAttribute('text').catch(() => '');
    const label = desc || txt;
    if (label && !excluir.some(n => label === n)) {
      return el;
    }
  }
  return null;
}

// Click en el resultado cuyo content-desc empieza con nombreShow
async function clickearResultadoEspecifico(nombreShow) {
  const elementos = await browser.$$('android=new UiSelector().clickable(true)');
  for (const el of elementos) {
    const desc = await el.getAttribute('content-desc').catch(() => '');
    if (desc.startsWith(nombreShow)) {
      await el.click();
      return;
    }
  }
  throw new Error(`Show "${nombreShow}" no encontrado en resultados`);
}

// Si entramos directo al player, valida. Si estamos en detalle de show,
// asegura que la tab EPISODIOS esté activa y toca el primer episodio disponible.
async function reproducirPrimerEpisodioYValidarPlayer() {
  await browser.pause(2000);

  // ¿Ya estamos en el player?
  if (await pageContains('Mostrar controles del reproductor')) {
    return true;
  }

  // Estamos en detalle de show — asegurar que la tab EPISODIOS esté activa
  const tabEpisodios = await browser.$('~%tab_category_live_related_episodes%');
  const tabExiste = await tabEpisodios.isExisting().catch(() => false);
  if (tabExiste) {
    await tabEpisodios.click();
    await browser.pause(800);
  }

  // Buscar el primer episodio: su content-desc contiene " MIN," (duración)
  const elementos = await browser.$$('android=new UiSelector().clickable(true)');
  let primerEpisodio = null;
  for (const el of elementos) {
    const desc = await el.getAttribute('content-desc').catch(() => '');
    if (desc.includes(' MIN,') || desc.includes(' MIN ')) {
      primerEpisodio = el;
      break;
    }
  }

  if (!primerEpisodio) {
    // Fallback: primer clickeable que no sea nav ni botones de UI del show
    const excluir = [...NAV_LABELS, 'VOLVER', 'VER TODO', 'EPISODIOS', 'SOBRE ESTE CONTENIDO', 'SUGERIDOS'];
    primerEpisodio = await obtenerPrimerResultado(excluir);
  }

  if (!primerEpisodio) return false;

  await primerEpisodio.click();
  await browser.pause(3000);

  return pageContains('Mostrar controles del reproductor');
}

describe('Búsqueda — tvnPass Android', () => {

  before(async () => {
    // Salir de cualquier show/player antes de normalizar para evitar swipes accidentales
    for (let i = 0; i < 5; i++) {
      const tieneVolver = await browser.$('~VOLVER').isExisting().catch(() => false);
      if (!tieneVolver) break;
      await browser.back();
      await browser.pause(700);
    }
    await normalizarEstadoApp();
    await clickElement('~Buscar');
    await browser.pause(600);
    await clickElement('~Buscar');
    await browser.pause(800);
    // Limpiar cualquier texto residual del campo de búsqueda (ej: "Exatlon" del run anterior)
    const { width } = await browser.getWindowSize();
    await browser.action('pointer')
      .move({ x: Math.floor(width / 2), y: 210 })
      .down().up()
      .perform();
    await browser.pause(400);
    const campo = await browser.$('android=new UiSelector().focused(true)');
    await campo.clearValue().catch(() => {});
    await browser.pause(300);
    const isKeyboardShown = await browser.isKeyboardShown();
    if (isKeyboardShown) {
      await browser.hideKeyboard();
      await browser.pause(500);
    }
  });

  it('busqueda_tab_buscar_navegable', async () => {
    // Valida que el campo de búsqueda esté visible con su content-desc estable
    const buscarVisible = await pageContains('Ingresa tu búsqueda');
    expect(buscarVisible).toBe(true);
  });

  it('busqueda_3_letras_muestra_resultados_y_player_carga', async () => {
    await escribirQuery('tvn');

    const primerResultado = await obtenerPrimerResultado(['tvn']);
    expect(primerResultado).not.toBeNull();
    await takeScreenshot('busqueda_3_letras_resultados');

    await primerResultado.click();
    const playerCargado = await reproducirPrimerEpisodioYValidarPlayer();
    await takeScreenshot('busqueda_3_letras_player');
    expect(playerCargado).toBe(true);
  });

  it('busqueda_contenido_exacto_mundialmente_player_carga', async () => {
    await irABuscar();
    await escribirQuery('Mundialmente');

    const hayResultado = await pageContains('Mundialmente');
    expect(hayResultado).toBe(true);
    await takeScreenshot('busqueda_mundialmente_resultados');

    await clickearResultadoEspecifico('Mundialmente');

    const playerCargado = await reproducirPrimerEpisodioYValidarPlayer();
    await takeScreenshot('busqueda_mundialmente_player');
    expect(playerCargado).toBe(true);
  });

  it('busqueda_sin_resultados_muestra_mensaje', async () => {
    await irABuscar();
    await escribirQuery('Exatlon');

    const sinResultados = await pageContains('No se encontraron resultados');
    await takeScreenshot('busqueda_sin_resultados');
    expect(sinResultados).toBe(true);
  });

});
