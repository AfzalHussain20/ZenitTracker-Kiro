import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json({ 
        error: 'Automation is not available in the cloud deployment',
        message: 'This feature requires local environment with Java/Maven setup'
    }, { status: 501 });
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'list_reports') {
        return NextResponse.json({ reports: [] });
    }

    return NextResponse.json({ 
        error: 'Automation is not available in the cloud deployment',
        message: 'This feature requires local environment with Java/Maven setup'
    }, { status: 501 });
}
