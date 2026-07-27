import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Dynamic import — prevents module evaluation at build time.
        // vision-core imports cheerio which references browser globals (File, etc.)
        // that are unavailable during Next.js static page data collection.
        const { getConnectedDevice, getConnectedDevices, captureDeviceState } =
            await import('@/lib/vision-core');

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
