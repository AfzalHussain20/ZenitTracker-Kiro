"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { TestSession, TestCase } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Printer, Download, Clock, Calendar, ExternalLink, ArrowRight,
  TrendingUp, Target, Bug, BarChart3, Layers, Check, SkipForward
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { normalizeCases, getCaseBugs, applyCasePatch, computeSummary } from '@/lib/session-collab';
import { naReasonOptions, resolveSkipReason, OTHER_REASON } from '@/lib/skip-reasons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { JIRA_BASE_URL as JIRA_BASE } from '@/lib/jira/config';

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
  const iconBgMap: Record<string, string> = {
    'bg-emerald-500': 'bg-emerald-50 dark:bg-emerald-500/10',
    'bg-red-500': 'bg-red-50 dark:bg-red-500/10',
    'bg-blue-500': 'bg-blue-50 dark:bg-blue-500/10',
    'bg-violet-500': 'bg-violet-50 dark:bg-violet-500/10',
  };
  const iconTextMap: Record<string, string> = {
    'bg-emerald-500': 'text-emerald-600 dark:text-emerald-400',
    'bg-red-500': 'text-red-600 dark:text-red-400',
    'bg-blue-500': 'text-blue-600 dark:text-blue-400',
    'bg-violet-500': 'text-violet-600 dark:text-violet-400',
  };
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
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBgMap[color] || 'bg-muted')}>
          <Icon className={cn('w-5 h-5', iconTextMap[color] || 'text-muted-foreground')} />
        </div>
      </div>
    </motion.div>
  );
}

export default function TestSessionResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user, displayName, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [colName, setColName] = useState<'sessions' | 'testSessions' | null>(null);
  const isLead = userRole === 'lead';

  // Lead inline editing
  const [saving, setSaving] = useState<number | null>(null);
  const [failEdit, setFailEdit] = useState<{ index: number } | null>(null);
  const [skipEdit, setSkipEdit] = useState<{ index: number } | null>(null);
  const [editBugId, setEditBugId] = useState('');
  const [editBugTitle, setEditBugTitle] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editOther, setEditOther] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!sessionId || !user) return;
    (async () => {
      setLoading(true);
      try {
        // Read both collections independently: a getDoc for a missing document is
        // rejected by the security rules and must not abort the other collection.
        let data: any = null;
        let id = sessionId;
        for (const col of ['sessions', 'testSessions'] as const) {
          try {
            const snap = await getDoc(doc(db, col, sessionId));
            if (snap.exists()) { data = snap.data(); id = snap.id; setColName(col); break; }
          } catch { /* denied / missing — try the next collection */ }
        }
        if (data) {
          setSession({
            id, ...data,
            createdAt: getValidDate(data.createdAt),
            completedAt: getValidDate(data.completedAt),
            testCases: normalizeCases(data.testCases)
          } as TestSession);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [sessionId, user, authLoading]);

  if (loading || authLoading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground">Loading report...</p>
      </motion.div>
    </div>
  );
  if (!session) return <div className="p-8 text-center text-muted-foreground">Report unavailable.</div>;

  const passed = session.testCases.filter(tc => tc.status === 'Pass').length;
  const failed = session.testCases.filter(tc => tc.status?.includes('Fail')).length;
  const na = session.testCases.filter(tc => tc.status === 'N/A').length;
  const total = session.testCases.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;
  const executed = passed + failed + na;
  const executionRate = total > 0 ? Math.round((executed / total) * 100) : 0;

  const createdDate = getValidDate(session.createdAt);
  const completedDate = getValidDate(session.completedAt);
  const duration = createdDate && completedDate
    ? formatDistanceStrict(completedDate, createdDate)
    : "In progress";

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
      fail: cases.filter(t => t.status?.includes('Fail')).length,
      na: cases.filter(t => t.status === 'N/A').length,
    };
  });

  const failedCases = session.testCases.filter(tc => tc.status?.includes('Fail'));

  // ── Lead editing ──────────────────────────────────────────────────────────
  const isValidBug = (id: string) => /^[A-Z]{2,10}-\d+$/.test(id.trim());

  const applyEdit = async (index: number, patch: Partial<TestCase>) => {
    if (!session || !colName || !user) return;
    setSaving(index);
    try {
      let nextCases: TestCase[] = session.testCases;
      await runTransaction(db, async (tx) => {
        const ref = doc(db, colName, session.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Session not found');
        const raw = snap.data().testCases;
        const base = Array.isArray(raw) ? normalizeCases(raw) : session.testCases;
        const patched = applyCasePatch(base, index, {
          ...patch,
          lastModified: Timestamp.now(),
          executedByUid: user.uid,
          executedByName: displayName || user.email?.split('@')[0] || '',
        });
        nextCases = patched;
        tx.update(ref, {
          testCases: patched,
          summary: computeSummary(patched),
          updatedAt: new Date(),
        });
      });
      setSession((s) => (s ? { ...s, testCases: nextCases, summary: computeSummary(nextCases), updatedAt: new Date() } : s));
      toast({ title: 'Updated', description: `Case ${index + 1} saved.` });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const markPass = async (index: number) => {
    const tc = session?.testCases[index];
    await applyEdit(index, {
      status: 'Pass',
      bugId: null,
      bugTitle: null,
      linkedBugs: [],
      linkedBugDetails: [],
      naReason: null,
      actualResult: tc?.expectedResult || '',
    } as any);
  };

  const openFail = (index: number) => {
    const tc = session?.testCases[index];
    setEditBugId(tc?.bugId || '');
    setEditBugTitle(tc?.bugTitle || null);
    setEditNotes(tc?.notes || '');
    setFailEdit({ index });
  };

  const lookupEditBug = async () => {
    const id = editBugId.trim().toUpperCase();
    if (!isValidBug(id)) return;
    try {
      const res = await fetch(`/api/jira/issue/${encodeURIComponent(id)}`);
      if (res.ok) {
        const d = await res.json();
        setEditBugTitle(d.summary || null);
      }
    } catch { /* ignore */ }
  };

  const confirmFail = async () => {
    if (!failEdit || !session) return;
    const index = failEdit.index;
    const id = editBugId.trim().toUpperCase();
    if (!isValidBug(id)) return;
    const tc = session.testCases[index];
    let title = editBugTitle;
    if (!title) {
      try {
        const res = await fetch(`/api/jira/issue/${encodeURIComponent(id)}`);
        if (res.ok) title = (await res.json()).summary || null;
      } catch { /* ignore */ }
    }
    await applyEdit(index, {
      status: 'Fail',
      bugId: id,
      bugTitle: title,
      linkedBugs: [id],
      linkedBugDetails: [{ id, title }],
      naReason: null,
      notes: editNotes.trim() || tc?.notes || '',
      actualResult: tc?.actualResult || '',
    } as any);
    setFailEdit(null);
  };

  const openSkip = (index: number) => {
    setEditReason('');
    setEditOther('');
    setSkipEdit({ index });
  };

  const confirmSkip = async () => {
    if (!skipEdit) return;
    const reason = resolveSkipReason(editReason, editOther);
    if (!reason) return;
    await applyEdit(skipEdit.index, {
      status: 'N/A',
      naReason: reason,
      bugId: null,
      bugTitle: null,
      linkedBugs: [],
      linkedBugDetails: [],
      actualResult: '',
    } as any);
    setSkipEdit(null);
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Print-only header */}
      <div className="hidden print:block print:mb-4 print:pb-4 print:border-b print:border-gray-300">
        <h1 className="text-2xl font-bold">{session.platformDetails.platformName} — Test Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          {createdDate ? format(createdDate, 'MMM dd, yyyy') : ''} · {duration} · Tester: {session.userName} · {session.status}
        </p>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-8">

        {/* ─── Header ─── */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              {(session.status === 'In Progress' || session.status === 'Aborted') && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/session/${session.id}`)} className="h-8 text-xs">
                  Continue Session <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{session.id.substring(0, 8)}</Badge>
              <Badge className={cn('text-[10px]', session.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400')}>
                {session.status}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{session.platformDetails.platformName} — Test Report</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{createdDate ? format(createdDate, 'MMM dd, yyyy') : '—'}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{duration}</span>
              <span className="flex items-center gap-1">Tester: <span className="text-foreground font-medium">{session.userName}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="text-xs">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs"><Printer className="w-3.5 h-3.5 mr-1.5" />Print</Button>
            <Button size="sm" className="text-xs bg-primary hover:bg-primary/90" onClick={() => {
              if (!session) return;
              const rows = [['#', 'Test Case', 'Module', 'Priority', 'Status', 'Bug ID', 'Bugs', 'Bug Title', 'Notes'].join(',')];
              session.testCases.forEach((tc, i) => {
                const allBugs = getCaseBugs(tc).map(b => (b.title ? `${b.id} — ${b.title}` : b.id)).join('; ');
                rows.push([i + 1, `"${tc.testCaseTitle.replace(/"/g, '""')}"`, tc.testBed, tc.priority || '', tc.status, tc.bugId || '', `"${allBugs.replace(/"/g, '""')}"`, `"${(tc.bugTitle || '').replace(/"/g, '""')}"`, `"${(tc.notes || tc.naReason || tc.actualResult || '').replace(/"/g, '""')}"`].join(','));
              });
              const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${session.platformDetails.platformName}_Report_${session.id.substring(0,8)}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}><Download className="w-3.5 h-3.5 mr-1.5" />Export CSV</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
              if (!session || !user) return;
              try {
                const { collection: col, doc: docRef, setDoc, Timestamp: Ts } = await import('firebase/firestore');
                const sessionsCol = col(db, 'sessions');
                const newRef = docRef(sessionsCol);
                const now = Ts.now();
                const freshCases = session.testCases.map((tc: any, i: number) => ({
                  ...tc, id: `${newRef.id}-tc-${i}`, status: 'Untested', actualResult: '', notes: '', bugId: null, bugTitle: null, linkedBugs: [], linkedBugDetails: [], naReason: null, lastModified: now,
                }));
                await setDoc(newRef, {
                  id: newRef.id, userId: user.uid, userName: session.userName,
                  platformDetails: session.platformDetails, testCases: freshCases, status: 'In Progress',
                  createdAt: now, updatedAt: now,
                  summary: { total: freshCases.length, pass: 0, fail: 0, na: 0, untested: freshCases.length, failKnown: 0 },
                });
                toast({ title: 'New session created', description: `Re-running ${freshCases.length} test cases.` });
                router.push(`/dashboard/session/${newRef.id}`);
              } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
            }}>
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />Run Again
            </Button>
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
          <KpiCard title="Duration" value={duration} subtitle={createdDate ? format(createdDate, 'h:mm a') + ' start' : '—'}
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
                    {/* Show all linked bugs as a clean list */}
                    {getCaseBugs(tc).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {getCaseBugs(tc).map((bug) => (
                          <a key={bug.id} href={`${JIRA_BASE}/browse/${bug.id}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md">
                            <ExternalLink className="w-3 h-3" />
                            {bug.id}{bug.title ? ` — ${bug.title}` : ''}
                          </a>
                        ))}
                      </div>
                    )}
                    {tc.notes && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{tc.notes}</p>}
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
                  {isLead && (
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">Actions</th>
                  )}
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
                      {tc.status?.includes('Fail') && (
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
                      {getCaseBugs(tc).length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {getCaseBugs(tc).map((bug) => (
                            <a key={bug.id} href={`${JIRA_BASE}/browse/${bug.id}`} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{bug.id}{bug.title ? ` — ${bug.title}` : ''}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="truncate block">{tc.naReason || tc.notes || tc.actualResult || '—'}</span>
                      )}
                    </td>
                    {isLead && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" title="Mark Pass" onClick={() => markPass(i)}
                            disabled={saving !== null}
                            className="w-7 h-7 rounded-md border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 flex items-center justify-center">
                            {saving === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" title="Mark Fail" onClick={() => openFail(i)}
                            disabled={saving !== null}
                            className="w-7 h-7 rounded-md border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40 flex items-center justify-center">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title="Skip" onClick={() => openSkip(i)}
                            disabled={saving !== null}
                            className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 flex items-center justify-center">
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>

      {/* Share Dialog */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShareOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-[360px] max-w-[90vw] space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Share Report</h3>
            <div className="space-y-3">
              {/* URL */}
              <div className="flex items-center gap-2">
                <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/report/${session?.id}`}
                  className="flex-1 text-xs bg-muted border border-border rounded-lg px-3 py-2 text-foreground truncate" />
                <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/report/${session?.id}`);
                  toast({ title: 'URL copied!' });
                }}>Copy</Button>
              </div>
              {/* QR Code (simple text-based representation) */}
              <div className="flex items-center justify-center py-4 bg-white rounded-xl border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/report/${session?.id}`)}`}
                  alt="QR Code" className="w-32 h-32" />
              </div>
              {/* Native Share */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button size="sm" className="w-full text-xs" onClick={() => {
                  navigator.share({
                    title: `${session?.platformDetails?.platformName} - Test Report`,
                    url: `${window.location.origin}/report/${session?.id}`,
                  }).catch(() => {});
                  setShareOpen(false);
                }}>Share via Apps</Button>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShareOpen(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Fail edit dialog (lead) */}
      {isLead && failEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFailEdit(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-[420px] max-w-[92vw] space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Mark as Failed</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                Case {failEdit.index + 1}: {session.testCases[failEdit.index]?.testCaseTitle}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Bug ID</label>
              <input
                value={editBugId}
                onChange={e => { setEditBugId(e.target.value.toUpperCase()); setEditBugTitle(null); }}
                onBlur={lookupEditBug}
                placeholder="e.g. SUN-1234"
                className="w-full text-sm font-mono bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
              {editBugTitle && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">{editBugId} — {editBugTitle}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Notes (optional)</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                placeholder="What went wrong?"
                className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setFailEdit(null)}>Cancel</Button>
              <Button size="sm" className="flex-1 text-xs" disabled={!isValidBug(editBugId) || saving !== null} onClick={confirmFail}>
                {saving !== null ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Fail
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skip edit dialog (lead) */}
      {isLead && skipEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSkipEdit(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-[420px] max-w-[92vw] space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Skip Test Case</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                Case {skipEdit.index + 1}: {session.testCases[skipEdit.index]?.testCaseTitle}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Reason</label>
              <select
                value={editReason}
                onChange={e => { setEditReason(e.target.value); if (e.target.value !== OTHER_REASON) setEditOther(''); }}
                className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/40"
              >
                <option value="">Select reason...</option>
                {naReasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {editReason === OTHER_REASON && (
                <textarea
                  value={editOther}
                  onChange={e => setEditOther(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Write the reason (required)..."
                  className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setSkipEdit(null)}>Cancel</Button>
              <Button size="sm" className="flex-1 text-xs" disabled={!resolveSkipReason(editReason, editOther) || saving !== null} onClick={confirmSkip}>
                {saving !== null ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
