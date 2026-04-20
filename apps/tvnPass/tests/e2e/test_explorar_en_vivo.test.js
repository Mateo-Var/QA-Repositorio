'use strict';

/**
 * Explorar → TVN EN VIVO / PROGRAMACIÓN — tvnPass Android
 * Flujo:
 *   1. Navegar a Explorar
 *   2. Verificar secciones EN VIVO y TVN EN VIVO visibles
 *   3. Entrar a TVN EN VIVO → VER AHORA (si activo) → validar live
 *   4. Volver a Explorar → entrar a PROGRAMACIÓN
 *   5. Verificar player, canales, controles, swipe
 *   6. Volver al Inicio
 */

const { pageContains,
        pageContainsAny }            = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick } = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible } = require('../../../../tests/helpers/appState');
const { getSource }                  = require('../../../../tests/helpers/getSource');
const { boundsOf, allBoundsOf,
        tapAdb, tapByBounds,
        swipeAdb }                   = require('../../../../tests/helpers/tapAdb');

const EN_VIVO_VARIANTS = ['EN VIVO', 'TVN EN VIVO', 'En Vivo', 'en vivo'];

describe('Explorar — TVN EN VIVO / PROGRAMACIÓN — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // ── 1. Navegación a Explorar ────────────────────────────────────────────────

  it('explorar_tab_navegacion_desde_inicio', async () => {
    await clickElement('~Explorar');
    await browser.pause(1500);
    await dismissPromoPopupIfVisible();
    const explorarVisible = await pageContains('Explorar');
    expect(explorarVisible).toBe(true);
  });

  // ── 2. Verificar secciones EN VIVO y TVN EN VIVO ───────────────────────────

  it('explorar_secciones_en_vivo_visibles', async () => {
    // Al menos una de las variantes de EN VIVO debe estar visible en Explorar
    let visible = false;
    for (let i = 0; i < 5 && !visible; i++) {
      visible = await pageContainsAny(EN_VIVO_VARIANTS);
      if (!visible) await browser.pause(1000);
    }
    expect(visible).toBe(true);
  });

  // ── 3. Entrar a TVN EN VIVO → VER AHORA → validar live ────────────────────

  it('explorar_tvn_en_vivo_ver_ahora_y_live', async () => {
    // Intentar entrar a "TVN EN VIVO" primero; si no existe, usar variante genérica
    const tvnEnVivoVariants = ['TVN EN VIVO', 'EN VIVO'];
    let clicked = false;
    for (const label of tvnEnVivoVariants) {
      try {
        await waitAndClick(label, 4000);
        clicked = true;
        break;
      } catch (_) {}
    }
    if (!clicked) throw new Error('No se encontró ningún botón TVN EN VIVO / EN VIVO en Explorar');

    await browser.pause(2000);
    await dismissPromoPopupIfVisible();

    // Presionar VER AHORA solo si está activo/visible
    const verAhoraVisible = await pageContainsAny(['VER AHORA', 'Ver ahora', 'VER AHORA »']);
    if (verAhoraVisible) {
      try {
        await waitAndClick('VER AHORA', 3000);
      } catch (_) {
        // Intentar variantes
        try { await waitAndClick('Ver ahora', 2000); } catch (_2) {}
      }
      await browser.pause(2500);
      await dismissPromoPopupIfVisible();
    } else {
      console.log('[explorar] VER AHORA no visible — continuando sin presionarlo');
    }

    // Validar que el live está reproduciendo (player activo)
    let playerActivo = false;
    for (let i = 0; i < 5 && !playerActivo; i++) {
      playerActivo = await pageContains('Mostrar controles del reproductor');
      if (!playerActivo) await browser.pause(1200);
    }
    expect(playerActivo).toBe(true);
  });

  // ── 4. Volver a Explorar → entrar a PROGRAMACIÓN ──────────────────────────

  it('explorar_volver_y_entrar_programacion', async () => {
    // Asegurarse de estar en la pantalla de Explorar con PROGRAMACIÓN visible.
    // Si no carga a la primera, intentar BACK nativo y volver a presionar Explorar.
    let programacionDisponible = false;
    for (let intento = 0; intento < 3 && !programacionDisponible; intento++) {
      // Intento 1: tap directo en Explorar
      try { await clickElement('~Explorar'); } catch (_) {}
      await browser.pause(1500);
      await dismissPromoPopupIfVisible();

      programacionDisponible = await pageContainsAny(['PROGRAMACIÓN', 'Programación']);

      if (!programacionDisponible) {
        console.log(`[explorar] PROGRAMACIÓN no visible (intento ${intento + 1}) — presionando BACK y reintentando`);
        // BACK nativo para salir de pantalla intermedias
        try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
        await browser.pause(1000);
      }
    }

    if (!programacionDisponible) throw new Error('No se pudo volver a Explorar con PROGRAMACIÓN visible tras 3 intentos');

    // Ya estamos en Explorar — entrar a PROGRAMACIÓN
    await waitAndClick('PROGRAMACIÓN', 8000);
    await browser.pause(2000);
    await dismissPromoPopupIfVisible();

    // Dentro de PROGRAMACIÓN esperamos ver el player o la guía de canales
    const enProgramacion = await pageContainsAny([
      'Mostrar controles del reproductor',
      'ESTÁS VIENDO',
      'EN VIVO',
      'TVN EN VIVO',
      'PROGRAMACIÓN',
      'Programación',
    ]);
    expect(enProgramacion).toBe(true);
  });

  // ── 5-9. Flujo dentro de PROGRAMACIÓN ──────────────────────────────────────

  it('explorar_player_activo_en_en_vivo', async () => {
    // El reproductor debe estar activo en PROGRAMACIÓN / EN VIVO
    let playerVisible = false;
    for (let i = 0; i < 5 && !playerVisible; i++) {
      playerVisible = await pageContains('Mostrar controles del reproductor');
      if (!playerVisible) await browser.pause(1200);
    }
    expect(playerVisible).toBe(true);
  });

  it('explorar_lista_canales_visible', async () => {
    // La lista de canales live debe mostrar el canal activo con "ESTÁS VIENDO"
    const estaViendoVisible = await pageContains('ESTÁS VIENDO');
    expect(estaViendoVisible).toBe(true);
  });

  it('explorar_tap_player_muestra_controles', async () => {
    // Al tocar el player se muestran los controles y la app no crashea
    await clickElement('~Mostrar controles del reproductor');
    await browser.pause(800);
    const enVivoVisible = await pageContainsAny(EN_VIVO_VARIANTS.concat(['PROGRAMACIÓN', 'Programación']));
    expect(enVivoVisible).toBe(true);
  });

  it('explorar_cambio_canal_lista_live', async () => {
    // Analizar cuántos canales hay visibles en la lista (patrón "Canal • Programa")
    const recolectarCanales = async () => {
      const els = await $$('android=new UiSelector().descriptionMatches(".*•.*")');
      const visibles = [];
      for (const el of els) {
        try { if (await el.isDisplayed()) visibles.push(el); } catch (_) {}
      }
      return visibles;
    };

    let canales = await recolectarCanales();

    // Si solo se ven pocos, hacer scroll para exponer más
    if (canales.length < 2) {
      const { width, height } = await browser.getWindowSize();
      await swipeAdb(width / 2, height * 0.75, width / 2, height * 0.45, 400);
      await browser.pause(800);
      canales = await recolectarCanales();
    }

    console.log(`[explorar] canales visibles: ${canales.length}`);

    if (canales.length === 0) {
      throw new Error('No se encontró ningún canal en la lista live');
    }

    if (canales.length === 1) {
      // Solo hay un canal visible — validar que el player sigue activo y continuar
      console.log('[explorar] Solo 1 canal visible — validando player sin cambiar canal');
      const playerActivo = await pageContains('Mostrar controles del reproductor');
      expect(playerActivo).toBe(true);
      return;
    }

    // Hay 2+ canales — hacer tap en el segundo (el primero es el activo)
    await canales[1].click();
    await browser.pause(2500);

    const playerSigueActivo = await pageContains('Mostrar controles del reproductor');
    expect(playerSigueActivo).toBe(true);
  });

  it('explorar_swipe_carousel_canales', async () => {
    // Dos swipes largos: izquierda (avanzar) y derecha (volver) en el carousel
    const { width, height } = await browser.getWindowSize();
    const carouselY = Math.floor(height * 0.5);
    const startX    = Math.floor(width * 0.95);
    const endX      = Math.floor(width * 0.05);

    // Swipe 1 — largo hacia la izquierda
    await swipeAdb(startX, carouselY, endX, carouselY, 500);
    await browser.pause(1000);
    // Swipe 2 — largo hacia la derecha
    await swipeAdb(endX, carouselY, startX, carouselY, 500);
    await browser.pause(1000);

    const playerActivo = await pageContains('Mostrar controles del reproductor');
    expect(playerActivo).toBe(true);
  });

  // ── 10. Volver al Inicio ────────────────────────────────────────────────────

  it('explorar_volver_al_inicio', async () => {
    try {
      await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
      await browser.pause(800);
    } catch (_) {}
    await clickElement('~Inicio');
    await browser.pause(1500);
    const inicioVisible = await pageContains('Programación');
    expect(inicioVisible).toBe(true);
  });

});
