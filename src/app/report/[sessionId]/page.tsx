"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { TestSession } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, Calendar, ExternalLink, TrendingUp, Target,
  Bug, BarChart3, Layers, Zap
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

export default function PublicReportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
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
        } else { setError('Report not found'); }
      } catch (e) { setError('Failed to load report'); }
      finally { setLoading(false); }
    })();
  }, [sessionId]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground">Loading report...</p>
      </div>
    </div>
  );
  if (error || !session) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-foreground">{error || 'Report not found'}</p>
        <p className="text-sm text-muted-foreground">This report may have been removed or the link is invalid.</p>
      </div>
    </div>
  );

  const passed = session.testCases.filter(tc => tc.status === 'Pass').length;
  const failed = session.testCases.filter(tc => tc.status.includes('Fail')).length;
  const na = session.testCases.filter(tc => tc.status === 'N/A').length;
  const total = session.testCases.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const createdDate = getValidDate(session.createdAt);
  const completedDate = getValidDate(session.completedAt);
  const duration = createdDate && completedDate ? formatDistanceStrict(completedDate, createdDate) : "—";
  const chartData = [
    { name: 'Passed', value: passed, color: '#10b981' },
    { name: 'Failed', value: failed, color: '#ef4444' },
    { name: 'N/A', value: na, color: '#94a3b8' },
  ].filter(x => x.value > 0);
  const failedCases = session.testCases.filter(tc => tc.status.includes('Fail'));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">Zenit Test Report</span>
            <Badge className={cn('text-[10px] ml-2', session.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{session.status}</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{session.platformDetails.platformName}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{createdDate ? format(createdDate, 'MMM dd, yyyy') : '—'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{duration}</span>
            <span>Tester: <span className="text-foreground font-medium">{session.userName}</span></span>
          </div>
        </motion.header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pass Rate', value: `${passRate}%`, color: 'text-emerald-600', bg: 'bg-emerald-500' },
            { label: 'Passed', value: passed, color: 'text-emerald-600', bg: 'bg-emerald-500' },
            { label: 'Failed', value: failed, color: 'text-red-600', bg: 'bg-red-500' },
            { label: 'Total', value: total, color: 'text-primary', bg: 'bg-primary' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
              <div className={cn('absolute top-0 left-0 w-full h-0.5', kpi.bg)} />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className={cn('text-2xl font-bold mt-1 tabular-nums', kpi.color)}>{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Distribution</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} strokeWidth={3} stroke="hsl(var(--card))">
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-3">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defects */}
        {failedCases.length > 0 && (
          <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.03] p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-600" />Defects ({failedCases.length})
            </h3>
            <div className="space-y-2">
              {failedCases.map(tc => (
                <div key={tc.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-card border border-border">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tc.testCaseTitle}</p>
                    {tc.bugId && (
                      <a href={`${JIRA_BASE}/browse/${tc.bugId}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-3 h-3" />{tc.bugId}{tc.bugTitle ? ` — ${tc.bugTitle}` : ''}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />All Test Cases</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase">Test Case</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase w-16">Status</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase hidden md:table-cell">Bug / Notes</th>
                </tr>
              </thead>
              <tbody>
                {session.testCases.map((tc, i) => (
                  <tr key={tc.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium">{tc.testCaseTitle}</p>
                      <p className="text-[10px] text-muted-foreground">{tc.testBed}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {tc.status === 'Pass' && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Pass</span>}
                      {tc.status.includes('Fail') && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Fail</span>}
                      {(tc.status === 'N/A' || tc.status === 'Untested') && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{tc.status}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      {tc.bugId ? (
                        <a href={`${JIRA_BASE}/browse/${tc.bugId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {tc.bugId}{tc.bugTitle ? ` — ${tc.bugTitle}` : ''}
                        </a>
                      ) : (tc.naReason || tc.actualResult || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs">Powered by <span className="font-semibold text-foreground">Zenit Tracker</span></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
