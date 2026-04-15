/**
 * clickHelper — Click con validación previa de existencia.
 * GOT-04: getPageSource() reemplazado por isExisting() — no serializa el árbol completo.
 * Soporta prefijo ~ para accessibility ID (content-desc) usado por tests generados.
 */

async function clickText(text) {
  let el;
  if (text.startsWith('~')) {
    // Accessibility ID selector — mapea a content-desc en Android
    el = await $(`~${text.slice(1)}`);
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

module.exports = { clickText, clickElement };
