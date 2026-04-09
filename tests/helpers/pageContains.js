/**
 * pageContains — Búsqueda en page source XML.
 * DEC-02: getPageSource() es 3-5x más rápido que findElement para verificar presencia.
 */

async function pageContains(text) {
  try {
    const src = await browser.getPageSource();
    return src.includes(text);
  } catch (_) {
    return false;
  }
}

async function pageContainsAny(texts) {
  try {
    const src = await browser.getPageSource();
    return texts.some(t => src.includes(t));
  } catch (_) {
    return false;
  }
}

module.exports = { pageContains, pageContainsAny };
