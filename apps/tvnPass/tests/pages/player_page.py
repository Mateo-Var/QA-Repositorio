"""Player Page Object."""

from appium.webdriver.common.appiumby import AppiumBy
from dod_rules import DOD_TIMEOUTS_BY_FLOW
from pages.base_page import BasePage


class PlayerPage(BasePage):
    # Locators
    PLAYER_CONTAINER = (AppiumBy.ACCESSIBILITY_ID, "video_player")
    PLAY_BUTTON = (AppiumBy.ACCESSIBILITY_ID, "player_play_button")
    PAUSE_BUTTON = (AppiumBy.ACCESSIBILITY_ID, "player_pause_button")
    BUFFER_INDICATOR = (AppiumBy.ACCESSIBILITY_ID, "player_buffering")
    OFFLINE_MESSAGE = (AppiumBy.ACCESSIBILITY_ID, "player_offline_message")
    RETRY_BUTTON = (AppiumBy.ACCESSIBILITY_ID, "player_retry_button")

    def is_playing(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["video_buffer"]
        return self.is_visible(self.PAUSE_BUTTON, timeout=t)

    def is_buffering(self) -> bool:
        return self.is_visible(self.BUFFER_INDICATOR, timeout=1)

    def is_offline_error_visible(self) -> bool:
        return self.is_visible(self.OFFLINE_MESSAGE)

    def tap_retry(self):
        self.tap(self.RETRY_BUTTON)

    def tap_pause(self):
        self.tap(self.PAUSE_BUTTON)

    def tap_play(self):
        self.tap(self.PLAY_BUTTON)
