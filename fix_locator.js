const fs = require('fs');
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

// Normalize to \n for matching, then restore \r\n at the end
p = p.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════════════
// FIX: Python script - handle empty locators
// ═══════════════════════════════════════════════════
const pyOld = `s += '# Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (a.type === 'CLICK') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).click()\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).send_keys("' + (a.value || '') + '")\\n\\n';
                    } else {
                        s += '# Action: ' + a.type + '\\n\\n';
                    }`;

const pyNew = `s += '# Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (!rid && !cd && !txt && !xp) {
                        if (a.type === 'TYPE') {
                            s += 'driver.find_element(AppiumBy.CLASS_NAME, "android.widget.EditText").send_keys("' + (a.value || '') + '")\\n\\n';
                        } else {
                            s += '# No locator captured - re-record with hierarchy loaded\\n\\n';
                        }
                    } else if (a.type === 'CLICK') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).click()\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += 'wait.until(EC.presence_of_element_located((' + by + ', "' + val + '"))).send_keys("' + (a.value || '') + '")\\n\\n';
                    } else {
                        s += '# Action: ' + a.type + '\\n\\n';
                    }`;

if (p.includes(pyOld)) {
    p = p.replace(pyOld, pyNew);
    console.log('[OK] Python empty locator handling added');
} else {
    console.log('[WARN] Python click block not found');
    // Debug: find what's actually around "# Step"
    const idx = p.indexOf("s += '# Step ' + (i + 1)");
    if (idx !== -1) {
        console.log('Found at index', idx);
        console.log('Context:', JSON.stringify(p.substring(idx, idx + 500)));
    }
}

// ═══════════════════════════════════════════════════
// FIX: Java script - handle empty locators  
// ═══════════════════════════════════════════════════
const javaOld = `s += '        // Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (a.type === 'CLICK') {
                        s += '        wait.until(ExpectedConditions.elementToBeClickable(' + selector + ')).click();\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += '        wait.until(ExpectedConditions.presenceOfElementLocated(' + selector + ')).sendKeys("' + (a.value || '') + '");\\n\\n';
                    } else {
                        s += '        // Action: ' + a.type + '\\n\\n';
                    }`;

const javaNew = `s += '        // Step ' + (i + 1) + ': ' + (a.description || a.type) + '\\n';
                    if (!rid && !cd && !txt && !xp) {
                        if (a.type === 'TYPE') {
                            s += '        driver.findElement(By.className("android.widget.EditText")).sendKeys("' + (a.value || '') + '");\\n\\n';
                        } else {
                            s += '        // No locator captured - re-record with hierarchy loaded\\n\\n';
                        }
                    } else if (a.type === 'CLICK') {
                        s += '        wait.until(ExpectedConditions.elementToBeClickable(' + selector + ')).click();\\n\\n';
                    } else if (a.type === 'TYPE') {
                        s += '        wait.until(ExpectedConditions.presenceOfElementLocated(' + selector + ')).sendKeys("' + (a.value || '') + '");\\n\\n';
                    } else {
                        s += '        // Action: ' + a.type + '\\n\\n';
                    }`;

if (p.includes(javaOld)) {
    p = p.replace(javaOld, javaNew);
    console.log('[OK] Java empty locator handling added');
} else {
    console.log('[WARN] Java click block not found');
    const javaIdx = p.indexOf("s += '        // Step ' + (i + 1)");
    if (javaIdx !== -1) {
        console.log('Found Java at index', javaIdx);
        console.log('Context:', JSON.stringify(p.substring(javaIdx, javaIdx + 500)));
    }
}

// Restore CRLF
p = p.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, p);
console.log('[DONE] page.tsx patched');
