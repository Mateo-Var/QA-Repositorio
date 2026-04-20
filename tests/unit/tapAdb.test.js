'use strict';

const { boundsOf, allBoundsOf, tapAdb, tapByBounds, swipeAdb } = require('../helpers/tapAdb');

const SAMPLE_SRC = `
<hierarchy>
  <android.widget.FrameLayout bounds="[0,0][1080,2340]">
    <android.view.ViewGroup content-desc="EN VIVO, 09:30, Jelou Break" clickable="true" bounds="[30,400][500,520]" />
    <android.view.ViewGroup content-desc="TVN RADIO" clickable="true" bounds="[600,800][900,900]" />
    <android.widget.TextView text="Programación" bounds="[100,1000][400,1050]" />
    <android.widget.TextView text="VER TODO" bounds="[800,1000][1000,1050]" />
    <android.widget.Button content-desc="Inicio" bounds="[0,2200][270,2340]" />
    <android.widget.Button content-desc="Explorar" bounds="[270,2200][540,2340]" />
  </android.widget.FrameLayout>
</hierarchy>`;

beforeEach(() => {
  global.browser = { execute: jest.fn().mockResolvedValue(undefined), pause: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => jest.clearAllMocks());

describe('boundsOf', () => {
  test('extrae coordenadas por text=', () => {
    const b = boundsOf(SAMPLE_SRC, 'Programación');
    expect(b).toMatchObject({ x1: 100, y1: 1000, x2: 400, y2: 1050 });
  });

  test('calcula cx y cy correctamente', () => {
    const b = boundsOf(SAMPLE_SRC, 'VER TODO');
    expect(b.cx).toBe(Math.floor((800 + 1000) / 2));
    expect(b.cy).toBe(Math.floor((1000 + 1050) / 2));
  });

  test('extrae coordenadas por content-desc=', () => {
    const b = boundsOf(SAMPLE_SRC, 'TVN RADIO');
    expect(b).toMatchObject({ x1: 600, y1: 800, x2: 900, y2: 900 });
  });

  test('retorna null si el texto no existe', () => {
    expect(boundsOf(SAMPLE_SRC, 'NO EXISTE')).toBeNull();
  });

  test('retorna null si el source está vacío', () => {
    expect(boundsOf('', 'Programación')).toBeNull();
  });
});

describe('allBoundsOf', () => {
  test('encuentra múltiples elementos por regex', () => {
    const results = allBoundsOf(SAMPLE_SRC, 'Inicio|Explorar');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test('retorna array vacío si no hay matches', () => {
    const results = allBoundsOf(SAMPLE_SRC, 'NO_EXISTE_NUNCA');
    expect(results).toEqual([]);
  });

  test('cada resultado tiene cx y cy calculados', () => {
    const results = allBoundsOf(SAMPLE_SRC, 'Inicio|Explorar');
    for (const r of results) {
      expect(r.cx).toBe(Math.floor((r.x1 + r.x2) / 2));
      expect(r.cy).toBe(Math.floor((r.y1 + r.y2) / 2));
    }
  });
});

describe('tapAdb', () => {
  test('ejecuta mobile: shell con input tap', async () => {
    await tapAdb(540, 1200);
    expect(global.browser.execute).toHaveBeenCalledWith('mobile: shell', {
      command: 'input',
      args: ['tap', '540', '1200'],
    });
  });

  test('hace pause después del tap', async () => {
    await tapAdb(100, 200);
    expect(global.browser.pause).toHaveBeenCalled();
  });
});

describe('tapByBounds', () => {
  test('llama tapAdb con las coordenadas del elemento', async () => {
    await tapByBounds(SAMPLE_SRC, 'VER TODO');
    const cx = Math.floor((800 + 1000) / 2);
    const cy = Math.floor((1000 + 1050) / 2);
    expect(global.browser.execute).toHaveBeenCalledWith('mobile: shell', {
      command: 'input',
      args: ['tap', String(cx), String(cy)],
    });
  });

  test('lanza error si el elemento no está en el source', async () => {
    await expect(tapByBounds(SAMPLE_SRC, 'NO EXISTE')).rejects.toThrow('tapByBounds');
  });
});

describe('swipeAdb', () => {
  test('ejecuta mobile: shell con input swipe', async () => {
    await swipeAdb(900, 1000, 100, 1000, 400);
    expect(global.browser.execute).toHaveBeenCalledWith('mobile: shell', {
      command: 'input',
      args: ['swipe', '900', '1000', '100', '1000', '400'],
    });
  });

  test('hace pause después del swipe', async () => {
    await swipeAdb(0, 0, 100, 100);
    expect(global.browser.pause).toHaveBeenCalled();
  });
});
