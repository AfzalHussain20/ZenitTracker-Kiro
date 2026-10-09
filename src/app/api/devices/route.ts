import { NextResponse } from 'next/server';

export async function GET() {
    // Device management requires ADB and is not available in Cloudflare Workers
    return NextResponse.json({
        devices: [],
        error: 'Device management is not available in the cloud deployment',
        message: 'This feature requires local environment with ADB access'
    }, { status: 501 });
}
