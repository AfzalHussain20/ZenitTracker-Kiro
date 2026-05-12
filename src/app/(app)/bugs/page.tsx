"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useJiraKPI } from '@/hooks/useJiraKPI';
import { useWorklogs } from '@/hooks/useWorklogs';
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
    AlertTriangle, ArrowLeft, CheckCircle2, Flame, Activity,
    LayoutDashboard, Users, Upload, X, Image as ImageIcon, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// ─── Status classification ────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttachedImage {
    id: string;
    name: string;
    url: string;
    uploadedAt: Date;
}

interface TeamStat {
    team: string;
    completed: number;
    inProgress: number;
    pending: number;
    total: number;
}

// ─── Avatar color palette (consistent per name) ──────────────────────────────
const AVATAR_COLORS = [
    { bg: '#f97316', text: '#1e1b4b' }, // orange
    { bg: '#8b5cf6', text: '#ffffff' }, // purple
    { bg: '#06b6d4', text: '#ffffff' }, // cyan
    { bg: '#10b981', text: '#ffffff' }, // emerald
    { bg: '#f43f5e', text: '#ffffff' }, // rose
    { bg: '#3b82f6', text: '#ffffff' }, // blue
    { bg: '#eab308', text: '#1e1b4b' }, // yellow
    { bg: '#ec4899', text: '#ffffff' }, // pink
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Donut Chart Component ────────────────────────────────────────────────────
const DONUT_COLORS = {
    completed: '#22c55e',
    inProgress: '#f59e0b',
    pending: '#ef4444',
};

interface DonutChartProps {
    completed: number;
    inProgress: number;
    pending: number;
    centerLabel?: string;
    hours?: number | null;        // worklog hours to show in center
    hoursLabel?: string;          // e.g. "This Month" or "This Year"
}

function StatusDonutChart({ completed, inProgress, pending, centerLabel, hours, hoursLabel }: DonutChartProps) {
    const [hoveredSegment, setHoveredSegment] = React.useState<{ name: string; value: number; pct: number; color: string } | null>(null);
    const total = completed + inProgress + pending;
    const data = [
        { name: 'Completed', value: completed, color: DONUT_COLORS.completed },
        { name: 'In Progress', value: inProgress, color: DONUT_COLORS.inProgress },
        { name: 'Pending', value: pending, color: DONUT_COLORS.pending },
    ].filter(d => d.value > 0);

    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

    return (
        <div className="flex items-center gap-8">
            <div className="relative flex-shrink-0">
                <PieChart width={220} height={220}>
                    <Pie
                        data={data}
                        cx={110}
                        cy={110}
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        label={false}
                        labelLine={false}
                        onMouseEnter={(entry) => {
                            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                            setHoveredSegment({ name: entry.name, value: entry.value, pct, color: entry.color });
                        }}
                        onMouseLeave={() => setHoveredSegment(null)}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                    </Pie>
                </PieChart>
                {/* Center label — shows hover info or default total */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center px-2">
                        {hoveredSegment ? (
                            <>
                                <div className="text-xl font-black" style={{ color: hoveredSegment.color }}>
                                    {hoveredSegment.pct}%
                                </div>
                                <div className="text-xs font-bold text-muted-foreground leading-tight">
                                    {hoveredSegment.value} bugs
                                </div>
                                <div className="text-xs font-semibold mt-0.5" style={{ color: hoveredSegment.color }}>
                                    {hoveredSegment.name}
                                </div>
                            </>
                        ) : hours != null ? (
                            <>
                                <div className="text-2xl font-black text-foreground">{hours}hr</div>
                                <div className="text-xs text-muted-foreground font-semibold leading-tight">{hoursLabel || 'Logged'}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{centerLabel ?? total} bugs</div>
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-black text-foreground">
                                    {centerLabel ?? total}
                                </div>
                                <div className="text-xs text-muted-foreground font-semibold">bugs</div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Legend */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Completed</span>
                    <span className="ml-auto text-sm font-bold text-green-600">{completedPct}%</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">In Progress</span>
                    <span className="ml-auto text-sm font-bold text-amber-600">{inProgressPct}%</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Pending</span>
                    <span className="ml-auto text-sm font-bold text-red-600">{pendingPct}%</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Total bugs shown in center</p>
            </div>
        </div>
    );
}

// ─── Team Progress Stacked Bar Chart ─────────────────────────────────────────
interface TeamProgressChartProps {
    data: TeamStat[];
    onTeamClick: (team: string) => void;
}

// Custom XAxis tick that rotates and auto-sizes font to fit bar width
function CustomXAxisTick(props: any) {
    const { x, y, payload, width, visibleTicksCount } = props;
    const label: string = payload.value || '';
    // Calculate available width per bar
    const barWidth = visibleTicksCount > 0 ? Math.floor((width || 600) / visibleTicksCount) : 60;
    // Scale font: smaller bars → smaller font, min 9px max 12px
    const fontSize = Math.max(9, Math.min(12, Math.floor(barWidth / 6)));
    // Max chars that fit at this font size (approx 0.6× font-size per char)
    const maxChars = Math.max(6, Math.floor(barWidth / (fontSize * 0.62)));

    // Split label into up to 2 lines at word boundaries
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (test.length <= maxChars) {
            current = test;
        } else {
            if (current) lines.push(current);
            // If single word is still too long, truncate it
            current = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
        }
    }
    if (current) lines.push(current);
    // Cap at 2 lines
    const displayLines = lines.slice(0, 2);

    return (
        <g transform={`translate(${x},${y})`}>
            {displayLines.map((line, i) => (
                <text
                    key={i}
                    x={0}
                    y={0}
                    dy={14 + i * (fontSize + 3)}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={fontSize}
                    fontWeight={600}
                >
                    {line}
                </text>
            ))}
        </g>
    );
}

function TeamProgressChart({ data, onTeamClick }: TeamProgressChartProps) {
    // Normalize to percentages for stacked bar
    // Teams with 0 bugs get a tiny placeholder (2%) so they appear as a visible empty bar
    const chartData = data.map(d => ({
        team: d.team,
        Completed: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        'In Progress': d.total > 0 ? Math.round((d.inProgress / d.total) * 100) : 0,
        Pending: d.total > 0 ? Math.round((d.pending / d.total) * 100) : 2, // 2% placeholder for 0-bug teams
        _raw: d,
    }));

    // Bottom margin only needs to fit the 2-line team name labels now (legend is HTML below)
    const bottomMargin = data.length > 10 ? 55 : 45;

    return (
        <div className="p-6">
            <h3 className="text-xl font-black text-foreground mb-1">Team Progress</h3>
            <p className="text-sm text-muted-foreground mb-6">Click a bar to drill into team details</p>
            <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: bottomMargin }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                        dataKey="team"
                        tick={<CustomXAxisTick />}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v: number) => `${v}`}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        formatter={(value: number, name: string, props: any) => {
                            const raw = props?.payload?._raw as TeamStat | undefined;
                            if (!raw) return [`${value}%`, name];
                            if (raw.total === 0) return ['No bugs recorded', name];
                            const count = name === 'Completed' ? raw.completed : name === 'In Progress' ? raw.inProgress : raw.pending;
                            return [`${value}% (${count} bugs)`, name];
                        }}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                    <Bar
                        dataKey="Completed"
                        stackId="a"
                        fill={DONUT_COLORS.completed}
                        radius={[0, 0, 0, 0]}
                        cursor="pointer"
                        onClick={(data: { _raw: TeamStat }) => onTeamClick(data._raw.team)}
                    />
                    <Bar
                        dataKey="In Progress"
                        stackId="a"
                        fill={DONUT_COLORS.inProgress}
                        cursor="pointer"
                        onClick={(data: { _raw: TeamStat }) => onTeamClick(data._raw.team)}
                    />
                    <Bar
                        dataKey="Pending"
                        stackId="a"
                        fill={DONUT_COLORS.pending}
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={(data: { _raw: TeamStat }) => onTeamClick(data._raw.team)}
                    />
                </BarChart>
            </ResponsiveContainer>
            {/* Custom legend rendered outside SVG so it never overlaps labels */}
            <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DONUT_COLORS.completed }} />
                    <span className="text-sm font-semibold text-foreground">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DONUT_COLORS.inProgress }} />
                    <span className="text-sm font-semibold text-foreground">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DONUT_COLORS.pending }} />
                    <span className="text-sm font-semibold text-foreground">Pending</span>
                </div>
            </div>
        </div>
    );
}

// ─── Image Attachment Panel ───────────────────────────────────────────────────
interface ImagePanelProps {
    images: AttachedImage[];
    onUpload: (file: File) => Promise<void>;
    onRemove: (id: string) => void;
    uploading: boolean;
}

function ImagePanel({ images, onUpload, onRemove, uploading }: ImagePanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) onUpload(file);
    }, [onUpload]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onUpload(file);
        if (inputRef.current) inputRef.current.value = '';
    }, [onUpload]);

    return (
        <div className="space-y-4">
            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
                    'hover:border-primary hover:bg-primary/5',
                    uploading ? 'opacity-60 pointer-events-none' : 'border-slate-300 dark:border-slate-700'
                )}
            >
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-semibold text-muted-foreground">Uploading...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Drop image here or click to upload</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP supported</p>
                    </div>
                )}
            </div>

            {/* Image grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img) => (
                        <div key={img.id} className="relative group rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 aspect-video bg-slate-100 dark:bg-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={img.url}
                                alt={img.name}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                <button
                                    onClick={() => onRemove(img.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-xs truncate">{img.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {images.length === 0 && !uploading && (
                <p className="text-center text-sm text-muted-foreground py-2">No images attached yet</p>
            )}
        </div>
    );
}

// ─── Team Detail View ─────────────────────────────────────────────────────────
interface TeamDetailViewProps {
    teamName: string;
    teamStats: TeamStat;
    members: Array<{
        name: string;
        avatarUrl?: string;
        userId: string;
        total: number;
        completed: number;
        inProgress: number;
        pending: number;
    }>;
    kpi: NonNullable<ReturnType<typeof useJiraKPI>['kpi']>;
    onBack: () => void;
}

function TeamDetailView({ teamName, teamStats, members, kpi, onBack }: TeamDetailViewProps) {
    const [showAll, setShowAll] = useState(false);
    const [selectedMember, setSelectedMember] = useState<typeof members[0] | null>(null);
    const [hoursPeriod, setHoursPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const { data: worklogData, loading: worklogLoading } = useWorklogs();

    const now = new Date();

    // Available months/years from kpi bugs
    const availableMonths = React.useMemo(() => {
        const keys = new Set<string>();
        kpi.bugs.forEach(b => { if (b.created) keys.add(b.created.slice(0, 7)); });
        return Array.from(keys).sort().reverse();
    }, [kpi.bugs]);

    const availableYears = React.useMemo(() => {
        const years = new Set<string>();
        kpi.bugs.forEach(b => { if (b.created) years.add(b.created.slice(0, 4)); });
        return Array.from(years).sort().reverse();
    }, [kpi.bugs]);

    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));

    const displayed = showAll ? members : members.slice(0, 5);
    const filterKey = hoursPeriod === 'monthly' ? selectedMonth : selectedYear;

    function fmtMonthShort(key: string) {
        const [y, m] = key.split('-');
        return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'short' });
    }
    function fmtMonthFull(key: string) {
        const [y, m] = key.split('-');
        return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }

    // Donut data — all-time when no member, period-filtered when member selected
    const donutData = React.useMemo(() => {
        if (!selectedMember) {
            return { completed: teamStats.completed, inProgress: teamStats.inProgress, pending: teamStats.pending, total: teamStats.total };
        }
        // Filter bugs by period for selected member
        const periodBugs = kpi.bugs.filter(b => {
            const created = b.created || '';
            if (!created.startsWith(filterKey)) return false;
            return (b.reporter && b.reporter.accountId === selectedMember.userId) ||
                   (b.assignee && b.assignee.accountId === selectedMember.userId);
        });
        return {
            completed: periodBugs.filter(b => classifyStatus(b.status) === 'closed').length,
            inProgress: periodBugs.filter(b => classifyStatus(b.status) === 'in_progress').length,
            pending: periodBugs.filter(b => classifyStatus(b.status) === 'open').length,
            total: periodBugs.length,
        };
    }, [selectedMember, filterKey, kpi, teamStats]);

    const donutTitle = selectedMember ? selectedMember.name : 'Overall status';

    // Hours — all-time for team overall, period-filtered for selected member
    const donutHours = React.useMemo(() => {
        if (!worklogData?.byUser) return null;
        if (!selectedMember) {
            // Team all-time total
            const teamNames = new Set(members.map(m => m.name.toLowerCase()));
            const total = worklogData.byUser
                .filter((u: { author: string }) => teamNames.has(u.author.toLowerCase()) ||
                    members.some(m => m.name.toLowerCase().includes(u.author.toLowerCase().split(' ')[0].toLowerCase())))
                .reduce((sum: number, u: { totalHours: number }) => sum + u.totalHours, 0);
            return Math.round(total * 10) / 10;
        }
        // Period-filtered hours for selected member using raw worklogs
        if (!worklogData.worklogs) return null;
        const filtered = worklogData.worklogs.filter((w: { authorId: string; started: string; timeSpentSeconds: number }) => {
            if (w.authorId !== selectedMember.userId) return false;
            const dateStr = (w.started || '').slice(0, hoursPeriod === 'monthly' ? 7 : 4);
            return dateStr === filterKey;
        });
        const totalSecs = filtered.reduce((s: number, w: { timeSpentSeconds: number }) => s + w.timeSpentSeconds, 0);
        return Math.round(totalSecs / 3600 * 10) / 10;
    }, [worklogData, selectedMember, members, hoursPeriod, filterKey]);

    const hoursLabel = !selectedMember ? 'Total' : hoursPeriod === 'monthly' ? fmtMonthFull(selectedMonth) : selectedYear;

    return (
        <div className="space-y-6">
            {/* Back button + title */}
            <div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline mb-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Team Dashboard
                </button>
                <h2 className="text-3xl font-black text-foreground">{teamName} <span className="text-muted-foreground font-normal">• Team Detail</span></h2>
                <p className="text-sm text-muted-foreground mt-1">Click a member to see their individual stats.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Members list */}
                <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-black">Members</CardTitle>
                            <div className="flex items-center gap-2">
                                {selectedMember && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedMember(null)}
                                        className="text-xs text-muted-foreground font-semibold h-7 px-2"
                                    >
                                        <X className="w-3 h-3 mr-1" /> Clear
                                    </Button>
                                )}
                                {members.length > 5 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowAll(!showAll)}
                                        className="font-bold text-sm"
                                    >
                                        {showAll ? 'Show Less' : 'Show All'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {displayed.map((member, i) => {
                                const completedPct = member.total > 0 ? Math.round((member.completed / member.total) * 100) : 0;
                                const inProgressPct = member.total > 0 ? Math.round((member.inProgress / member.total) * 100) : 0;
                                const pendingPct = member.total > 0 ? Math.round((member.pending / member.total) * 100) : 0;
                                const initials = member.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                                const isSelected = selectedMember?.name === member.name;
                                return (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedMember(isSelected ? null : member)}
                                        className={cn(
                                            'flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors',
                                            isSelected
                                                ? 'bg-primary/8 border-l-4 border-primary'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 border-l-4 border-transparent'
                                        )}
                                    >
                                        {(() => {
                                            const avatarColor = getAvatarColor(member.name);
                                            return (
                                                <div
                                                    className={cn(
                                                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 transition-all relative overflow-hidden',
                                                        isSelected
                                                            ? 'ring-2 ring-primary ring-offset-2'
                                                            : 'ring-2 ring-violet-500 ring-offset-1'
                                                    )}
                                                    style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                                >
                                                    <span className="select-none z-10 relative">{initials}</span>
                                                    {member.avatarUrl && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={member.avatarUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-20" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <span className={cn('font-bold w-32 truncate', isSelected ? 'text-primary' : 'text-foreground')}>{member.name}</span>
                                        <div className="flex items-center gap-3 ml-auto text-sm flex-wrap">
                                            <span className="text-muted-foreground font-semibold">Total: {member.total}</span>
                                            <span className="text-green-600 font-bold">Done {member.completed} ({completedPct}%)</span>
                                            <span className="text-amber-600 font-bold">Prog {member.inProgress} ({inProgressPct}%)</span>
                                            <span className="text-red-600 font-bold">Pend {member.pending} ({pendingPct}%)</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {displayed.length === 0 && (
                                <div className="px-6 py-8 text-center text-muted-foreground text-sm">No members found for this team</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Status donut — sticky */}
                <div className="sticky top-20">
                <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                    <CardHeader className="pb-3">
                        <div>
                            <CardTitle className="text-lg font-black truncate">{donutTitle}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {selectedMember ? 'Individual bug breakdown' : 'Team overall status'}
                            </p>
                        </div>
                        {/* Period toggle + picker — only shown when a member is selected */}
                        {selectedMember && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
                                    <button
                                        onClick={() => setHoursPeriod('monthly')}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                            hoursPeriod === 'monthly' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >Monthly</button>
                                    <button
                                        onClick={() => setHoursPeriod('yearly')}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                            hoursPeriod === 'yearly' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >Yearly</button>
                                </div>
                                {/* Month pills — scrollable */}
                                {hoursPeriod === 'monthly' && (
                                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {availableMonths.map(m => (
                                            <button key={m} onClick={() => setSelectedMonth(m)}
                                                className={cn('flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap',
                                                    selectedMonth === m
                                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md'
                                                        : 'border-slate-200 dark:border-slate-700 text-muted-foreground bg-white dark:bg-slate-900 hover:border-primary hover:text-primary'
                                                )}
                                            >
                                                {fmtMonthShort(m)}
                                                <span className="ml-1 opacity-60 text-[10px]">{m.slice(2, 4)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {/* Year pills */}
                                {hoursPeriod === 'yearly' && (
                                    <div className="flex flex-wrap gap-2">
                                        {availableYears.map(y => (
                                            <button key={y} onClick={() => setSelectedYear(y)}
                                                className={cn('relative px-4 py-2 rounded-xl text-sm font-black border-2 transition-all',
                                                    selectedYear === y
                                                        ? 'border-primary bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                                                        : 'border-slate-200 dark:border-slate-700 text-muted-foreground bg-white dark:bg-slate-900 hover:border-primary hover:scale-105'
                                                )}
                                            >
                                                {selectedYear === y && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"/>}
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="flex items-center justify-center py-6">
                        {worklogLoading ? (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground font-semibold">Loading hours...</span>
                            </div>
                        ) : (
                            <StatusDonutChart
                                completed={donutData.completed}
                                inProgress={donutData.inProgress}
                                pending={donutData.pending}
                                hours={donutHours}
                                hoursLabel={hoursLabel}
                            />
                        )}
                    </CardContent>
                </Card>
                </div>
            </div>
        </div>
    );
}

// ─── Bugs Dashboard (Team Dashboard tab) ─────────────────────────────────────
interface BugsTeamDashboardProps {
    kpi: NonNullable<ReturnType<typeof useJiraKPI>['kpi']>;
    teamStats: TeamStat[];
    overallStats: { completed: number; inProgress: number; pending: number; total: number };
    images: AttachedImage[];
    onUploadImage: (file: File) => Promise<void>;
    onRemoveImage: (id: string) => void;
    uploading: boolean;
}

function BugsTeamDashboard({
    kpi, teamStats, overallStats, images, onUploadImage, onRemoveImage, uploading
}: BugsTeamDashboardProps) {
    const [selectedTeamDetail, setSelectedTeamDetail] = useState<string | null>(null);
    const [showImagePanel, setShowImagePanel] = useState(false);

    // Build member stats for selected team
    const teamDetailData = useMemo(() => {
        if (!selectedTeamDetail) return null;
        const stat = teamStats.find(t => t.team === selectedTeamDetail);
        if (!stat) return null;

        const teamMembers = kpi.people.filter(p => p.teams.includes(selectedTeamDetail));
        const members = teamMembers.map(p => {
            const memberBugs = kpi.bugs.filter(b =>
                (b.reporter && b.reporter.accountId === p.userId) ||
                (b.assignee && b.assignee.accountId === p.userId)
            );
            const completed = memberBugs.filter(b => classifyStatus(b.status) === 'closed').length;
            const inProgress = memberBugs.filter(b => classifyStatus(b.status) === 'in_progress').length;
            const pending = memberBugs.filter(b => classifyStatus(b.status) === 'open').length;
            return {
                name: p.name,
                avatarUrl: p.avatarUrl,
                userId: p.userId,
                total: memberBugs.length,
                completed,
                inProgress,
                pending,
            };
        }).sort((a, b) => b.total - a.total);

        return { stat, members };
    }, [selectedTeamDetail, teamStats, kpi]);

    if (selectedTeamDetail && teamDetailData) {
        return (
            <TeamDetailView
                teamName={selectedTeamDetail}
                teamStats={teamDetailData.stat}
                members={teamDetailData.members}
                kpi={kpi}
                onBack={() => setSelectedTeamDetail(null)}
            />
        );
    }

    return (
        <div className="space-y-8">
            {/* Dashboard header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-black text-foreground">Team Dashboard</h2>
                    <p className="text-sm text-muted-foreground mt-1">An overview of progress across all sub-teams.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowImagePanel(!showImagePanel)}
                    className={cn(
                        'h-10 px-4 border-2 font-bold transition-all',
                        showImagePanel ? 'border-primary bg-primary/5 text-primary' : 'border-slate-300'
                    )}
                >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    {images.length > 0 ? `Images (${images.length})` : 'Attach Images'}
                </Button>
            </div>

            {/* Image panel */}
            {showImagePanel && (
                <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-black flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-primary" />
                                Dashboard Images
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowImagePanel(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ImagePanel
                            images={images}
                            onUpload={onUploadImage}
                            onRemove={onRemoveImage}
                            uploading={uploading}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Team Progress stacked bar */}
            <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                <TeamProgressChart data={teamStats} onTeamClick={setSelectedTeamDetail} />
            </Card>

            {/* Overall status donut */}
            <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-black">Overall status</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                    <StatusDonutChart
                        completed={overallStats.completed}
                        inProgress={overallStats.inProgress}
                        pending={overallStats.pending}
                    />
                </CardContent>
            </Card>

            {/* Team cards grid */}
            <div>
                <h3 className="text-xl font-black text-foreground mb-4">Teams Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {teamStats.map((t) => {
                        const completedPct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                        const hasNoBugs = t.total === 0;
                        return (
                            <button
                                key={t.team}
                                onClick={() => setSelectedTeamDetail(t.team)}
                                className={cn(
                                    'text-left p-5 rounded-2xl border-2 bg-white dark:bg-slate-900 hover:border-primary hover:shadow-lg transition-all group',
                                    hasNoBugs
                                        ? 'border-slate-100 dark:border-slate-900 opacity-70'
                                        : 'border-slate-200 dark:border-slate-800'
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-black text-foreground text-base group-hover:text-primary transition-colors truncate pr-2">{t.team}</span>
                                    <span className={cn('text-xs font-bold flex-shrink-0', hasNoBugs ? 'text-slate-400' : 'text-muted-foreground')}>
                                        {t.total} bugs
                                    </span>
                                </div>
                                {hasNoBugs ? (
                                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800" />
                                ) : (
                                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                                        <div className="h-full bg-green-500 transition-all" style={{ width: `${(t.completed / t.total) * 100}%` }} />
                                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${(t.inProgress / t.total) * 100}%` }} />
                                        <div className="h-full bg-red-500 transition-all" style={{ width: `${(t.pending / t.total) * 100}%` }} />
                                    </div>
                                )}
                                <div className="flex justify-between mt-2 text-xs font-semibold">
                                    {hasNoBugs ? (
                                        <span className="text-slate-400">No bugs recorded</span>
                                    ) : (
                                        <>
                                            <span className="text-green-600">{completedPct}% done</span>
                                            <span className="text-muted-foreground">{t.pending} pending</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BugsDashboard() {
    const { kpi, loading, error, lastSync, forceRefresh } = useJiraKPI();
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [isPolling, setIsPolling] = useState(true);
    const [activeTab, setActiveTab] = useState<'bugs' | 'team'>('bugs');
    const [images, setImages] = useState<AttachedImage[]>([]);
    const [uploading, setUploading] = useState(false);

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
            return { bugs: kpi.bugs, people: kpi.people, monthly: kpi.monthly };
        }
        const teamMemberIds = new Set(
            kpi.people.filter((p) => p.teams.includes(selectedTeam)).map((p) => p.userId)
        );
        const teamBugs = kpi.bugs.filter((b) =>
            b.team === selectedTeam ||
            (b.reporter && teamMemberIds.has(b.reporter.accountId)) ||
            (b.assignee && teamMemberIds.has(b.assignee.accountId))
        );
        return {
            bugs: teamBugs,
            people: kpi.people.filter((p) => p.teams.includes(selectedTeam)),
            monthly: kpi.monthly,
        };
    }, [kpi, selectedTeam]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!filteredData) return null;
        const totalBugs = filteredData.bugs.length;
        const openBugs = filteredData.bugs.filter((b) => classifyStatus(b.status) === 'open').length;
        const closedBugs = filteredData.bugs.filter((b) => classifyStatus(b.status) === 'closed').length;
        const criticalBugs = filteredData.bugs.filter((b) => b.priority === 'Highest').length;
        const closeRate = totalBugs > 0 ? Math.round((closedBugs / totalBugs) * 100) : 0;
        const currentMonthBugs = filteredData.bugs.filter((b) => b.created.startsWith(curKey)).length;
        const previousMonthBugs = filteredData.bugs.filter((b) => b.created.startsWith(prevKey)).length;
        const monthDelta = currentMonthBugs - previousMonthBugs;
        return { totalBugs, openBugs, closedBugs, criticalBugs, closeRate, currentMonthBugs, previousMonthBugs, monthDelta };
    }, [filteredData, curKey, prevKey]);

    // Build per-team stats for Team Dashboard
    const teamStats = useMemo((): TeamStat[] => {
        if (!kpi) return [];
        return kpi.allTeams.map((team) => {
            const teamMemberIds = new Set(
                kpi.people.filter((p) => p.teams.includes(team)).map((p) => p.userId)
            );
            const bugs = kpi.bugs.filter((b) =>
                b.team === team ||
                (b.reporter && teamMemberIds.has(b.reporter.accountId)) ||
                (b.assignee && teamMemberIds.has(b.assignee.accountId))
            );
            const completed = bugs.filter((b) => classifyStatus(b.status) === 'closed').length;
            const inProgress = bugs.filter((b) => classifyStatus(b.status) === 'in_progress').length;
            const pending = bugs.filter((b) => classifyStatus(b.status) === 'open').length;
            return { team, completed, inProgress, pending, total: bugs.length };
        });
        // Note: Includes teams with 0 bugs so all teams are visible
    }, [kpi]);

    const overallStats = useMemo(() => {
        if (!kpi) return { completed: 0, inProgress: 0, pending: 0, total: 0 };
        const completed = kpi.bugs.filter((b) => classifyStatus(b.status) === 'closed').length;
        const inProgress = kpi.bugs.filter((b) => classifyStatus(b.status) === 'in_progress').length;
        const pending = kpi.bugs.filter((b) => classifyStatus(b.status) === 'open').length;
        return { completed, inProgress, pending, total: kpi.bugs.length };
    }, [kpi]);

    // Firebase image upload
    const handleUploadImage = useCallback(async (file: File) => {
        setUploading(true);
        try {
            const id = `bugs-dashboard/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, id);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setImages((prev: AttachedImage[]) => [...prev, { id, name: file.name, url, uploadedAt: new Date() }]);
        } catch (err) {
            console.error('Image upload failed:', err);
        } finally {
            setUploading(false);
        }
    }, []);

    const handleRemoveImage = useCallback((id: string) => {
        setImages((prev: AttachedImage[]) => prev.filter((img: AttachedImage) => img.id !== id));
    }, []);

    // Loading state
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

                {/* ── HEADER ── */}
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
                                        {(kpi?.allTeams || []).map((t: string) => (
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

                        {/* ── TAB SWITCHER ── */}
                        <div className="flex gap-2 mt-8 border-b-2 border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setActiveTab('bugs')}
                                className={cn(
                                    'flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 -mb-[2px]',
                                    activeTab === 'bugs'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Bug className="w-4 h-4" />
                                Bugs Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('team')}
                                className={cn(
                                    'flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 -mb-[2px]',
                                    activeTab === 'team'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Team Dashboard
                                {images.length > 0 && (
                                    <span className="ml-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 font-black">{images.length}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TAB CONTENT ── */}
                {activeTab === 'team' ? (
                    <BugsTeamDashboard
                        kpi={kpi!}
                        teamStats={teamStats}
                        overallStats={overallStats}
                        images={images}
                        onUploadImage={handleUploadImage}
                        onRemoveImage={handleRemoveImage}
                        uploading={uploading}
                    />
                ) : (
                    <>
                        {/* ── HERO METRICS — Glassmorphism cards ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Total Bugs */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-2xl shadow-red-200 dark:shadow-red-900/30">
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-xl"/>
                                <div className="absolute bottom-0 left-0 w-32 h-16 bg-black/10 blur-2xl"/>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <Bug className="w-5 h-5 text-white"/>
                                        </div>
                                        {metrics && metrics.monthDelta !== 0 && (
                                            <span className={cn('text-xs font-bold px-2 py-1 rounded-full', metrics.monthDelta < 0 ? 'bg-green-400/30 text-green-100' : 'bg-white/20 text-white')}>
                                                {metrics.monthDelta < 0 ? '↓' : '↑'} {Math.abs(metrics.monthDelta)} vs last month
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-4xl font-black text-white mb-1">{n(metrics?.totalBugs)}</div>
                                    <div className="text-sm font-semibold text-red-100">Total Bugs</div>
                                    <div className="text-xs text-red-200 mt-1">{selectedTeam === 'all' ? 'All teams' : selectedTeam}</div>
                                    <div className="flex items-end gap-0.5 mt-3 h-8">
                                        {(filteredData?.monthly.slice(-6).map((m: { bugs: number }) => m.bugs) || [0,0,0,0,0,0]).map((v: number, i: number, arr: number[]) => {
                                            const max = Math.max(...arr, 1);
                                            return <div key={i} className="flex-1 bg-white/40 rounded-sm transition-all" style={{ height: `${(v/max)*100}%` }}/>;
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Open Bugs */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-6 shadow-2xl shadow-amber-200 dark:shadow-amber-900/30">
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-xl"/>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <AlertTriangle className="w-5 h-5 text-white"/>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 text-white">Needs attention</span>
                                    </div>
                                    <div className="text-4xl font-black text-white mb-1">{n(metrics?.openBugs)}</div>
                                    <div className="text-sm font-semibold text-amber-100">Open Bugs</div>
                                    <div className="flex items-end gap-0.5 mt-3 h-8">
                                        {(filteredData?.monthly.slice(-6).map((m: { open: number }) => m.open) || [0,0,0,0,0,0]).map((v: number, i: number, arr: number[]) => {
                                            const max = Math.max(...arr, 1);
                                            return <div key={i} className="flex-1 bg-white/40 rounded-sm" style={{ height: `${(v/max)*100}%` }}/>;
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Closed Bugs */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-2xl shadow-green-200 dark:shadow-green-900/30">
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-xl"/>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <CheckCircle2 className="w-5 h-5 text-white"/>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 text-white">Resolved</span>
                                    </div>
                                    <div className="text-4xl font-black text-white mb-1">{n(metrics?.closedBugs)}</div>
                                    <div className="text-sm font-semibold text-green-100">Closed Bugs</div>
                                    <div className="flex items-end gap-0.5 mt-3 h-8">
                                        {(filteredData?.monthly.slice(-6).map((m: { closed: number }) => m.closed) || [0,0,0,0,0,0]).map((v: number, i: number, arr: number[]) => {
                                            const max = Math.max(...arr, 1);
                                            return <div key={i} className="flex-1 bg-white/40 rounded-sm" style={{ height: `${(v/max)*100}%` }}/>;
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Close Rate */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-6 shadow-2xl shadow-violet-200 dark:shadow-violet-900/30">
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-xl"/>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <TrendingUp className="w-5 h-5 text-white"/>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 text-white">Resolution rate</span>
                                    </div>
                                    <div className="text-4xl font-black text-white mb-1">{metrics?.closeRate || 0}%</div>
                                    <div className="text-sm font-semibold text-violet-100">Close Rate</div>
                                    <div className="mt-3 h-2 rounded-full bg-white/20">
                                        <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${metrics?.closeRate || 0}%` }}/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── SECONDARY STATS ROW ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Critical', value: metrics?.criticalBugs || 0, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900', icon: '🔴' },
                                { label: 'In Progress', value: Math.max(0, (metrics?.totalBugs || 0) - (metrics?.openBugs || 0) - (metrics?.closedBugs || 0)), color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900', icon: '🟡' },
                                { label: 'This Month', value: metrics?.currentMonthBugs || 0, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900', icon: '📅' },
                                { label: 'Last Month', value: metrics?.previousMonthBugs || 0, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', icon: '📆' },
                            ].map((stat) => (
                                <div key={stat.label} className={cn('rounded-2xl border-2 p-5 flex items-center gap-4', stat.bg, stat.border)}>
                                    <span className="text-2xl">{stat.icon}</span>
                                    <div>
                                        <div className={cn('text-2xl font-black', stat.color)}>{stat.value}</div>
                                        <div className="text-xs font-semibold text-muted-foreground">{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── CHARTS ROW ── */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                                <BugTrendChart
                                    data={filteredData?.monthly.slice(-6).map((m: { label?: string; month: string; bugs: number; open: number; closed: number; inProgress: number }) => ({
                                        month: m.label || m.month,
                                        bugs: m.bugs,
                                        open: m.open,
                                        closed: m.closed,
                                        inProgress: m.inProgress,
                                    })) || []}
                                    title="6-Month Bug Trend"
                                />
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                                <PriorityDonutChart
                                    data={{
                                        Highest: filteredData?.bugs.filter((b) => b.priority === 'Highest').length || 0,
                                        High: filteredData?.bugs.filter((b) => b.priority === 'High').length || 0,
                                        Medium: filteredData?.bugs.filter((b) => b.priority === 'Medium').length || 0,
                                        Low: filteredData?.bugs.filter((b) => b.priority === 'Low').length || 0,
                                        Lowest: filteredData?.bugs.filter((b) => b.priority === 'Lowest').length || 0,
                                    }}
                                    title="Priority Distribution"
                                />
                            </div>
                        </div>

                        {/* ── INSIGHTS ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                                    <Flame className="w-5 h-5 text-white"/>
                                </div>
                                <h2 className="text-2xl font-black text-foreground">Key Insights</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className={cn('relative overflow-hidden rounded-2xl border-2 p-6', (metrics?.criticalBugs || 0) > 0 ? 'border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20' : 'border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20')}>
                                    <div className={cn('text-3xl font-black mb-1', (metrics?.criticalBugs || 0) > 0 ? 'text-red-600' : 'text-green-600')}>{metrics?.criticalBugs || 0}</div>
                                    <div className="font-bold text-foreground mb-1">Critical Bugs</div>
                                    <div className="text-sm text-muted-foreground">{(metrics?.criticalBugs || 0) > 0 ? 'Require immediate attention' : 'No critical bugs — great!'}</div>
                                    {(metrics?.criticalBugs || 0) > 0 && (
                                        <button onClick={() => window.location.href = '/analytics/bugs?priority=Highest'} className="mt-3 text-xs font-bold text-red-600 hover:underline">View in Analytics →</button>
                                    )}
                                </div>
                                <div className={cn('relative overflow-hidden rounded-2xl border-2 p-6', (metrics?.closeRate || 0) >= 70 ? 'border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' : (metrics?.closeRate || 0) >= 40 ? 'border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' : 'border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20')}>
                                    <div className={cn('text-3xl font-black mb-1', (metrics?.closeRate || 0) >= 70 ? 'text-green-600' : (metrics?.closeRate || 0) >= 40 ? 'text-amber-600' : 'text-red-600')}>{metrics?.closeRate || 0}%</div>
                                    <div className="font-bold text-foreground mb-1">Resolution Rate</div>
                                    <div className="text-sm text-muted-foreground">{(metrics?.closeRate || 0) >= 70 ? 'Excellent performance' : (metrics?.closeRate || 0) >= 40 ? 'Room for improvement' : 'Needs urgent attention'}</div>
                                    <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                                        <div className={cn('h-full rounded-full', (metrics?.closeRate || 0) >= 70 ? 'bg-green-500' : (metrics?.closeRate || 0) >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${metrics?.closeRate || 0}%` }}/>
                                    </div>
                                </div>
                                <div className={cn('relative overflow-hidden rounded-2xl border-2 p-6', (metrics?.monthDelta || 0) < 0 ? 'border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20' : 'border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20')}>
                                    <div className={cn('text-3xl font-black mb-1', (metrics?.monthDelta || 0) < 0 ? 'text-green-600' : 'text-amber-600')}>{(metrics?.monthDelta || 0) < 0 ? '↓' : '↑'} {Math.abs(metrics?.monthDelta || 0)}</div>
                                    <div className="font-bold text-foreground mb-1">Monthly Trend</div>
                                    <div className="text-sm text-muted-foreground">Bug count {(metrics?.monthDelta || 0) < 0 ? 'decreased' : 'increased'} vs last month</div>
                                    <div className="mt-3 flex gap-2 text-xs font-semibold">
                                        <span className="text-muted-foreground">This: <span className="text-foreground">{metrics?.currentMonthBugs || 0}</span></span>
                                        <span className="text-muted-foreground">· Last: <span className="text-foreground">{metrics?.previousMonthBugs || 0}</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── TEAM PERFORMANCE ── */}
                        {filteredData && filteredData.people.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                                <TeamPerformanceChart
                                    data={filteredData.people
                                        .sort((a, b) => b.bugsReported - a.bugsReported)
                                        .slice(0, 10)
                                        .map((p) => ({
                                            name: p.name,
                                            bugsReported: p.bugsReported,
                                            bugsClosed: p.bugsClosed,
                                            closeRate: p.closeRate,
                                        }))}
                                    title={selectedTeam === 'all' ? 'Top 10 Performers' : `${selectedTeam} - Top Performers`}
                                />
                            </div>
                        )}

                        {/* ── PERIOD COMPARISON ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                                    <Calendar className="w-5 h-5 text-white"/>
                                </div>
                                <h2 className="text-2xl font-black text-foreground">Period Comparison</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {[
                                    { title: 'Overall', subtitle: 'All time', total: metrics?.totalBugs || 0, open: metrics?.openBugs || 0, closed: metrics?.closedBugs || 0, critical: metrics?.criticalBugs || 0, from: 'from-violet-600', to: 'to-purple-600', glow: 'shadow-violet-200 dark:shadow-violet-900/30' },
                                    { title: cm?.label || 'Current Month', subtitle: 'This month', total: metrics?.currentMonthBugs || 0, open: cm?.open || 0, closed: cm?.closed || 0, critical: cm?.critical || 0, from: 'from-amber-500', to: 'to-orange-500', glow: 'shadow-amber-200 dark:shadow-amber-900/30' },
                                    { title: pm?.label || 'Previous Month', subtitle: 'Last month', total: metrics?.previousMonthBugs || 0, open: pm?.open || 0, closed: pm?.closed || 0, critical: pm?.critical || 0, from: 'from-blue-500', to: 'to-cyan-500', glow: 'shadow-blue-200 dark:shadow-blue-900/30' },
                                ].map((period) => {
                                    const closeRate = period.total > 0 ? Math.round((period.closed / period.total) * 100) : 0;
                                    return (
                                        <div key={period.title} className={cn('rounded-3xl overflow-hidden shadow-2xl', period.glow)}>
                                            <div className={cn('bg-gradient-to-r p-5', period.from, period.to)}>
                                                <div className="text-white font-black text-lg">{period.title}</div>
                                                <div className="text-white/70 text-xs font-semibold">{period.subtitle}</div>
                                                <div className="text-4xl font-black text-white mt-2">{period.total}</div>
                                                <div className="text-white/80 text-sm">total bugs</div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-5 grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-center">
                                                    <div className="text-2xl font-black text-red-600">{period.open}</div>
                                                    <div className="text-xs font-semibold text-muted-foreground">Open</div>
                                                </div>
                                                <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3 text-center">
                                                    <div className="text-2xl font-black text-green-600">{period.closed}</div>
                                                    <div className="text-xs font-semibold text-muted-foreground">Closed</div>
                                                </div>
                                                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 p-3 text-center">
                                                    <div className="text-2xl font-black text-orange-600">{period.critical}</div>
                                                    <div className="text-xs font-semibold text-muted-foreground">Critical</div>
                                                </div>
                                                <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 p-3 text-center">
                                                    <div className="text-2xl font-black text-violet-600">{closeRate}%</div>
                                                    <div className="text-xs font-semibold text-muted-foreground">Close Rate</div>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 px-5 pb-5">
                                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', period.from, period.to)} style={{ width: `${Math.min(closeRate, 100)}%` }}/>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
