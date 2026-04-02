"""Profile Selector Page — selección de perfil post-login."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from appium.webdriver.common.appiumby import AppiumBy
from tests.pages.base_page import BasePage
from dod_rules import DOD_TIMEOUTS_BY_FLOW


class ProfileSelectorPage(BasePage):
    # Grid / lista de perfiles
    PROFILE_GRID   = (AppiumBy.XPATH, '//*[@name="car_profiles" or @name="profilesCollectionView" or contains(@name,"profile")]')
    FIRST_PROFILE  = (AppiumBy.XPATH, '//*[contains(@name,"lbl_profileName") or contains(@label,"Perfil") or contains(@name,"profile_")]')

    # Page identity — busca texto de selección de perfil
    LBL_WHO_WATCHES = (AppiumBy.XPATH, '//*[contains(@label,"¿Quién") or contains(@label,"Selecciona") or contains(@label,"perfil")]')

    # Add profile
    BTN_ADD_PROFILE = (AppiumBy.XPATH, '//*[@name="btn_addProfile" or @label="Agregar perfil" or @label="Nuevo perfil"]')

    def is_loaded(self, timeout=None) -> bool:
        t = timeout or DOD_TIMEOUTS_BY_FLOW["profile_selector"]
        return (
            self.is_visible(self.LBL_WHO_WATCHES, timeout=t)
            or self.is_visible(self.FIRST_PROFILE, timeout=t)
            or self.is_visible(self.BTN_ADD_PROFILE, timeout=t)
        )

    def tap_first_profile(self):
        self.tap(self.FIRST_PROFILE)

    def tap_add_profile(self):
        self.tap(self.BTN_ADD_PROFILE)
