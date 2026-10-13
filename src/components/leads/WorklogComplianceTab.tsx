"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, RefreshCw, Users, AlertCircle, Trophy, CalendarClock, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PersonKPI } from '@/hooks/useJiraKPI';
import type { Task } from '@/types';
import {
  buildHoursByName, complianceFor, COMPLIANCE_STYLE, downloadCsv, fmtHours,
  formatDate, getAvatarBg, getWorkBadge, type ComplianceStatus,
  type WorklogEntry, type WorklogUser,
} from './shared';

interface Props {
  people: PersonKPI[];
  byUser: WorklogUser[];
  worklogs: WorklogEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  tasks: Task[];
  periodDays: number;
  onLogWork: (name: string) => void;
}

interface Row {
  userId: string;
  name: string;
  team: string;
  hours: number;
  logs: number;
  issues: number;
  lastLog: string | null;
  status: ComplianceStatus;
}

const norm = (s: string) => s.toLowerCase().trim();

export function WorklogComplianceTab({
  people, byUser, worklogs, loading, error, onRefresh, tasks, periodDays, onLogWork,
}: Props) {
  const [team, setTeam] = useState('all');
  const [member, setMember] = useState('all');

  const allTeams = useMemo(
    () => Array.from(new Set(people.flatMap(p => p.teams))).sort(),
    [people],
  );

  const rows: Row[] = useMemo(() => {
    const hoursByName = buildHoursByName(byUser);
    const logsByName = new Map<string, number>();
    const issuesByName = new Map<string, Set<string>>();
    const lastByName = new Map<string, string>();
    byUser.forEach(u => {
      const k = norm(u.author);
      logsByName.set(k, (logsByName.get(k) || 0) + u.logCount);
      if (!issuesByName.has(k)) issuesByName.set(k, new Set());
    });
    worklogs.forEach(w => {
      const k = norm(w.author);
      if (w.issueKey) issuesByName.get(k)?.add(w.issueKey);
      if (w.started && (!lastByName.has(k) || w.started > lastByName.get(k)!)) lastByName.set(k, w.started);
    });

    let roster = people;
    if (team !== 'all') roster = roster.filter(p => p.teams.includes(team));
    if (member !== 'all') roster = roster.filter(p => p.userId === member);

    return roster.map(p => {
      const k = norm(p.name);
      const hours = Math.round((hoursByName.get(k) || 0) * 10) / 10;
      return {
        userId: p.userId,
        name: p.name,
        team: p.teams[0] || '—',
        hours,
        logs: logsByName.get(k) || 0,
        issues: issuesByName.get(k)?.size || 0,
        lastLog: lastByName.get(k) || null,
        status: complianceFor(hours, periodDays),
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [people, byUser, worklogs, team, member, periodDays]);

  const scoped = useMemo(() => {
    let roster = people;
    if (team !== 'all') roster = roster.filter(p => p.teams.includes(team));
    if (member !== 'all') roster = roster.filter(p => p.userId === member);
    return roster;
  }, [people, team, member]);

  const missing = useMemo(() => {
    const hours = new Set(rows.filter(r => r.hours > 0).map(r => norm(r.name)));
    return scoped.filter(p => !hours.has(norm(p.name))).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, scoped]);

  const membersWithoutLogs = useMemo(
    () => new Set(missing.map(p => norm(p.name))),
    [missing],
  );

  // Tasks owned by a member who logged nothing this period (excluding done).
  const tasksNeedingLogs = useMemo(() => {
    const names = membersWithoutLogs;
    return tasks
      .filter(t => t.status !== 'Done' && names.has(norm(t.assignedToName)))
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [tasks, membersWithoutLogs]);

  const totalHours = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  const onTrack = rows.filter(r => r.status === 'On track').length;
  const compliancePct = rows.length > 0 ? Math.round((onTrack / rows.length) * 100) : 100;

  const exportCsv = () => {
    const heading = `Worklog Compliance — last ${periodDays} days${team !== 'all' ? ` · ${team}` : ''}`;
    const rowsCsv: (string | number)[][] = [
      [heading],
      ['Member', 'Team', 'Hours Logged', 'Logs', 'Issues', 'Last Log', 'Status'],
      ...rows.map(r => [r.name, r.team, r.hours, r.logs, r.issues, r.lastLog ? formatDate(r.lastLog) : '—', r.status]),
    ];
    downloadCsv(`Zenit_Worklog_Compliance_${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={team} onValueChange={v => { setTeam(v); setMember('all'); }}>
          <SelectTrigger className={cn('w-40 h-9 text-xs', team !== 'all' && 'border-primary font-medium')}>
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger className={cn('w-48 h-9 text-xs', member !== 'all' && 'border-primary font-medium')}>
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {scoped.map(p => <SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 ml-auto" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Hours Logged', value: fmtHours(totalHours), icon: Clock, color: 'text-cyan-600' },
          { label: 'Contributors', value: `${rows.filter(r => r.hours > 0).length}/${rows.length}`, icon: Users, color: 'text-blue-600' },
          { label: 'Missing Logs', value: missing.length, icon: AlertCircle, color: 'text-amber-600' },
          { label: 'Compliance', value: `${compliancePct}%`, icon: Trophy, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
            </div>
            <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
          </CardContent></Card>
        ))}
      </div>

      {error && !loading && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Could not load worklogs</div>
              <div className="text-xs text-muted-foreground mt-0.5">{error}</div>
            </div>
            <Button size="sm" variant="outline" onClick={onRefresh}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Missing loggers */}
      {!loading && missing.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                No worklogs in the last {periodDays} days
              </span>
              <span className="text-xs text-muted-foreground">({missing.length}{team !== 'all' ? ` · ${team}` : ''})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {missing.map(p => (
                <span key={p.userId} className="inline-flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 pl-2.5 pr-1 py-1 rounded-full">
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getAvatarBg(p.name))}>
                    {p.name.charAt(0)}
                  </span>
                  {p.name}
                  <button onClick={() => onLogWork(p.name)} title={`Log work for ${p.name}`}
                    className="inline-flex items-center gap-0.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer">
                    <Clock className="w-2.5 h-2.5" />Log
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks awaiting worklogs */}
      {!loading && tasksNeedingLogs.length > 0 && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                Assigned tasks with no worklog
              </span>
              <span className="text-xs text-muted-foreground">({tasksNeedingLogs.length})</span>
            </div>
            <div className="space-y-1.5">
              {tasksNeedingLogs.slice(0, 10).map(t => {
                const overdue = t.dueDate ? new Date(t.dueDate) < new Date() : false;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg bg-card border border-border/60 px-3 py-2 text-xs">
                    <span className="flex-1 font-medium truncate">{t.title}</span>
                    <span className="text-muted-foreground shrink-0">{t.assignedToName}</span>
                    {t.dueDate && (
                      <span className={cn('shrink-0 inline-flex items-center gap-1', overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                        <CalendarClock className="w-3 h-3" />{formatDate(t.dueDate, 'MMM d')}
                      </span>
                    )}
                    <button onClick={() => onLogWork(t.assignedToName)}
                      className="shrink-0 text-[10px] text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg border border-primary/20 font-medium transition-colors">
                      Log Work
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Member</th>
                  <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">Team</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Hours</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Logs</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">Issues</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">Last Log</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-60" />Fetching worklogs…
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No members for this filter</td></tr>
                ) : rows.map(r => {
                  const badge = getWorkBadge(r.hours);
                  return (
                    <tr key={r.userId} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', getAvatarBg(r.name))}>
                            {r.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium', badge.bg, badge.color)}>{badge.label}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{r.team}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">{fmtHours(r.hours)}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums">{r.logs || '—'}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums hidden md:table-cell">{r.issues || '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs text-muted-foreground hidden lg:table-cell">{r.lastLog ? formatDate(r.lastLog, 'MMM d') : '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border', COMPLIANCE_STYLE[r.status])}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => onLogWork(r.name)}
                          className="text-[10px] text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg border border-primary/20 font-medium transition-colors">
                          Log Work
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
