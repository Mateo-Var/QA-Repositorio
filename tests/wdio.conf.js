const path = require('path');

// ── Plataforma ────────────────────────────────────────────────────────────────
const PLATFORM = (process.env.APP_PLATFORM || 'android').trim().toLowerCase();
const IS_IOS   = PLATFORM === 'ios';

// ── Rutas del entorno (Android) ───────────────────────────────────────────────
const ADB_PATH  = process.env.ANDROID_HOME || '/opt/homebrew/bin';
const JAVA_HOME = process.env.JAVA_HOME    || '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home';

process.env.JAVA_HOME    = JAVA_HOME;
process.env.ANDROID_HOME = ADB_PATH;
process.env.PATH         = `${ADB_PATH}:${JAVA_HOME}/bin:${process.env.PATH}`;

// ── App seleccionada (multi-app) ──────────────────────────────────────────────
const APP_ID = (process.env.APP_ID || 'tvnPass').trim();

// ── Android ───────────────────────────────────────────────────────────────────
const ANDROID_DEVICE   = (process.env.ANDROID_DEVICE_NAME  || 'R5CTB1W92KY').trim();
const APP_PACKAGE      = (process.env.ANDROID_APP_PACKAGE   || 'com.streann.tvnpass').trim();
const APP_ACTIVITY     = (process.env.ANDROID_APP_ACTIVITY  || 'com.streann.tvnpass.MainActivity').trim();
const ANDROID_APPIUM   = (process.env.APPIUM_SERVER_URL     || 'http://localhost:4723').trim();

// ── iOS ───────────────────────────────────────────────────────────────────────
const IOS_UDID      = (process.env.IOS_DEVICE_UDID    || '00008140-00045DCE3422801C').trim();
const IOS_BUNDLE_ID = (process.env.IOS_BUNDLE_ID      || 'com.tvn-2.appletv').trim();
const IOS_TEAM_ID   = (process.env.IOS_TEAM_ID        || '8KW4872JND').trim();
const IOS_APPIUM    = (process.env.IOS_APPIUM_SERVER_URL || 'http://localhost:4724').trim();

const APPIUM_URL = IS_IOS ? IOS_APPIUM : ANDROID_APPIUM;

const specsPath = IS_IOS
  ? path.resolve(__dirname, `../apps/${APP_ID}/tests/e2e/ios/*.test.js`)
  : path.resolve(__dirname, `../apps/${APP_ID}/tests/e2e/*.test.js`);

exports.config = {
  runner:   'local',
  hostname: new URL(APPIUM_URL).hostname,
  port:     parseInt(new URL(APPIUM_URL).port) || 4723,

  specs: [specsPath],
  maxInstances: 1,

  capabilities: [IS_IOS ? {
    platformName:                'iOS',
    'appium:udid':               IOS_UDID,
    'appium:deviceName':         'iPhone',
    'appium:bundleId':           IOS_BUNDLE_ID,
    'appium:automationName':     'XCUITest',
    'appium:noReset':            true,
    'appium:newCommandTimeout':  60,
    'appium:xcodeOrgId':         IOS_TEAM_ID,
    'appium:xcodeSigningId':     'Apple Development',
    'appium:usePrebuiltWDA':     true,
    'appium:waitForIdleTimeout': 0,
  } : {
    platformName:                    'Android',
    'appium:udid':                   ANDROID_DEVICE,
    'appium:deviceName':             'Android',
    'appium:appPackage':             APP_PACKAGE,
    'appium:appActivity':            APP_ACTIVITY,
    'appium:automationName':         'UiAutomator2',
    'appium:noReset':                true,
    'appium:newCommandTimeout':      60,
    'appium:adbExecTimeout':         30000,
    'appium:waitForIdleTimeout':     0,
    'appium:waitForSelectorTimeout': 0,
  }],

  logLevel:               'warn',
  bail:                   0,
  waitforTimeout:         10000,
  connectionRetryTimeout: 120000,  // 120s para session creation (UiAutomator2 tarda ~74s en arrancar)
  connectionRetryCount:   3,

  // Sin @wdio/appium-service — conectamos al Appium externo en APPIUM_SERVER_URL.
  // Arrancar Appium es responsabilidad de run_android.sh (DEC-04).
  services: [],

  framework: 'mocha',
  mochaOpts: {
    ui:      'bdd',
    timeout: 240000,
  },

  reporters: [
    'spec',
    ['allure', {
      outputDir: path.resolve(__dirname, `../reports/${APP_ID}/allure-results`),
      disableWebdriverStepsReporting: true,
      disableWebdriverScreenshotsReporting: false,
    }],
  ],

  // ── Screenshot automático por test ────────────────────────────────────────
  // afterEach guarda screenshot en happy_path/ si pasó, failures/ si falló.
  // Los paths usan el mismo RUN_ID que el video para agrupar los artefactos.
  // afterTest es el hook correcto en wdio v9 (afterEach se ignora silenciosamente)
  async afterTest(test, _ctx, { passed }) {
    const { takeScreenshot } = require('./helpers/screenshot');
    const type = passed ? 'happy_path' : 'failures';
    const raw  = (test.fullTitle || test.title || 'test')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .slice(0, 60);
    try {
      await takeScreenshot(raw, type);
    } catch (e) {
      console.warn(`[screenshot] No se pudo capturar "${raw}": ${e.message}`);
    }
  },

  async before() {
    const fs = require('fs');
    const cp = require('child_process');

    const videosDir = path.resolve(__dirname, '../reports', APP_ID, 'videos');
    [
      path.resolve(__dirname, '../reports', APP_ID, 'screenshots'),
      path.resolve(__dirname, '../reports', APP_ID, 'logs'),
      videosDir,
    ].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

    await browser.setTimeout({ implicit: 0 });

    if (IS_IOS) return; // iOS no soporta adb screenrecord

    // Grabación completa de pantalla via ADB screenrecord (solo Android)
    const device = process.env.ANDROID_DEVICE_NAME || ANDROID_DEVICE;
    const runId  = process.env.QA_RUN_ID || Date.now().toString();
    const remote = `/sdcard/qa_run_${runId}.mp4`;
    const local  = path.join(videosDir, `qa_run_${runId}.mp4`);

    global.__screenrecordRemote = remote;
    global.__screenrecordLocal  = local;
    global.__screenrecordDevice = device;

    global.__screenrecordProc = cp.spawn(
      'adb', ['-s', device, 'shell', 'screenrecord', '--time-limit', '180', remote],
      { detached: true, stdio: 'ignore' }
    );
    console.log(`[video] Grabación iniciada → ${remote}`);
  },

  async after() {
    if (IS_IOS) return;

    const cp     = require('child_process');
    const device = global.__screenrecordDevice;
    const remote = global.__screenrecordRemote;
    const local  = global.__screenrecordLocal;
    if (!device || !remote) return;

    try {
      cp.execSync(`adb -s ${device} shell pkill -f screenrecord`, { stdio: 'ignore' });
    } catch (_) {}

    await new Promise(r => setTimeout(r, 3000));

    try {
      cp.execSync(`adb -s ${device} pull ${remote} ${local}`);
      cp.execSync(`adb -s ${device} shell rm ${remote}`, { stdio: 'ignore' });
      console.log(`[video] Video guardado → ${local}`);
    } catch (e) {
      console.warn(`[video] No se pudo descargar el video: ${e.message}`);
    }
  },

  async onComplete() {
    const { execSync } = require('child_process');
    const publishScript = path.resolve(__dirname, '../scripts/publish-report.js');
    const resultsDir    = path.resolve(__dirname, '../reports', APP_ID, 'allure-results');
    console.log('\n[onComplete] Publicando reporte Allure en GitHub Pages...');
    try {
      execSync(`node "${publishScript}" "${resultsDir}"`, { stdio: 'inherit', timeout: 120000 });
    } catch (e) {
      console.warn('[onComplete] No se pudo publicar el reporte:', e.message.split('\n')[0]);
    }
    setTimeout(() => process.exit(0), 2000);
  },
};
