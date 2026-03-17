const fs = require('fs');

// ═══════════════════════════════════════════════════
// FIX 1: vision-stream.ts — Latency & Runner Resiliency
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');
stream = stream.replace(/\r\n/g, '\n');

// 1. Reduce intervals
stream = stream.replace('const FRAME_INTERVAL_MS = 150;', 'const FRAME_INTERVAL_MS = 60;'); // ~16 FPS
stream = stream.replace('const HIERARCHY_INTERVAL_MS = 3000;', 'const HIERARCHY_INTERVAL_MS = 800;'); // Faster sync

// 2. Use compressed dump (faster)
stream = stream.replace(/uiautomator dump \/data\/local\/tmp\/v_sync.xml/g, 'uiautomator dump --compressed /data/local/tmp/v_sync.xml');

// 3. Include real deviceId in status broadcast
stream = stream.replace(
    "broadcast({ type: 'device_status', connected: true, model: deviceModel, resolution: deviceResolution });",
    "broadcast({ type: 'device_status', connected: true, id: deviceId, model: deviceModel, resolution: deviceResolution });"
);

// 4. Improve the runner to NOT stay stuck if a command fails
// It's already fairly okay, but let's make sure 'isActionInProgress' is set during manual run too 
// so the screen doesn't flicker/lag during execution
stream = stream.replace(
    'isAdbBusy = true;',
    'isAdbBusy = true; isActionInProgress = true;'
);
stream = stream.replace(
    'isAdbBusy = false;',
    'isAdbBusy = false; isActionInProgress = false;'
);

// Restore CRLF and save
stream = stream.replace(/\n/g, '\r\n');
fs.writeFileSync(streamPath, stream);
console.log('[OK] vision-stream.ts optimized for latency and runner');


// ═══════════════════════════════════════════════════
// FIX 2: page.tsx — Copy Button & Real DeviceId
// ═════════════════════════════════════════════════
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// 1. Fix deviceId assignment (line 309 approx)
page = page.replace(
    'setDeviceId(msg.model || \'\');',
    'setDeviceId(msg.id || msg.model || \'\');'
);

// 2. Fix the Copy Button - make it more visible and easier to click
const oldCopyBtn = `<button onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: 'Copied to clipboard!' }); }} className="absolute top-2 right-2 px-2.5 py-1 bg-[#0078D4] text-white text-[9px] font-bold border border-[#005A9E] rounded hover:bg-[#005A9E] z-10 flex items-center gap-1 shadow-sm">
                                                        <Copy className="w-3 h-3" /> Copy
                                                    </button>`;

const newCopyBtn = `<Button 
                                                        size="sm" 
                                                        onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: '✅ Copied to clipboard!' }); }} 
                                                        className="absolute top-3 right-3 h-7 px-3 bg-[#0078D4] hover:bg-[#005A9E] text-white text-[10px] font-bold shadow-lg z-[100] flex items-center gap-2"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copy Code
                                                    </Button>`;

if (page.includes('navigator.clipboard.writeText(generatedScript);')) {
    // Regular expression to replace the whole button block more reliably
    page = page.replace(/<button onClick=\{\(\) => \{ navigator\.clipboard\.writeText\(generatedScript\);.*<\/button>/s, newCopyBtn);
    console.log('[OK] Copy button upgraded and moved to top-right with higher z-index');
}

// 3. Ensure the script pre area has enough padding so the button doesn't cover text
page = page.replace(
    '<pre className="p-3 text-[11px]',
    '<pre className="p-4 pt-12 text-[11px]'
);

// Restore CRLF and save
page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);
console.log('[OK] page.tsx copy button and deviceId fixed');

console.log('\n=== OPTIMIZATION COMPLETE ===');
