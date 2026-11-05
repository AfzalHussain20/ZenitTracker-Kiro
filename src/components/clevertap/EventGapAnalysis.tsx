'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    ScanSearch, ClipboardPaste, FileDown, CheckCircle2, AlertTriangle, XCircle,
    PlusCircle, Search, BookOpen, Info, ChevronDown, ChevronRight, Sparkles,
    ListChecks, UploadCloud, Terminal, RotateCcw, Copy, Layers, Shield,
} from 'lucide-react';
import {
    analyzeGaps, buildGapCsv, buildCatalogCsv, parseCapturedEvents,
    CLEVERTAP_CATALOG, ZENIT_EXTRA_EVENTS, CATEGORIES, SAMPLE_CAPTURE,
    GAP_STATUS_LABEL, ZENIT_STATUS_LABEL,
    type GapAnalysisResult, type GapRow, type GapStatus, type CatalogCategory,
    type ZenitStatus,
} from '@/lib/clevertap/event-catalog';
import {
    extractCleverTapEventsFromHar, sanitizeHarEvents, CONSOLE_CAPTURE_SNIPPET,
    type HarExtractStats,
} from '@/lib/clevertap/har-parser';

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<GapStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    captured: { label: GAP_STATUS_LABEL.captured, cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
    missing: { label: GAP_STATUS_LABEL.missing, cls: 'bg-rose-500/15 text-rose-600 border-rose-500/30', icon: XCircle },
    extra: { label: GAP_STATUS_LABEL.extra, cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30', icon: PlusCircle },
};

const ZENIT_STYLE: Record<ZenitStatus | 'unknown', { label: string; cls: string }> = {
    wired: { label: ZENIT_STATUS_LABEL.wired, cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    available: { label: ZENIT_STATUS_LABEL.available, cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30' },
    'schema-only': { label: ZENIT_STATUS_LABEL['schema-only'], cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    'not-implemented': { label: ZENIT_STATUS_LABEL['not-implemented'], cls: 'bg-muted text-muted-foreground border-border' },
    unknown: { label: ZENIT_STATUS_LABEL.unknown, cls: 'bg-violet-500/15 text-violet-600 border-violet-500/30' },
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

const CATEGORY_DOT: Record<CatalogCategory | 'Uncategorized', string> = {
    Lifecycle: 'bg-blue-500',
    Discovery: 'bg-cyan-500',
    Playback: 'bg-indigo-500',
    Ads: 'bg-orange-500',
    Subscription: 'bg-fuchsia-500',
    'Profile & Account': 'bg-teal-500',
    Library: 'bg-lime-500',
    'Zenit Specific': 'bg-violet-500',
    Uncategorized: 'bg-muted-foreground',
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

/**
 * Searchable event-name combobox. Replaces the native <datalist> so the
 * catalog can be browsed by category and filtered by name. Free text is
 * still allowed — a custom event name can be typed and used as-is.
 */
function EventNamePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocMouseDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [open]);

    const q = query.trim().toLowerCase();
    const matches = useMemo(() => {
        return [...CLEVERTAP_CATALOG, ...ZENIT_EXTRA_EVENTS].filter((e) => {
            if (!q) return true;
            return e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
        });
    }, [q]);

    const exact = useMemo(
        () => [...CLEVERTAP_CATALOG, ...ZENIT_EXTRA_EVENTS].find((e) => e.name.toLowerCase() === value.trim().toLowerCase()),
        [value],
    );

    const choose = (name: string) => {
        onChange(name);
        setQuery(name);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative flex-1 min-w-[240px]">
            <Label htmlFor="html-event-name" className="text-[11px] font-semibold text-muted-foreground">
                Event name for tooltip-HTML pastes
            </Label>
            <div className="relative mt-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                    id="html-event-name"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="catalog-event-names"
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setQuery(value);
                        setOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setOpen(false);
                        if (e.key === 'Enter' && open && matches[0]) {
                            e.preventDefault();
                            choose(matches[0].name);
                        }
                    }}
                    placeholder="Search 50 catalog events, or type a custom name…"
                    className="h-9 pl-8 pr-8 font-mono text-xs"
                />
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-label="Toggle event name list"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                </button>
            </div>

            {/* Selected-state hint */}
            <div className="mt-1 min-h-[16px]">
                {exact ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className={cn('w-1.5 h-1.5 rounded-full', CATEGORY_DOT[exact.category])} />
                        {exact.category} · {exact.properties.length} expected properties
                    </span>
                ) : value.trim() ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Custom name — not in the CleverTap CSV (will be reported as an extra event).
                    </span>
                ) : (
                    <span className="text-[10px] text-muted-foreground">Pick from the list or type any event name.</span>
                )}
            </div>

            {open && (
                <div
                    id="catalog-event-names"
                    role="listbox"
                    className="absolute z-50 mt-1 w-full max-h-[300px] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
                >
                    {matches.length === 0 ? (
                        <div className="px-3 py-4 text-[11px] text-muted-foreground">
                            No catalog event matches “{query.trim()}”. Type it and hit <b>Analyse gaps</b> to treat it as a custom event.
                        </div>
                    ) : (
                        CATEGORIES.map((cat) => {
                            const items = matches.filter((e) => e.category === cat);
                            if (items.length === 0) return null;
                            return (
                                <div key={cat}>
                                    <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-muted/95 backdrop-blur px-2.5 py-1.5 border-b border-border/60">
                                        <span className={cn('w-1.5 h-1.5 rounded-full', CATEGORY_DOT[cat])} />
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
                                    </div>
                                    {items.map((e) => {
                                        const selected = e.name.toLowerCase() === value.trim().toLowerCase();
                                        return (
                                            <button
                                                key={e.name}
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                onMouseDown={(ev) => ev.preventDefault()}
                                                onClick={() => choose(e.name)}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-blue-500/10',
                                                    selected && 'bg-blue-500/10',
                                                )}
                                            >
                                                <code className="flex-1 min-w-0 truncate text-xs font-semibold">{e.name}</code>
                                                <span className="text-[10px] text-muted-foreground tabular-nums">{e.properties.length}p</span>
                                                {selected && <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                    <div className="sticky bottom-0 border-t border-border/60 bg-popover/95 backdrop-blur px-2.5 py-1.5 text-[10px] text-muted-foreground">
                        Not listed? Type a custom event name and press <b>Analyse gaps</b>.
                    </div>
                </div>
            )}
        </div>
    );
}

/** Plain-language explanation of the two independent status axes. */
function ZenitStatusLegend() {
    const entries: Array<[ZenitStatus | 'unknown', string]> = [
        ['wired', 'Zenit sends this event today.'],
        ['available', 'Helper exists in clevertap-analytics.ts, but nothing calls it yet.'],
        ['schema-only', 'Defined in analytics-schema.json — no code path yet.'],
        ['not-implemented', 'No Zenit equivalent (usually a video/streaming-only event).'],
        ['unknown', 'Captured event that is not in the CleverTap CSV, so it has no Zenit mapping.'],
    ];
    return (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Two separate checks
                </p>
                <p className="text-[11px] text-muted-foreground">
                    <b className="text-foreground">In paste</b> = did it appear in what you pasted?
                    <span className="mx-1.5 opacity-40">•</span>
                    <b className="text-foreground">Zenit</b> = does the Zenit app itself send it?
                </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {entries.map(([key, description]) => (
                    <div key={key} className="space-y-1">
                        <Pill className={ZENIT_STYLE[key].cls}>{ZENIT_STYLE[key].label}</Pill>
                        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'gap' | 'catalog' | 'guide';
type Filter = 'all' | GapStatus;

export default function EventGapAnalysis() {
    const { toast } = useToast();
    const [input, setInput] = useState('');
    const [htmlEventName, setHtmlEventName] = useState('');
    const [result, setResult] = useState<GapAnalysisResult | null>(null);
    const [harStats, setHarStats] = useState<HarExtractStats | null>(null);
    const harInputRef = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<Tab>('gap');
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<'all' | CatalogCategory>('all');
    const [expanded, setExpanded] = useState<string | null>(null);

    const runAnalysis = (text: string) => {
        const parsed = parseCapturedEvents(text, { htmlEventName });
        if (parsed.events.length === 0) {
            toast({
                title: 'Could not read that paste',
                description: parsed.errors[0] || 'Paste event names, JSON, NDJSON, CSV, or tooltip HTML first.',
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
        setHtmlEventName('');
        setResult(null);
        setHarStats(null);
        setFilter('all');
        setQuery('');
    };

    /**
     * HAR import — fully client-side. The file never leaves the browser:
     * only event names + property names are retained (no values, headers,
     * cookies, tokens, or URLs with query strings).
     */
    const handleHarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            let har: unknown;
            try {
                har = JSON.parse(String(reader.result || ''));
            } catch {
                toast({
                    title: 'Invalid HAR',
                    description: 'That file is not valid JSON. Use “Save all as HAR with content”.',
                    variant: 'destructive',
                });
                return;
            }

            const extracted = extractCleverTapEventsFromHar(har);
            if (extracted.events.length === 0) {
                toast({
                    title: 'No CleverTap events found',
                    description:
                        extracted.errors[0] ||
                        'Record a session with the Network tab filtered to “clevertap”, then export again.',
                    variant: 'destructive',
                });
                return;
            }

            setInput(sanitizeHarEvents(extracted.events));
            setResult(analyzeGaps(extracted));
            setHarStats(extracted.stats);
            setFilter('all');
            setExpanded(null);
            toast({
                title: 'HAR imported',
                description: `${extracted.events.length} events from ${extracted.stats.cleverTapEntries} CleverTap request(s). Values and headers were discarded.`,
            });
        };
        reader.onerror = () => {
            toast({ title: 'Could not read the file', variant: 'destructive' });
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportSanitized = () => {
        if (!result) return;
        download(
            `clevertap-captured-events-${new Date().toISOString().slice(0, 10)}.json`,
            sanitizeHarEvents(result.parse.events),
        );
        toast({ title: 'Sanitized events exported', description: 'Names + property names only — safe to share.' });
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

    const systemExtras = useMemo(
        () => (result?.rows ?? []).filter((r) => r.status === 'extra' && r.isSystem).length,
        [result],
    );

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
                                    {['JSON array', 'NDJSON', 'CSV rows', 'Event names', 'Tooltip HTML', 'Activity page'].map((f) => (
                                        <Pill key={f} className="bg-muted/70 border-border text-muted-foreground">{f}</Pill>
                                    ))}
                                </div>
                            </div>
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Paste anything — all at once, not one by one:\n\n• CleverTap activity page: paste the whole "User activity details" HTML (best coverage)\n• JSON array:  [{"event":"Login","properties":{"source":"D2C"}}]\n• NDJSON:      one {"event":"Page_View","properties":{...}} per line\n• CSV rows:    Login,source,isNewUser,loginStatus\n• Names only:  Login\n               Page_View\n               Searched\n• Tooltip HTML: <span data-t="tooltip" title="source">B2B</span>…\n               (type the event name below)`}
                                className="min-h-[170px] font-mono text-xs leading-relaxed"
                                spellCheck={false}
                            />

                            {/* Event name for tooltip-HTML / property-only pastes */}
                            <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                                <EventNamePicker value={htmlEventName} onChange={setHtmlEventName} />
                                <p className="text-[11px] text-muted-foreground flex-1 min-w-[220px] pt-4">
                                    Only needed for a <b>tooltip snippet</b> (properties only, no event name).
                                    A full <b>User activity details</b> paste already contains every event name, so you can leave this blank.
                                </p>
                            </div>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button onClick={handleAnalyze} className="bg-blue-600 hover:bg-blue-700">
                                        <ScanSearch className="w-4 h-4 mr-1.5" /> Analyse gaps
                                    </Button>
                                    <Button variant="outline" onClick={handleSample}>
                                        <Sparkles className="w-4 h-4 mr-1.5" /> Load sample
                                    </Button>
                                    <Button variant="outline" onClick={() => harInputRef.current?.click()}>
                                        <UploadCloud className="w-4 h-4 mr-1.5" /> Import HAR
                                    </Button>
                                    <input
                                        ref={harInputRef}
                                        type="file"
                                        accept=".har,.json,application/json"
                                        className="hidden"
                                        onChange={handleHarFile}
                                        aria-label="Import HAR file"
                                    />
                                    <Button variant="ghost" onClick={handleClear}>
                                        <RotateCcw className="w-4 h-4 mr-1.5" /> Clear
                                    </Button>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    Bulk paste is supported — partial input only reports what you pasted.
                                </span>
                            </div>

                            {/* Privacy note for HAR import */}
                            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-2.5">
                                <Shield className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                                    <b>HAR import is local-only.</b> The file is parsed in your browser — only event names and
                                    property <i>names</i> are kept. Headers, cookies, tokens, values and query strings are discarded.
                                    Nothing is uploaded to a server or written to Firestore.
                                </p>
                            </div>

                            {harStats && (
                                <div className="flex flex-wrap gap-1.5">
                                    <Pill className="bg-emerald-500/10 border-emerald-500/25 text-emerald-600">
                                        {harStats.cleverTapEntries} CleverTap request(s)
                                    </Pill>
                                    <Pill className="bg-sky-500/10 border-sky-500/25 text-sky-600">
                                        {harStats.payloadsDecoded} payload(s) decoded
                                    </Pill>
                                    <Pill className="bg-blue-500/10 border-blue-500/25 text-blue-600">
                                        {harStats.eventsFound} event(s) extracted
                                    </Pill>
                                    <Pill className="bg-muted border-border text-muted-foreground">
                                        {harStats.entriesScanned} HAR entries scanned
                                    </Pill>
                                </div>
                            )}

                            {result && result.parse.format === 'activity-html' && (
                                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/5 p-2.5">
                                    <Pill className="bg-blue-500/15 border-blue-500/30 text-blue-600">
                                        <Layers className="w-3 h-3" /> CleverTap activity page
                                    </Pill>
                                    <Pill className="bg-emerald-500/10 border-emerald-500/25 text-emerald-600">
                                        {result.parse.events.length} unique event(s)
                                    </Pill>
                                    <Pill className="bg-sky-500/10 border-sky-500/25 text-sky-600">
                                        {result.parse.events.reduce((sum, e) => sum + e.count, 0)} record(s)
                                    </Pill>
                                    {systemExtras > 0 && (
                                        <Pill className="bg-slate-500/10 border-slate-500/25 text-slate-600">
                                            {systemExtras} CleverTap system event(s)
                                        </Pill>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">
                                        Every event on the page was read in one pass — names and property names only.
                                    </span>
                                </div>
                            )}

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
                                    <StatTile label="In your paste" value={result.summary.capturedTotal} sub="unique events seen" tone="sky" icon={ClipboardPaste} />
                                    <StatTile label="Found" value={result.summary.matched} sub="CSV events in paste" tone="emerald" icon={CheckCircle2} />
                                    <StatTile label="Not in paste" value={result.summary.missing} sub="CSV events absent" tone="rose" icon={XCircle} />
                                    <StatTile label="Beyond CSV" value={result.summary.extra} sub={systemExtras > 0 ? `in paste, not in CSV · ${systemExtras} system` : 'in paste, not in CSV'} tone="violet" icon={PlusCircle} />
                                    <StatTile label="Prop coverage" value={`${result.summary.propertyCoverage}%`} sub="matched properties" tone="emerald" icon={ListChecks} />
                                </div>

                                {/* Toolbar */}
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/60">
                                        {([
                                            ['all', `All ${counts.all}`],
                                            ['missing', `Not in paste ${counts.missing}`],
                                            ['captured', `Found in paste ${counts.captured}`],
                                            ['extra', `Beyond CSV ${counts.extra}`],
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
                                            <FileDown className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={handleExportSanitized} title="Sanitized captured events (names + property names only)">
                                            <Shield className="w-3.5 h-3.5 mr-1.5" /> Safe JSON
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
                                                    <th className="px-3 py-2.5 font-semibold">In paste</th>
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

                                <ZenitStatusLegend />
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

                    <ZenitStatusLegend />

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
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        <code className="text-xs font-semibold">{row.name}</code>
                        {row.records > 0 && <span className="text-[10px] text-muted-foreground">×{row.records}</span>}
                        {row.isSystem && (
                            <Pill className="bg-slate-500/10 text-slate-600 border-slate-500/25 text-[10px]">CT system</Pill>
                        )}
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
                            {row.isSystem && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                    <b>CleverTap system event:</b> generated by the SDK, not defined in the CSV. It is expected
                                    in the activity page and should not be treated as a missing custom event.
                                </p>
                            )}
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
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const handleCopySnippet = async () => {
        try {
            await navigator.clipboard.writeText(CONSOLE_CAPTURE_SNIPPET);
            setCopied(true);
            toast({ title: 'Snippet copied', description: 'Paste it in the browser console before using the app.' });
            setTimeout(() => setCopied(false), 2500);
        } catch {
            toast({ title: 'Copy failed', description: 'Select the snippet and copy it manually.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-600"><Terminal className="w-5 h-5" /></div>
                        <div>
                            <h3 className="font-bold">Getting the data without an API key</h3>
                            <p className="text-sm text-muted-foreground">Four ways, from easiest to most complete.</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            {
                                n: 1, title: 'HAR import (recommended)',
                                body: 'F12 ▸ Network ▸ Preserve log ▸ filter “clevertap”. Do your actions, then right-click ▸ Save all as HAR with content. Click Import HAR above — parsed locally, values discarded.',
                                tag: 'One file',
                            },
                            {
                                n: 2, title: 'Browser DevTools (Network)',
                                body: 'F12 ▸ Network ▸ filter “clevertap”. Click a request ▸ Payload ▸ copy the JSON body. Paste it above — one or many events at once.',
                                tag: 'Live truth',
                            },
                            {
                                n: 3, title: 'Console hook',
                                body: 'Paste the snippet below before using the app, then copy the captured array and paste it above. No cookies, no HAR, no API key.',
                                tag: 'Zero setup',
                            },
                            {
                                n: 4, title: 'User activity details page',
                                body: 'Open a user in CleverTap ▸ User activity details. Select the whole page (Ctrl+A) and paste it above — every event row (name + properties) is read in one pass.',
                                tag: 'One paste',
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
Searched

// E) Tooltip HTML (properties only — set the event name above)
<span data-t="tooltip" title="source">B2B</span>…

// F) CleverTap "User activity details" page (best coverage)
//    Select the whole page (Ctrl+A) and paste it.
//    Every event row is read at once — names + property names.`}</pre>
                    </div>

                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-600" /> Best single paste: “User activity details”
                        </p>
                        <ol className="list-decimal pl-5 text-[12px] text-muted-foreground space-y-1">
                            <li>Open the user in CleverTap and go to <b>User activity details</b>.</li>
                            <li>Select the whole page (<b>Ctrl+A</b> / <b>Cmd+A</b>) and copy it.</li>
                            <li>Paste it into the box above and press <b>Analyse gaps</b>.</li>
                        </ol>
                        <p className="text-[11px] text-muted-foreground">
                            The page contains many events in one HTML table. Zenit reads every row, groups repeated events,
                            unions their property names, and flags CleverTap system events (App Launched, Identity Set, …)
                            so they are not mistaken for missing CSV events. Parsing is local — nothing is uploaded.
                        </p>
                    </div>

                    <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-sm font-semibold flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-blue-600" /> Console hook — no HAR, no API key
                            </p>
                            <Button size="sm" variant="outline" onClick={handleCopySnippet}>
                                {copied
                                    ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Copied</>
                                    : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy snippet</>}
                            </Button>
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                            Run this in the browser console <b>before</b> using the app. It wraps <code>clevertap.push</code>
                            and records every event. Afterwards it copies a JSON array you can paste straight into the box above.
                            Nothing leaves your browser.
                        </p>
                        <pre className="text-[11px] font-mono bg-background/70 border rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">{CONSOLE_CAPTURE_SNIPPET}</pre>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Run it after the SDK has loaded (i.e. once the app is open). Reloading the page clears the hook.
                        </p>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[12px] text-amber-800 dark:text-amber-300 space-y-2">
                        <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> The tooltip snippet is NOT the full capture</p>
                        <p>
                            The <code>&lt;span data-t=&quot;tooltip&quot; …&gt;</code> block you copy from a CleverTap event detail
                            is <b>one event&apos;s properties only</b>. It has no event name and no list of the other events.
                            That is why it cannot answer &quot;what is missing&quot; on its own.
                        </p>
                        <p>
                            To get the <b>overall</b> capture in one shot, use one of these:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><b>User activity details →</b> open the page, select the whole page and paste it. It already contains every event and its properties in one HTML table.</li>
                            <li><b>Import HAR</b> — DevTools ▸ Network ▸ Preserve log ▸ filter <code>clevertap</code> ▸ do your actions ▸ right-click ▸ <b>Save all as HAR with content</b> ▸ click <b>Import HAR</b> above. One file covers the whole session and is parsed locally.</li>
                            <li><b>DevTools → Network →</b> filter <code>clevertap</code> → click the request → <b>Payload</b> tab → copy the whole JSON body. It contains the batched events (names + properties).</li>
                            <li><b>Console hook →</b> use the snippet above to record every <code>clevertap.push</code> call, then copy the JSON array.</li>
                            <li><b>CleverTap dashboard → Analytics ▸ Events</b> → use the <b>Export / download</b> action to get the event list as CSV.</li>
                            <li>Paste or import any of these here — every event is analysed in one pass.</li>
                        </ul>
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
