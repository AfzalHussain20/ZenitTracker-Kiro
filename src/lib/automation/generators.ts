export type AutomationLanguage = 'PYTHON' | 'JAVA' | 'JAVASCRIPT';

export interface AutomationStep {
    id: string;
    type: 'CLICK' | 'INPUT' | 'ASSERT' | 'SWIPE';
    target?: {
        id?: string;
        xpath?: string;
        text?: string;
        accessibilityId?: string;
    };
    value?: string;
    description: string;
    timestamp: number;
}

export const generateAutomationScript = (steps: AutomationStep[], language: AutomationLanguage, deviceId: string = "DEVICE_ID") => {
    switch (language) {
        case 'PYTHON':
            return generatePythonScript(steps, deviceId);
        case 'JAVA':
            return generateJavaScript(steps, deviceId);
        case 'JAVASCRIPT':
            return generateWDIOScript(steps, deviceId);
        default:
            return "// Language not supported";
    }
};

const getBestLocator = (loc: any) => {
    if (loc.resourceId || loc.id) return { strategy: 'id', value: loc.resourceId || loc.id };
    if (loc.accessibilityId) return { strategy: 'accessibility_id', value: loc.accessibilityId };
    if (loc.text) return { strategy: 'android_uiautomator', value: `new UiSelector().text("${loc.text}")` };
    return { strategy: 'xpath', value: loc.xpath || "//*" };
};

const generatePythonScript = (steps: AutomationStep[], deviceId: string) => {
    let script = `import unittest
from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy

class ZenitAutomation(unittest.TestCase):
    def setUp(self):
        caps = {
            "platformName": "Android",
            "automationName": "UiAutomator2",
            "udid": "${deviceId}",
            "noReset": True
        }
        self.driver = webdriver.Remote("http://localhost:4723/wd/hub", caps)

    def test_recorded_workflow(self):
        driver = self.driver
        
`;

    steps.forEach(step => {
        const loc = getBestLocator(step.target || {});
        const strategy = loc.strategy === 'id' ? 'ID' :
            loc.strategy === 'accessibility_id' ? 'ACCESSIBILITY_ID' :
                loc.strategy === 'android_uiautomator' ? 'ANDROID_UIAUTOMATOR' : 'XPATH';

        script += `        # ${step.description}\n`;
        if (step.type === 'CLICK') {
            script += `        driver.find_element(by=AppiumBy.${strategy}, value="${loc.value}").click()\n`;
        } else if (step.type === 'INPUT') {
            script += `        element = driver.find_element(by=AppiumBy.${strategy}, value="${loc.value}")\n`;
            script += `        element.clear()\n`;
            script += `        element.send_keys("${step.value}")\n`;
        }
        script += `\n`;
    });

    script += `    def tearDown(self):
        self.driver.quit()

if __name__ == "__main__":
    unittest.main()`;

    return script;
};

const generateJavaScript = (steps: AutomationStep[], deviceId: string) => {
    let script = `import io.appium.java_client.AppiumBy;
import io.appium.java_client.android.AndroidDriver;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import java.net.URL;

public class ZenitTest {
    private AndroidDriver driver;

    @BeforeMethod
    public void setUp() throws Exception {
        DesiredCapabilities caps = new DesiredCapabilities();
        caps.setCapability("platformName", "Android");
        caps.setCapability("udid", "${deviceId}");
        caps.setCapability("automationName", "UiAutomator2");
        
        driver = new AndroidDriver(new URL("http://localhost:4723/wd/hub"), caps);
    }

    @Test
    public void testRecordedWorkflow() {
`;

    steps.forEach(step => {
        const loc = getBestLocator(step.target || {});
        const strategy = loc.strategy === 'id' ? 'id' :
            loc.strategy === 'accessibility_id' ? 'accessibilityId' :
                loc.strategy === 'android_uiautomator' ? 'androidUIAutomator' : 'xpath';

        script += `        // ${step.description}\n`;
        if (step.type === 'CLICK') {
            script += `        driver.findElement(AppiumBy.${strategy}("${loc.value}")).click();\n`;
        } else if (step.type === 'INPUT') {
            script += `        var el = driver.findElement(AppiumBy.${strategy}("${loc.value}"));\n`;
            script += `        el.clear();\n`;
            script += `        el.sendKeys("${step.value}");\n`;
        }
        script += `\n`;
    });

    script += `    }
}`;

    return script;
};

const generateWDIOScript = (steps: AutomationStep[], deviceId: string) => {
    let script = `describe('Zenit Recorded Workflow', () => {
    it('should execute recorded actions', async () => {
`;

    steps.forEach(step => {
        const loc = getBestLocator(step.target || {});
        let selector = "";
        if (loc.strategy === 'id') selector = `id:${loc.value}`;
        else if (loc.strategy === 'accessibility_id') selector = `~${loc.value}`;
        else if (loc.strategy === 'xpath') selector = loc.value;
        else selector = `android=${loc.value}`;

        script += `        // ${step.description}\n`;
        if (step.type === 'CLICK') {
            script += `        await $('${selector}').click();\n`;
        } else if (step.type === 'INPUT') {
            script += `        await $('${selector}').setValue('${step.value}');\n`;
        }
        script += `\n`;
    });

    script += `    });
});`;

    return script;
};
