"""Profile Selector Page Object."""

from appium.webdriver.common.appiumby import AppiumBy
from knowledge.dod_rules import DOD_TIMEOUTS_BY_FLOW
from tests.pages.base_page import BasePage


class ProfileSelectorPage(BasePage):
    # Locators
    PROFILE_GRID = (AppiumBy.ACCESSIBILITY_ID, "profile_grid")
    FIRST_PROFILE = (AppiumBy.ACCESSIBILITY_ID, "profile_item_0")
    PIN_KEYBOARD = (AppiumBy.ACCESSIBILITY_ID, "pin_keyboard")
    PIN_ERROR = (AppiumBy.ACCESSIBILITY_ID, "pin_error_message")

    def is_loaded(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["profile_selector"]
        return self.is_visible(self.PROFILE_GRID, timeout=t)

    def select_first_profile(self):
        self.tap(self.FIRST_PROFILE)

    def select_profile_by_name(self, name: str):
        locator = (AppiumBy.ACCESSIBILITY_ID, f"profile_{name.lower()}")
        self.tap(locator)

    def enter_pin(self, pin: str):
        for digit in pin:
            self.tap((AppiumBy.ACCESSIBILITY_ID, f"pin_key_{digit}"))

    def is_pin_keyboard_visible(self) -> bool:
        return self.is_visible(self.PIN_KEYBOARD)

    def is_pin_error_visible(self) -> bool:
        return self.is_visible(self.PIN_ERROR)
