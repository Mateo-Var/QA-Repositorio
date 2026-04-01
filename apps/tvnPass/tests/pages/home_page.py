"""Home Page Object — pantalla principal con tab bar y carruseles."""

from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class HomePage(BasePage):
    # Tab bar
    TAB_INICIO   = (AppiumBy.ACCESSIBILITY_ID, "Inicio")
    TAB_EXPLORAR = (AppiumBy.ACCESSIBILITY_ID, "Explorar")
    TAB_BUSCAR   = (AppiumBy.ACCESSIBILITY_ID, "Buscar")
    TAB_MENU     = (AppiumBy.ACCESSIBILITY_ID, "Menú")

    # Secciones de carrusel visibles en home (StaticText)
    SECTION_TOP10       = (AppiumBy.ACCESSIBILITY_ID, "TOP 10")
    SECTION_RECOMENDADOS = (AppiumBy.ACCESSIBILITY_ID, "RECOMENDADOS")
    SECTION_NOTICIAS    = (AppiumBy.ACCESSIBILITY_ID, "NOTICIAS")
    SECTION_EXCLUSIVO   = (AppiumBy.ACCESSIBILITY_ID, "EXCLUSIVO TVN PASS")

    def go_home(self):
        """Navega activamente al tab Inicio y espera contenido."""
        self.tap(self.TAB_INICIO)

    def is_loaded(self, timeout=8) -> bool:
        """Verifica que Home tiene contenido. Llama go_home() primero si la app puede estar en otro tab."""
        return (
            self.is_visible(self.SECTION_TOP10, timeout=timeout)
            or self.is_visible(self.SECTION_RECOMENDADOS, timeout=timeout)
            or self.is_visible(self.SECTION_NOTICIAS, timeout=timeout)
            or self.is_visible(self.SECTION_EXCLUSIVO, timeout=timeout)
        )

    def tap_inicio(self):
        self.tap(self.TAB_INICIO)

    def tap_explorar(self):
        self.tap(self.TAB_EXPLORAR)

    def tap_buscar(self):
        self.tap(self.TAB_BUSCAR)

    def tap_menu(self):
        self.tap(self.TAB_MENU)

    def is_inicio_tab_selected(self) -> bool:
        """El tab activo tiene value="1"."""
        el = self.find(self.TAB_INICIO)
        return el.get_attribute("value") == "1"

    def has_carousels(self) -> bool:
        return (
            self.is_visible(self.SECTION_TOP10, timeout=3)
            or self.is_visible(self.SECTION_RECOMENDADOS, timeout=3)
        )
