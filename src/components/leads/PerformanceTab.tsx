"use client";

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target, CheckCircle2, XCircle, Bug, Layers, Users,
  BarChart3, ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TestSession } from '@/types';
import { downloadCsv, formatDate, type MemberStats } from './shared';

interface Props {
  memberStats: MemberStats[];
  filteredSessions: TestSession[];
  totals: { sessions: number; cases: number; passed: number; failed: number; bugs: number; passRate: number };
  periodDays: number;
}

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

export function PerformanceTab({ memberStats, filteredSessions, totals, periodDays }: Props) {
  const router = useRouter();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const kpis = useMemo(() => [
    { label: 'Sessions', value: totals.sessions, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Test Cases', value: totals.cases, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: 'Pass Rate', value: `${totals.passRate}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Failed', value: totals.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
    { label: 'Bugs Filed', value: totals.bugs, icon: Bug, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  ], [totals]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [`Team Performance — last ${periodDays} days`],
      ['Name', 'Score', 'Sessions', 'Test Cases', 'Passed', 'Failed', 'N/A', 'Pass Rate', 'Bugs Logged', 'Platforms', 'Last Active'],
      ...memberStats.map(m => [
        m.name, m.productivityScore, m.sessions, m.totalCases, m.passed, m.failed, m.na,
        `${m.passRate}%`, m.bugsLogged, m.platforms.join(', '), m.lastActive ? formatDate(m.lastActive) : '—',
      ]),
    ];
    downloadCsv(`Zenit_Team_Performance_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', kpi.bg)}>
                <kpi.icon className={cn('w-4 h-4', kpi.color)} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold tabular-nums">{kpi.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Test Cases by Member</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberStats.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Bar dataKey="passed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Member Breakdown</CardTitle>
              <CardDescription className="text-xs">{memberStats.length} active members</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs">Export</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Member</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Score</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Sessions</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Cases</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Pass%</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Bugs</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">Active Days</th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((m, i) => {
                    const isExpanded = selectedMember === m.uid;
                    const memberSessions = isExpanded ? filteredSessions.filter(s => s.userId === m.uid).slice(0, 10) : [];
                    return (
                      <React.Fragment key={m.uid}>
                        <tr onClick={() => setSelectedMember(isExpanded ? null : m.uid)}
                          className={cn('border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer', isExpanded && 'bg-primary/5')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{m.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{m.name}</p>
                                {i === 0 && <Badge className="text-[8px] bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 px-1 py-0">Top</Badge>}
                              </div>
                            </div>
                          </td>
                          <td className="text-center px-2 py-3">
                            <div className="flex items-center justify-center">
                              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold',
                                m.productivityScore >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                                m.productivityScore >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
                                'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                              )}>{m.productivityScore}</div>
                            </div>
                          </td>
                          <td className="text-center px-2 py-3 text-sm font-semibold tabular-nums">{m.sessions}</td>
                          <td className="text-center px-2 py-3 text-sm tabular-nums">{m.totalCases}</td>
                          <td className="text-center px-2 py-3">
                            <span className={cn('text-sm font-bold tabular-nums', m.passRate >= 80 ? 'text-emerald-600' : m.passRate >= 50 ? 'text-amber-600' : 'text-red-600')}>
                              {m.passRate}%
                            </span>
                          </td>
                          <td className="text-center px-2 py-3 text-sm tabular-nums text-red-600 font-medium">{m.bugsLogged || '—'}</td>
                          <td className="text-center px-2 py-3 text-xs text-muted-foreground hidden lg:table-cell">{m.activeDays}d</td>
                          <td className="text-center px-2 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {m.platforms.slice(0, 2).map(p => (
                                <Badge key={p} variant="outline" className="text-[8px] px-1 py-0">{p.replace(' TV', '').replace('Mobile ', '')}</Badge>
                              ))}
                              {m.platforms.length > 2 && <span className="text-[8px] text-muted-foreground">+{m.platforms.length - 2}</span>}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && memberSessions.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-3 bg-muted/20">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Sessions by {m.name}</p>
                                {memberSessions.map(s => {
                                  const summary = s.summary || { pass: 0, fail: 0, na: 0, total: 0, untested: 0, failKnown: 0 };
                                  const rate = summary.total > 0 ? Math.round((summary.pass / summary.total) * 100) : 0;
                                  const created = getValidDate(s.createdAt);
                                  return (
                                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border/50 text-xs">
                                      <span className="font-medium text-foreground truncate flex-1">{s.platformDetails?.platformName || 'Unknown'}</span>
                                      <span className="text-emerald-600 font-semibold">{summary.pass}P</span>
                                      <span className="text-red-600 font-semibold">{summary.fail}F</span>
                                      <span className={cn('font-bold', rate >= 80 ? 'text-emerald-600' : 'text-amber-600')}>{rate}%</span>
                                      <Badge variant="outline" className="text-[9px]">{s.status}</Badge>
                                      <span className="text-muted-foreground">{created ? format(created, 'MMM dd') : '—'}</span>
                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/session/${s.id}/results`); }}>
                                        View <ArrowRight className="w-3 h-3 ml-1" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {memberStats.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No team data available for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
