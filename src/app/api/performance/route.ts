import { NextRequest, NextResponse } from 'next/server';

// Store for active test sessions
const activeSessions = new Map<string, any>();

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = activeSessions.get(sessionId);

    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
        sessionId,
        status: session.status,
        metrics: session.metrics,
        startTime: session.startTime,
        duration: Date.now() - session.startTime
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, sessionId, deviceId, platform, testUrl, duration } = body;

        if (action === 'start') {
            // Create new test session
            const newSessionId = `session-${Date.now()}`;

            activeSessions.set(newSessionId, {
                sessionId: newSessionId,
                deviceId,
                platform,
                testUrl,
                duration,
                status: 'running',
                startTime: Date.now(),
                metrics: []
            });

            return NextResponse.json({
                success: true,
                sessionId: newSessionId,
                message: 'Performance test started'
            });
        }

        if (action === 'stop') {
            if (!sessionId) {
                return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
            }

            const session = activeSessions.get(sessionId);
            if (session) {
                session.status = 'completed';
                session.endTime = Date.now();
            }

            return NextResponse.json({
                success: true,
                message: 'Performance test stopped'
            });
        }

        if (action === 'metrics') {
            if (!sessionId) {
                return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
            }

            const session = activeSessions.get(sessionId);
            if (!session) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            // Add new metrics
            const { metrics } = body;
            session.metrics.push({
                timestamp: Date.now(),
                ...metrics
            });

            return NextResponse.json({
                success: true,
                message: 'Metrics recorded'
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Performance API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    activeSessions.delete(sessionId);

    return NextResponse.json({
        success: true,
        message: 'Session deleted'
    });
}
