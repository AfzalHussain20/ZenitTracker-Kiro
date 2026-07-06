"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { TestSession } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Printer, Download, Clock, Calendar, ExternalLink,
  TrendingUp, Target, Bug, SkipForward, BarChart3, Layers
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const JIRA_BASE = 'https://sunnetwork-techteam-hanqzy91.atlassian.net';

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d?.toDate) return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

function KpiCard({ title, value, subtitle, icon: Icon, color, delay }: {
  title: string; value: string | number; subtitle: string;
  icon: any; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border bg-card p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={cn('absolute top-0 left-0 w-full h-1 rounded-t-2xl', color)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color.replace('bg-', 'bg-').replace('-500', '-50') + ' dark:bg-opacity-10')}>
          <Icon className={cn('w-5 h-5', color.replace('bg-', 'text-').replace('-500', '-600'))} />
        </div>
      </div>
    </motion.div>
  );
}

export default function TestSessionResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user } = useAuth();
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      setLoading(true);
      try {
        let ref = doc(db, 'sessions', sessionId);
        let snap = await getDoc(ref);
        if (!snap.exists()) { ref = doc(db, 'testSessions', sessionId); snap = await getDoc(ref); }
        if (snap.exists()) {
          const data = snap.data();
          setSession({
            id: snap.id, ...data,
            createdAt: getValidDate(data.createdAt),
            completedAt: getValidDate(data.completedAt),
            testCases: (data.testCases || []).map((tc: any) => ({ ...tc, lastModified: getValidDate(tc.lastModified) }))
          } as TestSession);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [sessionId, user]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground">Loading report...</p>
      </motion.div>
    </div>
  );
  if (!session) return <div className="p-8 text-center text-muted-foreground">Report unavailable.</div>;

  const passed = session.testCases.filter(tc => tc.status === 'Pass').length;
  const failed = session.testCases.filter(tc => tc.status.includes('Fail')).length;
  const na = session.testCases.filter(tc => tc.status === 'N/A').length;
  const total = session.testCases.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;
  const executed = passed + failed + na;
  const executionRate = total > 0 ? Math.round((executed / total) * 100) : 0;

  const duration = session.createdAt && session.completedAt
    ? formatDistanceStrict(session.completedAt as Date, session.createdAt as Date)
    : "—";

  const chartData = [
    { name: 'Passed', value: passed, color: '#10b981' },
    { name: 'Failed', value: failed, color: '#ef4444' },
    { name: 'N/A', value: na, color: '#94a3b8' },
  ].filter(x => x.value > 0);

  // Group by test bed for breakdown
  const testBeds = Array.from(new Set(session.testCases.map(t => t.testBed || 'General')));
  const bedStats = testBeds.map(bed => {
    const cases = session.testCases.filter(t => (t.testBed || 'General') === bed);
    return {
      bed, total: cases.length,
      pass: cases.filter(t => t.status === 'Pass').length,
      fail: cases.filter(t => t.status.includes('Fail')).length,
      na: cases.filter(t => t.status === 'N/A').length,
    };
  });

  const failedCases = session.testCases.filter(tc => tc.status.includes('Fail'));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-8">

        {/* ─── Header ─── */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="h-8 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
              </Button>
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{session.id.substring(0, 8)}</Badge>
              <Badge className={cn('text-[10px]', session.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400')}>
                {session.status}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{session.platformDetails.platformName} — Test Report</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{session.createdAt ? format(session.createdAt as Date, 'MMM dd, yyyy') : '—'}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{duration}</span>
              <span className="flex items-center gap-1">Tester: <span className="text-foreground font-medium">{session.userName}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs"><Printer className="w-3.5 h-3.5 mr-1.5" />Print</Button>
            <Button size="sm" className="text-xs bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5 mr-1.5" />Export</Button>
          </div>
        </motion.header>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Pass Rate" value={`${passRate}%`} subtitle={`${passed} of ${total} passed`}
            icon={TrendingUp} color="bg-emerald-500" delay={0.1} />
          <KpiCard title="Defects" value={failed} subtitle={`${failRate}% failure rate`}
            icon={Bug} color="bg-red-500" delay={0.15} />
          <KpiCard title="Execution" value={`${executionRate}%`} subtitle={`${executed} of ${total} run`}
            icon={Target} color="bg-blue-500" delay={0.2} />
          <KpiCard title="Duration" value={duration} subtitle={session.createdAt ? format(session.createdAt as Date, 'h:mm a') + ' start' : '—'}
            icon={Clock} color="bg-violet-500" delay={0.25} />
        </div>

        {/* ─── Chart + Breakdown ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Donut chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Distribution
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80} strokeWidth={3} stroke="hsl(var(--card))">
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-bold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Test bed breakdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="lg:col-span-3 rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Module Breakdown
            </h3>
            <div className="space-y-4">
              {bedStats.map((s) => {
                const rate = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
                return (
                  <div key={s.bed} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Layers className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{s.bed}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{s.total} cases</span>
                      </div>
                      <span className={cn('text-sm font-bold tabular-nums', rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{rate}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                      {s.pass > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(s.pass / s.total) * 100}%` }} />}
                      {s.fail > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${(s.fail / s.total) * 100}%` }} />}
                      {s.na > 0 && <div className="h-full bg-slate-300 dark:bg-slate-600 transition-all" style={{ width: `${(s.na / s.total) * 100}%` }} />}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px]">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Pass</span><span className="font-semibold text-foreground">{s.pass}</span></span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-muted-foreground">Fail</span><span className="font-semibold text-foreground">{s.fail}</span></span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-muted-foreground">Skip</span><span className="font-semibold text-foreground">{s.na}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ─── Defects Section ─── */}
        {failedCases.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.03] p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />
              Defects Found
              <Badge className="bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] ml-1">{failedCases.length}</Badge>
            </h3>
            <div className="space-y-2">
              {failedCases.map((tc, i) => (
                <div key={tc.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border">
                  <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tc.testCaseTitle}</p>
                    {tc.bugId && (
                      <a href={`${JIRA_BASE}/browse/${tc.bugId}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" />
                        {tc.bugId}{tc.bugTitle ? ` — ${tc.bugTitle}` : ''}
                      </a>
                    )}
                    {tc.notes && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{tc.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tc.priority && (
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                        tc.priority === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' :
                        tc.priority === 'Medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' :
                        'bg-muted text-muted-foreground'
                      )}>{tc.priority}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{tc.testBed}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Full Test Case Table ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Detailed Results
            </h3>
            <span className="text-[11px] text-muted-foreground">{total} test cases</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Test Case</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-20">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Bug / Notes</th>
                </tr>
              </thead>
              <tbody>
                {session.testCases.map((tc, i) => (
                  <tr key={tc.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground font-medium leading-snug">{tc.testCaseTitle}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tc.testBed}</p>
                    </td>
                    <td className="px-4 py-3">
                      {tc.status === 'Pass' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />Pass
                        </span>
                      )}
                      {tc.status.includes('Fail') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />Fail
                        </span>
                      )}
                      {(tc.status === 'N/A' || tc.status === 'Untested') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />{tc.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[250px] hidden md:table-cell">
                      {tc.bugId ? (
                        <a href={`${JIRA_BASE}/browse/${tc.bugId}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{tc.bugId}{tc.bugTitle ? ` — ${tc.bugTitle}` : ''}</span>
                        </a>
                      ) : (
                        <span className="truncate block">{tc.naReason || tc.notes || tc.actualResult || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
