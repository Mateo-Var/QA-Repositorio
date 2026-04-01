"""Buscar (Search) Page Object."""

from appium.webdriver.common.appiumby import AppiumBy
from dod_rules import DOD_TIMEOUTS_BY_FLOW
from pages.base_page import BasePage


class SearchPage(BasePage):
    # Campo de búsqueda
    SEARCH_FIELD      = (AppiumBy.XPATH, '//XCUIElementTypeSearchField')
    SEARCH_FIELD_ALT  = (AppiumBy.XPATH, '//XCUIElementTypeTextField')

    # Teclado
    BTN_DONE          = (AppiumBy.ACCESSIBILITY_ID, "Done")

    # Resultados / estado vacío
    NO_RESULTS_LABEL  = (AppiumBy.ACCESSIBILITY_ID, "No se encontraron resultados")

    # Primer resultado (celda genérica)
    FIRST_RESULT      = (AppiumBy.XPATH, '(//XCUIElementTypeCell)[1]')

    def is_loaded(self, timeout=5) -> bool:
        return self.is_visible(self.SEARCH_FIELD, timeout=timeout) or \
               self.is_visible(self.SEARCH_FIELD_ALT, timeout=timeout)

    def _get_field(self, timeout=5):
        try:
            return self.find(self.SEARCH_FIELD, timeout=timeout)
        except Exception:
            return self.find(self.SEARCH_FIELD_ALT, timeout=timeout)

    def type_query(self, text: str):
        field = self._get_field()
        field.clear()
        field.send_keys(text)

    def dismiss_keyboard(self):
        if self.is_visible(self.BTN_DONE, timeout=2):
            self.tap(self.BTN_DONE)

    def has_results(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["search"]
        return self.is_visible(self.FIRST_RESULT, timeout=t)

    def has_no_results_message(self, timeout=3) -> bool:
        return self.is_visible(self.NO_RESULTS_LABEL, timeout=timeout)

    def search(self, query: str):
        self.type_query(query)
        self.dismiss_keyboard()
