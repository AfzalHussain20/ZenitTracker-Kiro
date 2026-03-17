const fs = require('fs');
const path = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let content = fs.readFileSync(path, 'utf8');

const targetStr = 'if (msg.type === \\\'run_manual_script\\\') {';
const startIdx = content.indexOf('if (msg.type === \'run_manual_script\') {');
if (startIdx === -1) {
    console.log('Target string not found');
    process.exit(1);
}

// Find the end of that if-block (the ")"; before the next message handler or end)
// The next handler is likely if (msg.type === ...) or the closing brace of the main handler
const endIdx = content.indexOf('})();', startIdx); // The one at the end of the async iife
if (endIdx === -1) {
    console.log('Block end not found');
    process.exit(1);
}

const newLogic = `            if (msg.type === 'run_manual_script') {
                const { lines } = msg.payload;
                if (!deviceId || isAdbBusy) return;

                (async () => {
                    isAdbBusy = true;
                    broadcast({ type: 'log', message: "[INFO] START SCRIPT (" + lines.length + " steps)", level: 'info' });

                    try {
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith('#')) continue;

                            broadcast({ type: 'log', message: "[EXEC] " + trimmed, level: 'info' });

                            if (trimmed.startsWith('tap ') || trimmed.startsWith('type ') || trimmed.startsWith('keyevent ')) {
                                await execAsync("adb -s " + deviceId + " shell input " + trimmed);
                            } else {
                                const cmd = trimmed.replace(/^adb\\s+shell\\s+/, '').replace(/^adb\\s+/, '');
                                await execAsync("adb -s " + deviceId + " shell " + cmd);
                            }

                            await new Promise(r => setTimeout(r, 600)); 
                        }
                        broadcast({ type: 'log', message: '[SUCCESS] MANUAL SCRIPT FINISHED', level: 'success' });
                    } catch (e) {
                        broadcast({ type: 'log', message: '[ERROR] FAILED: ' + e.message, level: 'error' });
                    } finally {
                        isAdbBusy = false;
                        broadcast({ type: 'action_done' });
                    }
                })();`;

const updatedContent = content.substring(0, startIdx) + newLogic + content.substring(endIdx + ')})()'.length);
// Wait, the end of the if-block is } after })();
const finalEnd = content.indexOf('}', endIdx);
const trulyUpdatedContent = content.substring(0, startIdx) + newLogic + '\\n            }' + content.substring(finalEnd + 1);

fs.writeFileSync(path, trulyUpdatedContent);
console.log('Successfully updated vision-stream.ts');
