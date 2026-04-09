const { normalizarEstadoApp } = require('../helpers/appState');

// GOT-03: browser.execute necesita mockImplementation para distinguir comandos
function makeBrowser({ estado = 4, src = 'Programación', inicioExists = false } = {}) {
  const mockInicio = { isExisting: jest.fn().mockResolvedValue(inicioExists), click: jest.fn() };
  return {
    execute: jest.fn().mockImplementation(async (cmd) => {
      if (cmd === 'mobile: queryAppState') return estado;
      return undefined;
    }),
    activateApp: jest.fn().mockResolvedValue(undefined),
    getPageSource: jest.fn().mockResolvedValue(src),
    pause: jest.fn().mockResolvedValue(undefined),
    $mock: mockInicio,
  };
}

beforeEach(() => {
  const b = makeBrowser();
  global.browser = b;
  global.$ = jest.fn().mockResolvedValue(b.$mock);
});

afterEach(() => jest.clearAllMocks());

describe('normalizarEstadoApp', () => {
  test('no activa la app si ya está en foreground (estado=4)', async () => {
    global.browser = makeBrowser({ estado: 4, src: 'Programación' });
    await normalizarEstadoApp();
    const activateCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: activateApp');
    expect(activateCalls).toHaveLength(0);
  });

  test('activa la app si el estado es menor a 4', async () => {
    global.browser = makeBrowser({ estado: 2, src: 'Programación' });
    await normalizarEstadoApp();
    const activateCalls = browser.execute.mock.calls.filter(c => c[0] === 'mobile: activateApp');
    expect(activateCalls).toHaveLength(1);
  });

  test('retorna sin navegar si el source contiene "Programación"', async () => {
    global.browser = makeBrowser({ estado: 4, src: 'Programación' });
    global.$ = jest.fn();
    await normalizarEstadoApp();
    expect(global.$).not.toHaveBeenCalled();
  });

  test('toca el botón Inicio si no está en home pero el botón existe', async () => {
    const b = makeBrowser({ estado: 4, src: 'Player', inicioExists: true });
    global.browser = b;
    global.$ = jest.fn().mockResolvedValue(b.$mock);
    await normalizarEstadoApp();
    expect(b.$mock.click).toHaveBeenCalled();
  });

  test('usa HOME + activateApp si Inicio no existe y no está en home', async () => {
    const b = makeBrowser({ estado: 4, src: 'Player', inicioExists: false });
    global.browser = b;
    global.$ = jest.fn().mockResolvedValue(b.$mock);
    await normalizarEstadoApp();
    const keyCalls = b.execute.mock.calls.filter(c => c[0] === 'mobile: pressKey');
    expect(keyCalls).toHaveLength(1);
    expect(keyCalls[0][1]).toEqual({ keycode: 3 });
  });

  test('maneja error silenciosamente en queryAppState', async () => {
    global.browser = {
      execute: jest.fn().mockRejectedValue(new Error('session lost')),
      activateApp: jest.fn().mockResolvedValue(undefined),
      getPageSource: jest.fn().mockResolvedValue('Programación'),
      pause: jest.fn().mockResolvedValue(undefined),
    };
    global.$ = jest.fn();
    await expect(normalizarEstadoApp()).resolves.not.toThrow();
  });

  test('llama browser.pause después de activar la app', async () => {
    const b = makeBrowser({ estado: 1, src: 'Programación' });
    global.browser = b;
    global.$ = jest.fn();
    await normalizarEstadoApp();
    expect(b.pause).toHaveBeenCalledWith(3000);
  });
});
