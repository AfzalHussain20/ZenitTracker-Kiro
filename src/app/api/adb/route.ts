import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    // ADB functionality is not available in Cloudflare Workers deployment
    return NextResponse.json({
        error: 'ADB functionality is not available in the cloud deployment',
        message: 'This feature requires local environment with ADB access'
    }, { status: 501 });
}