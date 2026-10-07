export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // List of possible ADB paths
        const adbPaths = [
            'adb', // Global PATH
            'D:\\ADB\\platform-tools-latest-windows\\platform-tools\\adb.exe', // User's specific path
            'C:\\platform-tools\\adb.exe',
            '%ANDROID_HOME%\\platform-tools\\adb.exe'
        ];

        let stdout = '';
        let usedPath = '';

        // Try each path until one works
        for (const path of adbPaths) {
            try {
                console.log(`[API] Trying ADB at: ${path}`);
                const result = await execAsync(`${path} devices -l`);
                stdout = result.stdout;
                usedPath = path;
                console.log(`[API] Success with ${path}`);
                break;
            } catch (e) {
                // Continue to next path
                console.log(`[API] Failed with ${path}`);
            }
        }

        if (!stdout) {
            throw new Error('Could not execute ADB. Make sure it is installed or in the list of checked paths.');
        }

        const lines = stdout.split('\n');
        console.log('[API] ADB Output:', stdout);

        const devices = [];

        // Skip the first line usually "List of devices attached"
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse the line
            // Format is usually: <serial> <status> <metadata>
            const parts = line.split(/\s+/);
            const id = parts[0];
            const status = parts[1];

            if (status === 'device') {
                let model = 'Unknown Android Device';
                let product = 'Android';

                // Parse metadata
                const metadata = line.substring(line.indexOf(status) + status.length);
                const modelMatch = metadata.match(/model:(\S+)/);
                const productMatch = metadata.match(/product:(\S+)/);

                if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');
                if (productMatch) product = productMatch[1];

                devices.push({
                    id: id,
                    name: `${model} (${id})`,
                    platform: 'android',
                    model: model,
                    os: 'Android',
                    browser: 'Chrome (Mobile)',
                    status: 'connected',
                    isReal: true
                });
            }
        }

        return NextResponse.json({ devices, debug_path: usedPath });

    } catch (error: any) {
        console.error('[API] Error executing ADB:', error);
        return NextResponse.json({
            devices: [],
            error: error.message || 'Failed to execute ADB'
        }, { status: 500 });
    }
}
