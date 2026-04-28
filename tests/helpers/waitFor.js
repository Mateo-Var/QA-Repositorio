/**
 * waitFor — Espera con timeout propio y reintentos.
 * GOT-02: usa browser.pause (no setTimeout) para que Jest pueda mockearlo.
 * PAT-01: helper extraído como módulo para permitir unit testing sin Appium.
 */

async function waitFor(conditionFn, timeoutMs, intervalMs, errorMsg) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await conditionFn()) return true;
    await browser.pause(intervalMs);
  }
  throw new Error(errorMsg || `Timeout esperando condición (${timeoutMs}ms)`);
}

async function waitForElement(selector, timeoutMs = 5000, intervalMs = 500) {
  return waitFor(
    async () => {
      try { return await $(selector).isExisting(); } catch (_) { return false; }
    },
    timeoutMs,
    intervalMs,
    `Elemento no encontrado: ${selector} (${timeoutMs}ms)`
  );
}

module.exports = { waitFor, waitForElement };
