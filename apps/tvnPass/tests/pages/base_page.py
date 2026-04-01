"""Base Page Object — todas las páginas heredan de esta clase."""

from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


def wait_for_element(driver, locator, timeout=5):
    """Espera explícita centralizada. Nunca usar time.sleep() en los tests."""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(locator)
        )
    except TimeoutException:
        raise TimeoutException(
            f"Elemento {locator} no encontrado en {timeout}s"
        )


class BasePage:
    def __init__(self, driver):
        self.driver = driver

    def find(self, locator, timeout=5):
        return wait_for_element(self.driver, locator, timeout)

    def tap(self, locator, timeout=5):
        self.find(locator, timeout).click()

    def type_text(self, locator, text, timeout=5):
        element = self.find(locator, timeout)
        element.clear()
        element.send_keys(text)

    def is_visible(self, locator, timeout=3) -> bool:
        try:
            wait_for_element(self.driver, locator, timeout)
            return True
        except TimeoutException:
            return False

    def get_text(self, locator, timeout=5) -> str:
        return self.find(locator, timeout).text
