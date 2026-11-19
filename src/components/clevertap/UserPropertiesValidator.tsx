'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    UserRound, ClipboardPaste, CheckCircle2, XCircle, PlusCircle,
    AlertTriangle, FileDown, Copy, RotateCcw, Sparkles, Info,
    ArrowRight, Trash2, PencilLine,
} from 'lucide-react';
import {
    analyzeUserProperties,
    buildUserPropertiesCsv,
    buildMissingList,
    buildExtraList,
    SAMPLE_USER_PROPERTIES,
    USER_PROPERTY_CATALOG,
    type UserPropertyAnalysis,
    type UserPropertyRow,
    type UserPropertySource,
} from '@/lib/clevertap/user-properties-catalog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function download(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function stamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const SOURCE_STYLE: Record<UserPropertySource, string> = {
    Client: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    Backend: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    Analytics: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
};

const FORMAT_LABEL: Record<string, string> = {
    json: 'JSON',
    'js-object': 'JS object',
    html: 'HTML',
    csv: 'CSV rows',
    lines: 'Key/value lines',
    empty: 'Nothing pasted',
};

function StatTile({
    label, value, sub, tone, icon: Icon,
}: {
    label: string; value: string | number; sub?: string;
    tone: 'blue' | 'emerald' | 'rose' | 'sky' | 'violet' | 'amber';
    icon: typeof CheckCircle2;
}) {
    const tones: Record<string, string> = {
        blue: 'from-blue-500/15 to-cyan-500/10 border-blue-500/25 text-blue-600',
        emerald: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/25 text-emerald-600',
        rose: 'from-rose-500/15 to-red-500/10 border-rose-500/25 text-rose-600',
        sky: 'from-sky-500/15 to-cyan-500/10 border-sky-500/25 text-sky-600',
        violet: 'from-violet-500/15 to-fuchsia-500/10 border-violet-500/25 text-violet-600',
        amber: 'from-amber-500/15 to-orange-500/10 border-amber-500/25 text-amber-600',
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
        <div className="flex items-center gap-2 min-w-[140px]">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{value}%</span>
        </div>
    );
}

function ValueCell({ row }: { row: UserPropertyRow }) {
    if (!row.value) return <span className="text-muted-foreground">—</span>;
    return <span className="font-mono text-[11px] break-all">{row.value}</span>;
}

function SourceBadge({ source }: { source: UserPropertySource }) {
    return (
        <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap', SOURCE_STYLE[source])}>
            {source}
        </span>
    );
}

function SectionShell({
    title, description, count, tone, icon: Icon, children,
}: {
    title: string; description: string; count: number;
    tone: 'rose' | 'sky' | 'amber' | 'emerald';
    icon: typeof CheckCircle2;
    children: React.ReactNode;
}) {
    const tones = {
        rose: 'border-rose-500/25 bg-rose-500/5 text-rose-600',
        sky: 'border-sky-500/25 bg-sky-500/5 text-sky-600',
        amber: 'border-amber-500/25 bg-amber-500/5 text-amber-600',
        emerald: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600',
    };
    return (
        <Card className={cn('overflow-hidden border', tones[tone])}>
            <div className="px-5 py-3 border-b border-current/10">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <h3 className="text-sm font-bold text-foreground">{title}</h3>
                    <Badge variant="outline" className="text-[10px] border-current/30 text-current">{count}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
            </div>
            <div className="max-h-80 overflow-y-auto">{children}</div>
        </Card>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UserPropertiesValidator() {
    const { toast } = useToast();
    const [input, setInput] = useState('');
    const [result, setResult] = useState<UserPropertyAnalysis | null>(null);

    // Restore the last paste so switching tabs inside the tracker does not
    // lose the inspected element.
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ct_user_props_input');
            if (saved) {
                setInput(saved);
                setResult(analyzeUserProperties(saved));
            }
        } catch {
            /* storage unavailable */
        }
    }, []);

    useEffect(() => {
        if (!input) return;
        try {
            localStorage.setItem('ct_user_props_input', input);
        } catch {
            /* storage unavailable */
        }
    }, [input]);

    const runAnalysis = (text: string) => {
        const analysis = analyzeUserProperties(text);
        if (analysis.errors.length > 0 && analysis.summary.pastedTotal === 0) {
            toast({
                title: 'Could not read that paste',
                description: analysis.errors[0],
                variant: 'destructive',
            });
        }
        setResult(analysis);
    };

    const handleAnalyze = () => runAnalysis(input);

    const handleSample = () => {
        setInput(SAMPLE_USER_PROPERTIES);
        runAnalysis(SAMPLE_USER_PROPERTIES);
    };

    const handleClear = () => {
        setInput('');
        setResult(null);
        try {
            localStorage.removeItem('ct_user_props_input');
        } catch {
            /* storage unavailable */
        }
    };

    const handleExport = () => {
        if (!result) return;
        download(`clevertap-user-properties-${stamp()}.csv`, buildUserPropertiesCsv(result));
        toast({ title: 'Report exported', description: 'User-property diff CSV downloaded.' });
    };

    const copy = async (text: string, title: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast({ title, description: 'Copied to clipboard.' });
        } catch {
            toast({ title: 'Clipboard unavailable', description: 'Use Export CSV instead.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <Card className="overflow-hidden border-teal-500/25">
                <div className="relative bg-gradient-to-br from-teal-500/12 via-cyan-500/8 to-emerald-500/10 p-6">
                    <div className="relative z-10 flex flex-wrap items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600">
                            <UserRound className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-700 dark:text-teal-400 mb-2">
                                <Sparkles className="w-3 h-3" /> User Properties · workbook source of truth
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">User Properties Validator</h2>
                            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                                Paste the profile element you copied from the browser inspector. Zenit compares it with the{' '}
                                <b>{USER_PROPERTY_CATALOG.length} user properties</b> in the CleverTap workbook and shows exactly what is
                                <b className="text-rose-600"> missing</b> and what is
                                <b className="text-sky-600"> not in the workbook</b> (remove it).
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">JSON</span>
                            <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">JS object</span>
                            <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">Tooltip HTML</span>
                            <span className="rounded-full border border-border bg-background/60 px-2.5 py-1">CSV / key:value</span>
                        </div>
                    </div>
                    <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
                </div>
            </Card>

            {/* Paste */}
            <Card>
                <CardContent className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ClipboardPaste className="w-4 h-4 text-teal-600" />
                            <h3 className="font-semibold text-sm">Paste the inspected profile</h3>
                            <span className="text-[11px] text-muted-foreground">
                                All at once — not one property at a time
                            </span>
                        </div>
                        {result && (
                            <Badge variant="outline" className="text-[10px]">
                                Detected: {FORMAT_LABEL[result.format] ?? result.format}
                            </Badge>
                        )}
                    </div>

                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        rows={10}
                        spellCheck={false}
                        placeholder={`Paste any of these:\n\n• DevTools ▸ Network ▸ clevertap request ▸ Payload ▸ copy the profile JSON\n• Console: clevertap.profile.push({ Site: { Email: "…", Name: "…" } })\n• Element inspector: right-click the profile block ▸ Copy ▸ Copy element\n• Tooltip HTML: <span data-t="tooltip" title="Email">…</span>\n• CSV rows or one "key: value" per line`}
                        className="font-mono text-xs"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={handleAnalyze} className="bg-gradient-to-r from-teal-500 to-emerald-600">
                            <UserRound className="w-4 h-4 mr-2" /> Check user properties
                        </Button>
                        <Button onClick={handleSample} variant="outline">
                            <Sparkles className="w-4 h-4 mr-2" /> Load sample
                        </Button>
                        <Button onClick={handleClear} variant="ghost" disabled={!input && !result}>
                            <RotateCcw className="w-4 h-4 mr-2" /> Clear
                        </Button>
                        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Info className="w-3.5 h-3.5" /> Parsed locally — nothing is uploaded
                        </span>
                    </div>

                    {result && result.errors.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                            {result.errors.map((error) => (
                                <p key={error} className="flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
                                </p>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results */}
            {result && result.summary.pastedTotal > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        <StatTile label="Workbook properties" value={result.summary.catalogTotal} sub="expected" tone="blue" icon={UserRound} />
                        <StatTile label="In your paste" value={result.summary.pastedTotal} sub="unique keys" tone="violet" icon={ClipboardPaste} />
                        <StatTile label="Matched" value={result.summary.matched} sub="exact workbook names" tone="emerald" icon={CheckCircle2} />
                        <StatTile label="Missing" value={result.summary.missing} sub="not in paste" tone="rose" icon={XCircle} />
                        <StatTile label="Not in workbook" value={result.summary.extra} sub="remove these" tone="sky" icon={PlusCircle} />
                        <StatTile label="Needs rename" value={result.summary.renamed} sub="wrong case / punctuation" tone="amber" icon={PencilLine} />
                    </div>

                    <Card>
                        <CardContent className="p-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">Strict coverage</span>
                                <CoverageBar value={result.summary.coverage} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                {result.summary.matched}/{result.summary.catalogTotal} workbook properties present under the exact name
                            </span>
                            {result.summary.ignored > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                    {result.summary.ignored} structural key(s) ignored
                                </Badge>
                            )}
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copy(buildMissingList(result), 'Missing properties copied')}
                                    disabled={result.missing.length === 0}
                                    className="text-xs h-8"
                                >
                                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy missing
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copy(buildExtraList(result), 'Extra properties copied')}
                                    disabled={result.extra.length === 0}
                                    className="text-xs h-8"
                                >
                                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy extras
                                </Button>
                                <Button size="sm" onClick={handleExport} className="text-xs h-8 bg-gradient-to-r from-teal-500 to-emerald-600">
                                    <FileDown className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {result.summary.missing === 0 && result.summary.extra === 0 && result.summary.renamed === 0 ? (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" /> All {result.summary.catalogTotal} workbook user properties are present with the exact names — and there are no extras.
                        </div>
                    ) : null}

                    {/* Missing */}
                    {result.missing.length > 0 && (
                        <SectionShell
                            title="Missing from the paste"
                            description="These workbook properties are required but were not found. Add them to the profile payload."
                            count={result.missing.length}
                            tone="rose"
                            icon={XCircle}
                        >
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-card z-10">
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="px-4 py-2 font-semibold">Property</th>
                                        <th className="px-3 py-2 font-semibold">When it should be updated</th>
                                        <th className="px-3 py-2 font-semibold">Owner</th>
                                        <th className="px-3 py-2 font-semibold">Expected values</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {result.missing.map((row) => (
                                        <tr key={row.key} className="hover:bg-rose-500/5">
                                            <td className="px-4 py-2 font-mono font-semibold text-rose-600 whitespace-nowrap">{row.key}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.def?.whenUpdated}</td>
                                            <td className="px-3 py-2">{row.def && <SourceBadge source={row.def.source} />}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.def?.sampleValues}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </SectionShell>
                    )}

                    {/* Extra */}
                    {result.extra.length > 0 && (
                        <SectionShell
                            title="Not in the workbook — remove"
                            description="These keys were in the paste but do not exist in the user-properties workbook. Remove them or get the workbook updated first."
                            count={result.extra.length}
                            tone="sky"
                            icon={Trash2}
                        >
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-card z-10">
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="px-4 py-2 font-semibold">Pasted property</th>
                                        <th className="px-3 py-2 font-semibold">Value in paste</th>
                                        <th className="px-3 py-2 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {result.extra.map((row) => (
                                        <tr key={row.key} className="hover:bg-sky-500/5">
                                            <td className="px-4 py-2 font-mono font-semibold text-sky-600 whitespace-nowrap">{row.key}</td>
                                            <td className="px-3 py-2"><ValueCell row={row} /></td>
                                            <td className="px-3 py-2 text-muted-foreground">Remove — not in workbook</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </SectionShell>
                    )}

                    {/* Renamed */}
                    {result.renamed.length > 0 && (
                        <SectionShell
                            title="Present but wrongly named"
                            description="The value exists, but the key is not the camelCase name from the workbook. Rename it so CleverTap matches the profile property."
                            count={result.renamed.length}
                            tone="amber"
                            icon={PencilLine}
                        >
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-card z-10">
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="px-4 py-2 font-semibold">Pasted key</th>
                                        <th className="px-3 py-2 font-semibold">Use instead</th>
                                        <th className="px-3 py-2 font-semibold">Value in paste</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {result.renamed.map((row) => (
                                        <tr key={row.key} className="hover:bg-amber-500/5">
                                            <td className="px-4 py-2 font-mono text-amber-600 whitespace-nowrap">{row.key}</td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center gap-1 font-mono font-semibold">
                                                    <ArrowRight className="w-3 h-3 text-muted-foreground" /> {row.canonical}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2"><ValueCell row={row} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </SectionShell>
                    )}

                    {/* Matched */}
                    {result.present.length > 0 && (
                        <details className="group rounded-xl border border-emerald-500/25 bg-emerald-500/5 overflow-hidden">
                            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-bold">Matched workbook properties</span>
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                                    {result.present.length}
                                </Badge>
                                <span className="ml-auto text-[11px] text-muted-foreground group-open:hidden">Show</span>
                                <span className="ml-auto text-[11px] text-muted-foreground hidden group-open:inline">Hide</span>
                            </summary>
                            <div className="max-h-80 overflow-y-auto border-t border-emerald-500/20">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-card z-10">
                                        <tr className="border-b border-border text-left text-muted-foreground">
                                            <th className="px-4 py-2 font-semibold">Property</th>
                                            <th className="px-3 py-2 font-semibold">Value in paste</th>
                                            <th className="px-3 py-2 font-semibold">Owner</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {result.present.map((row) => (
                                            <tr key={row.key} className="hover:bg-emerald-500/5">
                                                <td className="px-4 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{row.canonical}</td>
                                                <td className="px-3 py-2"><ValueCell row={row} /></td>
                                                <td className="px-3 py-2">{row.def && <SourceBadge source={row.def.source} />}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!result && (
                <div className="grid md:grid-cols-3 gap-3">
                    {[
                        {
                            title: '1 · Copy the profile',
                            body: 'Open DevTools ▸ Network, filter “clevertap”, trigger a profile update, then copy the request payload. Or right-click the profile block ▸ Copy ▸ Copy element.',
                        },
                        {
                            title: '2 · Paste it above',
                            body: 'One paste is enough. JSON, a JS object, tooltip HTML, CSV rows and “key: value” lines are all accepted.',
                        },
                        {
                            title: '3 · Fix the diff',
                            body: 'Add every property in “Missing”, remove every property in “Not in workbook”, and rename anything shown under “Wrongly named”.',
                        },
                    ].map((item) => (
                        <Card key={item.title}>
                            <CardContent className="p-4">
                                <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
