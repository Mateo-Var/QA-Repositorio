'use strict';

/**
 * clientConfig.js — carga la configuración del cliente activo en runtime.
 * Todos los tests genéricos lo importan para resolver textos, tabs y features
 * sin hardcodear valores de una app específica.
 */

const path = require('path');

const APP_ID = (process.env.APP_ID || '').trim();
if (!APP_ID) throw new Error('APP_ID no está definido. Ejecútalo con APP_ID=NextOTT npm run test:android');

const raw = require(path.resolve(__dirname, `../../apps/${APP_ID}/client_config.json`));

// ── Extraer secciones principales ─────────────────────────────────────────────
const config    = raw.config    || raw;
const navigator = raw.navigator || [];
const i18n      = (raw.i18n || config.i18n || {}).es || {};

// ── Tabs del bottom bar (TabMain) ─────────────────────────────────────────────
function extractTabs(nav) {
  function findTabMain(items) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (item.name === 'TabMain') return item.navigators || [];
      const found = findTabMain(item.navigators || []);
      if (found.length) return found;
    }
    return [];
  }
  return findTabMain(nav).map(stack => ({
    name:  stack.name,
    title: (stack.navigatorOptions || {}).navigationOptions
      ? (stack.navigatorOptions.navigationOptions.title || stack.name)
      : stack.name,
  }));
}

const tabs = extractTabs(navigator);

// ── Tabs reales desde ui_map (fuente de verdad — Agente 0) ───────────────────
// Los Button elements en screens tienen los labels exactos que renderiza la UI.
// Esto es lo que el dispositivo real expone como accessibility labels.
let uiMapTabs = [];
let bottomBarLabels = [];
try {
  const fs = require('fs');
  const uiMapPath = path.resolve(__dirname, `../../apps/${APP_ID}/ui_map_android.json`);
  if (fs.existsSync(uiMapPath)) {
    const uiMap = JSON.parse(fs.readFileSync(uiMapPath, 'utf8'));
    const screens = uiMap.screens || {};
    // Buttons de la primera pantalla que tenga 3+ botones = bottom bar real
    for (const screen of Object.values(screens)) {
      const btns = (screen.elements || [])
        .filter(e => e.type === 'Button' && e.name && e.name !== 'null')
        .map(e => e.name);
      if (btns.length >= 3) { uiMapTabs = btns; break; }
    }
    // bottom_bar como fuente adicional para tabs no capturados en screens
    if (Array.isArray(uiMap.bottom_bar)) {
      bottomBarLabels = uiMap.bottom_bar.filter(l => l && l !== 'null');
    }
  }
} catch (_) {}

// ── Features activas ──────────────────────────────────────────────────────────
const features = {
  hasAuth:      !!(config.hasAuth),
  hasSearch:    !!(config.hasSearch),
  hasEpg:       !!(config.hasEpg),
  hasRadios:    !!(config.hasRadios),
  hasChannels:  !!(config.hasChannels),
  hasAudios:    !!(config.hasAudios),
  hasVideos:    !!(config.hasVideos),
  hasDownloads: !!(config.features && config.features.hasDownload),
};

// ── Textos de UI resueltos para el cliente ────────────────────────────────────
const texts = {
  home:      i18n.nav_home     || 'Home',
  search:    i18n.nav_search   || 'Buscar',
  menu:      i18n.nav_menu     || 'Menú',
  discover:  i18n.nav_discover || 'Explorar',
  loading:   i18n.loading      || '',
  live:      i18n.nav_live     || 'En Vivo',
};

// ── Selector de un tab por nombre lógico ─────────────────────────────────────
// Sinónimos por nombre lógico — cubre variantes entre clientes
const TAB_ALIASES = {
  home:      ['home', 'inicio', 'recommended', 'apprecommended', 'principal'],
  discover:  ['discover', 'explorar', 'explore', 'navegar', 'browse', 'appdiscover'],
  search:    ['search', 'buscar', 'búsqueda', 'busqueda', 'searchstack'],
  downloads: ['downloads', 'descargas', 'descarga', 'downloadsstack'],
  account:   ['account', 'cuenta', 'mi cuenta', 'perfil', 'profile', 'accountstack', 'menu', 'menú'],
  live:      ['live', 'en vivo', 'envivo', 'liveepg'],
};

// Mapeo: nombre lógico del tab → clave i18n que da el label real renderizado en la UI
const TAB_I18N_KEYS = {
  home:      ['nav_home'],
  discover:  ['nav_discover'],
  search:    ['nav_search'],
  downloads: ['nav_downloads'],
  account:   ['nav_account', 'nav_menu'],
  live:      ['nav_live'],
};

/**
 * Retorna true si el tab existe.
 * Con ui_map: verifica labels reales del dispositivo.
 * Sin ui_map: asume true — deja que el selector falle si de verdad no existe.
 */
function hasTab(logicalName) {
  // Sin ui_map no podemos saber — asumir que existe y dejar que el test lo verifique
  if (uiMapTabs.length === 0 && bottomBarLabels.length === 0) return true;

  const key     = logicalName.toLowerCase();
  const aliases = TAB_ALIASES[key] || [key];
  return uiMapTabs.some(l => aliases.some(a => l.toLowerCase().includes(a))) ||
         bottomBarLabels.some(l => aliases.some(a => l.toLowerCase().includes(a)));
}

/**
 * Devuelve el selector más probable para un tab.
 * Prioridad: ui_map > i18n del cliente > título del navigator.
 * Retorna un array de candidatos para que los tests puedan probar en orden.
 */
function tabSelector(logicalName) {
  const key     = logicalName.toLowerCase();
  const aliases = TAB_ALIASES[key] || [key];

  // 1. Buttons reales capturados por Agente 0 (máxima prioridad)
  if (uiMapTabs.length > 0) {
    const match = uiMapTabs.find(l => aliases.some(a => l.toLowerCase().includes(a)));
    if (match) return `~${match}`;
  }

  // 2. bottom_bar del ui_map
  if (bottomBarLabels.length > 0) {
    const match = bottomBarLabels.find(l => aliases.some(a => l.toLowerCase().includes(a)));
    if (match) return `~${match}`;
  }

  // 3. Valor i18n del cliente (lo que la UI realmente renderiza)
  const i18nKeys = TAB_I18N_KEYS[key] || [];
  for (const k of i18nKeys) {
    const val = i18n[k];
    if (val) return `~${val}`;
  }

  // 4. Título del navigator como último fallback
  const tab = tabs.find(t => {
    const n  = t.name.toLowerCase();
    const ti = t.title.toLowerCase();
    return aliases.some(a => n.includes(a) || ti.includes(a));
  });
  return tab ? `~${tab.title}` : `~${logicalName}`;
}

/**
 * Intenta hacer click en un tab probando múltiples selectores.
 * Primero el selector principal (i18n/ui_map), luego el título del navigator,
 * luego UiSelector.text() como último recurso.
 */
async function clickTab(logicalName) {
  const primary = tabSelector(logicalName);
  const key     = logicalName.toLowerCase();
  const aliases = TAB_ALIASES[key] || [key];

  // Candidatos: i18n/ui_map → título navigator → UiSelector text/desc
  const candidates = [primary];
  const tab = tabs.find(t => {
    const n  = t.name.toLowerCase();
    const ti = t.title.toLowerCase();
    return aliases.some(a => n.includes(a) || ti.includes(a));
  });
  if (tab && `~${tab.title}` !== primary) candidates.push(`~${tab.title}`);
  for (const alias of aliases) {
    candidates.push(`android=new UiSelector().text("${alias}")`);
    candidates.push(`android=new UiSelector().descriptionContains("${alias}")`);
  }

  // Intento directo
  for (const sel of candidates) {
    try {
      const el = await $(sel);
      if (await el.isExisting()) { await el.click(); return sel; }
    } catch (_) {}
  }

  // Navbar oculta (fullscreen/modal) — un back para volver a la pantalla anterior
  // Usar browser.back() via WebDriver: Appium lo traduce a back del sistema sin cerrar la app
  console.log(`[clickTab] navbar oculta al buscar "${logicalName}" — back`);
  try { await browser.back(); } catch (_) {}
  await browser.pause(600);

  for (const sel of candidates) {
    try {
      const el = await $(sel);
      if (await el.isExisting()) {
        console.log(`[clickTab] navbar recuperada con "${sel}"`);
        await el.click();
        return sel;
      }
    } catch (_) {}
  }

  throw new Error(`Tab "${logicalName}" no encontrado. Candidatos: ${candidates.slice(0, 3).join(', ')}`);
}

// ── Término de búsqueda de ejemplo del catálogo ───────────────────────────────
const searchSample = (raw.search_sample || APP_ID.slice(0, 4)).trim();

// ── Credenciales de prueba ────────────────────────────────────────────────────
const credentials = {
  email:    process.env.TEST_USER_EMAIL    || '',
  password: process.env.TEST_USER_PASSWORD || '',
};

// ── Setup de auth (producido por Agente 1.5) ──────────────────────────────────
// Contiene auth_tab, login_indicators, account_indicators para detección de sesión
let setup = { requires_login: false };
try {
  setup = require(path.resolve(__dirname, `../../apps/${APP_ID}/setup.json`));
} catch (_) {}

// ── Helper: detectar estado de sesión en runtime ──────────────────────────────
// Uso en before() de tests que requieren auth:
//   const sessionState = await detectSessionState();
//   if (sessionState === 'logged_out') return this.skip();
async function detectSessionState() {
  if (!setup.requires_login) return 'no_auth_required';
  try {
    const { clickElement }        = require('../helpers/clickHelper');
    const { pageContainsAny }     = require('../helpers/pageContains');
    const authTabSelector = setup.auth_tab ? `~${setup.auth_tab}` : tabSelector('Account');
    await clickElement(authTabSelector);
    await browser.pause(1500);
    const enLogin   = await pageContainsAny(setup.login_indicators   || ['Login', 'Ingresar']);
    const enCuenta  = await pageContainsAny(setup.account_indicators || ['Mi cuenta', 'Perfil']);
    if (enCuenta)  return 'logged_in';
    if (enLogin)   return 'logged_out';
    return 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

module.exports = {
  APP_ID,
  config,
  navigator,
  tabs,
  features,
  texts,
  credentials,
  setup,
  searchSample,
  tabSelector,
  clickTab,
  hasTab,
  detectSessionState,
  i18n,
};
