const fs = require('fs');

// ═══════════════════════════════════════════════════
// FIX 1: vision-stream.ts — completely rewrite run_manual_script handler
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');
stream = stream.replace(/\r\n/g, '\n');

// Find the broken run_manual_script block and replace it entirely
const manualStart = stream.indexOf("if (msg.type === 'run_manual_script')");
if (manualStart === -1) {
    console.log('[FATAL] run_manual_script not found in vision-stream.ts');
    process.exit(1);
}

// Find the next `if (msg.type ===` after this block, which marks the end
const nextHandler = stream.indexOf("if (msg.type === 'set_fps')", manualStart);
if (nextHandler === -1) {
    console.log('[FATAL] set_fps handler not found');
    process.exit(1);
}

const newManualHandler = `if (msg.type === 'run_manual_script') {
                const { lines } = msg.payload;
                if (!deviceId) {
                    broadcast({ type: 'log', message: '[ERROR] No device connected', level: 'error' });
                    return;
                }
                if (isAdbBusy) {
                    broadcast({ type: 'log', message: '[WARN] ADB busy, please wait...', level: 'info' });
                    return;
                }

                (async () => {
                    isAdbBusy = true;
                    broadcast({ type: 'log', message: '[START] Running ' + lines.length + ' commands...', level: 'info' });

                    try {
                        for (let i = 0; i < lines.length; i++) {
                            const trimmed = lines[i].trim();
                            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

                            broadcast({ type: 'log', message: '[' + (i + 1) + '/' + lines.length + '] ' + trimmed, level: 'info' });

                            try {
                                if (trimmed.startsWith('tap ') || trimmed.startsWith('input tap')) {
                                    const cmd = trimmed.startsWith('input') ? trimmed : 'input ' + trimmed;
                                    await execAsync('adb -s ' + deviceId + ' shell ' + cmd);
                                } else if (trimmed.startsWith('type ') || trimmed.startsWith('input text')) {
                                    const cmd = trimmed.startsWith('input') ? trimmed : 'input text ' + trimmed.substring(5);
                                    await execAsync('adb -s ' + deviceId + ' shell ' + cmd);
                                } else if (trimmed.startsWith('keyevent ') || trimmed.startsWith('input keyevent')) {
                                    const cmd = trimmed.startsWith('input') ? trimmed : 'input keyevent ' + trimmed.substring(9);
                                    await execAsync('adb -s ' + deviceId + ' shell ' + cmd);
                                } else if (trimmed.startsWith('swipe ') || trimmed.startsWith('input swipe')) {
                                    const cmd = trimmed.startsWith('input') ? trimmed : 'input swipe ' + trimmed.substring(6);
                                    await execAsync('adb -s ' + deviceId + ' shell ' + cmd);
                                } else if (trimmed.startsWith('adb shell ')) {
                                    await execAsync('adb -s ' + deviceId + ' shell ' + trimmed.substring(10));
                                } else if (trimmed.startsWith('adb ')) {
                                    await execAsync('adb -s ' + deviceId + ' ' + trimmed.substring(4));
                                } else {
                                    // Treat as raw shell command
                                    await execAsync('adb -s ' + deviceId + ' shell ' + trimmed);
                                }
                                broadcast({ type: 'log', message: '[OK] Step ' + (i + 1) + ' done', level: 'info' });
                            } catch (stepErr: any) {
                                broadcast({ type: 'log', message: '[FAIL] Step ' + (i + 1) + ': ' + (stepErr?.message || 'Unknown error'), level: 'error' });
                            }

                            await sleep(500);
                        }
                        broadcast({ type: 'log', message: '[DONE] All commands executed', level: 'success' });
                    } catch (err: any) {
                        broadcast({ type: 'log', message: '[ERROR] ' + (err?.message || 'Execution failed'), level: 'error' });
                    } finally {
                        isAdbBusy = false;
                        broadcast({ type: 'action_done', success: true });
                    }
                })();
            }

            `;

stream = stream.substring(0, manualStart) + newManualHandler + stream.substring(nextHandler);
console.log('[OK] vision-stream.ts run_manual_script handler rewritten');

// Restore CRLF
stream = stream.replace(/\n/g, '\r\n');
fs.writeFileSync(streamPath, stream);
console.log('[OK] vision-stream.ts saved');


// ═══════════════════════════════════════════════════
// FIX 2: page.tsx — fix preventDefault passive listener + verify copy button
// ═══════════════════════════════════════════════════
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// Fix handleScreenWheel - remove preventDefault (it doesn't work in passive listeners)
const oldWheel = `    const handleScreenWheel = (e: React.WheelEvent) => {
        if (interactionMode !== 'interact') return;
        e.preventDefault();
        sendScroll(e.deltaY > 0 ? 'down' : 'up');
    };`;

const newWheel = `    const handleScreenWheel = (e: React.WheelEvent) => {
        if (interactionMode !== 'interact') return;
        // Note: preventDefault removed - wheel events are passive in React
        sendScroll(e.deltaY > 0 ? 'down' : 'up');
    };`;

if (page.includes(oldWheel)) {
    page = page.replace(oldWheel, newWheel);
    console.log('[OK] Fixed preventDefault passive listener spam');
} else {
    console.log('[WARN] handleScreenWheel not found');
}

// Restore CRLF
page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);
console.log('[OK] page.tsx saved');

// Verify copy button
const hasCopy = page.includes('Copied to clipboard');
console.log('[CHECK] Copy button exists:', hasCopy);

console.log('\n=== FIXES COMPLETE ===');
console.log('Restart vision-stream: npx tsx src/server/vision-stream.ts');
