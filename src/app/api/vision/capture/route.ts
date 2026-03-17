import { NextResponse } from 'next/server';
import { getConnectedDevice, getConnectedDevices, captureDeviceState } from '@/lib/vision-core';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const preferredId = url.searchParams.get('deviceId');

        const deviceId = await getConnectedDevice(preferredId);
        const state = await captureDeviceState(deviceId);
        const devices = await getConnectedDevices();

        return NextResponse.json({ ...state, devices });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
