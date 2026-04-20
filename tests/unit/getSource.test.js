'use strict';

const { getSource } = require('../helpers/getSource');

beforeEach(() => {
  global.browser = { getPageSource: jest.fn(), pause: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => jest.clearAllMocks());

describe('getSource', () => {
  test('retorna el source cuando getPageSource resuelve correctamente', async () => {
    const fakeSrc = '<hierarchy>' + 'x'.repeat(300) + '</hierarchy>';
    global.browser.getPageSource.mockResolvedValue(fakeSrc);
    const result = await getSource(5000, 1);
    expect(result).toBe(fakeSrc);
  });

  test('reintenta si el source devuelto es vacío', async () => {
    const fakeSrc = '<hierarchy>' + 'x'.repeat(300) + '</hierarchy>';
    global.browser.getPageSource
      .mockResolvedValueOnce('')
      .mockResolvedValue(fakeSrc);
    const result = await getSource(5000, 3);
    expect(result).toBe(fakeSrc);
    expect(global.browser.getPageSource).toHaveBeenCalledTimes(2);
  });

  test('reintenta si el source es muy corto (< 200 chars)', async () => {
    const fakeSrc = '<hierarchy>' + 'x'.repeat(300) + '</hierarchy>';
    global.browser.getPageSource
      .mockResolvedValueOnce('<x/>')
      .mockResolvedValue(fakeSrc);
    const result = await getSource(5000, 3);
    expect(result).toBe(fakeSrc);
  });

  test('retorna string vacío si todos los reintentos fallan', async () => {
    global.browser.getPageSource.mockRejectedValue(new Error('error'));
    const result = await getSource(100, 2);
    expect(result).toBe('');
  });

  test('retorna string vacío si getPageSource siempre da source corto', async () => {
    global.browser.getPageSource.mockResolvedValue('<x/>');
    const result = await getSource(5000, 2);
    expect(result).toBe('');
  });

  test('maneja timeout por intento y reintenta', async () => {
    const fakeSrc = '<hierarchy>' + 'x'.repeat(300) + '</hierarchy>';
    let call = 0;
    global.browser.getPageSource.mockImplementation(() => {
      call++;
      if (call === 1) {
        // primer intento: timeout (nunca resuelve dentro del tiempo)
        return new Promise(resolve => setTimeout(() => resolve(fakeSrc), 99999));
      }
      return Promise.resolve(fakeSrc);
    });
    const result = await getSource(50, 2); // timeout 50ms
    expect(result).toBe(fakeSrc);
  });
});
