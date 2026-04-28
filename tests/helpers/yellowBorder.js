'use strict';

/**
 * yellowBorder.js — Detecta qué elemento tiene borde amarillo en pantalla.
 *
 * Cada vez que corre el test toma un screenshot fresco — las coordenadas del
 * borde amarillo cambian en cada run según el estado de la UI.
 *
 * Amarillo tvnPass exacto: R=255, G=198, B=39  (detectado empíricamente).
 * Tolerancia: R>220, G>160 y G<230, B<80.
 */

const { PNG } = require('pngjs');

function isYellow(r, g, b) {
  return r > 220 && g > 160 && g < 230 && b < 80;
}

function decodePng(base64) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(base64, 'base64');
    const png = new PNG();
    png.parse(buf, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

/**
 * Escanea un rectángulo alrededor del borde izquierdo del elemento.
 * Busca píxeles amarillos en un rango X de -10 a +20 respecto al edge izquierdo
 * y en toda la altura del elemento.
 */
function sampleLeftBorder(img, rect) {
  const x0 = Math.max(0, Math.round(rect.x) - 10);
  const x1 = Math.min(img.width - 1, Math.round(rect.x) + 20);
  const y0 = Math.max(0, Math.round(rect.y));
  const y1 = Math.min(img.height - 1, Math.round(rect.y + rect.height));

  let yellowCount = 0;
  // Muestrear cada 4px vertical para no ser lento
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * img.width + x) * 4;
      if (isYellow(img.data[idx], img.data[idx + 1], img.data[idx + 2])) {
        yellowCount++;
      }
    }
  }
  return yellowCount;
}

/**
 * Dado un array de elementos WebdriverIO, toma screenshot en el momento actual
 * y devuelve el índice del elemento con borde amarillo (canal activo).
 * Retorna -1 si no detecta ninguno con confianza suficiente.
 *
 * @param {WebdriverIO.Element[]} elements
 * @returns {Promise<number>}
 */
async function findYellowBorderIndex(elements) {
  const b64 = await browser.takeScreenshot();
  const img  = await decodePng(b64);

  // Calcular factor de escala: screenshot (píxeles físicos) vs getWindowSize (píxeles lógicos)
  const win   = await browser.getWindowSize();
  const scale = img.width / win.width;
  console.log(`[yellowBorder] escala: ${img.width}px físicos / ${win.width}px lógicos = ${scale.toFixed(2)}x`);

  let bestIdx   = -1;
  let bestCount = 0;

  for (let i = 0; i < elements.length; i++) {
    try {
      const rect = await elements[i].getRect();
      // Convertir rect de píxeles lógicos a físicos
      const physRect = {
        x:      rect.x      * scale,
        y:      rect.y      * scale,
        width:  rect.width  * scale,
        height: rect.height * scale,
      };
      const count = sampleLeftBorder(img, physRect);
      console.log(`[yellowBorder] elemento ${i} — píxeles amarillos: ${count} (físico x=${Math.round(physRect.x)} y=${Math.round(physRect.y)})`);
      if (count > bestCount) {
        bestCount = count;
        bestIdx   = i;
      }
    } catch (_) {}
  }

  if (bestCount < 3) {
    console.log('[yellowBorder] No se detectó borde amarillo confiable');
    return -1;
  }

  console.log(`[yellowBorder] Canal activo: índice ${bestIdx} (${bestCount} píxeles amarillos)`);
  return bestIdx;
}

module.exports = { findYellowBorderIndex };
