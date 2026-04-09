/**
 * clickHelper — Click por texto con validación previa en page source.
 * Verifica presencia antes de intentar el click para errores claros.
 */

async function clickText(text) {
  const src = await browser.getPageSource();
  if (!src.includes(`>${text}<`) && !src.includes(`"${text}"`)) {
    throw new Error(`"${text}" no encontrado en la UI`);
  }
  const el = await $(`android=new UiSelector().text("${text}")`);
  await el.click();
}

module.exports = { clickText };
