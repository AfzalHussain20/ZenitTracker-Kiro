'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Dynamically import only at runtime, not at build time
        const { getConnectedDevice, executeAdbAction, captureDeviceState, wait, getDetailedSystemState } = await import('@/lib/vision-core');

        const body = await request.json();
        const deviceId = await getConnectedDevice();

        // 1. Execute the action
        await executeAdbAction(deviceId, body);

        // 2. Wait slightly for UI to settle
        await wait(300);

        // 3. CAPTURE NEW STATE IMMEDIATELY (Perfect Sync)
        const newState = await captureDeviceState(deviceId);

        // 4. GET TECHNICAL TRUTH (State Machine info)
        const sysState = await getDetailedSystemState(deviceId);

        return NextResponse.json({
            ...newState,
            sysState
        });
    } catch (error: any) {
        console.error("Action/Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
