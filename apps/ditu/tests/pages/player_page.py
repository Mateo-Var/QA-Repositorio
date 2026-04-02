"""Player Page — reproductor unificado (Live TV + VOD) con EPG."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class PlayerPage(BasePage):
    # Player activo (live)
    PLAYER_PREVIEW   = (AppiumBy.ACCESSIBILITY_ID, "player_previewContent")
    BTN_FULLSCREEN   = (AppiumBy.ACCESSIBILITY_ID, "btn_fullScreen")

    # Fullscreen player controls
    BTN_PLAY_PAUSE   = (AppiumBy.ACCESSIBILITY_ID, "btn_playPause")
    BTN_CLOSE        = (AppiumBy.XPATH, '//*[@name="btn_close" or @name="VOLVER" or @name="Cerrar"]')

    # Live indicators
    LBL_EN_VIVO      = (AppiumBy.XPATH, '//*[@name="EN VIVO"]')
    IMG_CHANNEL_LOGO = (AppiumBy.ACCESSIBILITY_ID, "img_cardChannelLogo")

    # VOD player
    LBL_VOD_TITLE    = (AppiumBy.ACCESSIBILITY_ID, "lbl_hightlightContentTitle")
    BTN_VER_AHORA    = (AppiumBy.XPATH, '//*[@name="VER AHORA" or @name="Ver ahora" or @name="REPRODUCIR"]')
    BTN_REPRODUCIR   = (AppiumBy.XPATH, '//*[@name="REPRODUCIR" or @name="Reproducir"]')

    # EPG / Programación
    LBL_PROGRAMACION  = (AppiumBy.ACCESSIBILITY_ID, "lbl_programmingTitle")
    CARD_PROG_TITLE   = (AppiumBy.ACCESSIBILITY_ID, "lbl_cardProgrammingTitle")
    CARD_PROG_TIME    = (AppiumBy.ACCESSIBILITY_ID, "lbl_cardProgrammingTime")
    BTN_SHOW_MORE     = (AppiumBy.ACCESSIBILITY_ID, "btn_showMore")

    def is_player_active(self, timeout=None) -> bool:
        """El player está activo cuando hay preview o player en pantalla."""
        t = timeout or DOD_TIMEOUTS_BY_FLOW["video_buffer"]
        return self.is_visible(self.PLAYER_PREVIEW, timeout=t)

    def is_live_playing(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["video_buffer"]
        return (
            self.is_visible(self.PLAYER_PREVIEW, timeout=t)
            or self.is_visible(self.LBL_EN_VIVO, timeout=2)
        )

    def is_vod_playing(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["video_buffer_vod"]
        return (
            self.is_visible(self.BTN_PLAY_PAUSE, timeout=t)
            or self.is_visible(self.BTN_CLOSE, timeout=2)
        )

    def tap_fullscreen(self):
        self.tap(self.BTN_FULLSCREEN)

    def tap_ver_ahora(self):
        self.tap(self.BTN_VER_AHORA)

    def tap_reproducir(self):
        self.tap(self.BTN_REPRODUCIR)

    def tap_close(self):
        self.tap(self.BTN_CLOSE)

    def epg_is_visible(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["epg_load"]
        return self.is_visible(self.LBL_PROGRAMACION, timeout=t)

    def programming_card_is_visible(self, timeout=5) -> bool:
        return self.is_visible(self.CARD_PROG_TITLE, timeout=timeout)
