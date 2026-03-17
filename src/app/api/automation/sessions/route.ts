import { NextResponse } from 'next/server';
import { loadSessions, clearSessions } from '@/lib/automation-sessions';

// Re-export the type for the page to import
export type { RunSession } from '@/lib/automation-sessions';

// GET — return all sessions
export async function GET() {
    return NextResponse.json({ sessions: loadSessions() });
}

// DELETE — clear all sessions
export async function DELETE() {
    clearSessions();
    return NextResponse.json({ cleared: true });
}
