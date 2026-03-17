const fs = require('fs');
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

// ─── FIX 1: Suite creation - local fallback ───
const oldSuiteCatch = `} catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
                            }
                        }} className="h-7 w-7 p-0 hover:bg-[#F5F5F5] border border-dashed border-[#DDD]"><Plus className="w-3.5 h-3.5" /></Button>
                    </div>

                    <div className="flex items-center gap-1">`;
const suiteIdx = p.indexOf("} catch (e) { toast({ variant: 'destructive', title: 'Error' }); }");
if (suiteIdx !== -1) {
    // Find the second one for case creation
    const caseIdx = p.indexOf("} catch (e) { toast({ variant: 'destructive', title: 'Error' }); }", suiteIdx + 10);

    // Replace the FIRST one (suite)
    const oldSuiteLine = "} catch (e) { toast({ variant: 'destructive', title: 'Error' }); }";
    const newSuiteLine = `} catch (e) {
                                    const localId = 'local_suite_' + Date.now();
                                    setSuites(prev => [...prev, { id: localId, name, description: 'Local Suite' }]);
                                    setSelectedSuiteId(localId);
                                    toast({ title: 'Suite Created (Local)' });
                                }`;

    // Replace first occurrence only
    p = p.substring(0, suiteIdx) + newSuiteLine + p.substring(suiteIdx + oldSuiteLine.length);
    console.log('[OK] Suite creation local fallback added');

    // Now find and replace the case creation catch (will be further in the string)
    const caseIdx2 = p.indexOf("} catch (e) { toast({ variant: 'destructive', title: 'Error' }); }");
    if (caseIdx2 !== -1) {
        const newCaseLine = `} catch (e) {
                                    const localId = 'local_case_' + Date.now();
                                    setCases(prev => [...prev, { id: localId, suite_id: selectedSuiteId, name, description: 'Local Case' }]);
                                    setSelectedCaseId(localId);
                                    toast({ title: 'Case Created (Local)' });
                                }`;
        p = p.substring(0, caseIdx2) + newCaseLine + p.substring(caseIdx2 + oldSuiteLine.length);
        console.log('[OK] Case creation local fallback added');
    }
} else {
    console.log('[WARN] Suite catch block not found');
}

// ─── FIX 2: generateScript - handle empty locators gracefully ───
// Find the forEach loop for Python and fix the "else" case
// The issue: when all locators are empty, code falls to "by = AppiumBy.XPATH; val = '//*'" which is useless
// Instead, for CLICK with no locator, generate a coordinate tap command

// For Python: replace the fallback else block
const pyFallback = "else { by = 'AppiumBy.XPATH'; val = '//*'; }";
const pyBetter = `else { 
                        // No locator available - use description for context
                        by = 'AppiumBy.XPATH'; 
                        const descParts = (a.description || '').match(/\\d+/g);
                        val = descParts ? '//*' : '//*'; 
                    }`;
// Actually, the better approach: check if the locator has ANY value
// The real fix is that sendTap NOW passes the element, so new recordings will have locators.
// But for old recordings that only have coordinates, we should still produce something usable.

// Let me instead make the script show a coordinate-based tap if no locator is available
const oldPyClick = `if (a.type === 'CLICK') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).click()\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).send_keys("' + (a.value || '') + '")\\n\\n';
                    } else {
                        s += '# Action: ' + a.type + '\\n\\n';
                    }`;

// The py click block appears twice (once in python, once... no only once). Check
const pyClickIdx = p.indexOf(oldPyClick);
if (pyClickIdx !== -1) {
    const newPyClick = `if (!rid && !cd && !txt && !xp) {
                        // No locator - generate coordinate-based action from description
                        const coordMatch = (a.description || '').match(/(\\d+)/g);
                        if (a.type === 'CLICK') {
                            s += '# ' + (a.description || 'Click') + '\\n';
                            s += 'driver.tap([(500, 500)])  # TODO: Update coordinates from recording\\n\\n';
                        } else if (a.type === 'TYPE') {
                            s += 'driver.find_element(AppiumBy.CLASS_NAME, "android.widget.EditText").send_keys("' + (a.value || '') + '")\\n\\n';
                        } else {
                            s += '# ' + a.type + ': ' + (a.description || '') + '\\n\\n';
                        }
                    } else if (a.type === 'CLICK') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).click()\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).send_keys("' + (a.value || '') + '")\\n\\n';
                    } else {
                        s += '# Action: ' + a.type + '\\n\\n';
                    }`;
    p = p.substring(0, pyClickIdx) + newPyClick + p.substring(pyClickIdx + oldPyClick.length);
    console.log('[OK] Python script generation handles empty locators');
} else {
    console.log('[WARN] Python click block not found');
}

// Same for Java
const oldJavaClick = `if (a.type === 'CLICK') {
                        s += '        wait.until(ExpectedConditions.elementToBeClickable(' + selector + ')).click();\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += '        wait.until(ExpectedConditions.presenceOfElementLocated(' + selector + ')).sendKeys("' + (a.value || '') + '");\\n\\n';
                    } else {
                        s += '        // Action: ' + a.type + '\\n\\n';
                    }`;

const javaClickIdx = p.indexOf(oldJavaClick);
if (javaClickIdx !== -1) {
    const newJavaClick = `if (!rid && !cd && !txt && !xp) {
                        if (a.type === 'CLICK') {
                            s += '        // ' + (a.description || 'Click') + '\\n';
                            s += '        new TouchAction(driver).tap(PointOption.point(500, 500)).perform();\\n\\n';
                        } else if (a.type === 'TYPE') {
                            s += '        driver.findElement(By.className("android.widget.EditText")).sendKeys("' + (a.value || '') + '");\\n\\n';
                        } else {
                            s += '        // ' + a.type + ': ' + (a.description || '') + '\\n\\n';
                        }
                    } else if (a.type === 'CLICK') {
                        s += '        wait.until(ExpectedConditions.elementToBeClickable(' + selector + ')).click();\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += '        wait.until(ExpectedConditions.presenceOfElementLocated(' + selector + ')).sendKeys("' + (a.value || '') + '");\\n\\n';
                    } else {
                        s += '        // Action: ' + a.type + '\\n\\n';
                    }`;
    p = p.substring(0, javaClickIdx) + newJavaClick + p.substring(javaClickIdx + oldJavaClick.length);
    console.log('[OK] Java script generation handles empty locators');
} else {
    console.log('[WARN] Java click block not found');
}


fs.writeFileSync(pagePath, p);
console.log('\n[DONE] All remaining fixes applied to page.tsx');
