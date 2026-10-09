import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Vision capture is not available in Cloudflare Workers deployment
    // This requires ADB connection and local device access
    return NextResponse.json({ 
        error: 'Vision capture is not available in the cloud deployment',
        message: 'This feature requires local environment with ADB access',
        devices: []
    }, { status: 501 });
}
