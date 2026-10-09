import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    // Vision actions are not available in Cloudflare Workers deployment
    // This requires ADB connection and local device access
    return NextResponse.json({ 
        error: 'Vision actions are not available in the cloud deployment',
        message: 'This feature requires local environment with ADB access'
    }, { status: 501 });
}
