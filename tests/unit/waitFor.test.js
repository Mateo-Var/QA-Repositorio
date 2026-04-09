const { waitFor } = require('../helpers/waitFor');

// GOT-02: browser.pause debe estar mockeado para que los tests sean instantáneos
beforeEach(() => {
  global.browser = { pause: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => jest.clearAllMocks());

describe('waitFor', () => {
  test('resuelve inmediatamente si la condición es verdadera', async () => {
    const cond = jest.fn().mockResolvedValue(true);
    await expect(waitFor(cond, 5000, 100)).resolves.toBe(true);
    expect(cond).toHaveBeenCalledTimes(1);
    expect(browser.pause).not.toHaveBeenCalled();
  });

  test('reintenta hasta que la condición sea verdadera', async () => {
    const cond = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(waitFor(cond, 5000, 10)).resolves.toBe(true);
    expect(cond).toHaveBeenCalledTimes(3);
    expect(browser.pause).toHaveBeenCalledTimes(2);
  });

  test('lanza error con mensaje por defecto si timeout se agota', async () => {
    const cond = jest.fn().mockResolvedValue(false);
    await expect(waitFor(cond, 50, 5))
      .rejects.toThrow('Timeout esperando condición (50ms)');
  });

  test('lanza error con mensaje customizado', async () => {
    const cond = jest.fn().mockResolvedValue(false);
    await expect(waitFor(cond, 50, 5, 'Player no abrió'))
      .rejects.toThrow('Player no abrió');
  });

  test('llama browser.pause con el intervalMs correcto', async () => {
    const cond = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await waitFor(cond, 5000, 999);
    expect(browser.pause).toHaveBeenCalledWith(999);
  });

  test('condición asíncrona funciona correctamente', async () => {
    const cond = jest.fn().mockImplementation(async () => {
      await Promise.resolve();
      return true;
    });
    await expect(waitFor(cond, 5000, 10)).resolves.toBe(true);
  });
});
