const fs = require('fs');
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

// ─── FIX recordAction: Add overrideElement param ───
// Find the exact function signature
const sig1 = 'const recordAction = (type: string, desc: string, value?: string) =>';
const sig1Idx = p.indexOf(sig1);
if (sig1Idx === -1) {
    console.log('FATAL: recordAction signature not found');
    process.exit(1);
}

// Find the closing of this function
const closingIdx = p.indexOf('setActions(prev => [...prev, a]);', sig1Idx);
if (closingIdx === -1) {
    console.log('FATAL: setActions line not found in recordAction');
    process.exit(1);
}
// Find the end of the function: next "    };" after the setActions
const funcEndIdx = p.indexOf('    };', closingIdx);

const newRecordAction = `const recordAction = (type: string, desc: string, value?: string, overrideElement?: any) => {
        if (!isRecording) return;
        const el = overrideElement || selectedElement;
        const resId = el?.attributes?.resourceId || '';
        const contentDesc = el?.attributes?.contentDesc || '';
        const text = el?.attributes?.text || '';
        const className = el?.type?.split('.').pop() || '';

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

p = p.substring(0, sig1Idx) + newRecordAction + p.substring(funcEndIdx + '    };'.length);
console.log('[OK] recordAction replaced');

// ─── FIX sendTap: Look up element from hierarchy ───
const tapStr = "recordAction('CLICK', `Tap at (${Math.round(rx * 1000)}/1000, ${Math.round(ry * 1000)}/1000)`);"
const tapIdx = p.indexOf("recordAction('CLICK', `Tap at");
if (tapIdx !== -1) {
    // Find the end of this line
    const tapLineEnd = p.indexOf(';', tapIdx);
    const newTapCall = `const hitElement = hierarchy ? findElementAt(hierarchy, rx, ry) : null;
            recordAction('CLICK', 'Click element', undefined, hitElement);`;
    // Replace just the recordAction call line, keeping the if(isRecording) wrapper
    p = p.substring(0, tapIdx) + newTapCall + p.substring(tapLineEnd + 1);
    console.log('[OK] sendTap updated');
} else {
    console.log('[WARN] sendTap recordAction call not found');
}

// ─── FIX sendKeyInput: pass element ───
const typeStr = "if (isRecording) recordAction('TYPE',";
const typeIdx = p.indexOf(typeStr);
if (typeIdx !== -1) {
    const typeLineEnd = p.indexOf(';', typeIdx);
    const newTypeCall = `if (isRecording) {
            const hitEl = selectedElement || (hierarchy ? findElementAt(hierarchy, 0.5, 0.5) : null);
            recordAction('TYPE', \`Type "\${text}"\`, text, hitEl);
        }`;
    p = p.substring(0, typeIdx) + newTypeCall + p.substring(typeLineEnd + 1);
    console.log('[OK] sendKeyInput updated');
} else {
    console.log('[WARN] sendKeyInput not found');
}

// ─── FIX Copy button: make it more visible ───
const copyBtnSearch = 'navigator.clipboard.writeText(generatedScript)';
const copyIdx = p.indexOf(copyBtnSearch);
if (copyIdx !== -1) {
    // Find the button tag start
    const btnStart = p.lastIndexOf('<button', copyIdx);
    const btnEnd = p.indexOf('</button>', copyIdx) + '</button>'.length;
    if (btnStart !== -1 && btnEnd > btnStart) {
        const newCopyBtn = `<button onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: 'Copied to clipboard!' }); }} className="absolute top-2 right-2 px-2.5 py-1 bg-[#0078D4] text-white text-[9px] font-bold border border-[#005A9E] rounded hover:bg-[#005A9E] z-10 flex items-center gap-1 shadow-sm">
                                                        <Copy className="w-3 h-3" /> Copy
                                                    </button>`;
        p = p.substring(0, btnStart) + newCopyBtn + p.substring(btnEnd);
        console.log('[OK] Copy button redesigned');
    }
} else {
    console.log('[WARN] Copy button not found');
}

fs.writeFileSync(pagePath, p);
console.log('[DONE] All page.tsx fixes applied');
