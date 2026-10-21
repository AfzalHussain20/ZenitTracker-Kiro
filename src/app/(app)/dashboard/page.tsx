"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { TestSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  PlusCircle,
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  Target,
  BarChart3,
  Layers,
  StickyNote,
  Play,
  Grid3x3,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const getValidDate = (d: unknown): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  if (typeof d === 'string' || typeof d === 'number') {
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const STATUS_STYLES: Record<string, string> = {
  Pass: 'text-emerald-600 dark:text-emerald-400',
  Fail: 'text-red-600 dark:text-red-400',
  Known: 'text-orange-600 dark:text-orange-400',
  'N/A': 'text-muted-foreground',
};

const chartConfig = {
  passed: { label: 'Passed', color: 'hsl(var(--chart-2, 142 71% 45%))' },
  failed: { label: 'Failed', color: 'hsl(var(--chart-5, 0 84% 60%))' },
} satisfies ChartConfig;

const QUICK_LINKS = [
  { title: 'New Session', href: '/dashboard/new-session', icon: Play, desc: 'Start a test run' },
  { title: 'Repository', href: '/dashboard/repository', icon: Layers, desc: 'Manage test suites' },
  { title: 'Jira KPI', href: '/analytics/bugs', icon: BarChart3, desc: 'Bug analytics' },
  { title: 'Notes', href: '/notes', icon: StickyNote, desc: 'Capture findings' },
  { title: 'Apps', href: '/apps', icon: Grid3x3, desc: 'Browse platforms' },
  { title: 'Leads Portal', href: '/team', icon: Target, desc: 'Team oversight' },
];

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="h-full">
        <CardContent className="flex items-start justify-between p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className={`shrink-0 rounded-xl p-3 ${accent.replace('text-', 'bg-')}/10`}>
            <Icon className={`h-6 w-6 ${accent}`} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SessionCard({ session }: { session: TestSession }) {
  const summary = session.summary || { pass: 0, fail: 0, na: 0, failKnown: 0, total: 0 };
  const completedCount = summary.pass + summary.fail + summary.na + summary.failKnown;
  const completion = summary.total > 0 ? Math.round((completedCount / summary.total) * 100) : 0;
  const createdAt = getValidDate(session.createdAt);
  const canContinue = session.status === 'In Progress' || session.status === 'Aborted';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="flex h-full flex-col transition-shadow hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-semibold">
                {session.platformDetails?.platformName ?? 'Untitled session'}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {createdAt ? format(createdAt, 'MMM dd, yyyy') : 'No date'}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-primary">{completion}%</div>
              <div className="text-xs text-muted-foreground">complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${completion}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className={`text-sm font-bold tabular-nums ${STATUS_STYLES.Pass}`}>{summary.pass}</div>
              <div className="text-xs text-muted-foreground">Pass</div>
            </div>
            <div>
              <div className={`text-sm font-bold tabular-nums ${STATUS_STYLES.Fail}`}>{summary.fail}</div>
              <div className="text-xs text-muted-foreground">Fail</div>
            </div>
            <div>
              <div className={`text-sm font-bold tabular-nums ${STATUS_STYLES.Known}`}>{summary.failKnown}</div>
              <div className="text-xs text-muted-foreground">Known</div>
            </div>
            <div>
              <div className={`text-sm font-bold tabular-nums ${STATUS_STYLES['N/A']}`}>{summary.na}</div>
              <div className="text-xs text-muted-foreground">N/A</div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-auto w-full">
            <Link href={`/dashboard/session/${canContinue ? session.id : `${session.id}/results`}`}>
              {canContinue ? 'Continue' : 'View Results'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading, displayName } = useAuth();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSessionsLoading(false);
      return;
    }

    setSessionsLoading(true);

    let sessions1: TestSession[] = [];
    let sessions2: TestSession[] = [];
    let loaded1 = false,
      loaded2 = false;

    const merge = () => {
      if (!loaded1 || !loaded2) return;
      const merged = new Map<string, TestSession>();
      [...sessions1, ...sessions2].forEach((s) => merged.set(s.id, s));
      const sorted = Array.from(merged.values()).sort((a, b) => {
        const da = getValidDate(a.createdAt)?.getTime() || 0;
        const db2 = getValidDate(b.createdAt)?.getTime() || 0;
        return db2 - da;
      });
      setSessions(sorted);
      setSessionsLoading(false);
    };

    const q1 = query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const q2 = query(collection(db, 'testSessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        sessions1 = snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              createdAt: getValidDate(doc.data().createdAt),
              updatedAt: getValidDate(doc.data().updatedAt),
            }) as TestSession
        );
        loaded1 = true;
        merge();
      },
      () => {
        loaded1 = true;
        merge();
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        sessions2 = snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              createdAt: getValidDate(doc.data().createdAt),
              updatedAt: getValidDate(doc.data().updatedAt),
            }) as TestSession
        );
        loaded2 = true;
        merge();
      },
      () => {
        loaded2 = true;
        merge();
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [user, authLoading]);

  const { activeSessions, completedSessions, stats } = useMemo(() => {
    const active = sessions.filter((s) => s.status === 'In Progress' || s.status === 'Aborted');
    const completed = sessions.filter((s) => s.status === 'Completed');

    let totalTests = 0,
      totalPass = 0,
      totalFail = 0;
    sessions.forEach((s) => {
      if (s.summary) {
        totalTests += s.summary.total;
        totalPass += s.summary.pass;
        totalFail += s.summary.fail + s.summary.failKnown;
      }
    });

    return {
      activeSessions: active,
      completedSessions: completed,
      stats: { totalTests, totalPass, totalFail, totalSessions: sessions.length },
    };
  }, [sessions]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayStr = date.toISOString().split('T')[0];
      let tests = 0,
        passed = 0,
        failed = 0;
      sessions.forEach((s) => {
        const created = getValidDate(s.createdAt);
        if (created && created.toISOString().split('T')[0] === dayStr && s.summary) {
          tests += s.summary.total;
          passed += s.summary.pass;
          failed += s.summary.fail + (s.summary.failKnown || 0);
        }
      });
      return { date: format(date, 'EEE'), tests, passed, failed };
    });
  }, [sessions]);

  const passRate = stats.totalTests > 0 ? Math.round((stats.totalPass / stats.totalTests) * 100) : 0;
  const hasActivity = chartData.some((d) => d.tests > 0);

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent p-6 sm:p-8"
      >
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {format(new Date(), 'EEEE, MMMM d')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, <span className="text-gradient">{displayName || 'Tester'}</span>
            </h1>
            <p className="max-w-xl text-muted-foreground">
              Your testing command center — {stats.totalSessions} session{stats.totalSessions === 1 ? '' : 's'} tracked, {passRate}% pass rate.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
              <Link href="/dashboard/new-session">
                <PlusCircle className="mr-2 h-5 w-5" />
                New Session
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      </motion.div>

      {/* Resume banner */}
      {activeSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            href={`/dashboard/session/${activeSessions[0].id}`}
            className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                Continue: {activeSessions[0].platformDetails?.platformName ?? 'Untitled'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {activeSessions[0].summary
                  ? `${activeSessions[0].summary.pass + activeSessions[0].summary.fail + activeSessions[0].summary.na}/${activeSessions[0].summary.total} done`
                  : 'In progress'}
                {activeSessions.length > 1 && ` · ${activeSessions.length - 1} more active`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Sessions" value={stats.totalSessions} hint="All time" icon={Activity} accent="text-blue-600 dark:text-blue-400" delay={0.05} />
        <StatTile label="Tests Executed" value={stats.totalTests} hint="Across all sessions" icon={Target} accent="text-purple-600 dark:text-purple-400" delay={0.1} />
        <StatTile label="Passed" value={stats.totalPass} hint={`${passRate}% pass rate`} icon={CheckCircle2} accent="text-emerald-600 dark:text-emerald-400" delay={0.15} />
        <StatTile label="Failed" value={stats.totalFail} hint="Needs attention" icon={XCircle} accent="text-red-600 dark:text-red-400" delay={0.2} />
      </div>

      {/* Activity chart + quick links */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Activity
            </CardTitle>
            <CardDescription>Test execution over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {hasActivity ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillPassed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-passed)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--color-passed)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-failed)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--color-failed)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="passed" type="monotone" fill="url(#fillPassed)" stroke="var(--color-passed)" strokeWidth={2} />
                  <Area dataKey="failed" type="monotone" fill="url(#fillFailed)" stroke="var(--color-failed)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium">No activity yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Run a session to see trends here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Quick Access
            </CardTitle>
            <CardDescription>Jump to common tools</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex flex-col gap-2 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                  <div>
                    <p className="text-sm font-medium leading-tight">{link.title}</p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      {sessionsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Ready to start testing?</h3>
              <p className="mt-2 text-muted-foreground">Create your first session and begin tracking your QA workflow.</p>
            </div>
            <Button asChild size="lg" className="mt-2">
              <Link href="/dashboard/new-session">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Your First Session
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-semibold">Active Sessions</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeSessions.slice(0, 4).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
          )}

          {completedSessions.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <h2 className="text-xl font-semibold">Recently Completed</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {completedSessions.slice(0, 4).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
