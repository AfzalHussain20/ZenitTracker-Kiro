"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import type { TestSession, Task } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Lock, Loader2, RefreshCw, LayoutDashboard, Clock, FileText, BarChart3,
} from 'lucide-react';
import { subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useJiraKPI } from '@/hooks/useJiraKPI';
import { LogWorkDialog, type IssueOption } from '@/components/worklog/LogWorkDialog';
import { LeadsOverviewTab } from '@/components/leads/LeadsOverviewTab';
import { WorklogComplianceTab } from '@/components/leads/WorklogComplianceTab';
import { TestReportTab } from '@/components/leads/TestReportTab';
import { PerformanceTab } from '@/components/leads/PerformanceTab';
import {
  PERIOD_OPTIONS, buildHoursByName, findMissingLoggers,
  type MemberStats, type WorklogData,
} from '@/components/leads/shared';

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

const norm = (s: string) => s.toLowerCase().trim();

export default function LeadsPortalPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [allSessions, setAllSessions] = useState<TestSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [period, setPeriod] = useState('30');
  const [tab, setTab] = useState('overview');

  const [worklogData, setWorklogData] = useState<WorklogData | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logPerson, setLogPerson] = useState('');

  const { kpi, loading: kpiLoading } = useJiraKPI();
  const people = useMemo(() => kpi?.people ?? [], [kpi]);

  const periodDays = Number(period);
  const isLead = userRole === 'lead';

  // ── Sessions ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      setIsLoadingSessions(true);
      try {
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
      } catch (e) { console.error('Leads portal session fetch failed:', e); }
      finally { setIsLoadingSessions(false); }
    })();
  }, [user, authLoading]);

  // ── Tasks (lead only) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLead || !user) return;
    const unsub = onSnapshot(
      query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
      snap => setTasks(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: getValidDate(data.createdAt) || new Date(),
          updatedAt: getValidDate(data.updatedAt) || new Date(),
        } as Task;
      })),
      () => {},
    );
    return () => unsub();
  }, [isLead, user]);

  // ── Worklogs ──────────────────────────────────────────────────────────────
  const loadWorklogs = useCallback(async () => {
    setWlLoading(true);
    setWlError(null);
    try {
      const res = await fetch(`/api/jira/worklogs?days=${periodDays}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setWorklogData(json as WorklogData);
    } catch (e) {
      setWlError((e as Error).message);
    } finally {
      setWlLoading(false);
    }
  }, [periodDays]);

  useEffect(() => { loadWorklogs(); }, [loadWorklogs]);

  const openLogWork = (name = '') => { setLogPerson(name); setLogOpen(true); };

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    if (!periodDays) return allSessions;
    const cutoff = subDays(new Date(), periodDays);
    return allSessions.filter(s => {
      const created = getValidDate(s.createdAt);
      return created && isAfter(created, cutoff);
    });
  }, [allSessions, periodDays]);

  const memberStats: MemberStats[] = useMemo(() => {
    const map = new Map<string, MemberStats>();
    filteredSessions.forEach(session => {
      const uid = session.userId;
      const name = session.userName || 'Unknown';
      if (!map.has(uid)) {
        map.set(uid, { uid, name, sessions: 0, completedSessions: 0, totalCases: 0, passed: 0, failed: 0, na: 0, passRate: 0, bugsLogged: 0, platforms: [], lastActive: null, avgCasesPerSession: 0, completionRate: 0, productivityScore: 0, activeDays: 0 });
      }
      const stats = map.get(uid)!;
      stats.sessions += 1;
      if (session.status === 'Completed') stats.completedSessions += 1;
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

    map.forEach(s => {
      s.passRate = s.totalCases > 0 ? Math.round((s.passed / s.totalCases) * 100) : 0;
      s.avgCasesPerSession = s.sessions > 0 ? Math.round(s.totalCases / s.sessions) : 0;
      s.completionRate = s.sessions > 0 ? Math.round((s.completedSessions / s.sessions) * 100) : 0;
      s.productivityScore = Math.min(100, Math.round(
        (s.totalCases * 0.3) + (s.passRate * 0.4) + (s.completionRate * 0.3)
      ));
      const dates = new Set<string>();
      filteredSessions.filter(sess => sess.userId === s.uid).forEach(sess => {
        const d = getValidDate(sess.createdAt);
        if (d) dates.add(d.toISOString().split('T')[0]);
      });
      s.activeDays = dates.size;
    });

    return Array.from(map.values()).sort((a, b) => b.productivityScore - a.productivityScore);
  }, [filteredSessions]);

  const totals = useMemo(() => ({
    sessions: filteredSessions.length,
    cases: memberStats.reduce((a, m) => a + m.totalCases, 0),
    passed: memberStats.reduce((a, m) => a + m.passed, 0),
    failed: memberStats.reduce((a, m) => a + m.failed, 0),
    bugs: memberStats.reduce((a, m) => a + m.bugsLogged, 0),
    passRate: memberStats.reduce((a, m) => a + m.totalCases, 0) > 0
      ? Math.round((memberStats.reduce((a, m) => a + m.passed, 0) / memberStats.reduce((a, m) => a + m.totalCases, 0)) * 100) : 0,
  }), [filteredSessions, memberStats]);

  const byUser = useMemo(() => worklogData?.byUser ?? [], [worklogData]);
  const worklogs = useMemo(() => worklogData?.worklogs ?? [], [worklogData]);
  const hoursByName = useMemo(() => buildHoursByName(byUser), [byUser]);
  const hoursLogged = useMemo(
    () => Math.round(byUser.reduce((s, u) => s + u.totalHours, 0) * 10) / 10,
    [byUser],
  );
  const missingLoggers = useMemo(() => findMissingLoggers(people, byUser, 'all'), [people, byUser]);
  const compliancePct = useMemo(() => {
    if (people.length === 0) return 100;
    const withLogs = people.filter(p => (hoursByName.get(norm(p.name)) || 0) > 0).length;
    return Math.round((withLogs / people.length) * 100);
  }, [people, hoursByName]);

  const openTasks = useMemo(() => tasks.filter(t => t.status !== 'Done').length, [tasks]);
  const overdueTasks = useMemo(
    () => tasks.filter(t => t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    [tasks],
  );

  const issueOptions: IssueOption[] = useMemo(
    () => (kpi?.all ?? []).map(i => ({ key: i.key, summary: i.summary })),
    [kpi],
  );

  const refreshAll = () => { loadWorklogs(); };

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (authLoading || isLoadingSessions) return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!isLead) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
      <Lock className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-2xl font-bold">Lead Access Required</h2>
      <p className="text-muted-foreground text-center max-w-md">The Leads Portal is available for QA Leads only. Contact your admin to update your role.</p>
      <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Leads Portal</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {memberStats.length} member{memberStats.length === 1 ? '' : 's'} · {totals.sessions} sessions · last {periodDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={refreshAll} disabled={wlLoading}>
            <RefreshCw className={cn('w-3.5 h-3.5', wlLoading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="worklog" className="text-xs gap-1.5"><Clock className="w-3.5 h-3.5" />Worklog Compliance</TabsTrigger>
          <TabsTrigger value="report" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Test Report</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <LeadsOverviewTab
            memberStats={memberStats}
            totals={totals}
            hoursLogged={hoursLogged}
            compliancePct={compliancePct}
            missingLoggers={missingLoggers}
            openTasks={openTasks}
            overdueTasks={overdueTasks}
            periodDays={periodDays}
            onViewWorklog={() => setTab('worklog')}
            onLogWork={openLogWork}
          />
        </TabsContent>

        <TabsContent value="worklog">
          <WorklogComplianceTab
            people={people}
            byUser={byUser}
            worklogs={worklogs}
            loading={wlLoading || kpiLoading}
            error={wlError}
            onRefresh={refreshAll}
            tasks={tasks}
            periodDays={periodDays}
            onLogWork={openLogWork}
          />
        </TabsContent>

        <TabsContent value="report">
          <TestReportTab
            memberStats={memberStats}
            totals={totals}
            periodDays={periodDays}
            hoursByName={hoursByName}
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab
            memberStats={memberStats}
            filteredSessions={filteredSessions}
            totals={totals}
            periodDays={periodDays}
          />
        </TabsContent>
      </Tabs>

      <LogWorkDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        loggedForName={logPerson}
        issues={issueOptions}
        onLogged={loadWorklogs}
      />
    </div>
  );
}
