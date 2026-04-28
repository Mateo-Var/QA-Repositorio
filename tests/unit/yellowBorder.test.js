'use strict';

jest.mock('pngjs', () => {
  const EventEmitter = require('events');
  class PNG extends EventEmitter {
    constructor() { super(); this.data = null; this.width = 0; this.height = 0; }
    parse(buf, cb) { process.nextTick(() => cb(null, this)); return this; }
  }
  return { PNG };
});

const { findYellowBorderIndex } = require('../helpers/yellowBorder');

function makePng({ width = 200, height = 200, yellowPixels = [] } = {}) {
  const { PNG } = require('pngjs');
  const data = Buffer.alloc(width * height * 4, 0);
  for (const { x, y } of yellowPixels) {
    const idx = (y * width + x) * 4;
    data[idx]     = 255;
    data[idx + 1] = 198;
    data[idx + 2] = 39;
    data[idx + 3] = 255;
  }
  const png = Object.assign(new PNG(), { data, width, height });
  PNG.prototype.parse = function (buf, cb) { process.nextTick(() => cb(null, png)); return this; };
}

function makeElement(rect) {
  return { getRect: jest.fn().mockResolvedValue(rect) };
}

beforeEach(() => {
  global.browser = {
    takeScreenshot: jest.fn().mockResolvedValue(Buffer.alloc(10).toString('base64')),
    getWindowSize:  jest.fn().mockResolvedValue({ width: 200, height: 200 }),
  };
});

afterEach(() => jest.clearAllMocks());

describe('findYellowBorderIndex — sin amarillo', () => {
  test('retorna -1 si no hay píxeles amarillos', async () => {
    makePng();
    const result = await findYellowBorderIndex([makeElement({ x: 10, y: 10, width: 80, height: 40 })]);
    expect(result).toBe(-1);
  });

  test('retorna -1 si no hay elementos', async () => {
    makePng();
    const result = await findYellowBorderIndex([]);
    expect(result).toBe(-1);
  });
});

describe('findYellowBorderIndex — con amarillo', () => {
  test('detecta el elemento cuyo borde izquierdo tiene píxeles amarillos', async () => {
    // sampleLeftBorder muestrea y desde y0=50 con paso 4: 50,54,58,...86
    const yellowPixels = [];
    for (let y = 50; y < 90; y += 4) yellowPixels.push({ x: 42, y });
    makePng({ yellowPixels });

    const el0 = makeElement({ x: 50,  y: 50,  width: 80, height: 40 });
    const el1 = makeElement({ x: 120, y: 50,  width: 80, height: 40 });
    const result = await findYellowBorderIndex([el0, el1]);
    expect(result).toBe(0);
  });

  test('elige el elemento con más píxeles amarillos en su borde', async () => {
    const yellowPixels = [];
    for (let y = 100; y < 140; y += 4) yellowPixels.push({ x: 92, y });
    makePng({ yellowPixels });

    const el0 = makeElement({ x: 10,  y: 10,  width: 60, height: 30 });
    const el1 = makeElement({ x: 100, y: 100, width: 60, height: 40 });
    const result = await findYellowBorderIndex([el0, el1]);
    expect(result).toBe(1);
  });

  test('retorna -1 si el conteo de amarillos es menor a 3', async () => {
    makePng({ yellowPixels: [{ x: 42, y: 52 }, { x: 42, y: 56 }] });
    const el = makeElement({ x: 50, y: 50, width: 80, height: 40 });
    const result = await findYellowBorderIndex([el]);
    expect(result).toBe(-1);
  });
});

describe('findYellowBorderIndex — escala física/lógica', () => {
  test('aplica factor de escala 2x correctamente', async () => {
    // Escala 2x: rect lógico {x:25,y:25,w:40,h:20} → físico {x:50,y:50,w:80,h:40}
    // sampleLeftBorder físico: x0=40,x1=70, y0=50,y1=90 → muestrea y=50,54,58,...86
    global.browser.getWindowSize.mockResolvedValue({ width: 100, height: 100 });
    const yellowPixels = [];
    for (let y = 50; y < 90; y += 4) yellowPixels.push({ x: 42, y });
    makePng({ yellowPixels });

    const el = makeElement({ x: 25, y: 25, width: 40, height: 20 });
    const result = await findYellowBorderIndex([el]);
    expect(result).toBe(0);
  });
});

describe('findYellowBorderIndex — errores', () => {
  test('rechaza si pngjs devuelve error', async () => {
    const { PNG } = require('pngjs');
    PNG.prototype.parse = function (buf, cb) {
      process.nextTick(() => cb(new Error('PNG corrupto')));
      return this;
    };
    await expect(
      findYellowBorderIndex([makeElement({ x: 0, y: 0, width: 10, height: 10 })])
    ).rejects.toThrow('PNG corrupto');
  });

  test('ignora elementos donde getRect falla y continúa sin lanzar', async () => {
    makePng();
    const bad  = { getRect: jest.fn().mockRejectedValue(new Error('no rect')) };
    const good = makeElement({ x: 10, y: 10, width: 60, height: 30 });
    const result = await findYellowBorderIndex([bad, good]);
    expect(result).toBe(-1);
  });
});
