'use strict';

// yellowBorder.js usa browser global y pngjs — mockeamos ambos
jest.mock('pngjs', () => {
  const EventEmitter = require('events');
  class PNG extends EventEmitter {
    constructor() { super(); this.data = null; this.width = 0; this.height = 0; }
    parse(buf, cb) { process.nextTick(() => cb(null, this)); return this; }
  }
  return { PNG };
});

const { findYellowBorderIndex } = require('../helpers/yellowBorder');

function makePng(pixels) {
  // pixels: array de { x, y, r, g, b }; width/height derivados
  const width  = 100;
  const height = 100;
  const data   = Buffer.alloc(width * height * 4, 0);
  for (const { x, y, r, g, b } of pixels) {
    const idx = (y * width + x) * 4;
    data[idx]     = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  }
  return { data, width, height };
}

function makeElement(centerY) {
  return {
    getRect: jest.fn().mockResolvedValue({ x: 0, y: centerY - 20, width: 100, height: 40 }),
  };
}

beforeEach(() => {
  global.browser = { takeScreenshot: jest.fn() };
});

afterEach(() => jest.clearAllMocks());

// ── isYellow internals vía findYellowBorderIndex ──────────────────────────────

describe('findYellowBorderIndex — sin amarillo', () => {
  test('retorna -1 si la imagen no tiene píxeles amarillos', async () => {
    const { PNG } = require('pngjs');
    const png = Object.assign(new PNG(), makePng([])); // imagen negra
    PNG.prototype.parse = function (buf, cb) { process.nextTick(() => cb(null, png)); return this; };

    global.browser.takeScreenshot.mockResolvedValue(
      Buffer.alloc(10).toString('base64')
    );

    const elements = [makeElement(50)];
    const result = await findYellowBorderIndex(elements);
    expect(result).toBe(-1);
  });
});

describe('findYellowBorderIndex — con amarillo', () => {
  function setupPngWithYellow(yellowY) {
    const { PNG } = require('pngjs');
    // Poner suficientes píxeles amarillos (>3) alrededor de yellowY
    const pixels = [];
    for (let x = 0; x < 20; x += 2) {
      pixels.push({ x, y: yellowY, r: 255, g: 198, b: 39 });
    }
    const png = Object.assign(new PNG(), makePng(pixels));
    PNG.prototype.parse = function (buf, cb) { process.nextTick(() => cb(null, png)); return this; };
    global.browser.takeScreenshot.mockResolvedValue(Buffer.alloc(10).toString('base64'));
  }

  test('retorna el índice del elemento más cercano al cluster amarillo', async () => {
    setupPngWithYellow(40); // cluster Y ≈ 40+10=50
    const elements = [makeElement(50), makeElement(80)];
    const result = await findYellowBorderIndex(elements);
    expect(result).toBe(0);
  });

  test('retorna -1 si ningún elemento está dentro de 200px del cluster', async () => {
    setupPngWithYellow(0); // cluster Y ≈ 10
    const elements = [makeElement(250)]; // dist > 200
    const result = await findYellowBorderIndex(elements);
    expect(result).toBe(-1);
  });

  test('elige el elemento más cercano entre varios', async () => {
    setupPngWithYellow(60); // cluster Y ≈ 70
    const elements = [makeElement(20), makeElement(72), makeElement(90)];
    const result = await findYellowBorderIndex(elements);
    expect(result).toBe(1);
  });

  test('usa fallback getLocation/getSize si getRect falla', async () => {
    setupPngWithYellow(40);
    const el = {
      getRect:    jest.fn().mockRejectedValue(new Error('no rect')),
      getLocation: jest.fn().mockResolvedValue({ y: 30 }),
      getSize:    jest.fn().mockResolvedValue({ height: 40 }),
    };
    const result = await findYellowBorderIndex([el]);
    expect(result).toBe(0);
  });

  test('ignora elementos cuya posición no se puede obtener', async () => {
    setupPngWithYellow(40);
    const bad = {
      getRect:    jest.fn().mockRejectedValue(new Error('no rect')),
      getLocation: jest.fn().mockRejectedValue(new Error('no loc')),
      getSize:    jest.fn().mockRejectedValue(new Error('no size')),
    };
    const good = makeElement(50);
    const result = await findYellowBorderIndex([bad, good]);
    expect(result).toBe(1);
  });
});

describe('findYellowBorderIndex — error al decodificar PNG', () => {
  test('rechaza la promesa si pngjs devuelve error', async () => {
    const { PNG } = require('pngjs');
    PNG.prototype.parse = function (buf, cb) {
      process.nextTick(() => cb(new Error('PNG corrupto')));
      return this;
    };
    global.browser.takeScreenshot.mockResolvedValue(Buffer.alloc(10).toString('base64'));
    await expect(findYellowBorderIndex([makeElement(50)])).rejects.toThrow('PNG corrupto');
  });
});
