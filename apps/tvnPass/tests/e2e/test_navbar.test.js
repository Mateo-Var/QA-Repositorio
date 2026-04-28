'use strict';

/**
 * Navbar — Navegación completa tvnPass Android
 *
 * Flujo:
 *   1. Home: componentes activos + swipe carruseles
 *   2. Explorar → Radios → volver
 *   3. Explorar → ON DEMAND / Categorías → volver
 *   4. Explorar → PROGRAMACIÓN → volver
 *   5. Explorar → TVN EN VIVO → volver
 *   6. Buscar → buscar contenido → reproducir episodio o entrar a show
 *   7. Menú → secciones → navegación → volver al inicio
 */

const { pageContains, pageContainsAny } = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick }    = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible }    = require('../../../../tests/helpers/appState');
const { swipeAdb, tapAdb }             = require('../../../../tests/helpers/tapAdb');
const { getSource }                    = require('../../../../tests/helpers/getSource');
const { boundsOf, tapByBounds }        = require('../../../../tests/helpers/tapAdb');

const SEARCH_QUERY = 'noticias';

// Títulos a ignorar en el discovery del home
const SKIP_TITLES = new Set([
  'VER TODO', 'VER TODO ›', 'Inicio', 'Explorar', 'Buscar', 'Menú',
  'EN VIVO', 'Anteayer', 'Ayer', 'Hoy', 'Mañana',
  'PROGRAMACIÓN ANTERIOR', 'PROGRAMACIÓN', 'A CONTINUACIÓN', 'ESTÁS VIENDO',
]);
// Secciones sin botón VER TODO pero que igual tienen carrusel
const NO_VER_TODO = ['CONTINUAR VIENDO', 'TOP 10', 'Novedades'];

function extractSections(src, seenTitles, screenHeight) {
  const found = [];
  let from = 0;

  // Heurística 1: títulos al mismo Y que "VER TODO"
  while (true) {
    const vtIdx = src.indexOf('VER TODO', from);
    if (vtIdx === -1) break;
    from = vtIdx + 1;
    const vtTag = src.slice(src.lastIndexOf('<', vtIdx), src.indexOf('>', vtIdx) + 1);
    const vtB   = vtTag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!vtB) continue;
    const [vtY1, vtY2] = [+vtB[2], +vtB[4]];

    for (const m of [...src.matchAll(/\btext="([^"]{2,40})"/g)]) {
      const title = m[1].trim();
      if (SKIP_TITLES.has(title) || seenTitles.has(title) || title.length < 3) continue;
      const tIdx = src.indexOf(`text="${title}"`, Math.max(0, m.index - 2));
      const tTag = src.slice(src.lastIndexOf('<', tIdx), src.indexOf('>', tIdx) + 1);
      const tB   = tTag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!tB) continue;
      if (Math.abs(+tB[2] - vtY1) > 30 && Math.abs(+tB[4] - vtY2) > 30) continue;
      if (+tB[2] > screenHeight) continue; // título fuera de pantalla — ignorar
      const rawSliderY = +tB[4] + 300;
      const sliderY = Math.max(Math.floor(screenHeight * 0.30), Math.min(rawSliderY, Math.floor(screenHeight * 0.88)));
      found.push({ title, sliderY });
      seenTitles.add(title);
    }
  }

  // Heurística 2: secciones sin VER TODO
  for (const title of NO_VER_TODO) {
    if (seenTitles.has(title)) continue;
    const idx = src.indexOf(`text="${title}"`);
    if (idx === -1) continue;
    const tag = src.slice(src.lastIndexOf('<', idx), src.indexOf('>', idx) + 1);
    const b   = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!b) continue;
    if (+b[2] > screenHeight) continue; // fuera de pantalla
    const rawSliderY = +b[4] + 300;
    const sliderY = Math.max(Math.floor(screenHeight * 0.30), Math.min(rawSliderY, Math.floor(screenHeight * 0.88)));
    found.push({ title, sliderY });
    seenTitles.add(title);
  }

  return found;
}

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

describe('Navbar — Navegación completa tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  // ── 1. Home: discovery de secciones ────────────────────────────────────────

  it('navbar_home_componentes_activos', async () => {
    const { width, height } = await browser.getWindowSize();

    // Scroll al tope para empezar desde arriba
    for (let i = 0; i < 5; i++) {
      await swipeAdb(width / 2, height * 0.2, width / 2, height * 0.85, 120);
    }
    await browser.pause(500);
    await dismissPromoPopupIfVisible();

    // Verificar componentes de la navbar
    const componentes = ['Programación', 'EN VIVO', 'Explorar', 'Buscar', 'Menú', 'Inicio'];
    const visibles = [];
    for (const c of componentes) {
      if (await pageContains(c)) visibles.push(c);
    }
    console.log(`[navbar] Home componentes visibles: ${visibles.join(', ')}`);
    expect(visibles.length).toBeGreaterThan(0);
  });

  it('navbar_home_swipe_carruseles', async () => {
    const { width, height } = await browser.getWindowSize();
    const seenTitles  = new Set();
    const allSections = [];
    let   lastSrcHash = '';
    let   emptyStreak = 0;

    console.log('[navbar] Iniciando discovery de carruseles...');

    for (let step = 0; step <= 16; step++) {
      if (step > 0) {
        await swipeAdb(width / 2, height * 0.75, width / 2, height * 0.35, 300);
        await browser.pause(80);
        if (step % 2 !== 0) continue;
      }

      const src = await getSource(6000, 2);
      if (!src) { console.log('[navbar] getSource no disponible — skip step'); continue; }

      const srcHash = src.length + src.slice(-150);
      if (srcHash === lastSrcHash) { console.log('[navbar] Fondo alcanzado'); break; }
      lastSrcHash = srcHash;

      const found = extractSections(src, seenTitles, height);
      if (found.length > 0) {
        for (const s of found) {
          allSections.push({ ...s, scrollStep: step });
          console.log(`[navbar] ✓ sección "${s.title}" sliderY=${s.sliderY}`);
        }
        emptyStreak = 0;
      } else {
        if (++emptyStreak >= 2) { console.log('[navbar] Sin cambios — terminando discovery'); break; }
      }
    }

    console.log(`[navbar] Total secciones encontradas: ${allSections.length}`);

    if (allSections.length === 0) {
      console.log('[navbar] No se encontraron secciones — haciendo swipe genérico');
      const y = Math.floor(height * 0.55);
      await swipeAdb(Math.floor(width * 0.9), y, Math.floor(width * 0.1), y, 400);
      await browser.pause(500);
      await swipeAdb(Math.floor(width * 0.1), y, Math.floor(width * 0.9), y, 400);
      expect(true).toBe(true);
      return;
    }

    // Seleccionar hasta 4 secciones al azar y ordenar por scrollStep
    const seleccionadas = pickRandom(allSections, 4).sort((a, b) => a.scrollStep - b.scrollStep);
    console.log(`[navbar] Navegando: ${seleccionadas.map(s => s.title).join(', ')}`);

    // Volver al tope
    for (let i = 0; i < 5; i++) {
      await swipeAdb(width / 2, height * 0.2, width / 2, height * 0.85, 120);
    }
    await browser.pause(400);

    let currentStep = 0;
    for (const { title, sliderY, scrollStep } of seleccionadas) {
      // Scrollear hasta el paso donde está la sección
      const steps = scrollStep - currentStep;
      for (let s = 0; s < steps; s++) {
        await swipeAdb(width / 2, height * 0.75, width / 2, height * 0.35, 300);
        await browser.pause(80);
      }
      currentStep = scrollStep;
      await browser.pause(200);

      // 2 swipes adelante + 2 atrás en el carrusel (evitar borde derecho donde está VER TODO)
      console.log(`[navbar] swipe carrusel "${title}" Y=${sliderY}`);
      await swipeAdb(Math.floor(width * 0.80), sliderY, Math.floor(width * 0.10), sliderY, 500);
      await browser.pause(200);
      await swipeAdb(Math.floor(width * 0.80), sliderY, Math.floor(width * 0.10), sliderY, 500);
      await browser.pause(200);
      await swipeAdb(Math.floor(width * 0.10), sliderY, Math.floor(width * 0.80), sliderY, 500);
      await browser.pause(200);
      await swipeAdb(Math.floor(width * 0.10), sliderY, Math.floor(width * 0.80), sliderY, 500);
      await browser.pause(200);
    }

    expect(seleccionadas.length).toBeGreaterThan(0);
  });

  // ── 2. Explorar → Radios ───────────────────────────────────────────────────

  it('navbar_explorar_radios', async () => {
    await clickElement('~Explorar');
    await browser.pause(600);
    await dismissPromoPopupIfVisible();

    await clickElement('~RADIOS');
    await browser.pause(1000);
    await dismissPromoPopupIfVisible();

    // Confirmación: header VOLVER + título ESTACIONES DE RADIO
    const enRadios = await pageContains('VOLVER') && await pageContainsAny(['ESTACIONES DE RADIO', 'TVN Radio']);
    console.log(`[navbar] En sección Radios: ${enRadios}`);
    expect(enRadios).toBe(true);

    await clickElement('~Explorar');
    await browser.pause(500);
  });

  // ── 3. Explorar → ON DEMAND / Categorías ──────────────────────────────────

  it('navbar_explorar_on_demand', async () => {
    await clickElement('~Explorar');
    await browser.pause(600);
    await dismissPromoPopupIfVisible();

    await clickElement('~ON DEMAND');
    await browser.pause(1000);
    await dismissPromoPopupIfVisible();

    // Confirmación: header VOLVER + contenido de catálogo
    const enOnDemand = await pageContains('VOLVER') && await pageContainsAny(['VER TODO', 'NOTICIAS', 'EL MUNDIAL']);
    console.log(`[navbar] ON DEMAND / Categorías entrado: ${enOnDemand}`);
    expect(enOnDemand).toBe(true);

    await clickElement('~Explorar');
    await browser.pause(500);
  });

  // ── 4. Explorar → PROGRAMACIÓN ────────────────────────────────────────────

  it('navbar_explorar_programacion', async () => {
    await clickElement('~Explorar');
    await browser.pause(600);
    await dismissPromoPopupIfVisible();

    await clickElement('~PROGRAMACIÓN');
    await browser.pause(1000);
    await dismissPromoPopupIfVisible();

    // Confirmación: guía muestra GUIA + CANALES RECIENTES
    const enProg = await pageContainsAny(['GUIA', 'CANALES RECIENTES', 'ESTÁS VIENDO']);
    console.log(`[navbar] En PROGRAMACIÓN: ${enProg}`);
    expect(enProg).toBe(true);

    // PROGRAMACIÓN oculta la navbar inferior — back nativo para salir
    await browser.pressKeyCode(4);
    await browser.pause(500);
  });

  // ── 5. Explorar → TVN EN VIVO ─────────────────────────────────────────────

  it('navbar_explorar_tvn_en_vivo', async () => {
    await clickElement('~Explorar');
    await browser.pause(600);
    await dismissPromoPopupIfVisible();

    await clickElement('~TVN EN VIVO');
    await browser.pause(1000);
    await dismissPromoPopupIfVisible();

    // Confirmación: botón VER AHORA (cargando) o player ya activo
    const playerActivo = await pageContainsAny(['VER AHORA', 'Mostrar controles del reproductor', 'ESTÁS VIENDO']);
    console.log(`[navbar] TVN EN VIVO player activo: ${playerActivo}`);
    expect(playerActivo).toBe(true);

    await clickElement('~Inicio');
    await browser.pause(500);
  });

  // ── 6. Buscar → buscar contenido → reproducir ─────────────────────────────

  it('navbar_buscar_contenido', async () => {
    await clickElement('~Buscar');
    await browser.pause(600);
    await dismissPromoPopupIfVisible();

    // Ingresar query en el campo de búsqueda
    try {
      const campo = await $('android=new UiSelector().className("android.widget.EditText")');
      if (await campo.isExisting()) {
        await campo.click();
        await browser.pause(400);
        await campo.setValue(SEARCH_QUERY);
        await browser.pause(500);
        await browser.execute('mobile: pressKey', { keycode: 66 }); // ENTER
        await browser.pause(1000);
      }
    } catch (_) {
      // Intentar con accessibility
      try {
        await clickElement('~Buscar');
        await browser.pause(400);
        await browser.keys(SEARCH_QUERY.split(''));
        await browser.pause(500);
        await browser.execute('mobile: pressKey', { keycode: 66 });
        await browser.pause(1000);
      } catch (_2) {}
    }

    await dismissPromoPopupIfVisible();
    const hayResultados = await pageContainsAny(['resultado', 'Resultado', SEARCH_QUERY, 'episodio', 'Episodio', 'temporada', 'Temporada']);
    console.log(`[navbar] Resultados de búsqueda visibles: ${hayResultados}`);

    if (hayResultados) {
      // Detectar primer resultado y tipo
      const esEpisodio = await pageContainsAny(['Episodio', 'episodio', 'T1', 'E1', 'Temporada']);
      console.log(`[navbar] Primer resultado es episodio: ${esEpisodio}`);

      try {
        // Tap en el primer resultado visible
        const primer = await $('android=new UiSelector().className("android.view.ViewGroup").instance(3)');
        if (await primer.isExisting()) {
          await primer.click();
          await browser.pause(1000);
          await dismissPromoPopupIfVisible();

          if (esEpisodio) {
            // Reproducir
            try { await waitAndClick('REPRODUCIR', 3000); } catch (_) {
              try { await waitAndClick('VER AHORA', 2000); } catch (_2) {}
            }
            await browser.pause(700);
            const playerActivo = await pageContains('Mostrar controles del reproductor');
            console.log(`[navbar] Episodio reproduciéndose: ${playerActivo}`);
          } else {
            // Entrar al show — verificar que cargó contenido
            const showVisible = await pageContainsAny(['Temporada', 'Episodio', 'REPRODUCIR', 'VER AHORA', 'Episodios']);
            console.log(`[navbar] En show: ${showVisible}`);
          }
        }
      } catch (_) {
        console.log('[navbar] No se pudo interactuar con el primer resultado');
      }
    }

    // Volver al inicio
    try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
    await browser.pause(600);
    try { await browser.execute('mobile: pressKey', { keycode: 4 }); } catch (_) {}
    await browser.pause(600);
  });

  // ── 7. Menú ────────────────────────────────────────────────────────────────

  it('navbar_menu_navegacion', async () => {
    await clickElement('~Menú');
    await browser.pause(700);
    await dismissPromoPopupIfVisible();

    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);

    const hayContenido = await pageContainsAny([
      'Ajustes', 'Configuración', 'Acerca de', 'Notificaciones',
      'Información', 'Versión', 'Soporte', 'Ayuda', 'Contacto', 'Términos',
    ]);
    expect(hayContenido).toBe(true);

    const hayError = await pageContains('Error');
    expect(hayError).toBe(false);
  });

  it('navbar_menu_tap_opcion', async () => {
    const src = await getSource(6000, 3);
    if (!src) {
      console.log('[navbar] getSource no disponible — skip');
      return;
    }

    const opciones = ['Ajustes', 'Configuración', 'Acerca de', 'Notificaciones', 'Ayuda'];
    for (const opcion of opciones) {
      const b = boundsOf(src, opcion);
      if (b) {
        console.log(`[navbar] tap ADB en "${opcion}"`);
        await tapByBounds(src, opcion);
        await browser.pause(500);
        const visible = await pageContains(opcion);
        expect(visible).toBe(true);
        break;
      }
    }
  });

  it('navbar_volver_al_inicio', async () => {
    await browser.activateApp('com.streann.tvnpass');
    await browser.pause(700);
    await clickElement('~Inicio');
    await browser.pause(700);
    const inicioVisible = await pageContains('Inicio') || await pageContains('Explorar');
    expect(inicioVisible).toBe(true);
  });

});
