const { pageContains, pageContainsAny } = require('../helpers/pageContains');

beforeEach(() => {
  global.browser = { getPageSource: jest.fn() };
});

afterEach(() => jest.clearAllMocks());

describe('pageContains', () => {
  test('retorna true si el texto está en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="Programación" />');
    expect(await pageContains('Programación')).toBe(true);
  });

  test('retorna false si el texto no está en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="Programación" />');
    expect(await pageContains('EN VIVO')).toBe(false);
  });

  test('retorna false si browser.getPageSource lanza error', async () => {
    browser.getPageSource.mockRejectedValue(new Error('stale session'));
    expect(await pageContains('Programación')).toBe(false);
  });

  test('búsqueda es case-sensitive', async () => {
    browser.getPageSource.mockResolvedValue('<node text="programación" />');
    expect(await pageContains('Programación')).toBe(false);
    expect(await pageContains('programación')).toBe(true);
  });

  test('retorna false para texto vacío si el source no lo contiene', async () => {
    browser.getPageSource.mockResolvedValue('<root />');
    expect(await pageContains('Buscar')).toBe(false);
  });

  test('encuentra texto en medio de un source largo', async () => {
    const source = '<a /><b /><c text="EN VIVO" /><d />';
    browser.getPageSource.mockResolvedValue(source);
    expect(await pageContains('EN VIVO')).toBe(true);
  });
});

describe('pageContainsAny', () => {
  test('retorna true si al menos un texto está en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="SurfaceView" />');
    expect(await pageContainsAny(['SurfaceView', 'TextureView'])).toBe(true);
  });

  test('retorna false si ningún texto está en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="Home" />');
    expect(await pageContainsAny(['SurfaceView', 'TextureView'])).toBe(false);
  });

  test('retorna false si browser lanza error', async () => {
    browser.getPageSource.mockRejectedValue(new Error('timeout'));
    expect(await pageContainsAny(['SurfaceView'])).toBe(false);
  });
});
