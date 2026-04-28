/**
 * clickHelper — Click con validación previa de existencia.
 * GOT-04: getPageSource() reemplazado por isExisting() — no serializa el árbol completo.
 * Soporta prefijo ~ para accessibility ID (content-desc) usado por tests generados.
 */

const IS_IOS = (process.env.APP_PLATFORM || 'android').trim().toLowerCase() === 'ios';

async function clickText(text) {
  let el;
  if (text.startsWith('~')) {
    el = await $(`~${text.slice(1)}`);
  } else if (IS_IOS) {
    el = await $(`~${text}`);
  } else {
    el = await $(`android=new UiSelector().text("${text}")`);
  }
  if (!(await el.isExisting())) {
    throw new Error(`"${text}" no encontrado en la UI`);
  }
  await el.click();
}

// Alias para compatibilidad con tests generados por Agent 2
const clickElement = clickText;

/**
 * Espera hasta que el texto aparezca en la UI y luego hace click.
 * Portado de appium-test/utils/helpers.js (tapByText con timeout).
 * Útil cuando el elemento puede tardar en aparecer (animaciones, carga).
 */
async function waitAndClick(text, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const el = text.startsWith('~')
        ? await $(`~${text.slice(1)}`)
        : await $(`android=new UiSelector().text("${text}")`);
      if (await el.isExisting()) {
        await el.click();
        return;
      }
    } catch (_) {}
    await browser.pause(500);
  }
  throw new Error(`waitAndClick: "${text}" no apareció en ${timeoutMs}ms`);
}

module.exports = { clickText, clickElement, waitAndClick };
