"""Catalog Page — VOD browser (Tab btn_tbCatalog)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class CatalogPage(BasePage):
    # Tab
    TAB_CATALOG = (AppiumBy.ACCESSIBILITY_ID, "btn_tbCatalog")

    # Hero / highlight
    IMG_HIGHLIGHT      = (AppiumBy.ACCESSIBILITY_ID, "img_highlightDisplayedImage")
    LBL_CONTENT_TITLE  = (AppiumBy.ACCESSIBILITY_ID, "lbl_hightlightContentTitle")
    LBL_METADATA_YEAR  = (AppiumBy.ACCESSIBILITY_ID, "lbl_highlightMetadataYear")
    LBL_CONTENT_TYPE   = (AppiumBy.ACCESSIBILITY_ID, "lbl_highlightMetadataContentType")
    LBL_GENRE          = (AppiumBy.ACCESSIBILITY_ID, "lbl_highlightContentGenre")

    # Carousels
    LBL_CAROUSEL_TITLE = (AppiumBy.ACCESSIBILITY_ID, "lbl_posterCarouselTitle")
    IMG_POSTER         = (AppiumBy.ACCESSIBILITY_ID, "img_posterImage")

    def go_catalog(self):
        self.tap(self.TAB_CATALOG)

    def is_loaded(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["catalog_load"]
        return (
            self.is_visible(self.LBL_CAROUSEL_TITLE, timeout=t)
            or self.is_visible(self.IMG_HIGHLIGHT, timeout=t)
        )

    def highlight_title(self) -> str:
        return self.get_text(self.LBL_CONTENT_TITLE)

    def highlight_content_type(self) -> str:
        return self.get_text(self.LBL_CONTENT_TYPE)

    def highlight_year(self) -> str:
        return self.get_text(self.LBL_METADATA_YEAR)

    def tap_highlight(self):
        self.tap(self.IMG_HIGHLIGHT)

    def tap_first_poster(self):
        self.tap(self.IMG_POSTER)
