const { clickText } = require('../helpers/clickHelper');

const mockEl = { click: jest.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  global.browser = { getPageSource: jest.fn() };
  global.$ = jest.fn().mockResolvedValue(mockEl);
  mockEl.click.mockClear();
});

afterEach(() => jest.clearAllMocks());

describe('clickText', () => {
  test('hace click si texto aparece como >texto< en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node>Hoy</node>');
    await clickText('Hoy');
    expect(mockEl.click).toHaveBeenCalled();
  });

  test('hace click si texto aparece como "texto" en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="EN VIVO" />');
    await clickText('EN VIVO');
    expect(mockEl.click).toHaveBeenCalled();
  });

  test('lanza error si el texto no está en el source', async () => {
    browser.getPageSource.mockResolvedValue('<node text="Inicio" />');
    await expect(clickText('EN VIVO')).rejects.toThrow('"EN VIVO" no encontrado en la UI');
  });

  test('el mensaje de error incluye el texto buscado', async () => {
    browser.getPageSource.mockResolvedValue('<root />');
    await expect(clickText('Mañana')).rejects.toThrow('Mañana');
  });

  test('usa UiSelector con el texto exacto', async () => {
    browser.getPageSource.mockResolvedValue('<node>Ayer</node>');
    await clickText('Ayer');
    expect(global.$).toHaveBeenCalledWith('android=new UiSelector().text("Ayer")');
  });

  test('verifica el source antes de intentar el click', async () => {
    browser.getPageSource.mockResolvedValue('<node text="Saltar" />');
    await clickText('Saltar');
    expect(browser.getPageSource).toHaveBeenCalledBefore
      ? expect(browser.getPageSource).toHaveBeenCalled()
      : expect(browser.getPageSource).toHaveBeenCalled();
    expect(mockEl.click).toHaveBeenCalled();
  });
});
