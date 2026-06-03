/**
 * useJiraKPI — Single source of truth for all Jira KPI data
 * Uses server-side sync cache. Auto-polls every 10 min.
 * Tracks: story points, assigned tickets, live builds, monthly counts, ALL members
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JiraIssueRaw {
    id: string; key: string; url: string; summary: string;
    issueType: string; status: string; statusCategory: string; priority: string;
    assignee: { accountId: string; displayName: string; avatarUrl?: string } | null;
    reporter: { accountId: string; displayName: string; avatarUrl?: string } | null;
    labels: string[]; platform: string | null; environment: string | null;
    created: string; updated: string; resolutionDate: string | null;
    timeSpent: number; timeEstimate: number;
    storyPoints: number | null;
    isLive: boolean; liveVersion: string | null;
    fixVersions: { name: string; released: boolean }[];
    team: string | null;  // from customfield_10001
    isSubTask: boolean;   // true for Sub-task issue type — excluded from SP totals
    sprint: { id: number; name: string; state: string; startDate: string | null; endDate: string | null } | null;
}

export interface PersonKPI {
    userId: string; name: string; avatarUrl?: string;
    // Bugs reported
    bugsReported: number; bugsOpen: number; bugsClosed: number;
    bugsInProgress: number; bugsCritical: number; bugsHigh: number;
    // All tickets assigned to this person
    ticketsAssigned: number; assignedOpen: number; assignedClosed: number; assignedInProgress: number;
    // Story points (from assigned tickets)
    storyPointsAssigned: number; storyPointsCompleted: number; storyPointsInProgress: number; storyPointsTodo: number;
    // Other types reported
    storiesReported: number; epicsReported: number; tasksReported: number; totalIssues: number;
    // Quality
    qualityScore: number; closeRate: number;
    // Team labels found on their bugs
    teams: string[];
    // Monthly breakdown
    monthly: Record<string, { reported: number; closed: number; open: number; inProgress: number; assigned: number; storyPoints: number }>;}

export interface MonthlyStats {
    month: string; label: string;
    bugs: number; stories: number; epics: number; tasks: number; total: number;
    open: number; closed: number; inProgress: number;
    critical: number; high: number;
    storyPoints: number; liveTickets: number;
}

export interface JiraTeam {
    id: string;
    name: string;
    members: { accountId: string; displayName: string; avatarUrl?: string }[];
}

export interface KPIData {
    all: JiraIssueRaw[]; bugs: JiraIssueRaw[]; stories: JiraIssueRaw[];
    epics: JiraIssueRaw[]; tasks: JiraIssueRaw[]; subtasks: JiraIssueRaw[];
    liveTickets: JiraIssueRaw[];
    /** all-time bugs — not sprint-scoped — used for member profile overall counts */
    allTimeIssues: JiraIssueRaw[];
    counts: { total: number; bugs: number; stories: number; epics: number; tasks: number; subtasks: number; live: number };
    people: PersonKPI[];
    monthly: MonthlyStats[];
    currentMonth: MonthlyStats;
    previousMonth: MonthlyStats;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byIssueType: Record<string, number>;
    // All unique team labels found across all issues
    allTeams: string[];
    // Jira Teams with their actual members
    jiraTeams: JiraTeam[];
    // All sprints found across issues
    sprints: Array<{ id: number; name: string; state: string; startDate: string | null; endDate: string | null }>;
    // Summary KPIs
    totalStoryPoints: number;
    completedStoryPoints: number;
    inProgressStoryPoints: number;
    todoStoryPoints: number;
    spByType: { tasks: number; bugs: number; stories: number; epics: number };
    openBugsCurrentMonth: number;
    closedBugsCurrentMonth: number;
    liveBuildsCount: number;
    syncedAt: string; cacheAge: number; nextRefresh: number;
    fromCache: boolean; refreshing?: boolean;
}

// ─── Status classification ────────────────────────────────────────────────────

const CLOSED_SET = new Set([
    'done', 'closed', 'resolved', 'live', 'completed', 'fixed',
    'dev completed', 'infra completed', 'by design', 'qa verified',
    'verified', 'released', 'deployed', 'deferred', 'not reproducing',
    'change', 'changed', 'duplicate',
]);
const IN_PROGRESS_SET = new Set([
    'in progress', 'inprogress', 'in development', 'testing', 'qa',
    'in review', 'code review', 'uat', 'staging', 'retest', 'reopen',
]);

function classify(status: string): 'open' | 'in_progress' | 'closed' {
    const s = status.toLowerCase().trim();
    if (CLOSED_SET.has(s)) return 'closed';
    if (IN_PROGRESS_SET.has(s)) return 'in_progress';
    return 'open';
}

function monthKey(d: string) { return d.slice(0, 7); }

function monthLabel(key: string) {
    const [y, m] = key.split('-');
    return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function calcQuality(bugs: JiraIssueRaw[]): number {
    if (!bugs.length) return 0;
    const w: Record<string, number> = { Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 };
    const total = bugs.reduce((s, b) => s + (w[b.priority] ?? 3), 0);
    const raw = (total / (bugs.length * 5)) * 100;
    return Math.round((raw * 0.9 + Math.min(10, Math.log10(bugs.length + 1) * 5)) * 10) / 10;
}

function emptyMonth(key: string): MonthlyStats {
    return { month: key, label: monthLabel(key), bugs: 0, stories: 0, epics: 0, tasks: 0, total: 0, open: 0, closed: 0, inProgress: 0, critical: 0, high: 0, storyPoints: 0, liveTickets: 0 };
}

// ─── Process sync data → KPIs ─────────────────────────────────────────────────

function processKPI(raw: any): KPIData {
    const bugs: JiraIssueRaw[] = raw.bugs || [];
    const stories: JiraIssueRaw[] = raw.stories || [];
    const epics: JiraIssueRaw[] = raw.epics || [];
    const tasks: JiraIssueRaw[] = raw.tasks || [];
    const subtasks: JiraIssueRaw[] = raw.subtasks || [];
    const all = [...bugs, ...stories, ...epics, ...tasks, ...subtasks];
    // allForSP excludes sub-tasks — sub-tasks duplicate parent story SP
    const allForSP: JiraIssueRaw[] = raw.allForSP || all.filter(i => !i.isSubTask);
    // allTimeBugs — all bugs ever reported, not sprint-scoped — for Team KPI bug counts
    const allTimeBugs: JiraIssueRaw[] = raw.allTimeBugs || bugs;
    const liveTickets: JiraIssueRaw[] = raw.liveTickets || all.filter(i => i.isLive);

    // ── Per-person map ──
    type PersonEntry = {
        userId: string; name: string; avatarUrl?: string;
        bugsReported: JiraIssueRaw[];
        allAssigned: JiraIssueRaw[];
        storiesReported: number; epicsReported: number; tasksReported: number;
        monthly: Map<string, { reported: number; closed: number; open: number; inProgress: number; assigned: number; storyPoints: number }>;
    };

    const pm = new Map<string, PersonEntry>();

    function get(id: string, name: string, avatar?: string): PersonEntry {
        if (!pm.has(id)) pm.set(id, { userId: id, name, avatarUrl: avatar, bugsReported: [], allAssigned: [], storiesReported: 0, epicsReported: 0, tasksReported: 0, monthly: new Map() });
        return pm.get(id)!;
    }

    function ensureMonth(p: PersonEntry, mk: string) {
        if (!p.monthly.has(mk)) p.monthly.set(mk, { reported: 0, closed: 0, open: 0, inProgress: 0, assigned: 0, storyPoints: 0 });
        return p.monthly.get(mk)!;
    }

    // Use allTimeBugs (not sprint-scoped) for reporter-based bug counts in Team KPIs
    // This gives exact all-time bug counts per person, matching Jira's member view
    allTimeBugs.forEach(b => {
        if (b.reporter) {
            const p = get(b.reporter.accountId, b.reporter.displayName, b.reporter.avatarUrl);
            p.bugsReported.push(b);
            const m = ensureMonth(p, monthKey(b.created));
            m.reported++;
            const cls = classify(b.status);
            if (cls === 'closed') m.closed++;
            else if (cls === 'in_progress') m.inProgress++;
            else m.open++; // truly To-Do only
        }
    });

    // Use allForSP (no sub-tasks) for SP tracking — sub-tasks duplicate parent story SP
    allForSP.forEach(i => {
        if (i.assignee) {
            const p = get(i.assignee.accountId, i.assignee.displayName, i.assignee.avatarUrl);
            p.allAssigned.push(i);
            const m = ensureMonth(p, monthKey(i.created));
            m.assigned++;
            if (i.storyPoints) m.storyPoints += i.storyPoints;
        }
    });

    stories.forEach(s => { if (s.reporter) get(s.reporter.accountId, s.reporter.displayName, s.reporter.avatarUrl).storiesReported++; });
    epics.forEach(e => { if (e.reporter) get(e.reporter.accountId, e.reporter.displayName, e.reporter.avatarUrl).epicsReported++; });
    tasks.forEach(t => { if (t.reporter) get(t.reporter.accountId, t.reporter.displayName, t.reporter.avatarUrl).tasksReported++; });

    const people: PersonKPI[] = Array.from(pm.values()).map(p => {
        const br = p.bugsReported;
        const aa = p.allAssigned;
        const closed = br.filter(b => classify(b.status) === 'closed').length;
        const spAssigned = aa.reduce((s, i) => s + (i.storyPoints || 0), 0);
        const spCompleted = aa.filter(i => classify(i.status) === 'closed').reduce((s, i) => s + (i.storyPoints || 0), 0);
        const spInProgress = aa.filter(i => classify(i.status) === 'in_progress').reduce((s, i) => s + (i.storyPoints || 0), 0);
        const spTodo = aa.filter(i => classify(i.status) === 'open').reduce((s, i) => s + (i.storyPoints || 0), 0);
        const monthly: PersonKPI['monthly'] = {};
        p.monthly.forEach((v, k) => { monthly[k] = v; });

        // Collect unique teams from the team field (customfield_10001)
        // Use the most common team as primary, list all teams they've worked with
        const teamCount = new Map<string, number>();
        [...br, ...aa].forEach(issue => {
            if (issue.team) teamCount.set(issue.team, (teamCount.get(issue.team) || 0) + 1);
        });
        // Sort by frequency — most common team first
        const teamSet = Array.from(teamCount.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([t]) => t);

        return {
            userId: p.userId, name: p.name, avatarUrl: p.avatarUrl,
            bugsReported: br.length,
            bugsOpen: br.filter(b => classify(b.status) === 'open').length,
            bugsClosed: closed,
            bugsInProgress: br.filter(b => classify(b.status) === 'in_progress').length,
            bugsCritical: br.filter(b => b.priority === 'Highest').length,
            bugsHigh: br.filter(b => b.priority === 'High').length,
            ticketsAssigned: aa.length,
            assignedOpen: aa.filter(i => classify(i.status) === 'open').length,
            assignedClosed: aa.filter(i => classify(i.status) === 'closed').length,
            assignedInProgress: aa.filter(i => classify(i.status) === 'in_progress').length,
            storyPointsAssigned: spAssigned,
            storyPointsCompleted: spCompleted,
            storyPointsInProgress: spInProgress,
            storyPointsTodo: spTodo,
            storiesReported: p.storiesReported,
            epicsReported: p.epicsReported,
            tasksReported: p.tasksReported,
            totalIssues: br.length + p.storiesReported + p.epicsReported + p.tasksReported,
            qualityScore: calcQuality(br),
            closeRate: br.length > 0 ? Math.min(100, Math.round((closed / br.length) * 1000) / 10) : 0,
            teams: teamSet,
            monthly,
        };
    }).sort((a, b) => b.bugsReported - a.bugsReported);

    // ── Monthly stats (last 12 months) ──
    const now = new Date();
    const monthlyMap = new Map<string, MonthlyStats>();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(k, emptyMonth(k));
    }

    all.forEach(issue => {
        const mk = monthKey(issue.created);
        if (!monthlyMap.has(mk)) return;
        const m = monthlyMap.get(mk)!;
        m.total++;
        const cls = classify(issue.status);
        if (cls === 'open') m.open++;
        else if (cls === 'closed') m.closed++;
        else m.inProgress++;
        if (issue.storyPoints) m.storyPoints += issue.storyPoints;
        if (issue.isLive) m.liveTickets++;
        if (issue.issueType === 'Bug') {
            m.bugs++;
            if (issue.priority === 'Highest') m.critical++;
            if (issue.priority === 'High') m.high++;
        } else if (issue.issueType === 'Story') m.stories++;
        else if (issue.issueType === 'Epic') m.epics++;
        else if (issue.issueType === 'Task') m.tasks++;
    });

    const monthly = Array.from(monthlyMap.values());
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Breakdowns ──
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byIssueType: Record<string, number> = {};
    all.forEach(i => {
        byStatus[i.status] = (byStatus[i.status] || 0) + 1;
        byPriority[i.priority] = (byPriority[i.priority] || 0) + 1;
        byIssueType[i.issueType] = (byIssueType[i.issueType] || 0) + 1;
    });

    const cm = monthlyMap.get(curKey) || emptyMonth(curKey);

    // Collect all unique team names from the Team custom field
    const allTeamSet = new Set<string>();
    all.forEach(i => { if (i.team) allTeamSet.add(i.team); });

    // Also add team names from Jira Teams API
    const jiraTeams: Array<{ id: string; name: string; members: { accountId: string; displayName: string; avatarUrl?: string }[] }> = raw.jiraTeams || [];
    jiraTeams.forEach(t => allTeamSet.add(t.name));

    const allTeams = Array.from(allTeamSet).sort();

    // Collect all unique sprints from issues
    const sprintMap = new Map<number, { id: number; name: string; state: string; startDate: string | null; endDate: string | null }>();
    all.forEach(i => {
        if (i.sprint && i.sprint.id) {
            sprintMap.set(i.sprint.id, i.sprint);
        }
    });
    // Sort: active first, then by name descending (most recent sprint first)
    const sprints = Array.from(sprintMap.values()).sort((a, b) => {
        if (a.state === 'active' && b.state !== 'active') return -1;
        if (b.state === 'active' && a.state !== 'active') return 1;
        return b.name.localeCompare(a.name);
    });

    // If we have Jira Teams API data, enrich people with correct team membership
    if (jiraTeams.length > 0) {
        // Build a map: accountId → team names from Jira Teams API
        const apiTeamMap = new Map<string, string[]>();
        jiraTeams.forEach(team => {
            team.members.forEach(member => {
                const existing = apiTeamMap.get(member.accountId) || [];
                existing.push(team.name);
                apiTeamMap.set(member.accountId, existing);
            });
        });

        // Override teams on each person with API data
        people.forEach(p => {
            const apiTeams = apiTeamMap.get(p.userId);
            if (apiTeams && apiTeams.length > 0) {
                p.teams = apiTeams;
            }
        });

        // Add people from Jira Teams who have no issues yet (zero-activity members)
        const existingIds = new Set(people.map(p => p.userId));
        jiraTeams.forEach(team => {
            team.members.forEach(member => {
                if (!existingIds.has(member.accountId)) {
                    people.push({
                        userId: member.accountId,
                        name: member.displayName,
                        avatarUrl: member.avatarUrl,
                        bugsReported: 0, bugsOpen: 0, bugsClosed: 0, bugsInProgress: 0, bugsCritical: 0, bugsHigh: 0,
                        ticketsAssigned: 0, assignedOpen: 0, assignedClosed: 0, assignedInProgress: 0,
                        storyPointsAssigned: 0, storyPointsCompleted: 0, storyPointsInProgress: 0, storyPointsTodo: 0,
                        storiesReported: 0, epicsReported: 0, tasksReported: 0, totalIssues: 0,
                        qualityScore: 0, closeRate: 0,
                        teams: [team.name],
                        monthly: {},
                    });
                    existingIds.add(member.accountId);
                }
            });
        });
    }

    return {
        all, bugs: allTimeBugs, stories, epics, tasks, subtasks, liveTickets,
        allTimeIssues: allTimeBugs, // all-time bugs for member profile overall counts
        counts: raw.counts || { total: all.length, bugs: bugs.length, stories: stories.length, epics: epics.length, tasks: tasks.length, subtasks: subtasks.length, live: liveTickets.length },
        people, monthly,
        currentMonth: cm,
        previousMonth: monthlyMap.get(prevKey) || emptyMonth(prevKey),
        byStatus, byPriority, byIssueType,
        allTeams,
        jiraTeams: raw.jiraTeams || [],
        sprints,
        totalStoryPoints: all.reduce((s, i) => s + (i.storyPoints || 0), 0),
        completedStoryPoints: all.filter(i => classify(i.status) === 'closed').reduce((s, i) => s + (i.storyPoints || 0), 0),
        inProgressStoryPoints: all.filter(i => classify(i.status) === 'in_progress').reduce((s, i) => s + (i.storyPoints || 0), 0),
        todoStoryPoints: all.filter(i => classify(i.status) === 'open').reduce((s, i) => s + (i.storyPoints || 0), 0),
        spByType: raw.spByType || {
            tasks:   tasks.reduce((s, i) => s + (i.storyPoints || 0), 0),
            bugs:    bugs.reduce((s, i) => s + (i.storyPoints || 0), 0),
            stories: stories.reduce((s, i) => s + (i.storyPoints || 0), 0),
            epics:   epics.reduce((s, i) => s + (i.storyPoints || 0), 0),
        },
        openBugsCurrentMonth: cm.open,
        closedBugsCurrentMonth: cm.closed,
        liveBuildsCount: liveTickets.length,
        syncedAt: raw.syncedAt || new Date().toISOString(),
        cacheAge: raw.cacheAge || 0,
        nextRefresh: raw.nextRefresh || 600,
        fromCache: raw.fromCache || false,
        refreshing: raw.refreshing || false,
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJiraKPI(sprintId?: string) {
    const [kpi, setKpi] = useState<KPIData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    // All available sprints — fetched independently so sprint selector works before data loads
    const [allSprints, setAllSprints] = useState<Array<{id:number;name:string;state:string;startDate:string|null;endDate:string|null}>>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch sprint list once on mount — independent of main data fetch
    useEffect(() => {
        fetch('/api/jira/sprints')
            .then(r => r.json())
            .then(d => { if (d.sprints) setAllSprints(d.sprints); })
            .catch(() => {});
    }, []);

    const fetchKPI = useCallback(async (force = false) => {
        try {
            // Build URL with optional sprintId for sprint-scoped fetch
            const sprintParam = sprintId ? `?sprintId=${sprintId}` : '';
            // Fetch sync data and teams in parallel
            const [syncRes, teamsRes] = await Promise.all([
                fetch(`/api/jira/sync${sprintParam}`, { method: force ? 'POST' : 'GET' }),
                fetch('/api/jira/teams').catch(() => null),
            ]);
            if (!syncRes.ok) throw new Error(`HTTP ${syncRes.status}`);
            const data = await syncRes.json();
            if (data.error) throw new Error(data.error);

            // Merge teams data — use API teams if available, else empty (will use issue-based teams)
            if (teamsRes?.ok) {
                const teamsData = await teamsRes.json();
                data.jiraTeams = teamsData.teams || [];
            } else {
                data.jiraTeams = [];
            }

            const processed = processKPI(data);
            // Merge allSprints into kpi.sprints so sprint selector always has full list
            if (allSprints.length > 0) {
                processed.sprints = allSprints;
            }
            setKpi(processed);
            setLastSync(new Date());
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [sprintId, allSprints]);

    useEffect(() => {
        setLoading(true);
        setKpi(null);
        fetchKPI();
        timerRef.current = setInterval(() => fetchKPI(), POLL_INTERVAL);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [fetchKPI]);

    return {
        kpi, loading, error, lastSync, allSprints,
        forceRefresh: () => { setLoading(true); fetchKPI(true); },
    };
}
