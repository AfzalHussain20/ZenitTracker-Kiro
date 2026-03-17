const fs = require('fs');

const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// 1. Reset the entire right panel structure to ensure zero syntax errors
const marker = '{/* ──── RIGHT: TABBED PANEL ──── */}';
const startIdx = page.indexOf(marker);
const statusBarTag = '{/* ════════ STATUS BAR ════════ */}';
const statusBarIdx = page.indexOf(statusBarTag);

if (startIdx !== -1 && statusBarIdx !== -1) {
    // We'll replace everything between the marker and the status bar
    // to ensure there's exactly one <div>, one <Tabs>, and correctly balanced brackets

    // First, find where the actual Tabs start to keep its content
    const tabsIdx = page.indexOf('<Tabs', startIdx);
    const lastTabsEndIdx = page.lastIndexOf('</Tabs>');

    if (tabsIdx !== -1 && lastTabsEndIdx !== -1) {
        const tabsContent = page.substring(tabsIdx, lastTabsEndIdx + 7);

        const head = page.substring(0, startIdx);
        const tail = page.substring(statusBarIdx);

        const fullReplacement =
            marker + '\n' +
            '                {\n' +
            '                    rightOpen && (\n' +
            '                        <div className="w-[400px] shrink-0 bg-white border-l border-[#E5E5E5] flex flex-col items-stretch justify-start overflow-hidden">\n' +
            '                            ' + tabsContent + '\n' +
            '                        </div>\n' +
            '                    )\n' +
            '                }\n' +
            '            </div>\n\n            ';

        page = head + fullReplacement + tail;
        console.log('[OK] Entire Right Panel structure rebuilt and balanced');
    }
}

// 2. Double check main content div balance
// Main Content div starts at line 988: <div className="flex-1 flex overflow-hidden">
// It should be closed before the status bar.
// In the code above, the 'fullReplacement' ends with '</div>' which closes the Main Content div.

page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);
console.log('[DONE] Syntax cleanup finished');
