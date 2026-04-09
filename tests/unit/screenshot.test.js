const fs   = require('fs');
const path = require('path');

jest.mock('fs');

const { takeScreenshot, screenshotDir } = require('../helpers/screenshot');

beforeEach(() => {
  global.browser = { saveScreenshot: jest.fn().mockResolvedValue(undefined) };
  fs.mkdirSync.mockImplementation(() => {});
  fs.existsSync = jest.fn().mockReturnValue(true);
});

afterEach(() => jest.clearAllMocks());

describe('takeScreenshot', () => {
  test('llama browser.saveScreenshot con el path correcto', async () => {
    await takeScreenshot('01-app-launch');
    expect(browser.saveScreenshot).toHaveBeenCalledTimes(1);
    const [savedPath] = browser.saveScreenshot.mock.calls[0];
    expect(savedPath).toContain('01-app-launch');
  });

  test('crea el directorio en reports/APP_ID/screenshots/', async () => {
    await takeScreenshot('test');
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('reports', 'tvnPass', 'screenshots')),
      { recursive: true }
    );
  });

  test('el nombre del archivo incluye el label', async () => {
    await takeScreenshot('06-live-state');
    const [savedPath] = browser.saveScreenshot.mock.calls[0];
    expect(savedPath).toContain('06-live-state');
  });

  test('el nombre del archivo incluye un timestamp ISO', async () => {
    await takeScreenshot('test');
    const [savedPath] = browser.saveScreenshot.mock.calls[0];
    expect(savedPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  test('retorna el path dentro de reports/', async () => {
    const result = await takeScreenshot('08-canal');
    expect(result).toContain('08-canal');
    expect(result).toContain('screenshots');
    expect(result).toContain('reports');
  });

  test('type happy_path va a la subcarpeta happy_path', async () => {
    const result = await takeScreenshot('test', 'happy_path');
    expect(result).toContain('happy_path');
  });

  test('type failures va a la subcarpeta failures', async () => {
    const result = await takeScreenshot('test', 'failures');
    expect(result).toContain('failures');
  });
});
