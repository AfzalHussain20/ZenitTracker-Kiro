import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    // Extract PRD functionality is not fully available in Cloudflare Workers
    return NextResponse.json({ 
        error: 'Extract PRD is not available in the cloud deployment',
        message: 'This feature may require local file system access'
    }, { status: 501 });
}