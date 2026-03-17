import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Multiple ADB paths for robustness
const adbPaths = [
    'adb',
    'D:\\ADB\\platform-tools-latest-windows\\platform-tools\\adb.exe',
    'C:\\platform-tools\\adb.exe',
    '/usr/bin/adb',
    '/opt/homebrew/bin/adb'
];

async function runAdb(args: string) {
    let lastError = null;
    for (const path of adbPaths) {
        try {
            // timeout to prevent hanging
            const { stdout } = await execAsync(`"${path}" ${args}`, { timeout: 1500 });
            return stdout || '';
        } catch (e: any) {
            lastError = e;
        }
    }
    // minimal logging to avoid clutter
    // console.error(`ADB Fail: ${lastError?.message}`);
    return '';
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const deviceId = searchParams.get('deviceId');
    const packageId = searchParams.get('packageId');

    if (!deviceId && action !== 'list-devices') return NextResponse.json({ error: 'Device ID missing' }, { status: 400 });

    try {
        // --- 0. LIST DEVICES ---
        if (action === 'list-devices') {
            const raw = await runAdb(`devices`);
            const devices = raw.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('List') && !l.startsWith('*'))
                .map(l => {
                    const [id, status] = l.split(/\s+/);
                    return { id, status };
                })
                .filter(d => d.id);
            return NextResponse.json({ devices });
        }

        // --- 0.1 DEVICE INFO ---
        if (action === 'device-info') {
            const [model, os, manufacturer] = await Promise.all([
                runAdb(`-s ${deviceId} shell getprop ro.product.model`),
                runAdb(`-s ${deviceId} shell getprop ro.build.version.release`),
                runAdb(`-s ${deviceId} shell getprop ro.product.manufacturer`)
            ]);
            return NextResponse.json({
                model: model.trim(),
                os: os.trim(),
                manufacturer: manufacturer.trim()
            });
        }

        // --- 0.2 ACTIVE APP ---
        if (action === 'active-app') {
            // Focus can be in different formats depending on Android version
            const raw = await runAdb(`-s ${deviceId} shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp"`);
            const match = raw.match(/([a-zA-Z0-9._]+)\//);
            const packageId = match ? match[1] : 'unknown';
            return NextResponse.json({ packageId });
        }

        // --- 1. LIST PACKAGES ---
        if (action === 'list-packages') {
            const raw = await runAdb(`-s ${deviceId} shell pm list packages -3`);
            // Safe parsing
            const packages = raw.split('\n')
                .map(l => l.trim())
                .filter(l => l.startsWith('package:'))
                .map(l => l.split(':')[1])
                .sort();
            return NextResponse.json({ packages });
        }

        // --- 2. LAUNCH APP ---
        if (action === 'launch' && packageId) {
            await runAdb(`-s ${deviceId} shell monkey -p ${packageId} -c android.intent.category.LAUNCHER 1`);
            return NextResponse.json({ success: true });
        }

        // --- 3. MONITOR METRICS (The Core Logic) ---
        if (action === 'monitor' && packageId) {

            // A. Get PID first (Crucial for accurate /proc lookups)
            let pid = (await runAdb(`-s ${deviceId} shell pidof ${packageId}`)).trim();
            // Fallback: if pidof fails, try pgrep or ps
            if (!pid) {
                const psRaw = await runAdb(`-s ${deviceId} shell "ps -A | grep ${packageId}"`);
                const parts = psRaw.trim().split(/\s+/);
                if (parts.length > 1) pid = parts[1]; // Usually 2nd col is PID
            }

            if (!pid) {
                // App likely dead
                return NextResponse.json({ cpu: 0, threads: 0, memory: {}, network: {}, error: 'App not running' });
            }

            // B. Execute Parallel Commands using the PID
            const [cpuRaw, memRaw, battRaw, netRaw, threadsRaw, thermRaw] = await Promise.all([
                // CPU: standard top is most compatible. -n 1.
                runAdb(`-s ${deviceId} shell "top -n 1 -s 9 | grep ${pid}"`),
                // MEM: details
                runAdb(`-s ${deviceId} shell "dumpsys meminfo ${packageId}"`),
                // BATT
                runAdb(`-s ${deviceId} shell "dumpsys battery"`),
                // NET: Global stats (we will filter)
                runAdb(`-s ${deviceId} shell "cat /proc/net/dev"`),
                // THREADS: direct count
                runAdb(`-s ${deviceId} shell "ls /proc/${pid}/task | wc -l"`),
                // TEMP: try multiple zones
                runAdb(`-s ${deviceId} shell "cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || cat /sys/class/thermal/thermal_zone1/temp 2>/dev/null"`)
            ]);

            // --- PARSING LOGIC ---

            // 1. CPU
            // top output:  PID USER PR NI VIRT RES SHR S [%CPU] %MEM TIME+ COMMAND
            // The position of %CPU varies. We look for the pattern N% or just parse the fields.
            let cpu = 0.0;
            if (cpuRaw) {
                const lines = cpuRaw.trim().split('\n');
                const line = lines[lines.length - 1]; // grep might return multiple, take last
                const parts = line.trim().split(/\s+/);

                // Heuristic: Find the part that looks like a CPU float (usually ranges 0-800) 
                // and is NOT the PID or memory.
                // Standard Android top often puts CPU around index 8 or 9.
                // Let's look for the distinct '%' char if present, or guess.
                const cpuPart = parts.find(p => p.includes('%')) || parts[8] || '0';
                cpu = parseFloat(cpuPart.replace('%', '')) || 0;
            }

            // 2. THREADS
            // "ls ... | wc -l" returns just a number
            const threads = parseInt(threadsRaw.trim()) || 0;

            // 3. MEMORY (Robust regex)
            const parseKB = (regex: RegExp) => {
                const match = memRaw.match(regex);
                return match ? parseInt(match[1].replace(/,/g, '')) : 0;
            };
            const total = parseKB(/TOTAL\s+(\d+)/) || parseKB(/Total PSS:\s*(\d+)/);
            const java = parseKB(/Java Heap:\s+(\d+)/);
            const native = parseKB(/Native Heap:\s+(\d+)/);
            const graphics = parseKB(/Graphics:\s+(\d+)/) || parseKB(/GfxDev:\s+(\d+)/);
            const code = parseKB(/Code:\s+(\d+)/);
            const stack = parseKB(/Stack:\s+(\d+)/);

            // 4. BATTERY
            // level: 85
            // voltage: 4200
            // temperature: 320 (32.0 C)
            const level = parseInt(battRaw.match(/level:\s*(\d+)/)?.[1] || '0');
            const voltage = parseInt(battRaw.match(/voltage:\s*(\d+)/)?.[1] || '0');
            const battTempRaw = parseInt(battRaw.match(/temperature:\s*(\d+)/)?.[1] || '0');
            const battTemp = battTempRaw > 0 ? battTempRaw / 10 : 0;

            // 5. DEVICE TEMP (Thermal Zone)
            let devTemp = parseInt(thermRaw.trim()) || 0;
            if (devTemp > 1000) devTemp = devTemp / 1000; // 35000 -> 35
            // Fallback to battery temp if thermal zone is 0/fail
            if (devTemp === 0 && battTemp > 0) devTemp = battTemp;

            // 6. NETWORK
            // Interace     Receive       Transmit
            // wlan0:    12345 ...     67890 ...
            // rmnet0:   ...
            let rx = 0, tx = 0;
            const netLines = netRaw.split('\n');
            for (const line of netLines) {
                const trim = line.trim();
                if (!trim.includes(':')) continue;

                // Filter interfaces! verify wlan or rmnet (mobile)
                if (trim.startsWith('wlan') || trim.startsWith('rmnet') || trim.startsWith('eth')) {
                    const parts = trim.split(':')[1].trim().split(/\s+/);
                    if (parts.length >= 9) {
                        rx += parseInt(parts[0]);
                        tx += parseInt(parts[8]);
                    }
                }
            }

            // 7. JANK (Simplified)
            // Just count dropped frames from gfxinfo if possible, else 0
            const jank = 0; // Keeping 0 for now to reduce overhead, 'gfxinfo' is heavy

            return NextResponse.json({
                cpu,
                threads,
                memory: { total, java, native, graphics, code, stack },
                network: { rx, tx },
                battery: { level, voltage, temp: battTemp },
                temperature: devTemp,
                jank
            });
        }

        return NextResponse.json({ error: 'Invalid Action' });

    } catch (e: any) {
        console.error("ADB Error", e);
        // Return zeros instead of 500 so UI doesn't crash
        return NextResponse.json({
            cpu: 0, threads: 0, memory: {}, network: {}, battery: {}, temperature: 0, error: e.message
        });
    }
}
