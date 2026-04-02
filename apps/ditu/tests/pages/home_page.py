"""Home Page — Live TV principal (Tab btn_tbLiveTv)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class HomePage(BasePage):
    # Tab bar
    TAB_LIVE_TV     = (AppiumBy.ACCESSIBILITY_ID, "btn_tbLiveTv")
    TAB_CATALOG     = (AppiumBy.ACCESSIBILITY_ID, "btn_tbCatalog")
    TAB_SEARCH      = (AppiumBy.ACCESSIBILITY_ID, "btn_tbSearch")
    TAB_INFORMATION = (AppiumBy.ACCESSIBILITY_ID, "btn_tbInformation")

    # Player / preview
    PLAYER_PREVIEW  = (AppiumBy.ACCESSIBILITY_ID, "player_previewContent")
    BTN_FULLSCREEN  = (AppiumBy.ACCESSIBILITY_ID, "btn_fullScreen")

    # Login prompt (unauthenticated)
    LOGIN_OVERLAY   = (AppiumBy.ACCESSIBILITY_ID, "player_login_prompt_overlay")
    LBL_ENTRAR      = (AppiumBy.ACCESSIBILITY_ID, "¡ENTRA YA, ES GRATIS!")
    BTN_VAMOS_ALLA  = (AppiumBy.XPATH, '//*[@name="Vamos allá"]')

    # Programming / EPG
    LBL_PROGRAMACION = (AppiumBy.ACCESSIBILITY_ID, "lbl_programmingTitle")
    BTN_VER_MAS      = (AppiumBy.XPATH, '//*[@name="Ver más"]')
    BTN_SHOW_MORE    = (AppiumBy.ACCESSIBILITY_ID, "btn_showMore")

    # Category chips
    CHIP_TODO        = (AppiumBy.ACCESSIBILITY_ID, "btn_chip_Todo")
    CHIP_CARACOL_TV  = (AppiumBy.ACCESSIBILITY_ID, "btn_chip_Caracol_TV")
    CHIP_NOTICIAS    = (AppiumBy.ACCESSIBILITY_ID, "btn_chip_Noticias")
    CHIP_DEPORTES    = (AppiumBy.ACCESSIBILITY_ID, "btn_chip_Deportes")
    CHIP_NOVELAS     = (AppiumBy.ACCESSIBILITY_ID, "btn_chip_Novelas")

    # Programming cards
    CARD_TITLE       = (AppiumBy.ACCESSIBILITY_ID, "lbl_cardProgrammingTitle")
    CARD_TIME        = (AppiumBy.ACCESSIBILITY_ID, "lbl_cardProgrammingTime")

    def go_home(self):
        self.tap(self.TAB_LIVE_TV)

    def is_loaded(self, timeout=8) -> bool:
        return (
            self.is_visible(self.PLAYER_PREVIEW, timeout=timeout)
            or self.is_visible(self.LBL_PROGRAMACION, timeout=timeout)
        )

    def is_unauthenticated(self, timeout=3) -> bool:
        return self.is_visible(self.LOGIN_OVERLAY, timeout=timeout)

    def tap_vamos_alla(self):
        """CTA de login desde el overlay de home."""
        self.tap(self.BTN_VAMOS_ALLA)

    def tap_fullscreen(self):
        self.tap(self.BTN_FULLSCREEN)

    def tap_ver_mas_epg(self):
        self.tap(self.BTN_VER_MAS)

    def tap_chip(self, chip_locator):
        self.tap(chip_locator)

    def programming_is_visible(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["epg_load"]
        return self.is_visible(self.LBL_PROGRAMACION, timeout=t)

    def card_title_text(self) -> str:
        return self.get_text(self.CARD_TITLE)
