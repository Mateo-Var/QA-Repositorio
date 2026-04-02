"""Search Page — búsqueda de contenido (Tab btn_tbSearch)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class SearchPage(BasePage):
    # Tab
    TAB_SEARCH    = (AppiumBy.ACCESSIBILITY_ID, "btn_tbSearch")

    # Search UI
    SEARCH_BAR    = (AppiumBy.ACCESSIBILITY_ID, "searchBar")
    ICN_SEARCH    = (AppiumBy.ACCESSIBILITY_ID, "icn_search")
    RESULTS_GRID  = (AppiumBy.ACCESSIBILITY_ID, "car_catalog")

    # Results items
    RESULT_ITEM   = (AppiumBy.XPATH, '//*[@name="car_catalog"]//*[string-length(@name)>1]')

    def go_search(self):
        self.tap(self.TAB_SEARCH)

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.SEARCH_BAR, timeout=timeout)

    def type_query(self, text: str):
        self.tap(self.SEARCH_BAR)
        self.type_text(self.SEARCH_BAR, text)

    def dismiss_keyboard(self):
        try:
            self.driver.hide_keyboard()
        except Exception:
            pass

    def results_are_visible(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["search"]
        return self.is_visible(self.RESULTS_GRID, timeout=t)

    def tap_first_result(self):
        self.tap(self.RESULT_ITEM)
