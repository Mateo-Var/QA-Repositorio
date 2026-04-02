"""
Configuraciones de dispositivos — centralizadas aquí.
Para dispositivos físicos, los UDID van en variables de entorno.
"""

import os

_PHYSICAL_UDID   = os.environ.get("DEVICE_UDID", "00008030-00066C983602402E")
_WDA_BUNDLE_ID   = os.environ.get("WDA_BUNDLE_ID", "com.mediastre.WebDriverAgentRunner")
_XCODE_TEAM      = os.environ.get("XCODE_TEAM_ID", "FW6NW65M2T")
_WDA_DERIVED     = os.environ.get("WDA_DERIVED_DATA_PATH", "")

DEVICES = {
    "iphone_physical": {
        "platformName":                "iOS",
        "automationName":              "XCUITest",
        "appium:udid":                 _PHYSICAL_UDID,
        "appium:noReset":              True,
        "appium:xcodeOrgId":           _XCODE_TEAM,
        "appium:xcodeSigningId":       "Apple Development",
        "appium:updatedWDABundleId":   _WDA_BUNDLE_ID,
        "appium:derivedDataPath":      _WDA_DERIVED,
        "appium:usePreinstalledWDA":   False,
        "appium:wdaLaunchTimeout":     120000,
        "appium:wdaConnectionTimeout": 120000,
    },
    "iphone_14_sim": {
        "platformName":    "iOS",
        "platformVersion": "17.2",
        "deviceName":      "iPhone 14",
        "automationName":  "XCUITest",
        "appium:udid":     os.environ.get("DEVICE_UDID_IPHONE14", "auto"),
        "appium:noReset":  False,
    },
    "ipad_air_sim": {
        "platformName":    "iOS",
        "platformVersion": "17.2",
        "deviceName":      "iPad Air (5th generation)",
        "automationName":  "XCUITest",
        "appium:udid":     os.environ.get("DEVICE_UDID_IPADAIR", "auto"),
        "appium:noReset":  False,
    },
}

DEFAULT_DEVICE = "iphone_physical"
