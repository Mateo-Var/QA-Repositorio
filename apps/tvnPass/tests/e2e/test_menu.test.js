'use strict';

/**
 * Menú — tvnPass Android
 * Portado y adaptado de appium-test/tests/e2e patrones de navegación de menú.
 * Omite login/logout — la app no tiene registro de usuario en este contexto.
 */

const { pageContains, pageContainsAny } = require('../../../../tests/helpers/pageContains');
const { clickElement, waitAndClick }    = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp,
        dismissPromoPopupIfVisible }    = require('../../../../tests/helpers/appState');
const { getSource }                     = require('../../../../tests/helpers/getSource');
const { boundsOf, tapByBounds }         = require('../../../../tests/helpers/tapAdb');

describe('Menú — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
    await dismissPromoPopupIfVisible();
  });

  it('menu_tab_navegacion_desde_inicio', async () => {
    // Navegar a Menú desde la barra inferior
    await clickElement('~Menú');
    await browser.pause(1500);
    await dismissPromoPopupIfVisible();
    const menuVisible = await pageContains('Menú');
    expect(menuVisible).toBe(true);
  });

  it('menu_secciones_principales_visibles', async () => {
    // Al menos una sección del menú debe estar visible
    // tvnPass puede mostrar: ajustes, sobre la app, notificaciones, etc.
    const hayContenido = await pageContainsAny([
      'Ajustes',
      'Configuración',
      'Acerca de',
      'Notificaciones',
      'Información',
      'Versión',
      'Soporte',
      'Ayuda',
      'Contacto',
      'Términos',
    ]);
    expect(hayContenido).toBe(true);
  });

  it('menu_sin_pantalla_de_error', async () => {
    // El menú no debe mostrar pantalla de error
    const hayError = await pageContains('Error');
    expect(hayError).toBe(false);
  });

  it('menu_navegacion_con_tap_adb', async () => {
    // Usar ADB bounds para navegar — más confiable para elementos sin accessibility ID
    // Portado del patrón tapMenuTab de appium-test/utils/helpers.js
    const src = await getSource(6000, 3);
    if (!src) {
      console.log('[menu] getSource no disponible — skip navegación ADB');
      return;
    }

    // Intentar tap en la primera opción de menú que encontremos
    const opciones = ['Ajustes', 'Configuración', 'Acerca de', 'Notificaciones', 'Ayuda'];
    for (const opcion of opciones) {
      const b = boundsOf(src, opcion);
      if (b) {
        console.log(`[menu] tap ADB en "${opcion}" → (${b.cx}, ${b.cy})`);
        await tapByBounds(src, opcion);
        await browser.pause(1000);
        // Verificar que navegó sin crash
        const visible = await pageContains(opcion);
        expect(visible).toBe(true);
        break;
      }
    }
  });

  it('menu_volver_al_inicio', async () => {
    // Volver al inicio desde el Menú
    try {
      await browser.execute('mobile: pressKey', { keycode: 4 }); // BACK
      await browser.pause(600);
    } catch (_) {}
    await clickElement('~Inicio');
    await browser.pause(1500);
    const inicioVisible = await pageContains('Programación');
    expect(inicioVisible).toBe(true);
  });

});
