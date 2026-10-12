'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Clock, RefreshCw, Timer, Users, AlertCircle, ChevronRight, Flame,
    Trophy, ArrowUpRight, Link2, Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJiraKPI, type PersonKPI } from '@/hooks/useJiraKPI';
import { LogWorkDialog } from '@/components/worklog/LogWorkDialog';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkLogEntry {
    issueKey: string;
    issueUrl?: string;
    author: string;
    authorId: string;
    timeSpentSeconds: number;
    timeSpent: string;
    started: string;
    comment?: string;
}
interface WorklogUser {
    authorId: string;
    author: string;
    totalSeconds: number;
    totalHours: number;
    logCount: number;
    issueCount: number;
}
interface WorkLogData {
    worklogs: WorkLogEntry[];
    byUser: WorklogUser[];
    totalIssuesWithLogs: number;
    syncedAt: string;
    fromCache: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
    'bg-rose-500', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-amber-500', 'bg-cyan-600', 'bg-pink-600', 'bg-indigo-600',
];
function getAvatarBg(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
const WORK_BADGES = [
    { min: 40, label: 'On Fire', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/30' },
    { min: 30, label: 'Power User', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30' },
    { min: 20, label: 'Hard Worker', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/30' },
    { min: 10, label: 'Active', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/30' },
    { min: 0, label: 'Getting Started', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/30' },
];
function getWorkBadge(h: number) {
    return WORK_BADGES.find(b => h >= b.min) || WORK_BADGES[WORK_BADGES.length - 1];
}
const fmtHours = (h: number) => `${Math.round(h * 10) / 10}h`;

const RANGE_OPTIONS = [
    { value: '7', label: 'Last 7 days' },
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '60', label: 'Last 60 days' },
    { value: '90', label: 'Last 90 days' },
    { value: '180', label: 'Last 180 days' },
    { value: '365', label: 'Last 365 days' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WrklogPage() {
    const { kpi, loading: kpiLoading } = useJiraKPI();
    const kpiPeople = kpi?.people ?? [];
    const allIssues = kpi?.all ?? [];

    const [data, setData] = useState<WorkLogData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState('30');
    const [team, setTeam] = useState('all');
    const [member, setMember] = useState('all');
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [logWorkOpen, setLogWorkOpen] = useState(false);
    const [logWorkPerson, setLogWorkPerson] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/jira/worklogs?days=${days}`);
            const json = await res.json();
            if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
            setData(json as WorkLogData);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setMember('all'); }, [team]);

    const openLogWork = (personName = '') => { setLogWorkPerson(personName); setLogWorkOpen(true); };

    const issueOptions = useMemo(
        () => allIssues.map(i => ({ key: i.key, summary: i.summary })),
        [allIssues],
    );

    const nameToPerson = useMemo(() => {
        const m = new Map<string, PersonKPI>();
        kpiPeople.forEach(p => m.set(p.name.toLowerCase().trim(), p));
        return m;
    }, [kpiPeople]);

    const idToPerson = useMemo(() => {
        const m = new Map<string, PersonKPI>();
        kpiPeople.forEach(p => m.set(p.userId, p));
        return m;
    }, [kpiPeople]);

    const getPersonForUser = (u: { authorId: string; author: string }): PersonKPI | null =>
        idToPerson.get(u.authorId) || nameToPerson.get(u.author.toLowerCase().trim()) || null;

    const teamMemberKeys = useMemo(() => {
        if (team === 'all') return null;
        const members = kpiPeople.filter(p => p.teams.includes(team));
        return {
            ids: new Set(members.map(p => p.userId)),
            names: new Set(members.map(p => p.name.toLowerCase().trim())),
        };
    }, [kpiPeople, team]);

    const missedLoggers = useMemo(() => {
        if (!data || team === 'all') return [];
        const members = kpiPeople.filter(p => p.teams.includes(team));
        const loggedIds = new Set(data.byUser.map(u => u.authorId));
        const loggedNames = new Set(data.byUser.map(u => u.author.toLowerCase().trim()));
        return members.filter(p => !loggedIds.has(p.userId) && !loggedNames.has(p.name.toLowerCase().trim()));
    }, [data, kpiPeople, team]);

    const filteredUsers = useMemo(() => {
        if (!data) return [];
        let users = data.byUser;
        if (member !== 'all') {
            const person = idToPerson.get(member);
            users = users.filter(u => u.authorId === member || (person && u.author.toLowerCase().trim() === person.name.toLowerCase().trim()));
        } else if (team !== 'all' && teamMemberKeys) {
            users = users.filter(u => teamMemberKeys.ids.has(u.authorId) || teamMemberKeys.names.has(u.author.toLowerCase().trim()));
        }
        return users;
    }, [data, member, team, teamMemberKeys, idToPerson]);

    const peakIssues = (authorId: string) => {
        if (!data) return [];
        const logs = data.worklogs.filter(w => w.authorId === authorId);
        const map = new Map<string, { key: string; url?: string; seconds: number }>();
        logs.forEach(w => {
            const e = map.get(w.issueKey) || { key: w.issueKey, url: w.issueUrl, seconds: 0 };
            e.seconds += w.timeSpentSeconds;
            map.set(w.issueKey, e);
        });
        return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds).slice(0, 6);
    };

    const allTeams = useMemo(
        () => Array.from(new Set(kpiPeople.flatMap(p => p.teams))).sort(),
        [kpiPeople],
    );
    const allMembers = team !== 'all' ? kpiPeople.filter(p => p.teams.includes(team)) : kpiPeople;

    const totalHours = Math.round(filteredUsers.reduce((s, u) => s + u.totalHours, 0) * 10) / 10;
    const totalIssues = filteredUsers.reduce((s, u) => s + u.issueCount, 0);
    const topUser = filteredUsers[0];
    const teamSize = team !== 'all' ? kpiPeople.filter(p => p.teams.includes(team)).length : null;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-blue-500/10 to-purple-500/15 border border-primary/30 p-6">
                <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Wrklog</h1>
                                <p className="text-sm text-muted-foreground">
                                    {loading ? 'Loading Jira worklogs...'
                                        : data
                                            ? `${filteredUsers.length} contributor${filteredUsers.length === 1 ? '' : 's'} · ${fmtHours(totalHours)} logged in the last ${days} days`
                                            : 'Time logged on Jira issues, by person'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger className="w-36 h-9 text-xs bg-background/80"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={load} disabled={loading} variant="outline" className="h-9 text-xs gap-1.5 bg-background/80">
                                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                                Refresh
                            </Button>
                            <Button onClick={() => openLogWork()} className="h-9 text-xs gap-1.5 shadow-lg">
                                <Timer className="w-3.5 h-3.5" />
                                Log Work
                            </Button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-white/20">
                        <Select value={team} onValueChange={setTeam} disabled={kpiLoading}>
                            <SelectTrigger className={cn('w-40 h-8 text-xs bg-background/80', team !== 'all' && 'border-primary font-medium')}>
                                <SelectValue placeholder="All teams" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All teams</SelectItem>
                                {allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={member} onValueChange={setMember}>
                            <SelectTrigger className={cn('w-48 h-8 text-xs bg-background/80', member !== 'all' && 'border-primary font-medium')}>
                                <SelectValue placeholder="All members" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All members</SelectItem>
                                {allMembers.map(p => <SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {(team !== 'all' || member !== 'all') && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => { setTeam('all'); setMember('all'); }}>
                                Clear
                            </Button>
                        )}
                        <Link href="/profile" className="ml-auto text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Link your Jira account
                        </Link>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl" />
            </div>

            {/* Error */}
            {error && !loading && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="p-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                        <div className="flex-1">
                            <div className="font-semibold text-sm">Could not load worklogs</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{error}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {loading && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-primary opacity-60" />
                        <div className="text-sm font-medium">Fetching worklogs from Jira...</div>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && data && (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Hours Logged', value: fmtHours(totalHours), icon: Clock, color: 'text-blue-600' },
                            { label: 'Contributors', value: String(filteredUsers.length), icon: Users, color: 'text-green-600' },
                            { label: 'Issues Worked', value: String(totalIssues), icon: Hourglass, color: 'text-violet-600' },
                            { label: 'Top Contributor', value: topUser?.author || '—', icon: Trophy, color: 'text-amber-600' },
                        ].map((s, i) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                <Card><CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <s.icon className={cn('w-4 h-4', s.color)} />
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
                                    </div>
                                    <div className={cn('text-xl font-bold truncate', s.color)}>{s.value}</div>
                                </CardContent></Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Missed loggers */}
                    {missedLoggers.length > 0 && (
                        <Card className="border-amber-500/40 bg-amber-500/5">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-700">
                                        No logs recorded — {team} ({missedLoggers.length}{teamSize ? ` of ${teamSize}` : ''})
                                    </span>
                                    <span className="text-xs text-muted-foreground">no worklogs in the last {days} days</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {missedLoggers.map(p => (
                                        <span key={p.userId} className="inline-flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 pl-2.5 pr-1 py-1 rounded-full">
                                            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getAvatarBg(p.name))}>
                                                {p.name.charAt(0)}
                                            </span>
                                            {p.name}
                                            <button onClick={() => openLogWork(p.name)} title={`Log work for ${p.name}`}
                                                className="inline-flex items-center gap-0.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-900 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer">
                                                <Clock className="w-2.5 h-2.5" />Log
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty */}
                    {filteredUsers.length === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="py-14 text-center">
                                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <div className="font-semibold text-muted-foreground">No worklogs found</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {team !== 'all'
                                        ? <>No member of <strong>{team}</strong> logged work in the last {days} days</>
                                        : <>Nobody logged work in the last {days} days</>}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Leaderboard */}
                    {filteredUsers.length > 0 && (
                        <div className="space-y-2">
                            {filteredUsers.map((user, idx) => {
                                const badge = getWorkBadge(user.totalHours);
                                const isExpanded = expandedUser === user.authorId;
                                const peak = isExpanded ? peakIssues(user.authorId) : [];
                                const person = getPersonForUser(user);
                                const medals = ['#1', '#2', '#3'];
                                return (
                                    <Card key={user.authorId} className={cn('transition-all hover:shadow-md', isExpanded && 'ring-1 ring-primary/30')}>
                                        <CardContent className="p-0">
                                            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : user.authorId)}>
                                                <span className="text-base font-bold text-muted-foreground w-7 text-center shrink-0">{idx < 3 ? medals[idx] : `#${idx + 1}`}</span>
                                                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', getAvatarBg(user.author))}>
                                                    {user.author.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm">{user.author}</span>
                                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', badge.bg, badge.color)}>{badge.label}</span>
                                                        {person && person.teams.length > 0 && (
                                                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{person.teams[0]}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">{user.logCount} logs · {user.issueCount} issues</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button onClick={e => { e.stopPropagation(); openLogWork(user.author); }}
                                                        className="text-[10px] text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg border border-primary/20 transition-colors font-medium">
                                                        Log Work
                                                    </button>
                                                    <div className="text-right">
                                                        <div className={cn('text-lg font-bold', badge.color)}>{fmtHours(user.totalHours)}</div>
                                                        <div className="text-[10px] text-muted-foreground">logged</div>
                                                    </div>
                                                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-3 border-t border-border/50">
                                                    {peak.length > 0 ? (
                                                        <>
                                                            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                                <Flame className="w-3 h-3 text-amber-500" /> Top issues by time spent
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {peak.map(issue => (
                                                                    <div key={issue.key} className="flex items-center gap-2">
                                                                        {issue.url ? (
                                                                            <a href={issue.url} target="_blank" rel="noopener noreferrer"
                                                                                className="text-xs font-mono text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 hover:bg-blue-500/20 shrink-0 inline-flex items-center gap-1">
                                                                                {issue.key}<ArrowUpRight className="w-3 h-3" />
                                                                            </a>
                                                                        ) : (
                                                                            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{issue.key}</span>
                                                                        )}
                                                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(issue.seconds / peak[0].seconds) * 100}%` }} />
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground shrink-0">{fmtHours(issue.seconds / 3600)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground">No detailed log data available</div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {data.fromCache && (
                        <p className="text-[11px] text-muted-foreground text-center">
                            Synced {new Date(data.syncedAt).toLocaleString()} · served from cache
                        </p>
                    )}
                </>
            )}

            <LogWorkDialog
                open={logWorkOpen}
                onOpenChange={setLogWorkOpen}
                loggedForName={logWorkPerson}
                issues={issueOptions}
                onLogged={load}
            />
        </div>
    );
}
