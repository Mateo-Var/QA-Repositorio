const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '../..');  // tests/helpers/ → raíz del proyecto
const APP_ID  = process.env.APP_ID  || 'tvnPass';
const RUN_ID  = process.env.QA_RUN_ID || new Date().toISOString().slice(0, 10);

function screenshotDir(type) {
  // type: 'happy_path' | 'failures'
  return path.join(ROOT, 'reports', APP_ID, 'screenshots', RUN_ID, type);
}

async function takeScreenshot(name, type = 'happy_path') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename  = `${name}_${timestamp}.png`;
  const dir       = screenshotDir(type);
  fs.mkdirSync(dir, { recursive: true });
  const filepath  = path.join(dir, filename);
  try {
    await browser.saveScreenshot(filepath);
    console.log(`[screenshot] guardado: ${filepath}`);
  } catch (e) {
    console.warn(`[screenshot] no se pudo guardar ${filepath}: ${e.message}`);
  }
  return filepath;
}

module.exports = { takeScreenshot, screenshotDir };
