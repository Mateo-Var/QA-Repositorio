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
const APP_ID       = process.env.APP_ID             || 'tvnPass';
// WiFi ADB: ANDROID_DEVICE_NAME debe ser IP:puerto → ej. 192.168.1.50:5555
// USB ADB:  puede ser el serial → ej. R5CTB1W92KY
const DEVICE       = process.env.ANDROID_DEVICE_NAME || '192.168.1.50:5555';
const APP_PACKAGE  = process.env.ANDROID_APP_PACKAGE  || 'com.streann.tvnpass';
const APP_ACTIVITY = process.env.ANDROID_APP_ACTIVITY || 'com.streann.tvnpass.MainActivity';
const APPIUM_URL   = process.env.APPIUM_SERVER_URL    || 'http://localhost:4723';

const specsPath = path.resolve(__dirname, `../apps/${APP_ID}/tests/e2e/*.test.js`);

exports.config = {
  runner:   'local',
  hostname: new URL(APPIUM_URL).hostname,
  port:     parseInt(new URL(APPIUM_URL).port) || 4723,

  specs: [specsPath],

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
  connectionRetryTimeout: 120000,
  connectionRetryCount:   3,

  services: [
    ['appium', {
      command: 'appium',
      args: {
        relaxedSecurity: true,
        log: path.resolve(__dirname, '../reports', APP_ID, 'logs/appium.log'),
      },
    }],
  ],

  framework: 'mocha',
  mochaOpts: {
    ui:      'bdd',
    timeout: 240000,
  },

  reporters: [
    'spec',
    ['video', {
      saveAllVideos:            true,
      videoSlowdownMultiplier:  3,
      outputDir: path.resolve(__dirname, '../reports', APP_ID, 'videos'),
    }],
  ],

  async before() {
    const fs = require('fs');
    [
      path.resolve(__dirname, '../reports', APP_ID, 'screenshots'),
      path.resolve(__dirname, '../reports', APP_ID, 'logs'),
      path.resolve(__dirname, '../reports', APP_ID, 'videos'),
    ].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

    await browser.setTimeout({ implicit: 0 });
  },

  onComplete() {
    setTimeout(() => process.exit(0), 2000);
  },
};
