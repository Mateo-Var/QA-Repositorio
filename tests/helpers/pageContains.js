/**
 * pageContains — Verifica presencia de texto en la UI.
 * GOT-04: getPageSource() cuelga 60-120s en apps Compose con video live porque
 * el árbol de accesibilidad se actualiza continuamente con cada frame.
 * Solución: UiSelector devuelve true/false inmediatamente (no serializa el árbol completo).
 */

const IS_IOS = (process.env.APP_PLATFORM || 'android').trim().toLowerCase() === 'ios';

async function pageContains(text) {
  const selectors = IS_IOS ? [
    `~${text}`,
    `-ios predicate string:name == "${text}"`,
    `-ios predicate string:label == "${text}"`,
  ] : [
    `android=new UiSelector().text("${text}")`,
    `android=new UiSelector().description("${text}")`,
    `android=new UiSelector().textContains("${text}")`,
    `android=new UiSelector().descriptionContains("${text}")`,
  ];
  for (const sel of selectors) {
    try {
      const el = await $(sel);
      if (await el.isExisting()) return true;
    } catch (_) {}
  }
  return false;
}

async function pageContainsAny(texts) {
  for (const text of texts) {
    if (await pageContains(text)) return true;
  }
  return false;
}

module.exports = { pageContains, pageContainsAny };
