/**
 * useJiraAnalytics Hook
 * - JQL server-side date filtering (accurate counts, no client-side slicing)
 * - Parallel fetches for current/previous month + selected range
 * - In-memory cache keyed by fetch params to avoid redundant API calls
 * - Correct open/closed/in-progress classification
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TimeRange } from '@/types/bug-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: { displayName: string; accountId: string; avatarUrl?: string } | null;
  reporter: { displayName: string; accountId: string; avatarUrl?: string } | null;
  created: string;
  updated: string;
  resolutionDate: string | null;
  platform: string | null;
  environment: string | null;
  labels: string[];
}

export interface PersonStats {
  userId: string;
  userName: string;
  totalBugs: number;
  openBugs: number;
  closedBugs: number;
  inProgressBugs: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trivial: number;
  qualityScore: number;
  rank: number;
}

export interface PeriodSummary {
  totalBugs: number;
  openBugs: number;
  closedBugs: number;
  inProgressBugs: number;
  criticalBugs: number;
  highBugs: number;
  mediumBugs: number;
  lowBugs: number;
  leaderboard: PersonStats[];
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  daily: Array<{ date: string; count: number }>;
  // Derived
  closeRate: number;   // closedBugs / totalBugs * 100
  openRate: number;    // openBugs / totalBugs * 100
}

export interface JiraAnalytics {
  overall: PeriodSummary;
  currentMonth: PeriodSummary;
  previousMonth: PeriodSummary;
  selected: PeriodSummary;
  filteredBugs: JiraIssue[];
  allTimeChampion: PersonStats | null;
  currentMonthChampion: PersonStats | null;
  previousMonthChampion: PersonStats | null;
  // Month-over-month delta
  momDelta: {
    totalBugs: number;
    openBugs: number;
    closedBugs: number;
  };
}

// ─── Status classification ────────────────────────────────────────────────────
// Jira statuses vary by project — classify by checking known patterns

const CLOSED_STATUSES = new Set([
  'done', 'closed', 'resolved', 'live', 'completed', 'fixed',
  'dev completed', 'infra completed', 'won\'t do', 'duplicate',
  'by design', 'qa verified', 'verified', 'released', 'deployed',
  'deferred', 'not reproducing', 'change', 'changed',
]);
const IN_PROGRESS_STATUSES = new Set([
  'in progress', 'inprogress', 'in development', 'testing', 'qa', 'in review',
  'code review', 'uat', 'staging', 'in qa', 'qa in progress',
  'retest', 'reopen',
]);

function classifyStatus(status: string): 'open' | 'in_progress' | 'closed' {
  const s = status.toLowerCase().trim();
  if (CLOSED_STATUSES.has(s)) return 'closed';
  if (IN_PROGRESS_STATUSES.has(s)) return 'in_progress';
  return 'open'; // to do, new, open, reopened, backlog, etc.
}

// ─── Quality score ────────────────────────────────────────────────────────────

function calcQualityScore(bugs: JiraIssue[]): number {
  const n = bugs.length;
  if (n === 0) return 0;
  // Higher score = better quality bugs (more critical/high = better QA work)
  // Penalty for trivial bugs that shouldn't be bugs
  const weights: Record<string, number> = { Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 };
  const totalWeight = bugs.reduce((s, b) => s + (weights[b.priority] ?? 3), 0);
  const maxPossible = n * 5;
  const raw = (totalWeight / maxPossible) * 100;
  // Bonus for volume (more bugs found = more thorough testing)
  const volumeBonus = Math.min(10, Math.log10(n + 1) * 5);
  return Math.max(0, Math.min(100, Math.round((raw * 0.9 + volumeBonus) * 10) / 10));
}

// ─── Build helpers ────────────────────────────────────────────────────────────

function buildLeaderboard(bugs: JiraIssue[]): PersonStats[] {
  const map = new Map<string, { userId: string; userName: string; bugs: JiraIssue[] }>();
  for (const bug of bugs) {
    if (!bug.reporter) continue;
    const id = bug.reporter.accountId;
    if (!map.has(id)) {
      map.set(id, { userId: id, userName: bug.reporter.displayName, bugs: [] });
    }
    map.get(id)!.bugs.push(bug);
  }

  return Array.from(map.values())
    .map(({ userId, userName, bugs: b }) => {
      const classified = b.map(x => classifyStatus(x.status));
      return {
        userId,
        userName,
        totalBugs: b.length,
        openBugs: classified.filter(c => c === 'open').length,
        closedBugs: classified.filter(c => c === 'closed').length,
        inProgressBugs: classified.filter(c => c === 'in_progress').length,
        critical: b.filter(x => x.priority === 'Highest').length,
        high: b.filter(x => x.priority === 'High').length,
        medium: b.filter(x => x.priority === 'Medium').length,
        low: b.filter(x => x.priority === 'Low').length,
        trivial: b.filter(x => x.priority === 'Lowest').length,
        qualityScore: calcQualityScore(b),
        rank: 0,
      };
    })
    .sort((a, b) => b.totalBugs - a.totalBugs)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function buildSummary(bugs: JiraIssue[]): PeriodSummary {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const dailyMap = new Map<string, number>();

  let open = 0, closed = 0, inProgress = 0;

  for (const b of bugs) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    byPriority[b.priority] = (byPriority[b.priority] || 0) + 1;
    const day = b.created.split('T')[0];
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
    const cls = classifyStatus(b.status);
    if (cls === 'open') open++;
    else if (cls === 'closed') closed++;
    else inProgress++;
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const n = bugs.length;
  return {
    totalBugs: n,
    openBugs: open,
    closedBugs: closed,
    inProgressBugs: inProgress,
    criticalBugs: bugs.filter(b => b.priority === 'Highest').length,
    highBugs: bugs.filter(b => b.priority === 'High').length,
    mediumBugs: bugs.filter(b => b.priority === 'Medium').length,
    lowBugs: bugs.filter(b => b.priority === 'Low').length,
    leaderboard: buildLeaderboard(bugs),
    byStatus,
    byPriority,
    daily,
    closeRate: n > 0 ? Math.round((closed / n) * 1000) / 10 : 0,
    openRate: n > 0 ? Math.round((open / n) * 1000) / 10 : 0,
  };
}

// ─── Fetch with full pagination ───────────────────────────────────────────────

// In-memory cache: key → { data, ts }
const fetchCache = new Map<string, { data: JiraIssue[]; ts: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

interface FetchParams {
  issueType?: string;   // 'Bug' | 'Story' | 'Epic' | 'Task' | undefined (all)
  createdAfter?: Date;
  createdBefore?: Date;
  status?: string;
  priority?: string;
  reporter?: string;
}

function cacheKey(params: FetchParams): string {
  return JSON.stringify({
    issueType: params.issueType ?? 'all',
    after: params.createdAfter?.toISOString().split('T')[0],
    before: params.createdBefore?.toISOString().split('T')[0],
    status: params.status ?? '',
    priority: params.priority ?? '',
    reporter: params.reporter ?? '',
  });
}

async function fetchAllIssues(params: FetchParams): Promise<JiraIssue[]> {
  const key = cacheKey(params);
  const cached = fetchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.log(`[Cache HIT] ${params.issueType ?? 'all'} → ${cached.data.length} issues`);
    return cached.data;
  }

  const all: JiraIssue[] = [];
  let nextPageToken: string | null = null;
  let page = 1;

  console.log(`[Jira] Cursor fetch: issueType=${params.issueType ?? 'Bug'}, after=${params.createdAfter?.toISOString().split('T')[0]}, before=${params.createdBefore?.toISOString().split('T')[0]}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const body: Record<string, unknown> = {
      issueType: params.issueType ?? 'Bug',
    };
    if (params.status) body.status = params.status;
    if (params.priority) body.priority = params.priority;
    if (params.reporter) body.reporterAccountId = params.reporter;
    if (params.createdAfter) body.createdAfter = params.createdAfter.toISOString();
    if (params.createdBefore) body.createdBefore = params.createdBefore.toISOString();
    if (nextPageToken) body.nextPageToken = nextPageToken;

    let data: any;
    try {
      const res = await fetch('/api/jira/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[Jira] HTTP ${res.status} on page ${page}:`, text.slice(0, 300));
        break;
      }

      data = await res.json();
    } catch (e) {
      console.error('[Jira] Network error on page', page, e);
      break;
    }

    if (data.error) {
      console.error('[Jira] API error:', data.error);
      break;
    }

    const batch: JiraIssue[] = data.issues || [];
    all.push(...batch);

    console.log(`[Jira] Page ${page}: got ${batch.length}, total so far: ${all.length}, isLast: ${data.isLast}`);

    // Cursor-based pagination: stop when isLast=true or no next token
    if (data.isLast === true || !data.nextPageToken) break;

    nextPageToken = data.nextPageToken;
    page++;

    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`[Jira] DONE: ${all.length} issues across ${page} pages`);
  fetchCache.set(key, { data: all, ts: Date.now() });
  return all;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJiraAnalytics(
  timeRange: TimeRange,
  issueType?: string,
  status?: string,
  priority?: string,
  reporter?: string
) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<JiraAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const processJiraData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const isCurrentMonth = timeRange.preset === 'current_month';
      const isPreviousMonth = timeRange.preset === 'previous_month';
      const isAllTime = timeRange.preset === 'all_time';

      const resolvedType = issueType || 'Bug';
      const baseParams: FetchParams = { issueType: resolvedType, status, priority, reporter };

      console.log(`[Analytics] issueType=${resolvedType} preset=${timeRange.preset}`);

      // Always fetch current + previous month for summary cards
      const [curIssues, prevIssues] = await Promise.all([
        fetchAllIssues({ ...baseParams, createdAfter: curMonthStart, createdBefore: curMonthEnd }),
        fetchAllIssues({ ...baseParams, createdAfter: prevMonthStart, createdBefore: prevMonthEnd }),
      ]);

      // Overall = all time (no date filter)
      const overallIssues = await fetchAllIssues(baseParams);

      // Selected range
      let selectedIssues: JiraIssue[];
      if (isCurrentMonth) selectedIssues = curIssues;
      else if (isPreviousMonth) selectedIssues = prevIssues;
      else if (isAllTime) selectedIssues = overallIssues;
      else {
        selectedIssues = await fetchAllIssues({
          ...baseParams,
          createdAfter: timeRange.start,
          createdBefore: timeRange.end,
        });
      }

      console.log('[Analytics] Counts:', {
        overall: overallIssues.length,
        currentMonth: curIssues.length,
        previousMonth: prevIssues.length,
        selected: selectedIssues.length,
      });

      const overallSummary = buildSummary(overallIssues);
      const curSummary = buildSummary(curIssues);
      const prevSummary = buildSummary(prevIssues);
      const selectedSummary = buildSummary(selectedIssues);

      setAnalytics({
        overall: overallSummary,
        currentMonth: curSummary,
        previousMonth: prevSummary,
        selected: selectedSummary,
        filteredBugs: selectedIssues,
        allTimeChampion: overallSummary.leaderboard[0] ?? null,
        currentMonthChampion: curSummary.leaderboard[0] ?? null,
        previousMonthChampion: prevSummary.leaderboard[0] ?? null,
        momDelta: {
          totalBugs: curSummary.totalBugs - prevSummary.totalBugs,
          openBugs: curSummary.openBugs - prevSummary.openBugs,
          closedBugs: curSummary.closedBugs - prevSummary.closedBugs,
        },
      });
    } catch (err) {
      const e = err as Error;
      if (e.name === 'AbortError') return;
      setError(e);
      toast({ title: 'Analytics Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [timeRange, issueType, status, priority, reporter, toast]);

  useEffect(() => {
    processJiraData();
    return () => abortRef.current?.abort();
  }, [processJiraData]);

  return {
    analytics,
    loading,
    error,
    refetch: () => {
      fetchCache.clear();
      console.log('[Analytics] Cache cleared — refetching fresh data');
      processJiraData();
    },
  };
}
