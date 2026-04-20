/**
 * Atlassian Teams API — confirmed working endpoints:
 * - GET  /gateway/api/public/teams/v1/org/{orgId}/teams  → { entities: [{ teamId, displayName }] }
 * - POST /gateway/api/public/teams/v1/org/{orgId}/teams/{teamId}/members → { results: [{ accountId }] }
 * - GET  /rest/api/3/user?accountId=xxx  → { accountId, displayName, avatarUrls }
 *
 * Flow: list teams → POST members (get accountIds) → bulk resolve users → classify teams → done
 */
import { NextResponse } from 'next/server';
import { teamCacheService } from '@/lib/kpi/team-cache.service';
import { teamClassificationService } from '@/lib/kpi/team-classification.service';
import type { JiraTeam, TeamMember } from '@/types/kpi-dashboard';

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN!;
const ORG_ID = process.env.JIRA_ORG_ID!;

const BASIC = () => Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
const H = () => ({ Authorization: `Basic ${BASIC()}`, Accept: 'application/json', 'Content-Type': 'application/json' });

// ── Resolve accountId → user details ─────────────────────────────────────────
async function resolveUser(accountId: string): Promise<TeamMember> {
    // Check service cache first
    if (teamCacheService.hasUser(accountId)) {
        return teamCacheService.getUser(accountId)!;
    }

    try {
        const r = await fetch(`${JIRA_BASE}/rest/api/3/user?accountId=${encodeURIComponent(accountId)}`, {
            headers: H(), cache: 'no-store',
        });
        if (r.ok) {
            const u = await r.json();
            const member: TeamMember = {
                accountId: u.accountId,
                displayName: u.displayName || accountId,
                avatarUrl: u.avatarUrls?.['48x48'],
            };
            teamCacheService.setUser(accountId, member);
            return member;
        }
    } catch { /* fall through */ }

    // Return placeholder if lookup fails
    const fallback: TeamMember = { accountId, displayName: accountId };
    teamCacheService.setUser(accountId, fallback);
    return fallback;
}

// ── Fetch all accountIds for a team via POST ──────────────────────────────────
async function fetchTeamAccountIds(teamId: string): Promise<string[]> {
    const accountIds: string[] = [];
    let cursor: string | undefined;

    while (true) {
        const body: Record<string, any> = { maxResults: 100 };
        if (cursor) body.cursor = cursor;

        const r = await fetch(
            `https://api.atlassian.com/gateway/api/public/teams/v1/org/${ORG_ID}/teams/${teamId}/members`,
            { method: 'POST', headers: H(), body: JSON.stringify(body), cache: 'no-store' }
        );

        if (!r.ok) {
            console.error(`[Teams] POST members for ${teamId} HTTP ${r.status}`);
            break;
        }

        const data = await r.json();
        // Shape: { results: [{ accountId }], pageInfo: { hasNextPage, endCursor } }
        const list: any[] = data.results || data.entities || data.members || [];

        for (const m of list) {
            const id = m.accountId || m.id;
            if (id) accountIds.push(id);
        }

        const hasNext = data.pageInfo?.hasNextPage;
        const endCursor = data.pageInfo?.endCursor;
        if (!hasNext || !endCursor || list.length === 0) break;
        cursor = endCursor;
    }

    return accountIds;
}

// ── Fetch all teams (paginated) ───────────────────────────────────────────────
async function fetchTeamList(): Promise<Array<{ teamId: string; displayName: string }>> {
    const teams: Array<{ teamId: string; displayName: string }> = [];
    let cursor: string | undefined;

    console.log(`[Teams] Starting team list fetch for org: ${ORG_ID}`);

    try {
        while (true) {
            const url = new URL(`https://api.atlassian.com/gateway/api/public/teams/v1/org/${ORG_ID}/teams`);
            url.searchParams.set('maxResults', '50');
            if (cursor) url.searchParams.set('cursor', cursor);

            console.log(`[Teams] Fetching: ${url.toString()}`);

            const r = await fetch(url.toString(), { headers: H(), cache: 'no-store' });
            
            if (!r.ok) {
                const errorText = await r.text();
                console.error(`[Teams] HTTP ${r.status} error:`, errorText);
                throw new Error(`Teams list HTTP ${r.status}: ${errorText.slice(0, 200)}`);
            }

            const data = await r.json();
            const list: any[] = data.entities || data.values || data.teams || [];

            console.log(`[Teams] Received ${list.length} teams in this batch`);

            for (const t of list) {
                const teamId = t.teamId || t.id;
                const displayName = t.displayName || t.name;
                if (teamId && displayName) teams.push({ teamId, displayName });
            }

            const next = data.cursor || data.nextCursor;
            if (!next || list.length === 0) break;
            cursor = next;
        }

        console.log(`[Teams] Found ${teams.length} teams total`);
        return teams;
    } catch (error) {
        console.error('[Teams] fetchTeamList error:', error);
        throw error;
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function buildTeams(): Promise<JiraTeam[]> {
    const teamList = await fetchTeamList();
    const result: JiraTeam[] = [];

    // Process teams in batches of 5 to avoid rate limits
    const BATCH = 5;
    for (let i = 0; i < teamList.length; i += BATCH) {
        const batch = teamList.slice(i, i + BATCH);

        const resolved = await Promise.all(batch.map(async ({ teamId, displayName }) => {
            // Step 1: get accountIds
            const accountIds = await fetchTeamAccountIds(teamId);

            // Step 2: resolve all accountIds to user details in parallel
            const members = await Promise.all(accountIds.map(resolveUser));

            // Step 3: classify team type based on name
            const team: JiraTeam = { id: teamId, name: displayName, members };
            const classification = teamClassificationService.classifyTeam(team);
            team.teamType = classification.teamType;

            console.log(`[Teams] ${displayName}: ${members.length} members, type: ${classification.teamType} (${(classification.confidence * 100).toFixed(0)}%)`);
            return team;
        }));

        result.push(...resolved);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
    const now = Date.now();
    
    // Validate environment variables
    if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN || !ORG_ID) {
        console.error('[Teams] Missing required environment variables');
        return NextResponse.json({ 
            error: 'Server configuration error: Missing Jira credentials',
            teams: [] 
        }, { status: 500 });
    }
    
    // Check cache using service
    const cached = teamCacheService.get('default');
    if (cached) {
        const metadata = teamCacheService.getMetadata('default');
        return NextResponse.json({ 
            teams: cached, 
            fromCache: true, 
            count: cached.length,
            lastRefresh: metadata?.lastRefresh,
        });
    }

    try {
        const teams = await buildTeams();
        
        // Store in cache service
        teamCacheService.set(teams, 'default');
        
        const metadata = teamCacheService.getMetadata('default');
        return NextResponse.json({ 
            teams, 
            fromCache: false, 
            count: teams.length,
            lastRefresh: metadata?.lastRefresh,
        });
    } catch (err: any) {
        console.error('[Teams] Fatal:', err.message, err.stack);
        return NextResponse.json({ 
            error: err.message || 'Failed to fetch teams', 
            teams: [] 
        }, { status: 500 });
    }
}

// Force refresh — clears all caches
export async function POST() {
    teamCacheService.clear();
    return GET();
}
