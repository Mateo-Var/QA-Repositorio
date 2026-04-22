'use strict';

const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');
const { takeScreenshot }      = require('../../../../tests/helpers/screenshot');

describe('Modo Offline — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  after(async () => {
    // Restaurar conectividad siempre, incluso si el test falla
    await browser.setNetworkConnection(6); // wifi + data
    await browser.pause(2000);
  });

  it('modo_offline_app_no_crashea_sin_conexion', async () => {
    // DOD-09: La app no debe crashear al perder conectividad
    await browser.setNetworkConnection(0); // sin wifi ni datos
    await browser.pause(3000);

    await takeScreenshot('offline_sin_conexion', 'happy_path');

    const appSigueCorriendo = await browser.execute('mobile: queryAppState', {
      appId: 'com.streann.tvnpass',
    });
    // 4 = running foreground, 3 = running background
    expect(appSigueCorriendo).toBeGreaterThanOrEqual(3);
  });

  it('modo_offline_muestra_mensaje_sin_conexion', async () => {
    // DOD-09: Con red desactivada debe aparecer mensaje de error, no pantalla en blanco
    const sinConexion =
      (await pageContains('Sin conexión')) ||
      (await pageContains('No hay conexión')) ||
      (await pageContains('Verifica tu conexión')) ||
      (await pageContains('Error de red')) ||
      (await pageContains('offline'));

    await takeScreenshot('offline_mensaje_error', 'happy_path');
    expect(sinConexion).toBe(true);
  });

  it('modo_offline_recupera_al_restaurar_conexion', async () => {
    // DOD-09: Al volver la red, la app se recupera sin reiniciar
    await browser.setNetworkConnection(6); // restaurar wifi + data
    await browser.pause(4000);

    await takeScreenshot('offline_recuperacion', 'happy_path');

    const recuperada =
      (await pageContains('EN VIVO')) ||
      (await pageContains('Programación')) ||
      (await pageContains('Inicio'));
    expect(recuperada).toBe(true);
  });

});
