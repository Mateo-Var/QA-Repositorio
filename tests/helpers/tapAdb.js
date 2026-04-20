'use strict';

/**
 * tapAdb — Tap e interacciones via ADB shell.
 * Portado de appium-test/utils/helpers.js (patrón ADB bounds).
 * Más confiable que el.click() en algunos dispositivos y flujos.
 *
 * Uso: cuando clickHelper falla silenciosamente o el elemento
 * no tiene accessibility ID estable (ej: canales en lista EN VIVO).
 */

/**
 * Extrae las coordenadas del primer elemento que contenga el texto o content-desc dado.
 * Retorna { x1, y1, x2, y2, cx, cy } o null si no lo encuentra.
 */
function boundsOf(src, text) {
  const patterns = [`text="${text}"`, `content-desc="${text}"`];
  for (const pattern of patterns) {
    const idx = src.indexOf(pattern);
    if (idx === -1) continue;
    const tagStart = src.lastIndexOf('<', idx);
    const tagEnd   = src.indexOf('>', idx);
    if (tagStart === -1 || tagEnd === -1) continue;
    const tag = src.slice(tagStart, tagEnd + 1);
    const m = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (m) {
      const [x1, y1, x2, y2] = [+m[1], +m[2], +m[3], +m[4]];
      return { x1, y1, x2, y2, cx: Math.floor((x1 + x2) / 2), cy: Math.floor((y1 + y2) / 2) };
    }
  }
  return null;
}

/**
 * Extrae TODOS los elementos cuyo content-desc haga match con un regex.
 * Retorna array de { text, x1, y1, x2, y2, cx, cy }.
 */
function allBoundsOf(src, regexPattern) {
  const results = [];
  const re = new RegExp(
    `content-desc="(${regexPattern})"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'g'
  );
  let m;
  while ((m = re.exec(src)) !== null) {
    const [x1, y1, x2, y2] = [+m[2], +m[3], +m[4], +m[5]];
    results.push({ text: m[1], x1, y1, x2, y2, cx: Math.floor((x1 + x2) / 2), cy: Math.floor((y1 + y2) / 2) });
  }
  return results;
}

/** Tap directo via ADB — bypasea GestureController. */
async function tapAdb(x, y) {
  await browser.execute('mobile: shell', { command: 'input', args: ['tap', String(x), String(y)] });
  await browser.pause(400);
}

/** Busca el texto en el page source y hace tap ADB en sus coordenadas. */
async function tapByBounds(src, text) {
  const b = boundsOf(src, text);
  if (!b) throw new Error(`tapByBounds: "${text}" no encontrado en page source`);
  await tapAdb(b.cx, b.cy);
}

/**
 * Swipe via ADB.
 * Para carousel: swipeAdb(980, y, 30, y)   → avanza
 *                swipeAdb(30, y, 980, y)    → retrocede
 * Para scroll:   swipeAdb(540, 1700, 540, 900) → scroll down
 */
async function swipeAdb(x1, y1, x2, y2, durationMs = 300) {
  await browser.execute('mobile: shell', {
    command: 'input',
    args: ['swipe', String(x1), String(y1), String(x2), String(y2), String(durationMs)],
  });
  await browser.pause(500);
}

module.exports = { boundsOf, allBoundsOf, tapAdb, tapByBounds, swipeAdb };
