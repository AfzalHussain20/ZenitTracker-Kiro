'use client';

import { PageShell } from '@/components/ui/page-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Layout, Play, CheckCircle2, TrendingUp, Activity, XCircle, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { TestService, TestPlan } from '@/lib/test-suite-service';

interface RunSummary {
    id: string;
    planTitle: string;
    startedBy: string;
    startedAt: string;
    completedAt: string | null;
    status: 'in_progress' | 'completed';
    summary: { total: number; passed: number; failed: number; blocked: number; skipped: number; not_run: number };
}

export default function TestSuiteDashboard() {
    const [plans, setPlans] = useState<TestPlan[]>([]);
    const [runs, setRuns] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [plansData, runsRes] = await Promise.all([
                    TestService.getPlans(),
                    fetch('/api/test-runs?limit=20').then(r => r.json()),
                ]);
                setPlans(plansData);
                setRuns(runsRes.runs ?? []);
            } catch {}
            finally { setLoading(false); }
        }
        load();
    }, []);

    // Real stats
    const totalPlans = plans.length;
    const totalRuns = runs.length;
    const activeRuns = runs.filter(r => r.status === 'in_progress').length;
    const completedRuns = runs.filter(r => r.status === 'completed');
    const totalCasesRun = completedRuns.reduce((s, r) => s + r.summary.total, 0);
    const totalPassed = completedRuns.reduce((s, r) => s + r.summary.passed, 0);
    const passRate = totalCasesRun > 0 ? Math.round((totalPassed / totalCasesRun) * 100) : 0;
    const totalFailed = completedRuns.reduce((s, r) => s + r.summary.failed, 0);

    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

    return (
        <PageShell
            title="Zenit Test Suite"
            description="Plan, execute, and track quality across your entire testing effort."
            actions={
                <Link href="/test-suite/plans/new">
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-5 h-5 mr-2" />
                        New Test Plan
                    </Button>
                </Link>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        <motion.div variants={item}><StatsCard icon={Layout} label="Test Plans" value={totalPlans} /></motion.div>
                        <motion.div variants={item}><StatsCard icon={Play} label="Total Runs" value={totalRuns} sub={activeRuns > 0 ? `${activeRuns} active` : undefined} /></motion.div>
                        <motion.div variants={item}><StatsCard icon={CheckCircle2} label="Pass Rate" value={`${passRate}%`} isGood={passRate >= 85} /></motion.div>
                        <motion.div variants={item}><StatsCard icon={XCircle} label="Total Failures" value={totalFailed} isAlert={totalFailed > 0} /></motion.div>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Recent runs */}
                        <div className="lg:col-span-2 space-y-5">
                            <h2 className="text-lg font-bold">Recent Runs</h2>
                            {runs.length === 0 ? (
                                <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
                                    <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                    <p className="text-sm text-muted-foreground">No runs yet. Start one from a test plan.</p>
                                </div>
                            ) : (
                                <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                                    {runs.slice(0, 8).map(run => {
                                        const pct = run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0;
                                        const isActive = run.status === 'in_progress';
                                        return (
                                            <motion.div key={run.id} variants={item}>
                                                <Link href="/test-suite/runs">
                                                    <div className={cn('p-4 rounded-xl border flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer', isActive && 'border-blue-500/30 bg-blue-500/5')}>
                                                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isActive ? 'bg-blue-500/20' : pct >= 85 ? 'bg-emerald-500/20' : 'bg-amber-500/20')}>
                                                            {isActive ? <Activity className="w-5 h-5 text-blue-500 animate-pulse" /> : <CheckCircle2 className={cn('w-5 h-5', pct >= 85 ? 'text-emerald-500' : 'text-amber-500')} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm truncate">{run.planTitle}</p>
                                                            <p className="text-xs text-muted-foreground">{run.startedBy} · {run.startedAt ? new Date(run.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs font-semibold">
                                                            <span className="text-emerald-500">✓{run.summary.passed}</span>
                                                            <span className="text-red-500">✗{run.summary.failed}</span>
                                                        </div>
                                                        {isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-500">LIVE</span>}
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </div>

                        {/* Quick access */}
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Quick Access</h2>
                            <div className="space-y-3">
                                <Link href="/test-suite/plans" className="block">
                                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <Layout className="w-5 h-5 text-primary" />Test Plans
                                            </CardTitle>
                                            <CardDescription>{totalPlans} plan{totalPlans !== 1 ? 's' : ''}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                </Link>
                                <Link href="/test-suite/runs" className="block">
                                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <Play className="w-5 h-5 text-primary" />Test Runs
                                            </CardTitle>
                                            <CardDescription>{activeRuns} active · {completedRuns.length} completed</CardDescription>
                                        </CardHeader>
                                    </Card>
                                </Link>
                            </div>

                            {/* Recent plans */}
                            {plans.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Plans</h3>
                                    <div className="space-y-2">
                                        {plans.slice(0, 5).map(p => (
                                            <Link key={p.id} href={`/test-suite/plans/${p.id}`}>
                                                <div className="p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-3">
                                                    <Layout className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium truncate">{p.title}</span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </PageShell>
    );
}

function StatsCard({ icon: Icon, label, value, sub, isGood, isAlert }: { icon: any; label: string; value: string | number; sub?: string; isGood?: boolean; isAlert?: boolean }) {
    return (
        <Card className="border-none shadow-lg">
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <div className={cn('p-2.5 rounded-xl', isAlert ? 'bg-red-500/10 text-red-500' : isGood ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary')}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <h3 className="text-2xl font-bold mt-0.5">{value}</h3>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </CardContent>
        </Card>
    );
}
