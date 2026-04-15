const path = require('path');

// ── Rutas del entorno ─────────────────────────────────────────────────────────
const ADB_PATH = process.env.ANDROID_HOME ||
  'C:\\Users\\santi\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\\platform-tools';
const JAVA_HOME = process.env.JAVA_HOME ||
  'C:\\Program Files\\Microsoft\\jdk-21.0.10.7-hotspot';

process.env.JAVA_HOME    = JAVA_HOME;
process.env.ANDROID_HOME = ADB_PATH;
process.env.PATH         = `${ADB_PATH};${JAVA_HOME}\\bin;${process.env.PATH}`;

// ── App seleccionada (multi-app) ──────────────────────────────────────────────
// APP_ID determina qué specs se cargan — un solo runner, múltiples apps
const APP_ID       = (process.env.APP_ID             || 'tvnPass').trim();
// USB ADB:  serial del dispositivo → R5CTB1W92KY (preferido, más estable)
// WiFi ADB: IP:puerto → ej. 192.168.1.209:5555 (requiere depuración inalámbrica activa)
const DEVICE       = (process.env.ANDROID_DEVICE_NAME || 'R5CTB1W92KY').trim();
const APP_PACKAGE  = (process.env.ANDROID_APP_PACKAGE  || 'com.streann.tvnpass').trim();
const APP_ACTIVITY = (process.env.ANDROID_APP_ACTIVITY || 'com.streann.tvnpass.MainActivity').trim();
const APPIUM_URL   = (process.env.APPIUM_SERVER_URL    || 'http://localhost:4723').trim();

const specsPath = path.resolve(__dirname, `../apps/${APP_ID}/tests/e2e/*.test.js`);

exports.config = {
  runner:   'local',
  hostname: new URL(APPIUM_URL).hostname,
  port:     parseInt(new URL(APPIUM_URL).port) || 4723,

  specs: [specsPath],
  maxInstances: 1,

  capabilities: [{
    platformName:                    'Android',
    // udid es el identificador real para ADB (WiFi o USB)
    // WiFi ADB:  192.168.1.50:5555
    // USB ADB:   R5CTB1W92KY  (serial del dispositivo)
    'appium:udid':                   DEVICE,
    'appium:deviceName':             'Android',
    'appium:appPackage':             APP_PACKAGE,
    'appium:appActivity':            APP_ACTIVITY,
    'appium:automationName':         'UiAutomator2',
    'appium:noReset':                true,
    'appium:newCommandTimeout':      60,
    'appium:adbExecTimeout':         30000,
    // DEC-01: crítico en apps de streaming con animaciones continuas
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

  reporters: ['spec'],

  // ── Screenshot automático por test ────────────────────────────────────────
  // afterEach guarda screenshot en happy_path/ si pasó, failures/ si falló.
  // Los paths usan el mismo RUN_ID que el video para agrupar los artefactos.
  async afterEach(test, _ctx, result) {
    const { takeScreenshot } = require('./helpers/screenshot');
    const type = result.passed ? 'happy_path' : 'failures';
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
    const fs    = require('fs');
    const cp    = require('child_process');

    const videosDir = path.resolve(__dirname, '../reports', APP_ID, 'videos');
    [
      path.resolve(__dirname, '../reports', APP_ID, 'screenshots'),
      path.resolve(__dirname, '../reports', APP_ID, 'logs'),
      videosDir,
    ].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

    await browser.setTimeout({ implicit: 0 });

    // Grabación completa de pantalla via ADB screenrecord
    const device  = process.env.ANDROID_DEVICE_NAME || DEVICE;
    const runId   = process.env.QA_RUN_ID || Date.now().toString();
    const remote  = `/sdcard/qa_run_${runId}.mp4`;
    const local   = path.join(videosDir, `qa_run_${runId}.mp4`);

    global.__screenrecordRemote = remote;
    global.__screenrecordLocal  = local;
    global.__screenrecordDevice = device;

    // Inicia grabación en background (max 3min por limitación de Android)
    global.__screenrecordProc = cp.spawn(
      'adb', ['-s', device, 'shell', 'screenrecord', '--time-limit', '180', remote],
      { detached: true, stdio: 'ignore' }
    );
    console.log(`[video] Grabación iniciada → ${remote}`);
  },

  async after() {
    const cp = require('child_process');
    const device = global.__screenrecordDevice;
    const remote = global.__screenrecordRemote;
    const local  = global.__screenrecordLocal;
    if (!device || !remote) return;

    // Detener grabación
    try {
      cp.execSync(`adb -s ${device} shell pkill -f screenrecord`, { stdio: 'ignore' });
    } catch (_) {}

    // Esperar que el archivo se cierre
    await new Promise(r => setTimeout(r, 3000));

    // Descargar video del dispositivo
    try {
      cp.execSync(`adb -s ${device} pull ${remote} ${local}`);
      cp.execSync(`adb -s ${device} shell rm ${remote}`, { stdio: 'ignore' });
      console.log(`[video] Video guardado → ${local}`);
    } catch (e) {
      console.warn(`[video] No se pudo descargar el video: ${e.message}`);
    }
  },

  onComplete() {
    setTimeout(() => process.exit(0), 2000);
  },
};
