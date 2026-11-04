'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    ScanSearch, ClipboardPaste, FileDown, CheckCircle2, AlertTriangle, XCircle,
    PlusCircle, Search, BookOpen, Info, ChevronDown, ChevronRight, Sparkles,
    ListChecks, UploadCloud, Terminal, RotateCcw, Copy, Layers,
} from 'lucide-react';
import {
    analyzeGaps, buildGapCsv, buildCatalogCsv, parseCapturedEvents,
    CLEVERTAP_CATALOG, ZENIT_EXTRA_EVENTS, CATEGORIES, SAMPLE_CAPTURE,
    type GapAnalysisResult, type GapRow, type GapStatus, type CatalogCategory,
    type ZenitStatus,
} from '@/lib/clevertap/event-catalog';

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<GapStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    captured: { label: 'Captured', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
    missing: { label: 'Missing', cls: 'bg-rose-500/15 text-rose-600 border-rose-500/30', icon: XCircle },
    extra: { label: 'Extra', cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30', icon: PlusCircle },
};

const ZENIT_STYLE: Record<ZenitStatus | 'unknown', { label: string; cls: string }> = {
    wired: { label: 'Wired in Zenit', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    available: { label: 'Helper ready', cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30' },
    'schema-only': { label: 'Schema only', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    'not-implemented': { label: 'Not in Zenit', cls: 'bg-muted text-muted-foreground border-border' },
    unknown: { label: 'Unknown', cls: 'bg-violet-500/15 text-violet-600 border-violet-500/30' },
};

const CATEGORY_CLS: Record<CatalogCategory | 'Uncategorized', string> = {
    Lifecycle: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    Discovery: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
    Playback: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
    Ads: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    Subscription: 'bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30',
    'Profile & Account': 'bg-teal-500/15 text-teal-600 border-teal-500/30',
    Library: 'bg-lime-500/15 text-lime-600 border-lime-500/30',
    'Zenit Specific': 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    Uncategorized: 'bg-muted text-muted-foreground border-border',
};

function download(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
    label, value, sub, tone, icon: Icon,
}: {
    label: string; value: string | number; sub?: string;
    tone: 'blue' | 'emerald' | 'rose' | 'sky' | 'violet'; icon: typeof CheckCircle2;
}) {
    const tones: Record<string, string> = {
        blue: 'from-blue-500/15 to-cyan-500/10 border-blue-500/25 text-blue-600',
        emerald: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/25 text-emerald-600',
        rose: 'from-rose-500/15 to-red-500/10 border-rose-500/25 text-rose-600',
        sky: 'from-sky-500/15 to-cyan-500/10 border-sky-500/25 text-sky-600',
        violet: 'from-violet-500/15 to-fuchsia-500/10 border-violet-500/25 text-violet-600',
    };
    return (
        <div className={cn('rounded-xl border bg-gradient-to-br p-4', tones[tone])}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
                <Icon className="w-4 h-4 opacity-70" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function CoverageBar({ value }: { value: number }) {
    const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="flex items-center gap-2 min-w-[110px]">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
        </div>
    );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', className)}>
            {children}
        </span>
    );
}

function PropList({ label, props, tone }: { label: string; props: string[]; tone: 'rose' | 'sky' | 'emerald' }) {
    if (props.length === 0) return null;
    const tones = {
        rose: 'bg-rose-500/10 text-rose-600 border-rose-500/25',
        sky: 'bg-sky-500/10 text-sky-600 border-sky-500/25',
        emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
    };
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}:</span>
            {props.map((p) => (
                <span key={p} className={cn('rounded border px-1.5 py-0.5 text-[11px] font-mono', tones[tone])}>{p}</span>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'gap' | 'catalog' | 'guide';
type Filter = 'all' | GapStatus;

export default function EventGapAnalysis() {
    const { toast } = useToast();
    const [input, setInput] = useState('');
    const [result, setResult] = useState<GapAnalysisResult | null>(null);
    const [tab, setTab] = useState<Tab>('gap');
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<'all' | CatalogCategory>('all');
    const [expanded, setExpanded] = useState<string | null>(null);

    const runAnalysis = (text: string) => {
        const parsed = parseCapturedEvents(text);
        if (parsed.events.length === 0) {
            toast({
                title: 'Nothing to analyse',
                description: parsed.errors[0] || 'Paste event names, JSON, or NDJSON first.',
                variant: 'destructive',
            });
            return;
        }
        const analysis = analyzeGaps(parsed);
        setResult(analysis);
        setFilter('all');
        setExpanded(null);
        toast({
            title: 'Gap analysis ready',
            description: `${analysis.summary.capturedTotal} captured • ${analysis.summary.missing} missing • ${analysis.summary.extra} extra`,
        });
    };

    const handleAnalyze = () => runAnalysis(input);
    const handleSample = () => {
        setInput(SAMPLE_CAPTURE);
        runAnalysis(SAMPLE_CAPTURE);
    };
    const handleClear = () => {
        setInput('');
        setResult(null);
        setFilter('all');
        setQuery('');
    };

    const handleExportGap = () => {
        if (!result) return;
        download(`clevertap-gap-analysis-${new Date().toISOString().slice(0, 10)}.csv`, buildGapCsv(result));
        toast({ title: 'Report exported', description: 'Gap analysis CSV downloaded.' });
    };

    const handleExportCatalog = () => {
        download(`clevertap-event-catalog-${new Date().toISOString().slice(0, 10)}.csv`, buildCatalogCsv());
        toast({ title: 'Catalog exported', description: 'Full event catalog CSV downloaded.' });
    };

    const handleCopyReport = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(buildGapCsv(result));
            toast({ title: 'Copied', description: 'Gap analysis CSV copied to clipboard.' });
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    };

    const visibleRows = useMemo(() => {
        if (!result) return [];
        const q = query.trim().toLowerCase();
        return result.rows.filter((r) => {
            if (filter !== 'all' && r.status !== filter) return false;
            if (category !== 'all' && r.category !== category) return false;
            if (q && !r.name.toLowerCase().includes(q) && !r.trigger.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [result, filter, query, category]);

    const catalogRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...CLEVERTAP_CATALOG, ...ZENIT_EXTRA_EVENTS].filter((e) => {
            if (category !== 'all' && e.category !== category) return false;
            if (q && !e.name.toLowerCase().includes(q) && !e.trigger.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [query, category]);

    const counts = useMemo(() => {
        const rows = result?.rows ?? [];
        return {
            all: rows.length,
            captured: rows.filter((r) => r.status === 'captured').length,
            missing: rows.filter((r) => r.status === 'missing').length,
            extra: rows.filter((r) => r.status === 'extra').length,
        };
    }, [result]);

    return (
        <div className="space-y-5">
            {/* ── Hero / intro ── */}
            <Card className="overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20">
                            <ScanSearch className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold">Event Catalog &amp; Gap Analysis</h2>
                            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                                Compare the <span className="font-semibold text-foreground">39 CleverTap CSV events</span> against
                                what you actually captured — and see which Zenit-specific events go beyond the CSV.
                                Works entirely offline; <span className="font-semibold text-foreground">no CleverTap API key needed</span>.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Pill className="bg-background/60 border-border text-muted-foreground"><Layers className="w-3 h-3" /> {CLEVERTAP_CATALOG.length} CSV events</Pill>
                                <Pill className="bg-background/60 border-border text-muted-foreground"><Sparkles className="w-3 h-3" /> {ZENIT_EXTRA_EVENTS.length} Zenit-specific</Pill>
                                <Pill className="bg-background/60 border-border text-muted-foreground"><Terminal className="w-3 h-3" /> JSON · NDJSON · CSV · names</Pill>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit border border-border/60">
                {([
                    ['gap', 'Gap Analysis', ScanSearch],
                    ['catalog', 'Event Catalog', ListChecks],
                    ['guide', 'How to capture', BookOpen],
                ] as const).map(([id, label, Icon]) => (
                    <button
                        key={id}
                        onClick={() => { setTab(id); setQuery(''); setCategory('all'); }}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                            tab === id ? 'bg-blue-600 text-white shadow' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {/* ══════════════ GAP ANALYSIS ══════════════ */}
            {tab === 'gap' && (
                <div className="space-y-5">
                    {/* Input */}
                    <Card>
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardPaste className="w-4 h-4 text-blue-600" />
                                    <h3 className="font-semibold text-sm">Paste captured events</h3>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {['JSON array', 'NDJSON', 'CSV rows', 'Event names'].map((f) => (
                                        <Pill key={f} className="bg-muted/70 border-border text-muted-foreground">{f}</Pill>
                                    ))}
                                </div>
                            </div>
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Paste anything — all at once, not one by one:\n\n• JSON array:  [{"event":"Login","properties":{"source":"D2C"}}]\n• NDJSON:      one {"event":"Page_View","properties":{...}} per line\n• CSV rows:    Login,source,isNewUser,loginStatus\n• Names only:  Login\n               Page_View\n               Searched`}
                                className="min-h-[170px] font-mono text-xs leading-relaxed"
                                spellCheck={false}
                            />
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleAnalyze} className="bg-blue-600 hover:bg-blue-700">
                                        <ScanSearch className="w-4 h-4 mr-1.5" /> Analyse gaps
                                    </Button>
                                    <Button variant="outline" onClick={handleSample}>
                                        <Sparkles className="w-4 h-4 mr-1.5" /> Load sample
                                    </Button>
                                    <Button variant="ghost" onClick={handleClear}>
                                        <RotateCcw className="w-4 h-4 mr-1.5" /> Clear
                                    </Button>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    Bulk paste is supported — partial input only reports what you pasted.
                                </span>
                            </div>
                            {result && result.parse.errors.length > 0 && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700">
                                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                                    {result.parse.errors.length} line(s) could not be parsed · format detected: <b>{result.parse.format}</b>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {!result && (
                        <Card className="border-dashed">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                <UploadCloud className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">No capture analysed yet</p>
                                <p className="text-sm mt-1">Paste your events above (or hit <b>Load sample</b>) to see the gap report.</p>
                            </CardContent>
                        </Card>
                    )}

                    {result && (
                        <AnimatePresence mode="wait">
                            <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                                {/* Summary tiles */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <StatTile label="CSV Catalog" value={result.summary.catalogTotal} sub="expected events" tone="blue" icon={Layers} />
                                    <StatTile label="Captured" value={result.summary.capturedTotal} sub="in your paste" tone="sky" icon={ClipboardPaste} />
                                    <StatTile label="Matched" value={result.summary.matched} sub="catalog events found" tone="emerald" icon={CheckCircle2} />
                                    <StatTile label="Missing" value={result.summary.missing} sub="in CSV, not captured" tone="rose" icon={XCircle} />
                                    <StatTile label="Extra" value={result.summary.extra} sub="not in CSV" tone="violet" icon={PlusCircle} />
                                    <StatTile label="Prop coverage" value={`${result.summary.propertyCoverage}%`} sub="matched properties" tone="emerald" icon={ListChecks} />
                                </div>

                                {/* Toolbar */}
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/60">
                                        {([
                                            ['all', `All ${counts.all}`],
                                            ['missing', `Missing ${counts.missing}`],
                                            ['captured', `Captured ${counts.captured}`],
                                            ['extra', `Extra ${counts.extra}`],
                                        ] as const).map(([id, label]) => (
                                            <button
                                                key={id}
                                                onClick={() => setFilter(id)}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                                    filter === id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Search events…"
                                                className="h-8 pl-8 text-xs w-[180px]"
                                            />
                                        </div>
                                        <Button size="sm" variant="outline" onClick={handleExportGap}>
                                            <FileDown className="w-3.5 h-3.5 mr-1.5" /> Export
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={handleCopyReport}>
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Table */}
                                <Card className="overflow-hidden">
                                    <ScrollArea className="max-h-[560px]">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
                                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                                    <th className="px-4 py-2.5 font-semibold">Event</th>
                                                    <th className="px-3 py-2.5 font-semibold">Category</th>
                                                    <th className="px-3 py-2.5 font-semibold">Status</th>
                                                    <th className="px-3 py-2.5 font-semibold">Zenit</th>
                                                    <th className="px-3 py-2.5 font-semibold">Coverage</th>
                                                    <th className="px-3 py-2.5 font-semibold text-right">Props</th>
                                                    <th className="w-8" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visibleRows.map((row) => {
                                                    const st = STATUS_STYLE[row.status];
                                                    const zn = ZENIT_STYLE[row.zenitStatus];
                                                    const isOpen = expanded === row.name;
                                                    return (
                                                        <GapTableRow
                                                            key={row.name}
                                                            row={row}
                                                            isOpen={isOpen}
                                                            onToggle={() => setExpanded(isOpen ? null : row.name)}
                                                            st={st}
                                                            zn={zn}
                                                        />
                                                    );
                                                })}
                                                {visibleRows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                                                            No events match this filter.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </ScrollArea>
                                </Card>

                                <p className="text-[11px] text-muted-foreground">
                                    <Info className="w-3.5 h-3.5 inline mr-1" />
                                    Click any row to inspect expected vs. captured properties. <b>Coverage</b> is the share of
                                    the CSV&apos;s expected properties that appeared in your capture for that event.
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            )}

            {/* ══════════════ EVENT CATALOG ══════════════ */}
            {tab === 'catalog' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                size="sm"
                                variant={category === 'all' ? 'default' : 'outline'}
                                onClick={() => setCategory('all')}
                                className={category === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            >
                                All
                            </Button>
                            {CATEGORIES.map((c) => (
                                <Button
                                    key={c}
                                    size="sm"
                                    variant={category === c ? 'default' : 'outline'}
                                    onClick={() => setCategory(c)}
                                    className={cn('text-xs', category === c && 'bg-blue-600 hover:bg-blue-700')}
                                >
                                    {c}
                                </Button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search catalog…"
                                    className="h-8 pl-8 text-xs w-[180px]"
                                />
                            </div>
                            <Button size="sm" variant="outline" onClick={handleExportCatalog}>
                                <FileDown className="w-3.5 h-3.5 mr-1.5" /> Export catalog
                            </Button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {catalogRows.map((e) => {
                            const zn = ZENIT_STYLE[e.zenitStatus];
                            return (
                                <Card key={e.name} className="hover:border-blue-500/40 transition-colors">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <code className="text-sm font-bold">{e.name}</code>
                                            <Pill className={CATEGORY_CLS[e.category]}>{e.category}</Pill>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{e.trigger}</p>
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            <Pill className={zn.cls}>{zn.label}</Pill>
                                            <span className="text-[11px] text-muted-foreground">{e.properties.length} props</span>
                                        </div>
                                        {e.zenitEquivalent && (
                                            <p className="text-[11px] text-blue-600">→ {e.zenitEquivalent}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                    {catalogRows.length === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="p-10 text-center text-muted-foreground">No catalog events match.</CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ══════════════ GUIDE ══════════════ */}
            {tab === 'guide' && <CaptureGuide />}
        </div>
    );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function GapTableRow({
    row, isOpen, onToggle, st, zn,
}: {
    row: GapRow;
    isOpen: boolean;
    onToggle: () => void;
    st: { label: string; cls: string; icon: typeof CheckCircle2 };
    zn: { label: string; cls: string };
}) {
    const StIcon = st.icon;
    return (
        <>
            <tr
                onClick={onToggle}
                className={cn('border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/40', isOpen && 'bg-muted/40')}
            >
                <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        <code className="text-xs font-semibold">{row.name}</code>
                        {row.records > 0 && <span className="text-[10px] text-muted-foreground">×{row.records}</span>}
                    </div>
                </td>
                <td className="px-3 py-2.5">
                    <Pill className={CATEGORY_CLS[row.category]}>{row.category}</Pill>
                </td>
                <td className="px-3 py-2.5">
                    <Pill className={st.cls}><StIcon className="w-3 h-3" /> {st.label}</Pill>
                </td>
                <td className="px-3 py-2.5">
                    <Pill className={zn.cls}>{zn.label}</Pill>
                </td>
                <td className="px-3 py-2.5">
                    {row.status === 'captured' || row.status === 'extra' ? <CoverageBar value={row.propertyCoverage} /> : <span className="text-[11px] text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground tabular-nums">
                    {row.expectedProps.length > 0 ? `${row.expectedProps.length - row.missingProps.length}/${row.expectedProps.length}` : '—'}
                </td>
                <td className="px-2 py-2.5" />
            </tr>
            {isOpen && (
                <tr className="border-b border-border/50 bg-muted/20">
                    <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-2.5">
                            <p className="text-[11px] text-muted-foreground"><b className="text-foreground">Trigger:</b> {row.trigger}</p>
                            {row.zenitEquivalent && (
                                <p className="text-[11px] text-blue-600"><b>Zenit equivalent:</b> {row.zenitEquivalent}</p>
                            )}
                            <PropList label="Missing" props={row.missingProps} tone="rose" />
                            <PropList label="Captured" props={row.capturedProps} tone="emerald" />
                            <PropList label="Unexpected" props={row.extraProps} tone="sky" />
                            {row.expectedProps.length === 0 && row.capturedProps.length === 0 && (
                                <p className="text-[11px] text-muted-foreground">No properties expected or captured.</p>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── Guide ────────────────────────────────────────────────────────────────────

function CaptureGuide() {
    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-600"><Terminal className="w-5 h-5" /></div>
                        <div>
                            <h3 className="font-bold">Getting the data without an API key</h3>
                            <p className="text-sm text-muted-foreground">Three ways, from easiest to most complete.</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                        {[
                            {
                                n: 1, title: 'CleverTap dashboard export',
                                body: 'Log in → Analytics ▸ Events. Use Export / Download CSV. Paste the event names (or the whole CSV rows) into the box above.',
                                tag: 'Best coverage',
                            },
                            {
                                n: 2, title: 'Browser DevTools (Network)',
                                body: 'F12 ▸ Network ▸ filter “clevertap”. Perform actions, click the request, open Payload, copy the JSON body. Paste it above — one or many at once.',
                                tag: 'Live truth',
                            },
                            {
                                n: 3, title: 'Console hook',
                                body: 'In the app console run: clevertap.event.getHistory() — or wrap clevertap.push to log every event. Copy the array and paste it above.',
                                tag: 'Zero setup',
                            },
                        ].map((s) => (
                            <div key={s.n} className="rounded-xl border p-4 space-y-2 bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold grid place-items-center">{s.n}</span>
                                    <Pill className="bg-blue-500/10 text-blue-600 border-blue-500/25">{s.tag}</Pill>
                                </div>
                                <p className="font-semibold text-sm">{s.title}</p>
                                <p className="text-[12px] text-muted-foreground leading-relaxed">{s.body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-2"><ClipboardPaste className="w-4 h-4 text-blue-600" /> What exactly to copy</p>
                        <p className="text-[12px] text-muted-foreground">
                            Any of these works — paste <b>all events at once</b>:
                        </p>
                        <pre className="text-[11px] font-mono bg-background/70 border rounded-lg p-3 overflow-x-auto leading-relaxed">{`// A) JSON array (recommended)
[
  { "event": "Login", "properties": { "source": "D2C", "isNewUser": false } },
  { "event": "Page_View", "properties": { "currentPage": "/dashboard" } }
]

// B) NDJSON — one object per line
{"event":"Login","properties":{"source":"D2C"}}
{"event":"Page_View","properties":{"currentPage":"/dashboard"}}

// C) CSV rows
Login,source,isNewUser,loginStatus
Page_View,previousPage,currentPage

// D) Event names only
Login
Page_View
Searched`}</pre>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[12px] text-amber-800 dark:text-amber-300 space-y-1">
                        <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Partial input = partial report</p>
                        <p>If you paste only 5 events, the report can only validate those 5. The other 34 will correctly show as <b>Missing</b> — they are not invented. Paste everything you have in one go for a complete picture.</p>
                    </div>

                    <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-[12px] text-blue-800 dark:text-blue-300 space-y-1">
                        <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Why no API key is needed</p>
                        <p>This screen diffs <b>whatever you paste</b> against the embedded CSV catalog. It never calls CleverTap. Zenit also mirrors its own events to Firestore (<code>analytics_events</code>), so you can export that list the same way and compare.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
