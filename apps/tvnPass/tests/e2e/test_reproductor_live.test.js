'use strict';

/**
 * Hero EPG — Navegación y Reproductor Live — tvnPass Android (DOD-03)
 *
 * Flujo:
 *   1. Player visible al lanzar (DOD-03)
 *   2. Navegar tabs EPG: Ayer → Anteayer → Mañana → Hoy
 *   3. Cambio de canal con detección dinámica y manejo de georestrición
 *   4. Swipe carousel de programación
 *   5. Sin pantalla de error
 *   6. "A CONTINUACIÓN" soft check
 *
 * IMPORTANTE — comportamiento conocido:
 *   - El Hero EPG puede cambiar de posición en cualquier momento; nunca usar coordenadas fijas.
 *   - Los canales disponibles varían; siempre detectar cuáles están activos antes de cambiar.
 *   - Puede haber canales con georestrición — si aparece error de región, saltar al siguiente.
 *   - waitForIdleTimeout=0 obligatorio por las animaciones del reproductor.
 */

const { pageContains, pageContainsAny }  = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick }     = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible }     = require('../../../../tests/helpers/appState');
const { swipeAdb }                       = require('../../../../tests/helpers/tapAdb');
const { findYellowBorderIndex }          = require('../../../../tests/helpers/yellowBorder');

// Señales de georestrición — si aparecen tras cambiar canal, el canal está bloqueado
const GEO_ERROR_SIGNALS = [
  'no disponible en tu región',
  'no disponible en tu pais',
  'contenido no disponible',
  'not available in your region',
  'geo',
  'región',
];

describe('Hero EPG — Navegación y Reproductor Live — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // ── 1. DOD-03: Player activo al lanzar ─────────────────────────────────────

  it('hero_epg_player_activo_al_lanzar', async () => {
    let playerVisible = false;
    for (let i = 0; i < 5 && !playerVisible; i++) {
      playerVisible = await pageContains('Mostrar controles del reproductor');
      if (!playerVisible) await browser.pause(600);
    }
    expect(playerVisible).toBe(true);
  });

  // ── 2. Navegación de tabs EPG: Ayer → Anteayer → Mañana → Hoy ─────────────

  it('hero_epg_navegacion_tabs_ayer_anteayer_manana_hoy', async () => {
    // Los tabs pueden estar como texto o como content-desc — probar ambos
    const clickTab = async (label) => {
      try { await waitAndClick(label, 2500); return true; } catch (_) {}
      try { await clickElement(`~${label}`); return true; } catch (_) {}
      return false;
    };

    // Ayer
    const ayer = await clickTab('Ayer');
    if (ayer) {
      await browser.pause(500);
      await dismissPromoPopupIfVisible();
      const ayerVisible = await pageContainsAny(['Ayer', 'ayer']);
      expect(ayerVisible).toBe(true);
    } else {
      console.log('[hero_epg] Tab "Ayer" no encontrado — puede no estar disponible');
    }

    // Anteayer
    const anteayer = await clickTab('Anteayer');
    if (anteayer) {
      await browser.pause(500);
      await dismissPromoPopupIfVisible();
      const anteayerVisible = await pageContainsAny(['Anteayer', 'anteayer']);
      expect(anteayerVisible).toBe(true);
    } else {
      console.log('[hero_epg] Tab "Anteayer" no encontrado');
    }

    // Mañana
    const manana = await clickTab('Mañana');
    if (manana) {
      await browser.pause(500);
      await dismissPromoPopupIfVisible();
      const mananaVisible = await pageContainsAny(['Mañana', 'mañana', 'Manana']);
      expect(mananaVisible).toBe(true);
    } else {
      console.log('[hero_epg] Tab "Mañana" no encontrado');
    }

    // Hoy — siempre debe existir (es el estado base)
    const hoy = await clickTab('Hoy');
    expect(hoy).toBe(true);
    await browser.pause(500);
    const hoyVisible = await pageContainsAny(['Hoy', 'hoy', 'HOY']);
    expect(hoyVisible).toBe(true);
  });

  // ── 3. Cambio de canal con detección dinámica y manejo de georestrición ────

  it('hero_epg_cambio_canal_activo', async () => {
    // Detectar TODOS los canales visibles en el Hero EPG y leer su estado
    // Canales con live: tienen "EN VIVO" en content-desc
    // Canales sin programación: tienen "SIN PROGRAMACIÓN" o solo "A CONTINUACIÓN"
    const NAV_ITEMS = ['Inicio', 'Explorar', 'Buscar', 'Menú', 'Mostrar controles'];

    // Obtener todos los canales con live en el Hero EPG
    const els = await $$('android=new UiSelector().descriptionContains("EN VIVO")');
    const canales = [];
    for (const el of els) {
      try {
        if (!await el.isDisplayed()) continue;
        const desc = (await el.getAttribute('content-desc') || '').trim();
        if (NAV_ITEMS.some(n => desc.startsWith(n))) continue;
        canales.push({ el, desc: desc.slice(0, 80) });
      } catch (_) {}
    }

    canales.forEach((c, i) => console.log(`[hero_epg] Canal ${i + 1}: ${c.desc}`));

    if (canales.length === 0) {
      console.log('[hero_epg] No se detectaron canales — validando player');
      expect(await pageContains('Mostrar controles del reproductor')).toBe(true);
      return;
    }

    // Detectar canal activo (borde amarillo) via análisis de screenshot
    const actualIdx = await findYellowBorderIndex(canales.map(c => c.el));
    canales.forEach((c, i) => {
      const estado = i === actualIdx ? 'ACTUAL (borde amarillo)' : 'DISPONIBLE';
      console.log(`[hero_epg] Canal ${i + 1} [${estado}]: ${c.desc}`);
    });

    const disponibles = canales.filter((_, i) => i !== actualIdx);
    console.log(`[hero_epg] canales disponibles para cambiar: ${disponibles.length}`);

    if (disponibles.length === 0) {
      console.log('[hero_epg] No hay otro canal disponible — validando player');
      expect(await pageContains('Mostrar controles del reproductor')).toBe(true);
      return;
    }

    // Cambiar al primer canal disponible
    await disponibles[0].el.click();
    await browser.pause(500);
    await dismissPromoPopupIfVisible();

    const geoError = await pageContainsAny(GEO_ERROR_SIGNALS);
    if (geoError) {
      console.log('[hero_epg] Canal con georestrición — volviendo');
      try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
      await browser.pause(400);
    }

    const playerSigueActivo = await pageContains('Mostrar controles del reproductor');
    expect(playerSigueActivo).toBe(true);
  });

  // ── 4. Swipe en el carousel del Hero EPG ───────────────────────────────────

  it('hero_epg_swipe_carousel_programacion', async () => {
    // Localizar el Hero EPG por el elemento "ESTÁS VIENDO" para hacer swipe
    // en el componente correcto — nunca usar coordenadas fijas
    let carouselY = null;

    const candidatos = [
      'android=new UiSelector().descriptionContains("ESTÁS VIENDO")',
      'android=new UiSelector().descriptionContains("EN VIVO")',
      'android=new UiSelector().textContains("EN VIVO")',
    ];
    for (const sel of candidatos) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed()) {
          const loc  = await el.getLocation();
          const size = await el.getSize();
          carouselY = Math.round(loc.y + size.height / 2);
          console.log(`[hero_epg] carousel Y detectado en ${carouselY} via "${sel}"`);
          break;
        }
      } catch (_) {}
    }

    if (!carouselY) {
      // Fallback conservador: zona debajo del player (~65% de pantalla)
      const { height } = await browser.getWindowSize();
      carouselY = Math.floor(height * 0.65);
      console.log(`[hero_epg] carousel Y no detectado — usando fallback ${carouselY}`);
    }

    const { width } = await browser.getWindowSize();
    const izq  = Math.floor(width * 0.05);
    const der  = Math.floor(width * 0.95);

    // Dos swipes largos a la derecha y dos a la izquierda en el Hero EPG
    await swipeAdb(izq, carouselY, der, carouselY, 500); await browser.pause(400);
    await swipeAdb(izq, carouselY, der, carouselY, 500); await browser.pause(400);
    await swipeAdb(der, carouselY, izq, carouselY, 500); await browser.pause(400);
    await swipeAdb(der, carouselY, izq, carouselY, 500); await browser.pause(400);

    const playerActivo = await pageContains('Mostrar controles del reproductor');
    expect(playerActivo).toBe(true);
  });

  // ── 5. Sin pantalla de error ────────────────────────────────────────────────

  it('hero_epg_sin_error_reproduccion', async () => {
    await browser.pause(700);
    const hayError = await pageContainsAny(['Error', 'error', 'Fallo', 'failed']);
    expect(hayError).toBe(false);
  });

  // ── 6. "A CONTINUACIÓN" — soft check (no bloquea) ─────────────────────────

  it('hero_epg_siguiente_programa_visible', async () => {
    const aContinuacion = await pageContains('A CONTINUACIÓN');
    if (!aContinuacion) {
      console.log('[hero_epg] "A CONTINUACIÓN" no visible — señal puede no tener EPG completo');
    }
    // Solo verifica que no hay error, no que esté visible
    const hayError = await pageContainsAny(['Error', 'error', 'Fallo']);
    expect(hayError).toBe(false);
  });

});
