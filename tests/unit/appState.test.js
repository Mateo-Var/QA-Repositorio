const { normalizarEstadoApp } = require('../helpers/appState');

// GOT-03: browser.execute necesita mockImplementation para distinguir comandos
// GOT-04: getPageSource reemplazado por isExisting — los mocks usan $ + makeEl

function makeEl(exists = false) {
  return {
    isExisting: jest.fn().mockResolvedValue(exists),
    click:      jest.fn().mockResolvedValue(undefined),
  };
}

function makeBrowser({ estado = 4 } = {}) {
  return {
    execute: jest.fn().mockImplementation(async (cmd) => {
      if (cmd === 'mobile: queryAppState') return estado;
      return undefined;
    }),
    activateApp: jest.fn().mockResolvedValue(undefined),
    pause:       jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  global.browser = makeBrowser({ estado: 4 });
  // Default: app en home screen (Programación visible)
  global.$ = jest.fn().mockResolvedValue(makeEl(true));
});

afterEach(() => jest.clearAllMocks());

describe('normalizarEstadoApp', () => {
  test('no activa la app si ya está en foreground (estado=4)', async () => {
    await normalizarEstadoApp();
    const activateCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: activateApp');
    expect(activateCalls).toHaveLength(0);
  });

  test('activa la app si el estado es menor a 4', async () => {
    global.browser = makeBrowser({ estado: 2 });
    await normalizarEstadoApp();
    const activateCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: activateApp');
    expect(activateCalls).toHaveLength(1);
  });

  test('retorna sin tocar Inicio ni HOME si Programación está visible', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(true));
    await normalizarEstadoApp();
    const keyCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: pressKey');
    expect(keyCalls).toHaveLength(0);
  });

  test('toca el botón Inicio si no está en home pero el botón existe', async () => {
    const elInicio = makeEl(true);
    global.$ = jest.fn().mockImplementation(async (sel) => {
      // Programación no encontrada; Inicio sí
      if (sel.includes('"Programación"')) return makeEl(false);
      if (sel.includes('"Inicio"'))       return elInicio;
      return makeEl(false);
    });
    await normalizarEstadoApp();
    expect(elInicio.click).toHaveBeenCalled();
  });

  test('usa HOME + activateApp si Inicio no existe y no está en home', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(false));
    await normalizarEstadoApp();
    const keyCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: pressKey');
    expect(keyCalls).toHaveLength(1);
    expect(keyCalls[0][1]).toEqual({ keycode: 3 });
  });

  test('maneja error silenciosamente en queryAppState', async () => {
    global.browser = {
      execute:     jest.fn().mockRejectedValue(new Error('session lost')),
      activateApp: jest.fn().mockResolvedValue(undefined),
      pause:       jest.fn().mockResolvedValue(undefined),
    };
    global.$ = jest.fn().mockResolvedValue(makeEl(true));
    await expect(normalizarEstadoApp()).resolves.not.toThrow();
  });

  test('llama browser.pause después de activar la app', async () => {
    const b = makeBrowser({ estado: 1 });
    global.browser = b;
    await normalizarEstadoApp();
    expect(b.pause).toHaveBeenCalledWith(3000);
  });
});
