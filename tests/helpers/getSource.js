'use strict';

/**
 * getSource — Obtiene el page source con reintentos y timeout por intento.
 * GOT-04: getPageSource() puede colgar en screens con video live.
 * Solución: Promise.race() con timeout por intento — si cuelga, reintenta.
 * Usar solo en pantallas SIN reproductor activo (Explorar, Buscar, Menú).
 * Para pantallas con player, seguir usando pageContains() con UiSelector.
 */

async function getSource(timeoutMs = 5000, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const src = await Promise.race([
        browser.getPageSource(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSource timeout')), timeoutMs)
        ),
      ]);
      if (src && src.length > 200) return src;
    } catch (_) {}
    if (i < retries - 1) await browser.pause(800);
  }
  return '';
}

module.exports = { getSource };
