const fs = require('fs');
const path = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const startTag = 'setIsGenerating(true);';
// Since there might be multiple isGenerating, we look for the one near udidStr
const targetStr = 'const udidStr = deviceId || \'YOUR_DEVICE_UDID\';';
const searchStart = content.indexOf(targetStr);
if (searchStart === -1) {
    console.log('Target string not found');
    process.exit(1);
}

// Find the start of the block containing targetStr (setIsGenerating above it)
const blockStartIdx = content.lastIndexOf('setIsGenerating(true);', searchStart);
if (blockStartIdx === -1) {
    console.log('Block start not found');
    process.exit(1);
}

// Find the end of the block (the "return;" after "setIsGenerating(false);")
const blockEndIdx = content.indexOf('return;', searchStart);
if (blockEndIdx === -1) {
    console.log('Block end not found');
    process.exit(1);
}

const newLogic = `            setIsGenerating(true);
            let s = '';
            if (scriptLang === 'python') {
                s = "# Zenit Recording (Python Appium)\\n\\n";
                actions.forEach((a, i) => {
                    const loc = (a.locator?.xpath || a.locator?.resourceId || a.locator?.accessibilityId || 'element');
                    if (a.type === 'CLICK') s += "driver.find_element(by='xpath', value=\\"" + loc + "\\").click()\\n";
                    else if (a.type === 'TYPE') s += "driver.find_element(by='xpath', value=\\"" + loc + "\\").send_keys(\\"" + (a.value || '') + "\\")\\n";
                });
            } else if (scriptLang === 'java') {
                s = "// Sunnxt Java Snippet\\n";
                actions.forEach(a => {
                    const loc = (a.locator?.xpath || a.locator?.resourceId || 'element');
                    s += "wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(\\"" + loc + "\\")))." + (a.type === 'TYPE' ? "sendKeys(\\"" + a.value + "\\")" : "click()") + ";\\n";
                });
            } else {
                s = "// Exported Steps: " + actions.length + "\\n";
            }
            setGeneratedScript(s);
            setIsGenerating(false);
            return;`;

const updatedContent = content.substring(0, blockStartIdx) + newLogic + content.substring(blockEndIdx + 'return;'.length);
fs.writeFileSync(path, updatedContent);
console.log('Successfully updated page.tsx');
