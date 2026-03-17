import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import path from 'path';

const execAsync = promisify(exec);

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface DeviceState {
    status: string;
    deviceId: string;
    deviceModel: string;
    currentPackage: string;
    screenshotUrl: string;
    hierarchy: any;
    timestamp: number;
    resolution: { width: number; height: number };
}

export async function getConnectedDevices(): Promise<string[]> {
    const { stdout } = await execAsync('adb devices');
    const lines = stdout.split('\n').filter(line => line.includes('\tdevice'));
    return lines.map(line => line.split('\t')[0]);
}

export async function getConnectedDevice(preferredId?: string | null): Promise<string> {
    const devices = await getConnectedDevices();
    if (devices.length === 0) throw new Error('No Android device connected');
    if (preferredId && devices.includes(preferredId)) return preferredId;
    return devices[0];
}

export async function getDeviceResolution(deviceId: string) {
    const { stdout } = await execAsync(`adb -s ${deviceId} shell wm size`);
    const match = stdout.match(/(\d+)x(\d+)/);
    if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
    return { width: 1440, height: 2880 }; // Fallback
}

// --- CACHE FOR STATIC DEVICE DATA ---
let deviceCache: Record<string, { model: string, resolution: { width: number, height: number } }> = {};

export async function captureDeviceState(deviceId: string): Promise<DeviceState> {
    const startTime = Date.now();

    // 1. Parallelize non-dependent tasks
    const tasks = [
        // Task A: Get static info if not cached
        (async () => {
            if (!deviceCache[deviceId]) {
                const { stdout: modelOut } = await execAsync(`adb -s ${deviceId} shell getprop ro.product.model`);
                const res = await getDeviceResolution(deviceId);
                deviceCache[deviceId] = { model: modelOut.trim(), resolution: res };
            }
            return deviceCache[deviceId];
        })(),

        // Task B: Current Focus
        execAsync(`adb -s ${deviceId} shell "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"`),

        // Task C: Fast Screenshot (Piped directly to avoid pull overhead)
        (async () => {
            const localScreenshotPath = path.join(process.cwd(), 'public', 'temp_vision_screenshot.png');
            // On Windows/Linux, exec-out is significantly faster as it streams raw data
            try {
                await execAsync(`adb -s ${deviceId} exec-out screencap -p > "${localScreenshotPath}"`);
            } catch (err) {
                // Fallback for older ADB or specific environments
                await execAsync(`adb -s ${deviceId} shell screencap -p /data/local/tmp/screen.png`);
                await execAsync(`adb -s ${deviceId} pull /data/local/tmp/screen.png "${localScreenshotPath}"`);
            }
            return `/temp_vision_screenshot.png?t=${Date.now()}`;
        })(),

        // Task D: UI Hierarchy (The slow one - parallelized with screenshot)
        (async () => {
            try {
                // --compressed flag makes it slightly faster on some Android versions
                await execAsync(`adb -s ${deviceId} shell uiautomator dump --compressed /data/local/tmp/view.xml`);
                const { stdout: xmlContent } = await execAsync(`adb -s ${deviceId} shell cat /data/local/tmp/view.xml`);
                return xmlContent;
            } catch (e) {
                console.warn("Hierarchy dump failed:", e);
                return null;
            }
        })()
    ];

    const [cache, focusOut, screenshotUrl, xmlContent] = await Promise.all(tasks);

    // 2. Process results
    const packageMatch = (focusOut as any).stdout.match(/([a-zA-Z0-9._]+)\//);
    const res = (cache as any).resolution;

    let rootNode = null;
    if (xmlContent) {
        const $ = cheerio.load(xmlContent as string, { xmlMode: true });
        const parseNode = (el: any): any => {
            const attributes = el.attribs || {};
            const boundsMatch = attributes.bounds ? attributes.bounds.match(/\[(\d+),(\d+)\],\[(\d+),(\d+)\]|\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) : null;

            let normalizedBounds = null;
            if (boundsMatch) {
                // Handle both [x1,y1][x2,y2] and [x1,y1],[x2,y2] formats
                const x1 = parseInt(boundsMatch[1] || boundsMatch[5]);
                const y1 = parseInt(boundsMatch[2] || boundsMatch[6]);
                const x2 = parseInt(boundsMatch[3] || boundsMatch[7]);
                const y2 = parseInt(boundsMatch[4] || boundsMatch[8]);
                normalizedBounds = {
                    x: x1 / res.width,
                    y: y1 / res.height,
                    width: (x2 - x1) / res.width,
                    height: (y2 - y1) / res.height
                };
            }

            return {
                id: attributes['resource-id'] || attributes['content-desc'] || Math.random().toString(36).substr(2, 9),
                name: attributes['class']?.split('.').pop() || 'Element',
                type: attributes['class'] || 'View',
                package: attributes['package'],
                attributes: {
                    resourceId: attributes['resource-id'],
                    contentDesc: attributes['content-desc'],
                    text: attributes['text'],
                    clickable: attributes['clickable'] === 'true',
                    visible: attributes['visible-to-user'] === 'true',
                    bounds: normalizedBounds
                },
                children: $(el).children().toArray().map(child => parseNode(child))
            };
        };
        const firstChild = $('hierarchy').children().first()[0];
        if (firstChild) rootNode = parseNode(firstChild);
    }

    console.log(`Capture Cycle took ${Date.now() - startTime}ms`);

    return {
        status: "SUCCESS",
        deviceId,
        deviceModel: (cache as any).model,
        currentPackage: packageMatch ? packageMatch[1] : "Unknown",
        screenshotUrl: screenshotUrl as string,
        hierarchy: rootNode,
        timestamp: Date.now(),
        resolution: res
    };
}

// --- SYSTEM STATE OBSERVER (Logcat Parsing) ---
export async function getDetailedSystemState(deviceId: string) {
    try {
        // Get last 50 lines of logcat related to common OTT/System events
        const { stdout } = await execAsync(`adb -s ${deviceId} shell "logcat -d -t 50 *:I | grep -E 'ExoPlayer|AVPlayer|ActivityTaskManager|WindowState'"`);

        const isBuffering = stdout.includes('BUFFERING') || stdout.includes('Loading');
        const isReady = stdout.includes('STATE_READY') || stdout.includes('playback_started');
        const hasError = stdout.includes('Exception') || stdout.includes('Error');

        return {
            isBuffering,
            isReady,
            hasError,
            raw: stdout.split('\n').slice(-3) // last 3 lines
        };
    } catch (e) {
        return { isBuffering: false, isReady: true, hasError: false, raw: [] };
    }
}

// --- ELEMENT RESOLUTION (Intent-Based Action) ---
async function resolveLocatorToCoords(deviceId: string, locator: string): Promise<{ x: number, y: number } | null> {
    try {
        await execAsync(`adb -s ${deviceId} shell uiautomator dump /data/local/tmp/resolve.xml`);
        const { stdout: xmlContent } = await execAsync(`adb -s ${deviceId} shell cat /data/local/tmp/resolve.xml`);
        const $ = cheerio.load(xmlContent, { xmlMode: true });

        // Search by resource-id, content-desc, or text
        const selector = `node[resource-id="${locator}"], node[content-desc="${locator}"], node[text="${locator}"]`;
        const el = $(selector).first();

        if (el.length > 0) {
            const bounds = el.attr('bounds');
            const match = bounds ? bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) : null;
            if (match) {
                const x1 = parseInt(match[1]);
                const y1 = parseInt(match[2]);
                const x2 = parseInt(match[3]);
                const y2 = parseInt(match[4]);
                return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
            }
        }
    } catch (e) {
        console.error("Locator resolution failed", e);
    }
    return null;
}

// --- STABILITY CHECK (Wait for UI Idle) ---
async function waitForStability(deviceId: string, maxWaitMs = 2000) {
    const start = Date.now();
    let lastFocus = "";
    while (Date.now() - start < maxWaitMs) {
        const { stdout } = await execAsync(`adb -s ${deviceId} shell "dumpsys window | grep mCurrentFocus"`);
        if (lastFocus && lastFocus === stdout) {
            await wait(150); // Small buffer
            return true;
        }
        lastFocus = stdout;
        await wait(200);
    }
    return false;
}

export async function executeAdbAction(deviceId: string, body: any) {
    const { action } = body;
    const res = await getDeviceResolution(deviceId);

    const scale = (rX: number, rY: number) => ({
        x: Math.round(rX * res.width),
        y: Math.round(rY * res.height)
    });

    switch (action) {
        case 'tap':
            let targetX, targetY;
            if (body.locator) {
                const coords = await resolveLocatorToCoords(deviceId, body.locator);
                if (coords) {
                    targetX = coords.x;
                    targetY = coords.y;
                }
            }

            if (targetX === undefined) {
                const t = scale(body.ratioX, body.ratioY);
                targetX = t.x;
                targetY = t.y;
            }

            await execAsync(`adb -s ${deviceId} shell input tap ${targetX} ${targetY}`);
            break;

        case 'swipe':
            const s1 = scale(body.ratioX1, body.ratioY1);
            const s2 = scale(body.ratioX2, body.ratioY2);
            await execAsync(`adb -s ${deviceId} shell input swipe ${s1.x} ${s1.y} ${s2.x} ${s2.y} ${body.duration || 300}`);
            break;

        case 'type':
            const text = body.text.replace(/ /g, '%s').replace(/"/g, '\\"');
            await execAsync(`adb -s ${deviceId} shell input text "${text}"`);
            break;

        case 'keyevent':
            await execAsync(`adb -s ${deviceId} shell input keyevent ${body.keycode}`);
            break;

        case 'home': await execAsync(`adb -s ${deviceId} shell input keyevent 3`); break;
        case 'back': await execAsync(`adb -s ${deviceId} shell input keyevent 4`); break;
        case 'recents': await execAsync(`adb -s ${deviceId} shell input keyevent 187`); break;
    }

    // After action, wait for UI stability (Golden Rule: Never act without state)
    await waitForStability(deviceId);
}
