const { pageContains, pageContainsAny } = require('../helpers/pageContains');

function makeEl(exists) {
  return { isExisting: jest.fn().mockResolvedValue(exists) };
}

beforeEach(() => {
  global.$ = jest.fn().mockResolvedValue(makeEl(false));
});

afterEach(() => jest.clearAllMocks());

describe('pageContains', () => {
  test('retorna true si el primer selector encuentra el elemento', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(true));
    expect(await pageContains('Programación')).toBe(true);
  });

  test('retorna false si ningún selector encuentra el elemento', async () => {
    expect(await pageContains('EN VIVO')).toBe(false);
  });

  test('retorna false si isExisting lanza error en todos los selectores', async () => {
    global.$ = jest.fn().mockResolvedValue({
      isExisting: jest.fn().mockRejectedValue(new Error('stale element')),
    });
    expect(await pageContains('Programación')).toBe(false);
  });

  test('retorna true si el selector de descripción (content-desc) coincide', async () => {
    global.$ = jest.fn().mockImplementation(async (sel) =>
      makeEl(sel.includes('.description('))
    );
    expect(await pageContains('Mostrar controles')).toBe(true);
  });

  test('retorna true si textContains coincide (coincidencia parcial)', async () => {
    global.$ = jest.fn().mockImplementation(async (sel) =>
      makeEl(sel.includes('textContains('))
    );
    expect(await pageContains('EN VIVO')).toBe(true);
  });

  test('retorna false para texto inexistente', async () => {
    expect(await pageContains('Buscar')).toBe(false);
  });

  test('prueba todos los selectores antes de retornar false', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(false));
    await pageContains('algo');
    expect(global.$).toHaveBeenCalledTimes(4);
  });
});

describe('pageContainsAny', () => {
  test('retorna true si al menos un texto existe', async () => {
    let call = 0;
    global.$ = jest.fn().mockImplementation(async () => {
      call++;
      // Los primeros 4 (pageContains para 'SurfaceView') fallan; el 5to pasa
      return makeEl(call === 5);
    });
    expect(await pageContainsAny(['SurfaceView', 'TextureView'])).toBe(true);
  });

  test('retorna false si ningún texto existe', async () => {
    expect(await pageContainsAny(['SurfaceView', 'TextureView'])).toBe(false);
  });

  test('retorna false si isExisting lanza error', async () => {
    global.$ = jest.fn().mockResolvedValue({
      isExisting: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    expect(await pageContainsAny(['SurfaceView'])).toBe(false);
  });
});
