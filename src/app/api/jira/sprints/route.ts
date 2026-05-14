/**
 * Jira Sprints API — fetches all sprints for the project board
 * Returns sprints sorted: active first, then by start date descending
 */
import { NextResponse } from 'next/server';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';

interface SprintEntry { data: any; ts: number; }
const cache = new Map<string, SprintEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchSprints() {
    // Step 1: Get all boards for the project
    const boardsRes = await fetch(
        `${JIRA_BASE}/rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}&maxResults=50`,
        { headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    if (!boardsRes.ok) throw new Error(`Boards API ${boardsRes.status}`);
    const boardsData = await boardsRes.json();
    const boards: any[] = boardsData.values || [];
    if (boards.length === 0) return [];

    // Step 2: Fetch sprints from all boards in parallel
    const allSprints: any[] = [];
    await Promise.all(boards.map(async (board) => {
        let startAt = 0;
        while (true) {
            const res = await fetch(
                `${JIRA_BASE}/rest/agile/1.0/board/${board.id}/sprint?maxResults=50&startAt=${startAt}`,
                { headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' }, cache: 'no-store' }
            );
            if (!res.ok) break;
            const data = await res.json();
            const sprints: any[] = data.values || [];
            allSprints.push(...sprints.map((s: any) => ({
                id: s.id,
                name: s.name,
                state: s.state, // 'active' | 'closed' | 'future'
                startDate: s.startDate || null,
                endDate: s.endDate || null,
                boardId: board.id,
                boardName: board.name,
            })));
            if (data.isLast || sprints.length === 0) break;
            startAt += sprints.length;
        }
    }));

    // Deduplicate by sprint ID
    const seen = new Set<number>();
    const unique = allSprints.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

    // Sort: active first, then future, then closed by start date descending
    return unique.sort((a, b) => {
        const order = { active: 0, future: 1, closed: 2 };
        const ao = order[a.state as keyof typeof order] ?? 3;
        const bo = order[b.state as keyof typeof order] ?? 3;
        if (ao !== bo) return ao - bo;
        // Within same state, sort by start date descending (most recent first)
        const ad = a.startDate || '';
        const bd = b.startDate || '';
        return bd.localeCompare(ad);
    });
}

export async function GET() {
    const key = 'sprints';
    const entry = cache.get(key);
    const now = Date.now();

    if (entry && (now - entry.ts) < CACHE_TTL) {
        return NextResponse.json({ sprints: entry.data, fromCache: true });
    }

    try {
        const sprints = await fetchSprints();
        cache.set(key, { data: sprints, ts: now });
        return NextResponse.json({ sprints, fromCache: false });
    } catch (err: any) {
        console.error('[Sprints]', err.message);
        // Return cached data even if stale on error
        if (entry?.data) return NextResponse.json({ sprints: entry.data, fromCache: true, error: err.message });
        return NextResponse.json({ sprints: [], error: err.message }, { status: 500 });
    }
}
