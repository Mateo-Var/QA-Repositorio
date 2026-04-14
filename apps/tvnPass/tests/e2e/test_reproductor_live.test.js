'use strict';

const { pageContains }        = require('../../../../tests/helpers/pageContains');
const { clickElement }        = require('../../../../tests/helpers/clickHelper');
const { normalizarEstadoApp } = require('../../../../tests/helpers/appState');

describe('Reproductor Live — tvnPass Android', () => {

  before(async () => {
    await normalizarEstadoApp();
  });

  it('reproductor_live_carga_player_en_pantalla', async () => {
    // DOD-03: Player visible al lanzar la app
    const playerVisible = await pageContains('Mostrar controles del reproductor');
    expect(playerVisible).toBe(true);
  });

  it('reproductor_live_tab_en_vivo_visible', async () => {
    // DOD-03: Tab EN VIVO visible en la programación
    const enVivoTab = await pageContains('EN VIVO');
    expect(enVivoTab).toBe(true);
  });

  it('reproductor_live_controles_visibles_al_tocar', async () => {
    // DOD-03: Al tocar el player, la UI de programación sigue visible
    await clickElement('~Mostrar controles del reproductor');
    const ctrlVisible = await pageContains('Programación');
    expect(ctrlVisible).toBe(true);
  });

  it('reproductor_live_programacion_hoy_visible', async () => {
    // DOD-03: EPG del día actual accesible
    // No buscar programa específico — el contenido EPG cambia constantemente
    const hoyVisible = await pageContains('Hoy');
    expect(hoyVisible).toBe(true);
  });

});
