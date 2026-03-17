/**
 * ═══════════════════════════════════════════════════════════════════════
 * VISION STREAM SERVER — The "scrcpy-level" Display Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This is a standalone WebSocket server that runs alongside Next.js.
 * It implements the DUAL-ENGINE architecture:
 *
 *   Engine 1 (Display):  Continuously captures and pushes device frames
 *   Engine 2 (Action):   Receives interaction commands, executes instantly
 *   Engine 3 (Sync):     State machine manages when actions are allowed
 *
 * WHY THIS EXISTS:
 *   - Next.js API routes are request/response (HTTP). They cannot stream.
 *   - WebSocket is bidirectional and push-based. The server pushes frames
 *     WITHOUT the client asking. This is what makes it feel "live".
 *   - Actions are fire-and-forget. The display loop catches up automatically.
 *
 * PROTOCOL:
 *   Client → Server:  { type: "action", payload: { action: "tap", ... } }
 *   Server → Client:  { type: "frame", screenshot: "base64...", timestamp }
 *   Server → Client:  { type: "state", hierarchy, package, model, resolution }
 *   Server → Client:  { type: "action_done", success: true }
 *   Server → Client:  { type: "device_status", connected: true/false }
 *
 * START: npx ts-node --project tsconfig.json src/server/vision-stream.ts
 *   or:  node -e "require('./src/server/vision-stream')"
 * ═══════════════════════════════════════════════════════════════════════
 */

import { WebSocketServer, WebSocket } from 'ws';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
const WS_PORT = 8767;
const FRAME_INTERVAL_MS = 100;      // Increased to ~6.5 FPS for "butter smooth" feel
const HIERARCHY_INTERVAL_MS = 500; // Slower hierarchy to save CPU/ADB bandwidth
const ACTION_SETTLE_MS = 100;       // Faster settle for snappier feel
const POST_ACTION_BURST = 3;        // Send 3 quick frames after an action to show transition

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let deviceId: string | null = null;
let deviceModel = '';
let deviceResolution = { width: 1080, height: 1920 };
let currentPackage = '';
let isActionInProgress = false;
let isAdbBusy = false; // Lock for heavy ADB commands like hierarchy dump
let lastHierarchy: any = null;
let frameLoopRunning = false;
let hierarchyLoopRunning = false;
let clients: Set<WebSocket> = new Set();

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function broadcast(data: any) {
    const msg = JSON.stringify(data);
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(msg);
            } catch (err) {
                console.error('[Vision] Socket send error:', err);
                clients.delete(ws);
            }
        }
    }
}

async function detectDevice(): Promise<string | null> {
    try {
        const { stdout } = await execAsync('adb devices');
        const lines = stdout.split('\n').filter(l => l.includes('\tdevice'));
        if (lines.length === 0) return null;
        return lines[0].split('\t')[0];
    } catch {
        return null;
    }
}

async function getResolution(id: string) {
    try {
        const { stdout } = await execAsync(`adb -s ${id} shell wm size`);
        const m = stdout.match(/(\d+)x(\d+)/);
        if (m) return { width: parseInt(m[1]), height: parseInt(m[2]) };
    } catch { }
    return { width: 1080, height: 1920 };
}

async function getModel(id: string) {
    try {
        const { stdout } = await execAsync(`adb -s ${id} shell getprop ro.product.model`);
        return stdout.trim();
    } catch {
        return 'Unknown';
    }
}

async function getCurrentFocus(id: string) {
    try {
        const { stdout } = await execAsync(`adb -s ${id} shell "dumpsys window | grep mCurrentFocus"`);
        const m = stdout.match(/([a-zA-Z0-9._]+)\//);
        return m ? m[1] : 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// ═══════════════════════════════════════════════════
// ENGINE 1: DISPLAY — Continuous Frame Push
// ═══════════════════════════════════════════════════
import { spawn } from 'child_process';

async function captureFrameRaw(id: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
        const adb = spawn('adb', ['-s', id, 'exec-out', 'screencap', '-p']);
        const chunks: Buffer[] = [];
        let error = '';

        adb.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        adb.stderr.on('data', (data) => {
            error += data.toString();
        });

        adb.on('close', (code) => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks));
            } else {
                console.log(`[Vision] captureFrame Error: code ${code}, ${error}`);
                resolve(null);
            }
        });

        // Set a timeout for the capture
        setTimeout(() => {
            adb.kill();
            resolve(null);
        }, 1500);
    });
}

async function frameLoop() {
    if (frameLoopRunning) return;
    frameLoopRunning = true;

    console.log('[Vision] Frame loop started');

    while (clients.size > 0) {
        const frameStart = Date.now();

        if (!deviceId) {
            console.log('[Vision] Detecting devices...');
            deviceId = await detectDevice();
            if (deviceId) {
                console.log(`[Vision] Device detected: ${deviceId}`);
                deviceResolution = await getResolution(deviceId);
                deviceModel = await getModel(deviceId);
                broadcast({ type: 'device_status', connected: true, id: deviceId, model: deviceModel, resolution: deviceResolution });
            } else {
                broadcast({ type: 'device_status', connected: false });
                await sleep(2000);
                continue;
            }
        }

        // Action lock removed for live feedback during scripts

        try {
            const buffer = await captureFrameRaw(deviceId!);
            if (buffer && buffer.length > 5000) { // Valid PNGs are usually > 5KB
                broadcastBinaryFrame(buffer, frameStart);

                if (Math.random() < 0.05) {
                    const elapsed = Date.now() - frameStart;
                    console.log(`[Vision] Stream active: ${elapsed}ms per frame`);
                }
            } else if (buffer && buffer.length > 0) {
                console.log(`[Vision] Warning: Small frame received (${buffer.length} bytes)`);
            }
        } catch (err: any) {
            console.log(`[Vision] Frame loop error: ${err.message}`);
            if (err.message?.includes('device') || err.message?.includes('adb')) {
                deviceId = null;
                broadcast({ type: 'device_status', connected: false });
            }
        }

        const elapsed = Date.now() - frameStart;
        const remaining = Math.max(10, FRAME_INTERVAL_MS - elapsed);
        await sleep(remaining);
    }

    frameLoopRunning = false;
    console.log('[Vision] Frame loop stopped');
}

/**
 * Sends a binary message for the frame to avoid base64 overhead.
 * Format: 
 *   [First 4 bytes: Timestamp (UInt32)]
 *   [Rest: Image Data (binary)]
 */
function broadcastBinaryFrame(buffer: Buffer, startMs: number) {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Date.now() % 0xFFFFFFFF, 0);
    const combined = Buffer.concat([header, buffer]);

    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(combined, { binary: true });
            } catch (err) {
                clients.delete(ws);
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// ENGINE 1B: HIERARCHY — Slower refresh cycle
// ═══════════════════════════════════════════════════
function parseHierarchyXml(xml: string, res: { width: number, height: number }) {
    try {
        const $ = cheerio.load(xml, { xmlMode: true });
        const parseNode = (el: any): any => {
            const attrs = el.attribs || {};
            const bm = attrs.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            let bounds = null;
            if (bm) {
                const x1 = parseInt(bm[1]), y1 = parseInt(bm[2]);
                const x2 = parseInt(bm[3]), y2 = parseInt(bm[4]);
                bounds = {
                    x: x1 / res.width, y: y1 / res.height,
                    width: (x2 - x1) / res.width, height: (y2 - y1) / res.height
                };
            }
            return {
                id: attrs['resource-id'] || attrs['content-desc'] || Math.random().toString(36).substr(2, 9),
                name: attrs['class']?.split('.').pop() || 'Element',
                type: attrs['class'] || 'View',
                package: attrs['package'],
                attributes: {
                    resourceId: attrs['resource-id'],
                    contentDesc: attrs['content-desc'],
                    text: attrs['text'],
                    clickable: attrs['clickable'] === 'true',
                    visible: attrs['visible-to-user'] === 'true',
                    bounds
                },
                children: $(el).children().toArray().map((c: any) => parseNode(c))
            };
        };
        const root = $('hierarchy').children().first()[0];
        return root ? parseNode(root) : null;
    } catch {
        return null;
    }
}

async function hierarchyLoop() {
    if (hierarchyLoopRunning) return;
    hierarchyLoopRunning = true;

    while (clients.size > 0) {
        if (!deviceId) { await sleep(2000); continue; }
        // YIELD to actions and frame capture if busy
        if (isActionInProgress || isAdbBusy) { await sleep(200); continue; }

        try {
            isAdbBusy = true; isActionInProgress = true;
            const startMs = Date.now();
            // dump is very slow, we use a separate file name to avoid collision
            await execAsync(`adb -s ${deviceId} shell uiautomator dump --compressed /data/local/tmp/v_sync.xml`);
            const { stdout: xml } = await execAsync(`adb -s ${deviceId} shell cat /data/local/tmp/v_sync.xml`);
            const hierarchy = parseHierarchyXml(xml, deviceResolution);
            currentPackage = await getCurrentFocus(deviceId);
            isAdbBusy = false;

            if (hierarchy) {
                lastHierarchy = hierarchy;
                broadcast({
                    type: 'state',
                    hierarchy,
                    currentPackage,
                    deviceModel,
                    resolution: deviceResolution,
                    timestamp: Date.now()
                });
            }
        } catch (err: any) {
            isAdbBusy = false;
            console.log(`[Vision] Hierarchy loop error: ${err.message}`);
            if (err.message?.includes('device') || err.message?.includes('adb')) {
                deviceId = null;
            }
        }

        await sleep(HIERARCHY_INTERVAL_MS);
    }

    hierarchyLoopRunning = false;
}

// ═══════════════════════════════════════════════════
// ENGINE 2: ACTION — Instant Command Execution
// ═══════════════════════════════════════════════════
async function executeAction(payload: any) {
    if (!deviceId) throw new Error('No device');

    const { action } = payload;
    const scale = (rX: number, rY: number) => ({
        x: Math.round(rX * deviceResolution.width),
        y: Math.round(rY * deviceResolution.height)
    });

    isActionInProgress = true;
    isAdbBusy = true; // Block hierarchy engine during action

    try {
        switch (action) {
            case 'tap': {
                const t = scale(payload.ratioX, payload.ratioY);
                await execAsync(`adb -s ${deviceId} shell input tap ${t.x} ${t.y}`);
                break;
            }
            case 'swipe': {
                const s1 = scale(payload.ratioX1, payload.ratioY1);
                const s2 = scale(payload.ratioX2, payload.ratioY2);
                await execAsync(`adb -s ${deviceId} shell input swipe ${s1.x} ${s1.y} ${s2.x} ${s2.y} ${payload.duration || 300}`);
                break;
            }
            case 'longpress': {
                const lp = scale(payload.ratioX, payload.ratioY);
                await execAsync(`adb -s ${deviceId} shell input swipe ${lp.x} ${lp.y} ${lp.x} ${lp.y} ${payload.duration || 1500}`);
                break;
            }
            case 'doubletap': {
                const dt = scale(payload.ratioX, payload.ratioY);
                await execAsync(`adb -s ${deviceId} shell input tap ${dt.x} ${dt.y}`);
                await sleep(80);
                await execAsync(`adb -s ${deviceId} shell input tap ${dt.x} ${dt.y}`);
                break;
            }
            case 'type': {
                const text = payload.text;
                const sanitized = text.replace(/ /g, '%s').replace(/[()<>|&;$]/g, '\\$&');
                await execAsync(`adb -s ${deviceId} shell input text "${sanitized}"`);

                await sleep(100);
                if (payload.enter) {
                    await execAsync(`adb -s ${deviceId} shell input keyevent 66`);
                }
                break;
            }
            case 'keyevent':
                await execAsync(`adb -s ${deviceId} shell input keyevent ${payload.keycode}`);
                break;
            case 'home': await execAsync(`adb -s ${deviceId} shell input keyevent 3`); break;
            case 'back': await execAsync(`adb -s ${deviceId} shell input keyevent 4`); break;
            case 'recents': await execAsync(`adb -s ${deviceId} shell input keyevent 187`); break;
        }

        // ─── POST-ACTION FEEDBACK BURST ───
        for (let i = 0; i < POST_ACTION_BURST; i++) {
            await sleep(ACTION_SETTLE_MS);
            const buffer = await captureFrameRaw(deviceId);
            if (buffer) {
                broadcastBinaryFrame(buffer, Date.now());
            }
        }

        broadcast({ type: 'action_done', success: true, action: payload.action });

    } catch (err: any) {
        broadcast({ type: 'action_done', success: false, error: err.message });
    } finally {
        isActionInProgress = false;
        isAdbBusy = false; // Release lock
    }
}

// ═══════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════════
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`\n┌─────────────────────────────────────────────┐`);
console.log(`│  ⚡ VISION STREAM SERVER                     │`);
console.log(`│  Port: ws://localhost:${WS_PORT}               │`);
console.log(`│  Mode: Dual-Engine (Display + Action)       │`);
console.log(`│  Frame Rate: ~${Math.round(1000 / FRAME_INTERVAL_MS)} FPS continuous              │`);
console.log(`└─────────────────────────────────────────────┘\n`);

wss.on('connection', (ws) => {
    console.log('[Vision] Client connected');
    clients.add(ws);

    // Start engines if first client
    if (clients.size === 1) {
        frameLoop();
        hierarchyLoop();
    }

    // Send current state immediately
    if (deviceId) {
        ws.send(JSON.stringify({
            type: 'device_status',
            connected: true,
            model: deviceModel,
            resolution: deviceResolution
        }));
        if (lastHierarchy) {
            ws.send(JSON.stringify({
                type: 'state',
                hierarchy: lastHierarchy,
                currentPackage,
                deviceModel,
                resolution: deviceResolution,
                timestamp: Date.now()
            }));
        }
    }

    ws.on('message', async (raw) => {
        try {
            const msg = JSON.parse(raw.toString());

            if (msg.type === 'action') {
                await executeAction(msg.payload);
            }

            if (msg.type === 'refresh_hierarchy') {
                if (deviceId && !isAdbBusy) {
                    try {
                        isAdbBusy = true;
                        await execAsync(`adb -s ${deviceId} shell uiautomator dump --compressed /data/local/tmp/v_sync.xml`);
                        const { stdout: xml } = await execAsync(`adb -s ${deviceId} shell cat /data/local/tmp/v_sync.xml`);
                        const hierarchy = parseHierarchyXml(xml, deviceResolution);
                        isAdbBusy = false;
                        if (hierarchy) {
                            lastHierarchy = hierarchy;
                            broadcast({ type: 'state', hierarchy, currentPackage, deviceModel, resolution: deviceResolution, timestamp: Date.now() });
                        }
                    } catch {
                        isAdbBusy = false;
                    }
                }
            }

            if (msg.type === 'save_local_recording') {
                const { name, actions } = msg.payload;
                const recDir = path.join(process.cwd(), 'recordings');
                if (!fs.existsSync(recDir)) fs.mkdirSync(recDir);

                const fileName = `${name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
                const filePath = path.join(recDir, fileName);

                fs.writeFileSync(filePath, JSON.stringify({
                    test_case_name: name,
                    recorded_at: new Date().toISOString(),
                    steps: actions
                }, null, 2));

                console.log(`[Vision] Recording saved locally: ${filePath}`);
                ws.send(JSON.stringify({ type: 'recording_saved', path: filePath, name: fileName }));
            }

            if (msg.type === 'run_manual_script') {
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
                    isAdbBusy = true; isActionInProgress = true;
                    broadcast({ type: 'log', message: '[START] Running ' + lines.length + ' commands...', level: 'info' });

                    try {
                        for (let i = 0; i < lines.length; i++) {
                            const trimmed = lines[i].trim();
                            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

                            broadcast({ type: 'log', message: '[' + (i + 1) + '/' + lines.length + '] ' + trimmed, level: 'info' });

                            try {
                                if (trimmed.startsWith('tap ')) {
                                    // DSL: tap 500 500
                                    const parts = trimmed.split(/\s+/);
                                    if (parts.length >= 3) {
                                        await execAsync(`adb -s ${deviceId} shell input tap ${parts[1]} ${parts[2]}`);
                                    } else {
                                        throw new Error('Invalid tap command. Use: tap x y');
                                    }
                                } else if (trimmed.startsWith('type ')) {
                                    // DSL: type hello world
                                    const text = trimmed.substring(5).replace(/\s+/g, '%s'); // ADB requires %s for spaces
                                    await execAsync(`adb -s ${deviceId} shell input text "${text}"`);
                                } else if (trimmed.startsWith('swipe ')) {
                                    // DSL: swipe x1 y1 x2 y2 [duration]
                                    const parts = trimmed.split(/\s+/);
                                    if (parts.length >= 5) {
                                        const dur = parts[5] || '500';
                                        await execAsync(`adb -s ${deviceId} shell input swipe ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]} ${dur}`);
                                    } else {
                                        throw new Error('Invalid swipe command. Use: swipe x1 y1 x2 y2 [dur]');
                                    }
                                } else if (trimmed === 'back') {
                                    await execAsync(`adb -s ${deviceId} shell input keyevent 4`);
                                } else if (trimmed === 'home') {
                                    await execAsync(`adb -s ${deviceId} shell input keyevent 3`);
                                } else if (trimmed.startsWith('keyevent ')) {
                                    const code = trimmed.substring(9);
                                    await execAsync(`adb -s ${deviceId} shell input keyevent ${code}`);
                                } else if (trimmed.startsWith('adb shell ')) {
                                    await execAsync(`adb -s ${deviceId} shell ${trimmed.substring(10)}`);
                                } else if (trimmed.startsWith('adb ')) {
                                    await execAsync(`adb -s ${deviceId} ${trimmed.substring(4)}`);
                                } else if (trimmed.startsWith('input ')) {
                                    await execAsync(`adb -s ${deviceId} shell ${trimmed}`);
                                } else {
                                    // Raw shell command fallback
                                    await execAsync(`adb -s ${deviceId} shell ${trimmed}`);
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
                        isAdbBusy = false; isActionInProgress = false;
                        broadcast({ type: 'action_done', success: true });
                    }
                })();
            }

            if (msg.type === 'set_fps') {
                // Allow client to adjust frame rate dynamically
                // Not implemented here but could be extended
            }
        } catch (err) {
            console.error('[Vision] Message parse error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Vision] Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('[Vision] WebSocket error:', err);
        clients.delete(ws);
    });
});

console.log('[Vision] Waiting for connections...');
