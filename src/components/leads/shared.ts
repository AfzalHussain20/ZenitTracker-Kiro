/**
 * Shared helpers + types for the Leads Portal tabs.
 */

import type { PersonKPI } from '@/hooks/useJiraKPI';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemberStats {
  uid: string;
  name: string;
  sessions: number;
  completedSessions: number;
  totalCases: number;
  passed: number;
  failed: number;
  na: number;
  passRate: number;
  bugsLogged: number;
  platforms: string[];
  lastActive: Date | null;
  avgCasesPerSession: number;
  completionRate: number;
  productivityScore: number;
  activeDays: number;
}

export interface MemberTaskStats {
  uid: string;
  name: string;
  total: number;
  pending: number;
  inProgress: number;
  done: number;
  blocked: number;
  overdue: number;
}

export interface WorklogEntry {
  issueKey: string;
  issueUrl?: string;
  author: string;
  authorId: string;
  timeSpentSeconds: number;
  timeSpent: string;
  started: string;
  comment?: string;
}

export interface WorklogUser {
  authorId: string;
  author: string;
  totalSeconds: number;
  totalHours: number;
  logCount: number;
  issueCount: number;
}

export interface WorklogData {
  worklogs: WorklogEntry[];
  byUser: WorklogUser[];
  totalIssuesWithLogs: number;
  syncedAt: string;
  fromCache: boolean;
}

export type ComplianceStatus = 'On track' | 'Light' | 'Missing';

// ─── Visual helpers ───────────────────────────────────────────────────────────

export const AVATAR_PALETTE = [
  'bg-rose-500', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-amber-500', 'bg-cyan-600', 'bg-pink-600', 'bg-indigo-600',
];

export function getAvatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export const WORK_BADGES = [
  { min: 40, label: 'On Fire', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/30' },
  { min: 30, label: 'Power User', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30' },
  { min: 20, label: 'Hard Worker', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/30' },
  { min: 10, label: 'Active', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/30' },
  { min: 0, label: 'Getting Started', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/30' },
];

export function getWorkBadge(h: number) {
  return WORK_BADGES.find(b => h >= b.min) || WORK_BADGES[WORK_BADGES.length - 1];
}

export const fmtHours = (h: number) => `${Math.round(h * 10) / 10}h`;

export const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 365 days' },
];

export function formatDate(d: Date | string | null | undefined, fmt = 'MMM dd, yyyy'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// ─── Worklog / roster mapping ─────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().trim();

/** Map of lowercased member name → total hours logged (in the selected period). */
export function buildHoursByName(byUser: WorklogUser[]): Map<string, number> {
  const m = new Map<string, number>();
  byUser.forEach(u => m.set(norm(u.author), (m.get(norm(u.author)) || 0) + u.totalHours));
  return m;
}

export function complianceFor(hours: number, days: number): ComplianceStatus {
  if (hours <= 0) return 'Missing';
  if (hours < days * 0.5) return 'Light';
  return 'On track';
}

export const COMPLIANCE_STYLE: Record<ComplianceStatus, string> = {
  'On track': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'Light': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'Missing': 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

export interface MissingLogger {
  person: PersonKPI;
  hours: number;
}

/** Members on the roster (optionally scoped to a team) with zero hours logged. */
export function findMissingLoggers(
  people: PersonKPI[],
  byUser: WorklogUser[],
  team: string,
): MissingLogger[] {
  const hoursByName = buildHoursByName(byUser);
  const roster = team === 'all' ? people : people.filter(p => p.teams.includes(team));
  return roster
    .filter(p => (hoursByName.get(norm(p.name)) || 0) <= 0)
    .map(p => ({ person: p, hours: 0 }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
