import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    // Test functionality may not be fully available in Cloudflare Workers
    return NextResponse.json({
        error: 'Test functionality is not available in the cloud deployment',
        message: 'This feature may require local file system access',
        tests: [],
        suites: [],
        summary: { total: 0, passed: 0, failed: 0, running: 0, avgDuration: 0 }
    }, { status: 501 });
}

export async function POST(req: NextRequest) {
    // Test functionality may not be fully available in Cloudflare Workers
    return NextResponse.json({
        error: 'Test functionality is not available in the cloud deployment', 
        message: 'This feature may require local file system access'
    }, { status: 501 });
}