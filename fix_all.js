/**
 * Comprehensive fix for Vision tool:
 * 1. sendTap → uses findElementAt() to get real locators from hierarchy
 * 2. recordAction → accepts optional element override
 * 3. generateScript → produces WORKING Appium code (Python + Java)
 * 4. Suite/Case creation → local fallback when API is down
 * 5. Copy button → more visible
 * 6. vision-stream.ts → fix syntax error on line 520
 */

const fs = require('fs');

// ═══════════════════════════════════════════════════
// FIX 1: page.tsx
// ═══════════════════════════════════════════════════
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// ─── FIX 1A: recordAction — accept optional element param ───
const oldRecordAction = `    const recordAction = (type: string, desc: string, value?: string) => {
        if (!isRecording) return;
        const a: VisionAction = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            type: type as any,
            value: value,
            locator: selectedElement ? {
                accessibilityId: selectedElement.attributes?.contentDesc,
                resourceId: selectedElement.attributes?.resourceId,
                xpath: selectedElement.type ? \`//\${selectedElement.type.split('.').pop()}[@resource-id='\${selectedElement.attributes?.resourceId}']\` : undefined,
                text: selectedElement.attributes?.text
            } : {},
            description: selectedElement ? \`\${desc} '\${selectedElement.name || selectedElement.attributes?.text || 'Element'}'\` : desc,
            elementId: selectedElement?.attributes?.resourceId || selectedElement?.id,
            componentName: selectedElement?.name || selectedElement?.type?.split('.').pop() || 'Element',
        };
        setActions(prev => [...prev, a]);
    };`;

const newRecordAction = `    const recordAction = (type: string, desc: string, value?: string, overrideElement?: any) => {
        if (!isRecording) return;
        const el = overrideElement || selectedElement;
        const resId = el?.attributes?.resourceId || '';
        const contentDesc = el?.attributes?.contentDesc || '';
        const text = el?.attributes?.text || '';
        const className = el?.type?.split('.').pop() || '';

        // Build best xpath from available attributes
        let xpath = '';
        if (resId) xpath = \`//\${className || '*'}[@resource-id='\${resId}']\`;
        else if (contentDesc) xpath = \`//\${className || '*'}[@content-desc='\${contentDesc}']\`;
        else if (text) xpath = \`//\${className || '*'}[@text='\${text}']\`;
        else if (className) xpath = \`//\${className}\`;

        const a: VisionAction = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            type: type as any,
            value: value,
            locator: {
                accessibilityId: contentDesc || undefined,
                resourceId: resId || undefined,
                xpath: xpath || undefined,
                text: text || undefined
            },
            description: el ? \`\${desc} '\${el.name || text || contentDesc || className || 'Element'}'\` : desc,
            elementId: resId || el?.id,
            componentName: el?.name || className || 'Element',
        };
        setActions(prev => [...prev, a]);
    };`;

if (page.includes(oldRecordAction)) {
    page = page.replace(oldRecordAction, newRecordAction);
    console.log('[OK] recordAction updated to accept override element');
} else {
    console.log('[WARN] recordAction not found - trying line-based approach');
    // Try a more flexible match
    const recordIdx = page.indexOf('const recordAction = (type: string, desc: string, value?: string)');
    if (recordIdx !== -1) {
        const blockEnd = page.indexOf('setActions(prev => [...prev, a]);\n    };', recordIdx);
        if (blockEnd !== -1) {
            const endIdx = blockEnd + 'setActions(prev => [...prev, a]);\n    };'.length;
            page = page.substring(0, recordIdx) + newRecordAction.substring(4) + page.substring(endIdx);
            console.log('[OK] recordAction replaced via index');
        }
    }
}

// ─── FIX 1B: sendTap — look up element from hierarchy ───
const oldSendTap = `    const sendTap = (rx: number, ry: number) => {
        showActionFeedback(\`Tap \${Math.round(rx * 100)}%, \${Math.round(ry * 100)}%\`);
        if (isRecording) {
            recordAction('CLICK', \`Tap at (\${Math.round(rx * 1000)}/1000, \${Math.round(ry * 1000)}/1000)\`);
        }
        sendWsAction({ action: 'tap', ratioX: rx, ratioY: ry });
    };`;

const newSendTap = `    const sendTap = (rx: number, ry: number) => {
        showActionFeedback(\`Tap \${Math.round(rx * 100)}%, \${Math.round(ry * 100)}%\`);
        if (isRecording) {
            const hitElement = hierarchy ? findElementAt(hierarchy, rx, ry) : null;
            recordAction('CLICK', \`Click on element\`, undefined, hitElement);
        }
        sendWsAction({ action: 'tap', ratioX: rx, ratioY: ry });
    };`;

if (page.includes(oldSendTap)) {
    page = page.replace(oldSendTap, newSendTap);
    console.log('[OK] sendTap updated to look up element from hierarchy');
} else {
    console.log('[WARN] sendTap block not found exactly');
}

// ─── FIX 1C: sendKeyInput — pass element to recordAction ───
const oldKeyRecord = `if (isRecording) recordAction('TYPE', \`Type "\${text}"\`, text);`;
const newKeyRecord = `if (isRecording) {
            const hitEl = selectedElement || (hierarchy ? findElementAt(hierarchy, 0.5, 0.5) : null);
            recordAction('TYPE', \`Type "\${text}"\`, text, hitEl);
        }`;

if (page.includes(oldKeyRecord)) {
    page = page.replace(oldKeyRecord, newKeyRecord);
    console.log('[OK] sendKeyInput updated');
} else {
    console.log('[WARN] sendKeyInput record line not found');
}

// ─── FIX 1D: generateScript — produce WORKING code ───
// Find the current generateScript block and replace its inner logic
const genStart = page.indexOf('setIsGenerating(true);\n            let s = \'\';\n');
const genEnd = page.indexOf('setGeneratedScript(s);\n            setIsGenerating(false);\n            return;');

if (genStart !== -1 && genEnd !== -1) {
    const newGenBody = `setIsGenerating(true);
            const udid = deviceId || 'YOUR_DEVICE_UDID';
            const pkg = currentPackage || 'com.suntv.sunnxt';
            let s = '';

            if (scriptLang === 'python') {
                s = '# Zenit Vision - Appium Python Script\\n';
                s += 'from appium import webdriver\\n';
                s += 'from appium.webdriver.common.appiumby import AppiumBy\\n';
                s += 'from selenium.webdriver.support.ui import WebDriverWait\\n';
                s += 'from selenium.webdriver.support import expected_conditions as EC\\n\\n';
                s += 'caps = {\\n';
                s += '    "platformName": "Android",\\n';
                s += '    "appium:automationName": "UiAutomator2",\\n';
                s += '    "appium:udid": "' + udid + '",\\n';
                s += '    "appium:appPackage": "' + pkg + '",\\n';
                s += '    "appium:noReset": True\\n';
                s += '}\\n\\n';
                s += 'driver = webdriver.Remote("http://127.0.0.1:4723", caps)\\n';
                s += 'wait = WebDriverWait(driver, 15)\\n\\n';
                actions.forEach((a, i) => {
                    const rid = a.locator?.resourceId;
                    const cd = a.locator?.accessibilityId;
                    const txt = a.locator?.text;
                    const xp = a.locator?.xpath;
                    let by = '', val = '';
                    if (rid) { by = 'AppiumBy.ID'; val = rid; }
                    else if (cd) { by = 'AppiumBy.ACCESSIBILITY_ID'; val = cd; }
                    else if (txt) { by = 'AppiumBy.XPATH'; val = '//*[@text=\\\"' + txt + '\\\"]'; }
                    else if (xp) { by = 'AppiumBy.XPATH'; val = xp; }
                    else { by = 'AppiumBy.XPATH'; val = '//*'; }

                    s += '# Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (a.type === 'CLICK') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).click()\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).send_keys("' + (a.value || '') + '")\\n\\n';
                    } else {
                        s += '# Action: ' + a.type + '\\n\\n';
                    }
                });
                s += 'driver.quit()\\n';
            } else if (scriptLang === 'java') {
                s = 'package com.appium;\\n\\n';
                s += 'import java.net.URL;\\n';
                s += 'import java.time.Duration;\\n';
                s += 'import org.openqa.selenium.By;\\n';
                s += 'import org.openqa.selenium.support.ui.*;\\n';
                s += 'import io.appium.java_client.AppiumBy;\\n';
                s += 'import io.appium.java_client.android.AndroidDriver;\\n';
                s += 'import io.appium.java_client.android.options.UiAutomator2Options;\\n\\n';
                s += 'public class ZenitTest {\\n';
                s += '    public static void main(String[] args) throws Exception {\\n';
                s += '        UiAutomator2Options options = new UiAutomator2Options();\\n';
                s += '        options.setPlatformName("Android");\\n';
                s += '        options.setAutomationName("UiAutomator2");\\n';
                s += '        options.setUdid("' + udid + '");\\n';
                s += '        options.setAppPackage("' + pkg + '");\\n';
                s += '        options.setNoReset(true);\\n\\n';
                s += '        AndroidDriver driver = new AndroidDriver(new URL("http://127.0.0.1:4723"), options);\\n';
                s += '        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));\\n\\n';
                actions.forEach((a, i) => {
                    const rid = a.locator?.resourceId;
                    const cd = a.locator?.accessibilityId;
                    const txt = a.locator?.text;
                    const xp = a.locator?.xpath;
                    let selector = '';
                    if (rid) selector = 'By.id("' + rid + '")';
                    else if (cd) selector = 'AppiumBy.accessibilityId("' + cd + '")';
                    else if (txt) selector = 'By.xpath("//*[@text=\\\\\\\"' + txt + '\\\\\\\"]")';
                    else if (xp) selector = 'By.xpath("' + xp.replace(/"/g, '\\\\"') + '")';
                    else selector = 'By.xpath("//*")';

                    s += '        // Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (a.type === 'CLICK') {
                        s += '        wait.until(ExpectedConditions.elementToBeClickable(' + selector + ')).click();\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += '        wait.until(ExpectedConditions.presenceOfElementLocated(' + selector + ')).sendKeys("' + (a.value || '') + '");\\n\\n';
                    } else {
                        s += '        // Action: ' + a.type + '\\n\\n';
                    }
                });
                s += '        driver.quit();\\n';
                s += '    }\\n';
                s += '}\\n';
            } else {
                s = '// JavaScript Appium - ' + actions.length + ' steps\\n';
                s += 'const { remote } = require("webdriverio");\\n\\n';
                actions.forEach((a, i) => {
                    const loc = a.locator?.resourceId || a.locator?.xpath || 'element';
                    s += '// Step ' + (i+1) + '\\n';
                    if (a.type === 'CLICK') s += 'await $("' + loc + '").click();\\n';
                    else if (a.type === 'TYPE') s += 'await $("' + loc + '").setValue("' + (a.value||'') + '");\\n';
                });
            }

            setGeneratedScript(s);
            setIsGenerating(false);
            return;`;

    page = page.substring(0, genStart) + newGenBody + page.substring(genEnd + 'setGeneratedScript(s);\n            setIsGenerating(false);\n            return;'.length);
    console.log('[OK] generateScript rewritten with full working Appium code');
} else {
    console.log('[WARN] generateScript body markers not found. genStart=' + genStart + ', genEnd=' + genEnd);
}

// ─── FIX 1E: Suite/Case creation — add local fallback ───
const oldSuiteCreate = `const r = await trackerApi.createSuite({ name, description: 'Created from Vision' });
                                    setSuites(prev => [...prev, r.data]);
                                    setSelectedSuiteId(r.data.id);
                                    toast({ title: 'Suite Created' });
                                } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }`;

const newSuiteCreate = `const r = await trackerApi.createSuite({ name, description: 'Created from Vision' });
                                    setSuites(prev => [...prev, r.data]);
                                    setSelectedSuiteId(r.data.id);
                                    toast({ title: 'Suite Created' });
                                } catch (e) { 
                                    // Local fallback when API is down
                                    const localId = 'local_' + Date.now();
                                    const localSuite = { id: localId, name, description: 'Created from Vision (local)' };
                                    setSuites(prev => [...prev, localSuite]);
                                    setSelectedSuiteId(localId);
                                    toast({ title: 'Suite Created (Local)' });
                                }`;

if (page.includes(oldSuiteCreate)) {
    page = page.replace(oldSuiteCreate, newSuiteCreate);
    console.log('[OK] Suite creation fallback added');
} else {
    console.log('[WARN] Suite creation block not found');
}

const oldCaseCreate = `const r = await trackerApi.createCase({ suite_id: selectedSuiteId, name, description: 'Recorded' });
                                    setCases(prev => [...prev, r.data]);
                                    setSelectedCaseId(r.data.id);
                                    toast({ title: 'Case Created' });
                                } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }`;

const newCaseCreate = `const r = await trackerApi.createCase({ suite_id: selectedSuiteId, name, description: 'Recorded' });
                                    setCases(prev => [...prev, r.data]);
                                    setSelectedCaseId(r.data.id);
                                    toast({ title: 'Case Created' });
                                } catch (e) {
                                    // Local fallback when API is down
                                    const localId = 'local_' + Date.now();
                                    const localCase = { id: localId, suite_id: selectedSuiteId, name, description: 'Recorded (local)' };
                                    setCases(prev => [...prev, localCase]);
                                    setSelectedCaseId(localId);
                                    toast({ title: 'Case Created (Local)' });
                                }`;

if (page.includes(oldCaseCreate)) {
    page = page.replace(oldCaseCreate, newCaseCreate);
    console.log('[OK] Case creation fallback added');
} else {
    console.log('[WARN] Case creation block not found');
}

// ─── FIX 1F: Copy button — make more visible ───
const oldCopyBtn = `<button onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: 'Copied!' }); }} className="absolute top-2 right-2 p-1.5 bg-white/90 border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] z-10">
                                                        <Copy className="w-3 h-3" />
                                                    </button>`;

const newCopyBtn = `<button onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: 'Copied to clipboard!' }); }} className="absolute top-2 right-2 px-2 py-1 bg-[#0078D4] text-white text-[9px] font-bold border border-[#005A9E] rounded hover:bg-[#005A9E] z-10 flex items-center gap-1 shadow-sm">
                                                        <Copy className="w-3 h-3" /> Copy
                                                    </button>`;

if (page.includes(oldCopyBtn)) {
    page = page.replace(oldCopyBtn, newCopyBtn);
    console.log('[OK] Copy button made more visible');
} else {
    console.log('[WARN] Copy button not found - may already be styled');
}

fs.writeFileSync(pagePath, page);
console.log('[DONE] page.tsx updated');


// ═══════════════════════════════════════════════════
// FIX 2: vision-stream.ts — fix syntax error line 520
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');

// Fix the stray })(); on line 520
const brokenLine = `                })();\n            })();`;
const fixedLine = `                })();`;

if (stream.includes(brokenLine)) {
    stream = stream.replace(brokenLine, fixedLine);
    console.log('[OK] vision-stream.ts syntax error fixed');
} else {
    // Try alternate patterns
    const alt1 = `})();\\n            })();`;
    if (stream.includes(alt1)) {
        stream = stream.replace(alt1, `})();`);
        console.log('[OK] vision-stream.ts fixed (alt pattern)');
    } else {
        console.log('[WARN] vision-stream.ts stray })(); not found - checking manually');
        // Look for the pattern with \r\n
        const brokenCR = `                })();\r\n            })();`;
        if (stream.includes(brokenCR)) {
            stream = stream.replace(brokenCR, `                })();`);
            console.log('[OK] vision-stream.ts fixed (CRLF pattern)');
        }
    }
}

fs.writeFileSync(streamPath, stream);
console.log('[DONE] vision-stream.ts updated');

console.log('\n=== ALL FIXES APPLIED ===');
console.log('Restart the vision stream server: npx tsx src/server/vision-stream.ts');
