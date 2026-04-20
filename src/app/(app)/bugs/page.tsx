"use client";

import { useState, useMemo } from 'react';
import { useJiraKPI } from '@/hooks/useJiraKPI';
import { EnhancedMetricCard } from '@/components/dashboard/EnhancedMetricCard';
import { BugTrendChart } from '@/components/dashboard/BugTrendChart';
import { PriorityDonutChart } from '@/components/dashboard/PriorityDonutChart';
import { TeamPerformanceChart } from '@/components/dashboard/TeamPerformanceChart';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Bug, RefreshCw, TrendingUp, BarChart3, Calendar,
    AlertTriangle, ArrowLeft, CheckCircle2, Flame, Activity
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Status classification
const CLOSED_SET = new Set([
    'done','closed','resolved','live','completed','fixed','dev completed','infra completed',
    'by design','qa verified','verified','released','deployed','deferred','not reproducing',
    'change','changed','duplicate',"won't do",
]);
const IN_PROGRESS_SET = new Set([
    'in progress','inprogress','in development','testing','qa','in review',
    'code review','uat','staging','retest','reopen',
]);

function classifyStatus(s: string): 'open'|'in_progress'|'closed' {
    const sl = s.toLowerCase().trim();
    if (CLOSED_SET.has(sl)) return 'closed';
    if (IN_PROGRESS_SET.has(sl)) return 'in_progress';
    return 'open';
}

function n(v: number|undefined|null) { return String(v ?? 0); }

export default function BugsDashboard() {
    const { kpi, loading, error, lastSync, forceRefresh } = useJiraKPI();
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [isPolling, setIsPolling] = useState(true);

    // Current and previous month data
    const [now] = useState(() => new Date());
    const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const cm = kpi?.currentMonth;
    const pm = kpi?.previousMonth;

    // Filter data by selected team
    const filteredData = useMemo(() => {
        if (!kpi) return null;
        
        if (selectedTeam === 'all') {
            return {
                bugs: kpi.bugs,
                people: kpi.people,
                monthly: kpi.monthly,
            };
        }

        const teamMemberIds = new Set(
            kpi.people.filter(p => p.teams.includes(selectedTeam)).map(p => p.userId)
        );

        const teamBugs = kpi.bugs.filter(b =>
            b.team === selectedTeam ||
            (b.reporter && teamMemberIds.has(b.reporter.accountId)) ||
            (b.assignee && teamMemberIds.has(b.assignee.accountId))
        );

        const teamPeople = kpi.people.filter(p => p.teams.includes(selectedTeam));

        return {
            bugs: teamBugs,
            people: teamPeople,
            monthly: kpi.monthly,
        };
    }, [kpi, selectedTeam]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!filteredData) return null;

        const totalBugs = filteredData.bugs.length;
        const openBugs = filteredData.bugs.filter(b => classifyStatus(b.status) === 'open').length;
        const closedBugs = filteredData.bugs.filter(b => classifyStatus(b.status) === 'closed').length;
        const criticalBugs = filteredData.bugs.filter(b => b.priority === 'Highest').length;
        const closeRate = totalBugs > 0 ? Math.round((closedBugs / totalBugs) * 100) : 0;

        const currentMonthBugs = filteredData.bugs.filter(b => b.created.startsWith(curKey)).length;
        const previousMonthBugs = filteredData.bugs.filter(b => b.created.startsWith(prevKey)).length;
        const monthDelta = currentMonthBugs - previousMonthBugs;

        return {
            totalBugs,
            openBugs,
            closedBugs,
            criticalBugs,
            closeRate,
            currentMonthBugs,
            previousMonthBugs,
            monthDelta,
        };
    }, [filteredData, curKey, prevKey]);

    if (loading && !kpi) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"/>
                    <RefreshCw className="relative w-16 h-16 animate-spin text-primary"/>
                </div>
                <div className="text-2xl font-black mt-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Loading Dashboard...
                </div>
            </div>
        );
    }

    if (error && !kpi) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"/>
                    <AlertTriangle className="relative w-16 h-16 text-red-500"/>
                </div>
                <div className="text-xl font-bold text-red-600 mb-4">Failed to load: {error}</div>
                <Button onClick={forceRefresh} size="lg" className="h-12 px-8 text-base font-bold">
                    <RefreshCw className="w-5 h-5 mr-2"/>
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="max-w-[1800px] mx-auto p-6 md:p-8 lg:p-12 space-y-8">
                {/* HEADER - Ultra Clean */}
                <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5"/>
                    <div className="relative p-8 md:p-10">
                        <div className="flex items-center justify-between flex-wrap gap-6">
                            <div className="flex items-center gap-5">
                                <Link href="/apps">
                                    <Button variant="outline" size="icon" className="rounded-2xl h-14 w-14 border-2 hover:scale-110 transition-transform shadow-lg">
                                        <ArrowLeft className="h-6 w-6"/>
                                    </Button>
                                </Link>
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                                        Bugs Dashboard
                                    </h1>
                                    <p className="text-base text-muted-foreground font-semibold">
                                        Real-time visual insights and team performance analytics
                                        {lastSync && <span suppressHydrationWarning className="ml-3 text-primary">· Last sync {lastSync.toLocaleTimeString()}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 flex-wrap">
                                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                                    <SelectTrigger className="w-56 h-12 border-2 font-bold text-base hover:border-primary transition-colors shadow-md">
                                        <SelectValue placeholder="All Teams"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="font-bold text-base">🏢 All Teams</SelectItem>
                                        {(kpi?.allTeams || []).map(t => (
                                            <SelectItem key={t} value={t} className="font-semibold">{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button 
                                    onClick={() => setIsPolling(!isPolling)}
                                    variant="outline"
                                    className={cn(
                                        'h-12 px-5 border-2 font-bold text-base transition-all shadow-md',
                                        isPolling ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400 shadow-green-200' : 'border-slate-300'
                                    )}
                                >
                                    <Activity className={cn('w-5 h-5 mr-2', isPolling && 'animate-pulse')} />
                                    {isPolling ? 'Live' : 'Paused'}
                                </Button>
                                <Button 
                                    onClick={forceRefresh} 
                                    variant="outline" 
                                    disabled={loading}
                                    className="h-12 px-5 border-2 font-bold text-base hover:border-primary transition-colors shadow-md"
                                >
                                    <RefreshCw className={cn('w-5 h-5 mr-2', loading && 'animate-spin')}/>
                                    Refresh
                                </Button>
                                <Link href="/analytics/bugs">
                                    <Button className="h-12 px-6 font-bold text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                                        <BarChart3 className="w-5 h-5 mr-2"/>
                                        Full Analytics
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HERO METRICS - Extra Large */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <EnhancedMetricCard
                        title="Total Bugs"
                        value={n(metrics?.totalBugs)}
                        icon={Bug}
                        color="red"
                        trend={{
                            value: Math.abs(metrics?.monthDelta || 0),
                            label: "vs last month",
                            isPositive: (metrics?.monthDelta || 0) < 0
                        }}
                        sparklineData={filteredData?.monthly.slice(-6).map(m => m.bugs) || []}
                        subtitle={selectedTeam === 'all' ? 'All teams' : selectedTeam}
                    />
                    <EnhancedMetricCard
                        title="Open Bugs"
                        value={n(metrics?.openBugs)}
                        icon={AlertTriangle}
                        color="amber"
                        sparklineData={filteredData?.monthly.slice(-6).map(m => m.open) || []}
                        subtitle="Needs attention"
                    />
                    <EnhancedMetricCard
                        title="Closed Bugs"
                        value={n(metrics?.closedBugs)}
                        icon={CheckCircle2}
                        color="green"
                        sparklineData={filteredData?.monthly.slice(-6).map(m => m.closed) || []}
                        subtitle="Resolved"
                    />
                    <EnhancedMetricCard
                        title="Close Rate"
                        value={`${metrics?.closeRate || 0}%`}
                        icon={TrendingUp}
                        color={
                            (metrics?.closeRate || 0) >= 70 ? 'green' :
                            (metrics?.closeRate || 0) >= 40 ? 'amber' : 'red'
                        }
                        progress={metrics?.closeRate || 0}
                        subtitle="Resolution rate"
                    />
                </div>

                {/* CHARTS ROW - Much Larger */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                        <BugTrendChart
                            data={filteredData?.monthly.slice(-6).map(m => ({
                                month: m.label || m.month,
                                bugs: m.bugs,
                                open: m.open,
                                closed: m.closed,
                                inProgress: m.inProgress,
                            })) || []}
                            title="6-Month Bug Trend"
                        />
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                        <PriorityDonutChart
                            data={{
                                Highest: filteredData?.bugs.filter(b => b.priority === 'Highest').length || 0,
                                High: filteredData?.bugs.filter(b => b.priority === 'High').length || 0,
                                Medium: filteredData?.bugs.filter(b => b.priority === 'Medium').length || 0,
                                Low: filteredData?.bugs.filter(b => b.priority === 'Low').length || 0,
                                Lowest: filteredData?.bugs.filter(b => b.priority === 'Lowest').length || 0,
                            }}
                            title="Priority Distribution"
                        />
                    </div>
                </div>

                {/* INSIGHTS ROW - Larger Cards */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-xl">
                            <Flame className="w-6 h-6 text-white"/>
                        </div>
                        <h2 className="text-3xl font-black text-foreground">Key Insights</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {metrics && metrics.criticalBugs > 0 && (
                            <InsightCard
                                type="danger"
                                title="Critical Bugs Alert"
                                description={`${metrics.criticalBugs} critical priority bugs require immediate attention.`}
                                metric={{
                                    label: "Critical Bugs",
                                    value: metrics.criticalBugs
                                }}
                                action={{
                                    label: "View in Analytics",
                                    onClick: () => window.location.href = '/analytics/bugs?priority=Highest'
                                }}
                            />
                        )}
                        {metrics && (
                            <InsightCard
                                type={
                                    metrics.closeRate >= 70 ? 'success' :
                                    metrics.closeRate >= 40 ? 'warning' : 'danger'
                                }
                                title="Resolution Performance"
                                description={`Your team has a ${metrics.closeRate}% bug resolution rate.`}
                                metric={{
                                    label: "Close Rate",
                                    value: `${metrics.closeRate}%`
                                }}
                            />
                        )}
                        {metrics && (
                            <InsightCard
                                type={metrics.monthDelta < 0 ? 'success' : 'warning'}
                                title="Monthly Trend"
                                description={`Bug count ${metrics.monthDelta < 0 ? 'decreased' : 'increased'} by ${Math.abs(metrics.monthDelta)} this month.`}
                                metric={{
                                    label: metrics.monthDelta < 0 ? "Improvement" : "Increase",
                                    value: Math.abs(metrics.monthDelta)
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* TEAM PERFORMANCE - Larger */}
                {filteredData && filteredData.people.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                        <TeamPerformanceChart
                            data={filteredData.people
                                .sort((a, b) => b.bugsReported - a.bugsReported)
                                .slice(0, 10)
                                .map(p => ({
                                    name: p.name,
                                    bugsReported: p.bugsReported,
                                    bugsClosed: p.bugsClosed,
                                    closeRate: p.closeRate,
                                }))}
                            title={selectedTeam === 'all' ? 'Top 10 Performers' : `${selectedTeam} - Top Performers`}
                        />
                    </div>
                )}

                {/* PERIOD COMPARISON - Much Larger Cards */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-xl">
                            <Calendar className="w-6 h-6 text-white"/>
                        </div>
                        <h2 className="text-3xl font-black text-foreground">Period Comparison</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                title: 'Overall',
                                total: metrics?.totalBugs || 0,
                                open: metrics?.openBugs || 0,
                                closed: metrics?.closedBugs || 0,
                                critical: metrics?.criticalBugs || 0,
                                gradient: 'from-purple-500 to-pink-500',
                                bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
                                borderColor: 'border-purple-300 dark:border-purple-700'
                            },
                            {
                                title: cm?.label || 'Current Month',
                                total: metrics?.currentMonthBugs || 0,
                                open: cm?.open || 0,
                                closed: cm?.closed || 0,
                                critical: cm?.critical || 0,
                                gradient: 'from-amber-500 to-orange-500',
                                bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
                                borderColor: 'border-amber-300 dark:border-amber-700'
                            },
                            {
                                title: pm?.label || 'Previous Month',
                                total: metrics?.previousMonthBugs || 0,
                                open: pm?.open || 0,
                                closed: pm?.closed || 0,
                                critical: pm?.critical || 0,
                                gradient: 'from-blue-500 to-cyan-500',
                                bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
                                borderColor: 'border-blue-300 dark:border-blue-700'
                            },
                        ].map((period) => {
                            const closeRate = period.total > 0 ? Math.round((period.closed / period.total) * 100) : 0;
                            return (
                                <Card key={period.title} className={cn('border-2 shadow-2xl overflow-hidden hover:scale-105 transition-transform', period.borderColor)}>
                                    <CardHeader className={cn('pb-6 bg-gradient-to-br', period.bgGradient)}>
                                        <CardTitle className={cn('text-xl font-black bg-gradient-to-r bg-clip-text text-transparent', period.gradient)}>
                                            {period.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-8 pb-8">
                                        <div className="grid grid-cols-2 gap-5 mb-8">
                                            <div className="text-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 shadow-lg">
                                                <div className="text-4xl font-black text-foreground mb-1">{period.total}</div>
                                                <div className="text-sm font-bold text-muted-foreground">Total</div>
                                            </div>
                                            <div className="text-center p-5 rounded-2xl bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900 shadow-lg">
                                                <div className="text-4xl font-black text-red-600 mb-1">{period.open}</div>
                                                <div className="text-sm font-bold text-muted-foreground">Open</div>
                                            </div>
                                            <div className="text-center p-5 rounded-2xl bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-900 shadow-lg">
                                                <div className="text-4xl font-black text-green-600 mb-1">{period.closed}</div>
                                                <div className="text-sm font-bold text-muted-foreground">Closed</div>
                                            </div>
                                            <div className="text-center p-5 rounded-2xl bg-red-100 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-900 shadow-lg">
                                                <div className="text-4xl font-black text-red-700 mb-1">{period.critical}</div>
                                                <div className="text-sm font-bold text-muted-foreground">Critical</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-center pt-6 border-t-2 border-dashed border-slate-300 dark:border-slate-700">
                                            <ProgressRing
                                                progress={closeRate}
                                                size={120}
                                                strokeWidth={10}
                                                color={closeRate >= 70 ? 'green' : closeRate >= 40 ? 'amber' : 'red'}
                                                label="Close Rate"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
