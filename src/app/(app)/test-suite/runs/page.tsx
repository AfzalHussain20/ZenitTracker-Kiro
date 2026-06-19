'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
    Play, Activity, CheckCircle2, XCircle, AlertTriangle, Clock,
    ChevronRight, RefreshCw, SkipForward, Ban, CircleDot, Trophy
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RunCase {
    caseId: string;
    title: string;
    steps: string;
    expectedResult: string;
    priority: string;
    result: 'not_run' | 'passed' | 'failed' | 'blocked' | 'skipped';
    actualResult: string;
    notes: string;
    executedAt: string | null;
}

interface Run {
    id: string;
    planId: string;
    planTitle: string;
    startedBy: string;
    startedAt: string;
    completedAt: string | null;
    status: 'in_progress' | 'completed';
    cases: RunCase[];
    summary: { total: number; passed: number; failed: number; blocked: number; skipped: number; not_run: number };
}

const RESULT_CONFIG = {
    not_run: { label: 'Not Run', icon: CircleDot, color: 'text-slate-400', bg: 'bg-slate-400/10' },
    passed:  { label: 'Passed',  icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    failed:  { label: 'Failed',  icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    blocked: { label: 'Blocked', icon: Ban, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    skipped: { label: 'Skipped', icon: SkipForward, color: 'text-slate-500', bg: 'bg-slate-500/10' },
};

export default function TestRunsPage() {
    const { user } = useAuth();
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeRun, setActiveRun] = useState<Run | null>(null);
    const [caseIdx, setCaseIdx] = useState(0);
    const [saving, setSaving] = useState(false);

    // Fetch runs
    const fetchRuns = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/test-runs?limit=50');
            const data = await res.json();
            setRuns(data.runs ?? []);
        } catch { setRuns([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRuns(); }, [fetchRuns]);

    // Mark a case
    const markCase = async (result: RunCase['result'], notes?: string, actualResult?: string) => {
        if (!activeRun) return;
        const c = activeRun.cases[caseIdx];
        setSaving(true);
        try {
            const res = await fetch(`/api/test-runs/${activeRun.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId: c.caseId, result, notes: notes ?? '', actualResult: actualResult ?? '' }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local state
                const updated = { ...activeRun };
                updated.cases[caseIdx] = { ...updated.cases[caseIdx], result, notes: notes ?? '', actualResult: actualResult ?? '' };
                updated.summary = data.summary;
                setActiveRun(updated);
                // Auto-advance to next unexecuted case
                const nextIdx = updated.cases.findIndex((c, i) => i > caseIdx && c.result === 'not_run');
                if (nextIdx >= 0) setCaseIdx(nextIdx);
            }
        } catch {}
        finally { setSaving(false); }
    };

    // Complete run
    const completeRun = async () => {
        if (!activeRun) return;
        setSaving(true);
        try {
            await fetch(`/api/test-runs/${activeRun.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'complete' }),
            });
            setActiveRun(null);
            fetchRuns();
        } catch {}
        finally { setSaving(false); }
    };

    const currentCase = activeRun?.cases[caseIdx];
    const progress = activeRun ? Math.round(((activeRun.summary.total - activeRun.summary.not_run) / activeRun.summary.total) * 100) : 0;

    // ── Execution View ───────────────────────────────────────────────────────
    if (activeRun) {
        return (
            <PageShell
                title={`Executing: ${activeRun.planTitle}`}
                description={`Case ${caseIdx + 1} of ${activeRun.cases.length} · ${progress}% complete`}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActiveRun(null)}>Exit</Button>
                        <Button size="sm" onClick={completeRun} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Trophy className="w-4 h-4 mr-1.5" />Complete Run
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Progress bar */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-2 text-xs font-medium">
                            <span>{activeRun.summary.total - activeRun.summary.not_run} / {activeRun.summary.total} executed</span>
                            <div className="flex gap-3">
                                <span className="text-emerald-500">✓ {activeRun.summary.passed}</span>
                                <span className="text-red-500">✗ {activeRun.summary.failed}</span>
                                <span className="text-amber-500">⊘ {activeRun.summary.blocked}</span>
                                <span className="text-slate-400">↷ {activeRun.summary.skipped}</span>
                            </div>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                            {['passed', 'failed', 'blocked', 'skipped'].map(status => {
                                const pct = (activeRun.summary[status as keyof typeof activeRun.summary] as number / activeRun.summary.total) * 100;
                                const colors: Record<string, string> = { passed: 'bg-emerald-500', failed: 'bg-red-500', blocked: 'bg-amber-500', skipped: 'bg-slate-400' };
                                return pct > 0 ? <div key={status} className={`${colors[status]} h-full`} style={{ width: `${pct}%` }} /> : null;
                            })}
                        </div>
                    </div>

                    {/* Case navigator (compact pills) */}
                    <div className="flex gap-1 flex-wrap">
                        {activeRun.cases.map((c, i) => {
                            const cfg = RESULT_CONFIG[c.result];
                            return (
                                <button
                                    key={c.caseId}
                                    onClick={() => setCaseIdx(i)}
                                    className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-all',
                                        i === caseIdx ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
                                        cfg.bg, cfg.color, 'border-transparent'
                                    )}
                                    title={c.title}
                                >
                                    {i + 1}
                                </button>
                            );
                        })}
                    </div>

                    {/* Current case card */}
                    {currentCase && (
                        <motion.div
                            key={currentCase.caseId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card border rounded-2xl p-6 space-y-5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <Badge variant="outline" className="text-[10px] mb-2">{currentCase.priority}</Badge>
                                    <h3 className="text-lg font-bold">{currentCase.title}</h3>
                                </div>
                                <Badge className={cn(RESULT_CONFIG[currentCase.result].bg, RESULT_CONFIG[currentCase.result].color, 'border-0')}>
                                    {RESULT_CONFIG[currentCase.result].label}
                                </Badge>
                            </div>

                            {currentCase.steps && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Steps</h4>
                                    <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/50">{currentCase.steps}</p>
                                </div>
                            )}

                            {currentCase.expectedResult && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Expected Result</h4>
                                    <p className="text-sm bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">{currentCase.expectedResult}</p>
                                </div>
                            )}

                            {/* Quick notes */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Notes / Actual Result (optional)</h4>
                                <Textarea
                                    id={`notes-${currentCase.caseId}`}
                                    placeholder="Type observations, actual result, or attach a bug ID…"
                                    defaultValue={currentCase.notes || currentCase.actualResult}
                                    rows={2}
                                    className="text-sm resize-none"
                                />
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 pt-2">
                                <Button
                                    onClick={() => {
                                        const notes = (document.getElementById(`notes-${currentCase.caseId}`) as HTMLTextAreaElement)?.value ?? '';
                                        markCase('passed', notes);
                                    }}
                                    disabled={saving}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-sm font-bold"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />Pass
                                </Button>
                                <Button
                                    onClick={() => {
                                        const notes = (document.getElementById(`notes-${currentCase.caseId}`) as HTMLTextAreaElement)?.value ?? '';
                                        markCase('failed', notes);
                                    }}
                                    disabled={saving}
                                    variant="destructive"
                                    className="flex-1 h-11 text-sm font-bold"
                                >
                                    <XCircle className="w-4 h-4 mr-1.5" />Fail
                                </Button>
                                <Button
                                    onClick={() => markCase('blocked')}
                                    disabled={saving}
                                    variant="outline"
                                    className="h-11 text-sm font-bold text-amber-600 border-amber-300"
                                >
                                    <Ban className="w-4 h-4 mr-1.5" />Blocked
                                </Button>
                                <Button
                                    onClick={() => markCase('skipped')}
                                    disabled={saving}
                                    variant="ghost"
                                    className="h-11 text-sm text-muted-foreground"
                                >
                                    <SkipForward className="w-4 h-4 mr-1.5" />Skip
                                </Button>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between pt-2 border-t border-border/50">
                                <Button variant="ghost" size="sm" disabled={caseIdx === 0} onClick={() => setCaseIdx(i => i - 1)}>
                                    ← Previous
                                </Button>
                                <Button variant="ghost" size="sm" disabled={caseIdx >= activeRun.cases.length - 1} onClick={() => setCaseIdx(i => i + 1)}>
                                    Next →
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </PageShell>
        );
    }

    // ── Runs list view ───────────────────────────────────────────────────────
    const activeRuns = runs.filter(r => r.status === 'in_progress');
    const completedRuns = runs.filter(r => r.status === 'completed');

    return (
        <PageShell
            title="Test Runs"
            description="Execute test plans and track results in real time."
            actions={
                <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
                    <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />Refresh
                </Button>
            }
        >
            <div className="space-y-8">
                {/* Active runs */}
                {activeRuns.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-500" />In Progress ({activeRuns.length})
                        </h3>
                        <div className="grid gap-3">
                            {activeRuns.map(run => {
                                const pct = Math.round(((run.summary.total - run.summary.not_run) / run.summary.total) * 100);
                                return (
                                    <Card key={run.id} className="border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer" onClick={() => { setActiveRun(run); setCaseIdx(run.cases.findIndex(c => c.result === 'not_run') || 0); }}>
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <Play className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{run.planTitle}</p>
                                                <p className="text-xs text-muted-foreground">By {run.startedBy} · {pct}% done</p>
                                            </div>
                                            <div className="w-24">
                                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                                Resume <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Completed runs */}
                {completedRuns.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />Completed ({completedRuns.length})
                        </h3>
                        <div className="grid gap-3">
                            {completedRuns.map(run => {
                                const passRate = run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0;
                                return (
                                    <Card key={run.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setActiveRun(run); setCaseIdx(0); }}>
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', passRate >= 90 ? 'bg-emerald-500/20' : passRate >= 70 ? 'bg-amber-500/20' : 'bg-red-500/20')}>
                                                <Trophy className={cn('w-5 h-5', passRate >= 90 ? 'text-emerald-500' : passRate >= 70 ? 'text-amber-500' : 'text-red-500')} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{run.planTitle}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    By {run.startedBy} · {run.completedAt ? new Date(run.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-semibold">
                                                <span className="text-emerald-500">✓{run.summary.passed}</span>
                                                <span className="text-red-500">✗{run.summary.failed}</span>
                                                <span className="text-amber-500">⊘{run.summary.blocked}</span>
                                            </div>
                                            <Badge variant="outline" className={cn('text-xs', passRate >= 90 ? 'border-emerald-500/30 text-emerald-500' : passRate >= 70 ? 'border-amber-500/30 text-amber-500' : 'border-red-500/30 text-red-500')}>
                                                {passRate}% pass
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && runs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Play className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">No test runs yet</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Go to a Test Plan and click &ldquo;Start Run&rdquo; to begin executing test cases. Results will appear here.
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                    </div>
                )}
            </div>
        </PageShell>
    );
}
