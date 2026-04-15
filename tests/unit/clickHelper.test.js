const { clickText } = require('../helpers/clickHelper');

function makeEl(exists = true) {
  return {
    isExisting: jest.fn().mockResolvedValue(exists),
    click:      jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  global.$ = jest.fn().mockResolvedValue(makeEl(true));
});

afterEach(() => jest.clearAllMocks());

describe('clickText', () => {
  test('hace click si el elemento existe', async () => {
    const el = makeEl(true);
    global.$ = jest.fn().mockResolvedValue(el);
    await clickText('Hoy');
    expect(el.click).toHaveBeenCalled();
  });

  test('lanza error si el elemento no existe', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(false));
    await expect(clickText('EN VIVO')).rejects.toThrow('"EN VIVO" no encontrado en la UI');
  });

  test('el mensaje de error incluye el texto buscado', async () => {
    global.$ = jest.fn().mockResolvedValue(makeEl(false));
    await expect(clickText('Mañana')).rejects.toThrow('Mañana');
  });

  test('usa UiSelector con el texto exacto para textos sin prefijo ~', async () => {
    await clickText('Ayer');
    expect(global.$).toHaveBeenCalledWith('android=new UiSelector().text("Ayer")');
  });

  test('usa accessibility id selector para textos con prefijo ~', async () => {
    await clickText('~Mostrar controles del reproductor');
    expect(global.$).toHaveBeenCalledWith('~Mostrar controles del reproductor');
  });

  test('hace click vía accessibility id cuando el prefijo ~ está presente', async () => {
    const el = makeEl(true);
    global.$ = jest.fn().mockResolvedValue(el);
    await clickText('~Mostrar controles');
    expect(el.click).toHaveBeenCalled();
  });
});
