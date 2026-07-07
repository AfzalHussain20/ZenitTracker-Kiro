"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { TestSession } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trophy, Target, TrendingUp, Lock, Loader2, Download, Users,
  CheckCircle2, XCircle, Calendar, BarChart3, ArrowRight, Clock,
  Bug, Layers, ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useRouter } from 'next/navigation';
import { format, subDays, isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MemberStats {
  uid: string;
  name: string;
  sessions: number;
  totalCases: number;
  passed: number;
  failed: number;
  na: number;
  passRate: number;
  bugsLogged: number;
  platforms: string[];
  lastActive: Date | null;
  avgDuration: string;
}

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

export default function TeamPerformancePage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [allSessions, setAllSessions] = useState<TestSession[]>([]);
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        // Fetch from both collections
        const [sessionsSnap, testSessionsSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'testSessions'), orderBy('createdAt', 'desc'))),
        ]);
        const sessions: TestSession[] = [];
        const seenIds = new Set<string>();
        [...sessionsSnap.docs, ...testSessionsSnap.docs].forEach(doc => {
          if (seenIds.has(doc.id)) return;
          seenIds.add(doc.id);
          const data = doc.data();
          sessions.push({
            id: doc.id, ...data,
            createdAt: getValidDate(data.createdAt) || new Date(),
            completedAt: getValidDate(data.completedAt),
            testCases: data.testCases || [],
          } as TestSession);
        });
        setAllSessions(sessions);
      } catch (e) { console.error('Team data fetch failed:', e); }
      finally { setIsLoading(false); }
    })();
  }, [user, authLoading]);

  // Filter sessions by date
  const filteredSessions = useMemo(() => {
    if (dateFilter === 'all') return allSessions;
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
    const cutoff = subDays(new Date(), days);
    return allSessions.filter(s => {
      const created = getValidDate(s.createdAt);
      return created && isAfter(created, cutoff);
    });
  }, [allSessions, dateFilter]);

  // Compute per-member stats
  const memberStats: MemberStats[] = useMemo(() => {
    const map = new Map<string, MemberStats>();
    filteredSessions.forEach(session => {
      const uid = session.userId;
      const name = session.userName || 'Unknown';
      if (!map.has(uid)) {
        map.set(uid, { uid, name, sessions: 0, totalCases: 0, passed: 0, failed: 0, na: 0, passRate: 0, bugsLogged: 0, platforms: [], lastActive: null, avgDuration: '—' });
      }
      const stats = map.get(uid)!;
      stats.sessions += 1;
      const cases = session.testCases || [];
      stats.totalCases += cases.length;
      stats.passed += cases.filter(tc => tc.status === 'Pass').length;
      stats.failed += cases.filter(tc => tc.status?.includes('Fail')).length;
      stats.na += cases.filter(tc => tc.status === 'N/A').length;
      stats.bugsLogged += cases.filter(tc => tc.bugId).length;
      const platform = session.platformDetails?.platformName;
      if (platform && !stats.platforms.includes(platform)) stats.platforms.push(platform);
      const created = getValidDate(session.createdAt);
      if (created && (!stats.lastActive || created > stats.lastActive)) stats.lastActive = created;
    });
    // Compute pass rates
    map.forEach(s => { s.passRate = s.totalCases > 0 ? Math.round((s.passed / s.totalCases) * 100) : 0; });
    return Array.from(map.values()).sort((a, b) => b.totalCases - a.totalCases);
  }, [filteredSessions]);

  // Totals
  const totals = useMemo(() => ({
    sessions: filteredSessions.length,
    cases: memberStats.reduce((a, m) => a + m.totalCases, 0),
    passed: memberStats.reduce((a, m) => a + m.passed, 0),
    failed: memberStats.reduce((a, m) => a + m.failed, 0),
    bugs: memberStats.reduce((a, m) => a + m.bugsLogged, 0),
    passRate: memberStats.reduce((a, m) => a + m.totalCases, 0) > 0
      ? Math.round((memberStats.reduce((a, m) => a + m.passed, 0) / memberStats.reduce((a, m) => a + m.totalCases, 0)) * 100) : 0,
  }), [filteredSessions, memberStats]);

  // Export CSV
  const exportCSV = () => {
    const rows = [['Name', 'Sessions', 'Test Cases', 'Passed', 'Failed', 'N/A', 'Pass Rate', 'Bugs Logged', 'Platforms', 'Last Active'].join(',')];
    memberStats.forEach(m => {
      rows.push([m.name, m.sessions, m.totalCases, m.passed, m.failed, m.na, `${m.passRate}%`, m.bugsLogged, `"${m.platforms.join(', ')}"`, m.lastActive ? format(m.lastActive, 'MMM dd, yyyy') : '—'].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Zenit_Team_Performance_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Loading & Auth states
  if (isLoading || authLoading) return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (userRole !== 'lead') return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
      <Lock className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-2xl font-bold">Lead Access Required</h2>
      <p className="text-muted-foreground text-center max-w-md">Team Performance is available for QA Leads only. Contact your admin to update your role.</p>
      <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Team Performance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{memberStats.length} members · {totals.sessions} sessions in period</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date filter */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(['7d', '30d', '90d', 'all'] as const).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  dateFilter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Sessions', value: totals.sessions, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Test Cases', value: totals.cases, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Pass Rate', value: `${totals.passRate}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Failed', value: totals.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
          { label: 'Bugs Filed', value: totals.bugs, icon: Bug, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4">
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
          </motion.div>
        ))}
      </div>

      {/* Chart + Table Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
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

        {/* Member Table */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Member Breakdown</CardTitle>
            <CardDescription className="text-xs">{memberStats.length} active members</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Member</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Sessions</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Cases</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Pass Rate</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Bugs</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">Platforms</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((m, i) => (
                    <tr key={m.uid} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
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
                      <td className="text-center px-3 py-3 text-sm font-semibold tabular-nums">{m.sessions}</td>
                      <td className="text-center px-3 py-3 text-sm tabular-nums">{m.totalCases}</td>
                      <td className="text-center px-3 py-3">
                        <span className={cn('text-sm font-bold tabular-nums', m.passRate >= 80 ? 'text-emerald-600' : m.passRate >= 50 ? 'text-amber-600' : 'text-red-600')}>
                          {m.passRate}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-sm tabular-nums text-red-600 font-medium">{m.bugsLogged || '—'}</td>
                      <td className="text-center px-3 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {m.platforms.slice(0, 3).map(p => (
                            <Badge key={p} variant="outline" className="text-[9px] px-1.5 py-0">{p.replace(' TV', '').replace('Mobile ', '')}</Badge>
                          ))}
                          {m.platforms.length > 3 && <span className="text-[9px] text-muted-foreground">+{m.platforms.length - 3}</span>}
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {m.lastActive ? format(m.lastActive, 'MMM dd') : '—'}
                      </td>
                    </tr>
                  ))}
                  {memberStats.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No team data available for this period</td></tr>
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
