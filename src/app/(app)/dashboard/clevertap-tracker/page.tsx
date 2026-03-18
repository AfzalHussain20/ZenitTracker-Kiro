"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Rocket, ArrowLeft, CheckCircle2, PlusCircle, FileJson, FileDown,
    Database, AlertCircle, XCircle, FileSpreadsheet, UploadCloud,
    Zap, Shield, ChevronRight, Tv, Film, Music, Laugh, Radio, Smartphone,
    Globe, Monitor, Apple, Play, BarChart3, ChevronLeft, Layers, BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { buildPhase1Tabs, buildPhase2Tabs } from '@/lib/export-to-sheets';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;
type Platform = { id: string; label: string; icon: React.ElementType; gradient: string };
type ContentType = { id: string; label: string; icon: React.ElementType; color: string };
type ValidationStatus = 'VALUE_REQUIRED' | 'UNEXPECTED_VALUE' | 'CAPITAL_ATTR' | 'MISSING' | 'EXTRA' | 'PASS' | 'WEB_NA';
type InHousePhase = 'choose' | 'phase1' | 'phase2';

interface AttrResult {
    attr: string;
    status: ValidationStatus;
    expected?: string;
    actual?: string;
    message: string;
    mainAttr?: string; // 'others' when the row's Main_Attribute Name is "others"
}

interface EventCapture {
    eventName: string;
    rawJson: string;
    params: Record<string, string>;
    validationResults?: AttrResult[];
    validationScore?: number;
}

interface InHouseTitle {
    id: string;
    name: string;
    events: Record<string, EventCapture>;
}

interface InHouseSheet {
    id: string;
    name: string;
    titles: InHouseTitle[];
}

interface Schema {
    [eventName: string]: Record<string, 'yes' | 'no'>;
}

// Per-attr metadata: mainAttr tells us if it belongs to the "others" group
interface SchemaMeta {
    [eventName: string]: Record<string, { rule: 'yes' | 'no'; mainAttr: string }>;
}

// Schema keyed by xlsx sheet name → event name → attr → yes/no
interface SheetSchema {
    [sheetName: string]: Schema;
}

// Per-sheet metadata
interface SheetSchemaMeta {
    [sheetName: string]: SchemaMeta;
}

// Phase 2 state per title
interface Phase2Entry {
    selectedSheet: string;
    eventName: string;
    json: string;
    results: AttrResult[] | null;
    score: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS: Platform[] = [
    { id: 'android-tv', label: 'Android TV', icon: Tv, gradient: 'from-green-500 to-emerald-600' },
    { id: 'apple-tv', label: 'Apple TV', icon: Apple, gradient: 'from-slate-500 to-slate-700' },
    { id: 'fire-tv', label: 'Fire TV', icon: Tv, gradient: 'from-orange-500 to-red-600' },
    { id: 'lg-tv', label: 'LG TV', icon: Monitor, gradient: 'from-red-500 to-rose-600' },
    { id: 'samsung-tv', label: 'Samsung TV', icon: Monitor, gradient: 'from-blue-500 to-indigo-600' },
    { id: 'roku', label: 'Roku', icon: Tv, gradient: 'from-purple-500 to-violet-600' },
    { id: 'web', label: 'Web', icon: Globe, gradient: 'from-cyan-500 to-blue-600' },
    { id: 'android', label: 'Mobile (Android)', icon: Smartphone, gradient: 'from-lime-500 to-green-600' },
    { id: 'ios', label: 'Mobile (iOS)', icon: Apple, gradient: 'from-gray-500 to-slate-600' },
    { id: 'jio-stb', label: 'Jio STB', icon: Tv, gradient: 'from-indigo-500 to-blue-700' },
];

const CONTENT_TYPES: ContentType[] = [
    { id: 'live-tv', label: 'Live TV', icon: Radio, color: '#ef4444' },
    { id: 'tv-shows', label: 'TV Shows', icon: Tv, color: '#8b5cf6' },
    { id: 'movies', label: 'Movies', icon: Film, color: '#f59e0b' },
    { id: 'shorts', label: 'Shorts', icon: Play, color: '#10b981' },
    { id: 'music-videos', label: 'Music Videos', icon: Music, color: '#ec4899' },
    { id: 'comedy', label: 'Comedy', icon: Laugh, color: '#f97316' },
];

// These attributes accept any value as long as they are present.
// Absent → MISSING. Present with any value (even NA/null/false) → PASS.
const FLEXIBLE_VALUE_ATTRS = new Set([
    'user_parent_journey_id',
    'user_child_journey_id',
    'experiment_id',
    'experiment_variant',
    'feature_flag',
    'recommendation_source',
    'recommendation_version',
    'subscription_flow_id',
    'funnel_step',
]);

// Web platform always sends NA for these — treat as PASS, show web team notice
const WEB_NA_ATTRS = new Set([
    'device_id', 'server_timestamp', 'app_id', 'app_build', 'new_app_version',
    'device_manufacturer', 'device_model', 'region_code', 'force_update',
    'last_interaction_ts', 'time_to_app_start_ms', 'time_since_load_ms',
    'time_to_splash_ms', 'time_to_app_config_ms', 'time_to_storefront_ms',
    'vertical_position', 'vpn_detected', 'proxy_detected',
    'experiment_id', 'experiment_variant', 'feature_flag', 'launch_type',
    'recommendation_source', 'recommendation_version', 'subscription_flow_id',
    'funnel_step', 'app_state', 'background_reason',
]);

// Phase 1: exactly these 4 events
const PHASE1_EVENTS = [
    { name: 'app_launch', color: 'from-blue-500 to-cyan-600' },
    { name: 'content_click', color: 'from-purple-500 to-violet-600' },
    { name: 'content_attempted', color: 'from-amber-500 to-orange-600' },
    { name: 'content_played', color: 'from-emerald-500 to-green-600' },
];

const configSchema = z.object({
    platform: z.string().min(1, 'Select a platform'),
    environment: z.enum(['Production', 'Pre-Production']),
    appVersion: z.string().min(1, 'App version is required'),
});
type ConfigForm = z.infer<typeof configSchema>;

const statusColor: Record<ValidationStatus, string> = {
    PASS: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border-emerald-200',
    VALUE_REQUIRED: 'text-red-600 bg-red-50 dark:bg-red-950 border-red-200',
    UNEXPECTED_VALUE: 'text-orange-600 bg-orange-50 dark:bg-orange-950 border-orange-200',
    CAPITAL_ATTR: 'text-amber-600 bg-amber-50 dark:bg-amber-950 border-amber-200',
    MISSING: 'text-rose-600 bg-rose-50 dark:bg-rose-950 border-rose-200',
    EXTRA: 'text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200',
    WEB_NA: 'text-cyan-700 bg-cyan-50 dark:bg-cyan-950 border-cyan-200',
};

// ─── Helper Functions ─────────────────────────────────────────────────────────
function parseHtmlToParams(html: string): Record<string, string> {
    const pattern = /<span[^>]*data-t="tooltip"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>/g;
    const params: Record<string, string> = {};
    const keyCounts: Record<string, number> = {};
    let match;
    while ((match = pattern.exec(html)) !== null) {
        let key = match[1].trim();
        const value = match[2].trim();
        if (keyCounts[key]) { keyCounts[key]++; params[`${key} (${keyCounts[key]})`] = value; }
        else { keyCounts[key] = 1; params[key] = value; }
    }
    return params;
}

function parseJsonToParams(jsonStr: string): Record<string, string> {
    try {
        let obj = JSON.parse(jsonStr);
        if (obj._source?.fields) obj = obj._source.fields;
        else if (obj._source?.message) { try { obj = JSON.parse(obj._source.message); } catch { obj = obj._source; } }
        else if (obj._source) obj = obj._source;
        else if (obj.fields) obj = obj.fields;
        const params: Record<string, string> = {};
        const flatten = (data: any, prefix = '') => {
            if (data === null || data === undefined) return;
            for (const [key, value] of Object.entries(data)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                // Top-level 'others' object — emit each sub-key as others(subkey)
                // Handles both parsed object and JSON-stringified string
                if (key === 'others' && !prefix) {
                    let othersObj: Record<string, any> | null = null;
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        othersObj = value as Record<string, any>;
                    } else if (typeof value === 'string' && value.trim().startsWith('{')) {
                        try { const parsed = JSON.parse(value); if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) othersObj = parsed; } catch {}
                    }
                    if (othersObj) {
                        for (const [subKey, subVal] of Object.entries(othersObj)) {
                            params[`others(${subKey})`] = Array.isArray(subVal) ? JSON.stringify(subVal) : String(subVal ?? '');
                        }
                    }
                    // Always continue — never emit 'others' as a flat key, even if unparseable
                    continue;
                }
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) flatten(value, newKey);
                else params[newKey] = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
            }
        };
        flatten(obj);
        return params;
    } catch { throw new Error('Invalid JSON'); }
}

function cleanAttributeName(attrName: string): string {
    return attrName
        .replace(/^_source\.message\./i, '')
        .replace(/^event\.original\./i, '')
        .replace(/^_source\./i, '')
        .toLowerCase().trim();
    // No timestamp normalisation here — handled via alias in validateParams
}

function isInvalidNAValue(v: string | undefined | null): boolean {
    if (v === null || v === undefined) return true;
    const s = String(v).trim().toLowerCase();
    return s === '' || s === 'null' || s === 'undefined' || s === 'na' || s === 'n/a' || s === 'false';
}

function validateParams(
    params: Record<string, string>,
    schemaEvent: Record<string, 'yes' | 'no'>,
    schemaMeta?: Record<string, { rule: 'yes' | 'no'; mainAttr: string }>,
    isWeb?: boolean
): AttrResult[] {
    const results: AttrResult[] = [];
    const cleanedParams: Record<string, string> = {};

    // ── 1. Clean params and capital-check ──────────────────────────────
    for (const [key, value] of Object.entries(params)) {
        if (key.startsWith('others(')) {
            const subKey = key.slice(7, -1);
            if (/[A-Z]/.test(subKey)) {
                results.push({
                    attr: subKey, status: 'CAPITAL_ATTR', actual: value,
                    message: `Key inside others has capital letters`,
                    mainAttr: 'others',
                });
            }
            if (!(key in cleanedParams)) cleanedParams[key] = value;
        } else {
            const cleaned = cleanAttributeName(key);
            if (/[A-Z]/.test(cleaned)) {
                results.push({ attr: cleaned, status: 'CAPITAL_ATTR', actual: value, message: `Key "${cleaned}" contains uppercase letters — must be snake_case` });
            }
            if (!(cleaned in cleanedParams)) cleanedParams[cleaned] = value;
        }
    }

    const schemaKeys = Object.keys(schemaEvent);

    // Alias timestamp variants → base key (e.g. event_timestamp_utc/_ist → event_timestamp)
    for (const variant of ['event_timestamp_utc', 'event_timestamp_ist']) {
        if (cleanedParams[variant] !== undefined) {
            if (cleanedParams['event_timestamp'] === undefined) {
                cleanedParams['event_timestamp'] = cleanedParams[variant];
            }
            delete cleanedParams[variant]; // never show as EXTRA
        }
    }

    // Separate schema keys into others-group and normal
    const othersSchemaKeys = new Set(
        schemaKeys.filter(k => schemaMeta?.[k]?.mainAttr === 'others')
    );
    const normalSchemaKeys = new Set(
        schemaKeys.filter(k => schemaMeta?.[k]?.mainAttr !== 'others')
    );

    // ── 2. Validate normal (non-others) schema keys ─────────────────────
    for (const schemaKey of normalSchemaKeys) {
        const rule = schemaEvent[schemaKey];
        const mainAttr = schemaMeta?.[schemaKey]?.mainAttr ?? '';
        const actual = cleanedParams[schemaKey];

        // ── Flexible attributes: only care about presence, not value ──
        if (FLEXIBLE_VALUE_ATTRS.has(schemaKey)) {
            if (actual === undefined) {
                results.push({
                    attr: schemaKey, status: 'MISSING',
                    expected: '<any value>',
                    actual: undefined,
                    message: 'Must be present — any value including NA is accepted',
                    mainAttr,
                });
            } else {
                // Present with any value whatsoever → PASS
                results.push({ attr: schemaKey, status: 'PASS', actual, message: 'OK', mainAttr });
            }
            continue;
        }

        // ── Web platform: these attrs always send NA — show as WEB_NA section ──
        if (isWeb && WEB_NA_ATTRS.has(schemaKey)) {
            results.push({ attr: schemaKey, status: 'WEB_NA', actual: actual ?? 'na', message: 'Web team sends NA — expected behaviour', mainAttr });
            continue;
        }

        // ── Standard YES/NO validation ──────────────────────────────────
        if (actual === undefined) {
            results.push({
                attr: schemaKey, status: 'MISSING',
                expected: rule === 'yes' ? '<real value>' : 'na',
                actual: undefined, message: 'Missing attribute', mainAttr,
            });
            continue;
        }

        if (rule === 'yes') {
            if (isInvalidNAValue(actual)) {
                results.push({ attr: schemaKey, status: 'VALUE_REQUIRED', expected: '<real value>', actual, message: `Value Required — YES rule, got NA/null/blank/false`, mainAttr });
            } else {
                results.push({ attr: schemaKey, status: 'PASS', actual, message: 'OK', mainAttr });
            }
        } else {
            if (!isInvalidNAValue(actual)) {
                results.push({ attr: schemaKey, status: 'UNEXPECTED_VALUE', expected: 'na', actual, message: `Expected NA but got "${actual}"`, mainAttr });
            } else {
                results.push({ attr: schemaKey, status: 'PASS', actual, message: 'OK', mainAttr });
            }
        }
    }

    // ── 3. Validate others-group schema keys ────────────────────────────
    for (const schemaKey of othersSchemaKeys) {
        const rule = schemaEvent[schemaKey];
        const paramKey = `others(${schemaKey})`;
        const actual = cleanedParams[paramKey];

        if (rule === 'no') {
            // NO + absent or NA/null/false → completely silent, nothing pushed
            // NO + real value present → UNEXPECTED_VALUE
            if (actual !== undefined && !isInvalidNAValue(actual)) {
                results.push({
                    attr: schemaKey, status: 'UNEXPECTED_VALUE',
                    expected: 'na', actual,
                    message: `Expected NA in others but got "${actual}"`,
                    mainAttr: 'others',
                });
            }
            continue;
        }

        // Rule is YES
        if (actual === undefined) {
            results.push({
                attr: schemaKey, status: 'MISSING',
                expected: '<real value>', actual: undefined,
                message: 'Missing from others object',
                mainAttr: 'others',
            });
        } else if (isInvalidNAValue(actual)) {
            results.push({
                attr: schemaKey, status: 'VALUE_REQUIRED',
                expected: '<real value>', actual,
                message: `Value Required — YES rule, got NA/null/blank/false`,
                mainAttr: 'others',
            });
        } else {
            results.push({ attr: schemaKey, status: 'PASS', actual, message: 'OK', mainAttr: 'others' });
        }
    }

    // ── 4. EXTRA check ────────────────────────────────────────────────────
    for (const paramKey of Object.keys(cleanedParams)) {
        if (paramKey.startsWith('others(')) {
            const subKey = paramKey.slice(7, -1);
            if (!othersSchemaKeys.has(subKey)) {
                results.push({
                    attr: subKey, status: 'EXTRA',
                    actual: cleanedParams[paramKey],
                    message: 'Not in schema (others group)',
                    mainAttr: 'others',
                });
            }
        } else {
            if (!normalSchemaKeys.has(paramKey)) {
                results.push({
                    attr: paramKey, status: 'EXTRA',
                    actual: cleanedParams[paramKey],
                    message: 'Not in schema',
                });
            }
        }
    }

    return results;
}

function calcScore(results: AttrResult[]): number {
    if (!results.length) return 0;
    return Math.round((results.filter(r => r.status === 'PASS' || r.status === 'WEB_NA').length / results.length) * 100);
}

// ─── Validation Results Panel ─────────────────────────────────────────────────
function ValidationPanel({ results, eventName }: { results: AttrResult[]; eventName?: string }) {
    const score = calcScore(results);
    const passes = results.filter(r => r.status === 'PASS');
    const webNa = results.filter(r => r.status === 'WEB_NA');
    const failures = results.filter(r => r.status !== 'PASS' && r.status !== 'WEB_NA');
    return (
        <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" />{passes.length} Pass</span>
                    {webNa.length > 0 && <span className="flex items-center gap-1 text-cyan-600"><Globe className="w-3 h-3" />{webNa.length} Web NA</span>}
                    <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />{failures.length} Fail</span>
                </div>
                <Badge className={score === 100 ? 'bg-emerald-500 text-white' : score >= 70 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}>
                    {score}%
                </Badge>
            </div>
            {failures.length > 0 && (
                <ScrollArea className="h-40">
                    <div className="space-y-1 pr-1">
                        {failures.map((r, i) => (
                            <div key={i} className={`text-xs p-2 rounded border ${statusColor[r.status]}`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-semibold">{r.attr}</span>
                                    <Badge variant="outline" className="text-xs border-current">{r.status}</Badge>
                                </div>
                                <p className="opacity-80 mt-0.5">{r.message}</p>
                                {(r.expected || r.actual) && (
                                    <div className="flex gap-3 mt-0.5 opacity-70">
                                        {r.expected && <span>Expected: <strong>{r.expected}</strong></span>}
                                        {r.actual && <span>Actual: <strong>{r.actual}</strong></span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
            {webNa.length > 0 && (
                <div className="space-y-1">
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${statusColor['WEB_NA']}`}>
                        Web Platform Bypass — Not captured by dev team ({webNa.length})
                    </div>
                    <div className="space-y-1 pl-1">
                        {webNa.map((r, i) => (
                            <div key={i} className={`text-xs p-2 rounded border ${statusColor['WEB_NA']}`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-semibold">{r.attr}</span>
                                    <span className="opacity-70 font-mono">{r.actual ?? 'na'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {failures.length === 0 && webNa.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 p-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" /> All attributes passed
                </div>
            )}
            {failures.length === 0 && webNa.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 p-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" /> All non-web attributes passed
                </div>
            )}
        </div>
    );
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, value: any) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CleverTapTrackerPage() {
    const { toast } = useToast();
    const xlsxInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>(() => lsGet('ct_step', 1) as Step);
    const form = useForm<ConfigForm>({
        resolver: zodResolver(configSchema),
        defaultValues: lsGet<ConfigForm>('ct_config', { platform: '', environment: 'Production', appVersion: '' }) as ConfigForm,
    });
    const [config, setConfig] = useState<ConfigForm | null>(() => lsGet('ct_config', null));
    const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(() => lsGet('ct_content_types', []));
    const [includeAds, setIncludeAds] = useState<boolean>(() => lsGet('ct_include_ads', false));
    const [htmlInputs, setHtmlInputs] = useState<Record<string, Record<string, string>>>(() => lsGet('ct_html_inputs', {}));
    const [capturedEvents, setCapturedEvents] = useState<Record<string, Record<string, EventCapture>>>(() => lsGet('ct_captured_events', {}));
    const [activeHtmlModal, setActiveHtmlModal] = useState<string | null>(null);

    // In-House modal state
    const [isInHouseOpen, setIsInHouseOpen] = useState(false);
    const [inHousePhase, setInHousePhase] = useState<InHousePhase>('choose');

    // Phase 1 state: eventName -> { json, results }
    const [phase1Inputs, setPhase1Inputs] = useState<Record<string, string>>(() => lsGet('ct_p1_inputs', {}));
    const [phase1Results, setPhase1Results] = useState<Record<string, AttrResult[]>>(() => lsGet('ct_p1_results', {}));

    // Phase 2 state
    const [p2SelectedSheet, setP2SelectedSheet] = useState<string>(() => lsGet('ct_p2_sheet', ''));
    const [p2EventName, setP2EventName] = useState<string>(() => lsGet('ct_p2_event', ''));
    const [p2Json, setP2Json] = useState<string>(() => lsGet('ct_p2_json', ''));
    const [p2Results, setP2Results] = useState<AttrResult[] | null>(() => lsGet('ct_p2_results', null));
    const [p2Score, setP2Score] = useState<number | null>(() => lsGet('ct_p2_score', null));
    // Saved per-event data: eventName -> { json, results, score, sheet }
    const [p2SavedEvents, setP2SavedEvents] = useState<Record<string, { json: string; results: AttrResult[]; score: number; sheet: string }>>(() => lsGet('ct_p2_saved', {}));
    const [isP2ReportOpen, setIsP2ReportOpen] = useState(false);
    // Events imported from Excel Summary tab — used as chip fallback before schema loads
    const [p2ImportedSheetEvents, setP2ImportedSheetEvents] = useState<string[]>(() => lsGet('ct_p2_imported_events', []));

    // ── Persist to localStorage on change ──
    useEffect(() => { lsSet('ct_step', step); }, [step]);
    useEffect(() => { if (config) lsSet('ct_config', config); }, [config]);
    useEffect(() => { lsSet('ct_content_types', selectedContentTypes); }, [selectedContentTypes]);
    useEffect(() => { lsSet('ct_include_ads', includeAds); }, [includeAds]);
    useEffect(() => { lsSet('ct_html_inputs', htmlInputs); }, [htmlInputs]);
    useEffect(() => { lsSet('ct_captured_events', capturedEvents); }, [capturedEvents]);
    useEffect(() => { lsSet('ct_p1_inputs', phase1Inputs); }, [phase1Inputs]);
    useEffect(() => { lsSet('ct_p1_results', phase1Results); }, [phase1Results]);
    useEffect(() => { lsSet('ct_p2_sheet', p2SelectedSheet); }, [p2SelectedSheet]);
    useEffect(() => { lsSet('ct_p2_event', p2EventName); }, [p2EventName]);
    useEffect(() => { lsSet('ct_p2_json', p2Json); }, [p2Json]);
    useEffect(() => { lsSet('ct_p2_results', p2Results); }, [p2Results]);
    useEffect(() => { lsSet('ct_p2_score', p2Score); }, [p2Score]);
    useEffect(() => { lsSet('ct_p2_saved', p2SavedEvents); }, [p2SavedEvents]);
    useEffect(() => { lsSet('ct_p2_imported_events', p2ImportedSheetEvents); }, [p2ImportedSheetEvents]);

    // Schema: flat (event → attrs) for Phase 1, and per-sheet for Phase 2
    const [schema, setSchema] = useState<Schema>({});
    const [schemaMeta, setSchemaMeta] = useState<SchemaMeta>({});
    const [sheetSchema, setSheetSchema] = useState<SheetSchema>({});
    const [sheetSchemaMeta, setSheetSchemaMeta] = useState<SheetSchemaMeta>({});
    const [xlsxSheetNames, setXlsxSheetNames] = useState<string[]>([]);

    // Quick Validator
    const [isSessionValidatorOpen, setIsSessionValidatorOpen] = useState(false);
    const [sessionEventType, setSessionEventType] = useState('');
    const [sessionJson, setSessionJson] = useState('');
    const [sessionResults, setSessionResults] = useState<AttrResult[] | null>(null);

    // Report
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportData, setReportData] = useState<{ event: string; results: AttrResult[]; score: number }[]>([]);

    // Custom Event
    const [isCustomEventOpen, setIsCustomEventOpen] = useState(false);
    const [customEventName, setCustomEventName] = useState('');
    const [customEventJson, setCustomEventJson] = useState('');
    const [customResults, setCustomResults] = useState<AttrResult[] | null>(null);

    // XLSX workbook cache — avoid re-fetching on every platform change
    const xlsxCacheRef = useRef<{ wb: any } | null>(null);

    // ── Restore form values from persisted config on mount ──
    useEffect(() => {
        const saved = lsGet<ConfigForm | null>('ct_config', null);
        if (saved) {
            form.reset(saved);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load schema from xlsx ──
    useEffect(() => {
        const PLATFORM_SHEET_MAP: Record<string, string> = {
            'android': 'Android - Non Play Back Event',
            'android-tv': 'Android TV- Non Play Back Eve',
            'ios': 'iOS - Non Play Back Event',
            'apple-tv': 'Apple TV - Non Play Back Event',
            'samsung-tv': 'Samsung - Non Play Back Event',
            'web': 'Web - Non Play Back Event',
            'roku': 'Roku - Non Play Back Event',
            'lg-tv': 'LG - Non Play Back Event',
        };

        const loadSchema = async () => {
            try {
                let wb: any;
                if (xlsxCacheRef.current) {
                    wb = xlsxCacheRef.current.wb;
                } else {
                    const res = await fetch('/SunNxt Data Dictionary.xlsx');
                    const buf = await res.arrayBuffer();
                    wb = XLSX.read(buf, { type: 'array' });
                    xlsxCacheRef.current = { wb };
                }

                const builtFlat: Schema = {};
                const builtBySheet: SheetSchema = {};
                const builtBySheetMeta: SheetSchemaMeta = {};
                const sheetNames: string[] = [];

                // Parse every sheet in the workbook for Phase 2
                wb.SheetNames.forEach((sName: string) => {
                    const ws = wb.Sheets[sName];
                    if (!ws) return;
                    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
                    if (!rows.length) return;
                    const headerRow = rows[0] as any[];
                    // Dynamically detect the first event column (snake_case names, skip attr cols)
                    let startCol = headerRow.findIndex((cell: any, idx: number) => {
                        if (idx < 2) return false;
                        const s = String(cell || '').trim().toLowerCase();
                        return s.length > 2 && (s.includes('_') || /^[a-z]/.test(s));
                    });
                    if (startCol < 0) startCol = sName.toLowerCase().includes('play back') ? 3 : 5;
                    const sheetEvSchema: Schema = {};
                    const sheetEvMeta: SchemaMeta = {};
                    for (let c = startCol; c < headerRow.length; c++) {
                        const evName = String(headerRow[c] || '').trim().toLowerCase().replace(/\s+/g, '_');
                        if (!evName) continue;
                        if (!sheetEvSchema[evName]) sheetEvSchema[evName] = {};
                        if (!sheetEvMeta[evName]) sheetEvMeta[evName] = {};
                        for (let r = 1; r < rows.length; r++) {
                            const row = rows[r] as any[];
                            const mainAttrRaw = String(row[0] || '').trim().toLowerCase();
                            const attrName = String(row[1] || '').trim().toLowerCase();
                            if (!attrName) continue;
                            const val = String(row[c] || '').trim().toUpperCase();
                            const rule: 'yes' | 'no' = val === 'YES' ? 'yes' : 'no';
                            sheetEvSchema[evName][attrName] = rule;
                            sheetEvMeta[evName][attrName] = { rule, mainAttr: mainAttrRaw };
                        }
                    }
                    if (Object.keys(sheetEvSchema).length > 0) {
                        builtBySheet[sName] = sheetEvSchema;
                        builtBySheetMeta[sName] = sheetEvMeta;
                        sheetNames.push(sName);
                    }
                });

                // Flat schema for Phase 1 (platform-specific non-playback + playback)
                const platformId = config?.platform || '';
                const targetSheetName = PLATFORM_SHEET_MAP[platformId] || 'Main - Non Play Back Event';
                const flatSource = builtBySheet[targetSheetName] || builtBySheet['Main - Non Play Back Event'] || {};
                const pbSource = builtBySheet['Main - Play back Event'] || {};
                Object.assign(builtFlat, pbSource, flatSource);

                // Build flat meta the same way
                const flatMetaSource = builtBySheetMeta[targetSheetName] || builtBySheetMeta['Main - Non Play Back Event'] || {};
                const pbMetaSource = builtBySheetMeta['Main - Play back Event'] || {};
                const builtFlatMeta: SchemaMeta = {};
                Object.assign(builtFlatMeta, pbMetaSource, flatMetaSource);

                setSchema(builtFlat);
                setSchemaMeta(builtFlatMeta);
                setSheetSchema(builtBySheet);
                setSheetSchemaMeta(builtBySheetMeta);
                setXlsxSheetNames(sheetNames);
            } catch {
                // Fallback
                setSchema({
                    'app_launch': { platform: 'yes', app_version: 'yes', user_id: 'yes', session_id: 'yes', environment: 'yes' },
                    'content_click': { content_id: 'yes', content_type: 'yes', title: 'yes', platform: 'yes', user_id: 'yes', position: 'yes', source: 'yes' },
                    'content_attempted': { content_id: 'yes', content_type: 'yes', title: 'yes', platform: 'yes', user_id: 'yes', drm_type: 'yes', stream_url: 'no' },
                    'content_played': { content_id: 'yes', content_type: 'yes', title: 'yes', platform: 'yes', user_id: 'yes', duration: 'yes', quality: 'yes', ads_played: 'no' },
                });
                setSchemaMeta({});
                setXlsxSheetNames(['Main - Play back Event', 'Main - Non Play Back Event', 'Android - Non Play Back Event', 'iOS - Non Play Back Event']);
            }
        };
        loadSchema();
    }, [config?.platform]);

    // ── Phase 1: validate all 4 events at once ──
    const validatePhase1 = () => {
        const isWeb = config?.platform === 'web';
        const newResults: Record<string, AttrResult[]> = {};
        let anyValidated = false;
        for (const ev of PHASE1_EVENTS) {
            const json = phase1Inputs[ev.name] || '';
            if (!json.trim()) continue;
            try {
                const params = parseJsonToParams(json);
                const schemaEvent = schema[ev.name] || {};
                const eventMeta = schemaMeta[ev.name] || {};
                newResults[ev.name] = validateParams(params, schemaEvent, eventMeta, isWeb);
                anyValidated = true;
            } catch {
                toast({ title: `Invalid JSON for ${ev.name}`, variant: 'destructive' });
            }
        }
        setPhase1Results(newResults);
        if (anyValidated) toast({ title: 'Phase 1 validation complete' });
        else toast({ title: 'Paste at least one JSON to validate', variant: 'destructive' });
    };

    // ── Phase 2: validate JSON against selected sheet and save per event ──
    const validatePhase2 = () => {
        if (!p2SelectedSheet) { toast({ title: 'Select a sheet first', variant: 'destructive' }); return; }
        if (!p2Json.trim()) { toast({ title: 'Paste a JSON to validate', variant: 'destructive' }); return; }
        if (!p2EventName.trim()) { toast({ title: 'Select or enter an event name', variant: 'destructive' }); return; }
        const isWeb = p2SelectedSheet === 'Web - Non Play Back Event';
        try {
            const params = parseJsonToParams(p2Json);
            const sheetEvs = sheetSchema[p2SelectedSheet] || {};
            const sheetMeta = sheetSchemaMeta[p2SelectedSheet] || {};
            const resolvedEventName = p2EventName.trim().toLowerCase().replace(/\s+/g, '_');
            const schemaEvent = sheetEvs[resolvedEventName] || {};
            const eventMeta = sheetMeta[resolvedEventName] || {};
            const results = Object.keys(schemaEvent).length
                ? validateParams(params, schemaEvent, eventMeta, isWeb)
                : Object.entries(params).map(([attr, actual]) => ({
                    attr: attr.startsWith('others(') ? attr.slice(7, -1) : attr,
                    status: 'EXTRA' as ValidationStatus,
                    actual,
                    message: 'No schema found for this event in selected sheet',
                    mainAttr: attr.startsWith('others(') ? 'others' : undefined,
                }));
            const score = calcScore(results);
            setP2Results(results);
            setP2Score(score);
            // Save this event's data (capture sheet at save time — Bug 9 fix)
            setP2SavedEvents(prev => ({ ...prev, [resolvedEventName]: { json: p2Json, results, score, sheet: p2SelectedSheet } }));
            toast({ title: `Saved & validated "${resolvedEventName}"`, description: `Score: ${score}%` });
        } catch {
            toast({ title: 'Invalid JSON', variant: 'destructive' });
        }
    };

    // ── Phase 2: switch event (restore saved or blank) ──
    const selectP2Event = (evName: string) => {
        setP2EventName(evName);
        const saved = p2SavedEvents[evName];
        if (saved) {
            setP2Json(saved.json);
            setP2Results(saved.results);
            setP2Score(saved.score);
        } else {
            setP2Json('');
            setP2Results(null);
            setP2Score(null);
        }
    };

    // ── Phase 2: clear current event ──
    const clearP2Event = () => {
        if (!p2EventName) return;
        const evName = p2EventName.trim().toLowerCase().replace(/\s+/g, '_');
        setP2Json('');
        setP2Results(null);
        setP2Score(null);
        setP2SavedEvents(prev => { const n = { ...prev }; delete n[evName]; return n; });
        toast({ title: `Cleared "${evName}"` });
    };

    // ── Download as Excel helper ──
    const downloadAsExcel = (tabs: import('@/lib/export-to-sheets').SheetTab[], filename: string) => {
        const wb = XLSX.utils.book_new();
        tabs.forEach(tab => {
            const ws = XLSX.utils.aoa_to_sheet([tab.headers, ...tab.rows]);
            XLSX.utils.book_append_sheet(wb, ws, tab.tabName);
        });
        XLSX.writeFile(wb, `${filename}.xlsx`);
    };

    // ── Export Phase 1 to Excel ──
    const exportToSheets = () => {
        const liveData = PHASE1_EVENTS
            .filter(ev => phase1Results[ev.name])
            .map(ev => ({ event: ev.name, results: phase1Results[ev.name], score: calcScore(phase1Results[ev.name]) }));
        if (!liveData.length) { toast({ title: 'No validated events to export', variant: 'destructive' }); return; }
        const tabs = buildPhase1Tabs(liveData, {
            platform: PLATFORMS.find(p => p.id === config?.platform)?.label || '',
            environment: config?.environment || '',
            appVersion: config?.appVersion || '',
        }, phase1Inputs);
        const filename = `CleverTap_Phase1_${PLATFORMS.find(p => p.id === config?.platform)?.label || ''}_${format(new Date(), 'ddMMMyyy_HHmm')}`;
        downloadAsExcel(tabs, filename);
        toast({ title: 'Downloaded as Excel' });
    };

    // ── Export Phase 2 to Excel ──
    const exportPhase2ToSheets = () => {
        if (!Object.keys(p2SavedEvents).length) { toast({ title: 'No validated events to export', variant: 'destructive' }); return; }
        const allSheetEvents = sheetSchema[p2SelectedSheet]
            ? Object.keys(sheetSchema[p2SelectedSheet]).filter(e => e !== 'client_remarks' && e !== 'qa_remarks')
            : p2ImportedSheetEvents;
        const tabs = buildPhase2Tabs(p2SavedEvents, {
            platform: PLATFORMS.find(p => p.id === config?.platform)?.label || '',
            environment: config?.environment || '',
            appVersion: config?.appVersion || '',
        }, allSheetEvents);
        const filename = `CleverTap_Phase2_${p2SelectedSheet}_${format(new Date(), 'ddMMMyyy_HHmm')}`;
        downloadAsExcel(tabs, filename);
        toast({ title: 'Downloaded as Excel' });
    };

    // ── Import from Excel (restore session) ──
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const buf = ev.target?.result as ArrayBuffer;
                const wb = XLSX.read(buf, { type: 'array' });

                // ── Require the All Attributes tab ──
                const allAttrsSheet = wb.Sheets['2. All Attributes'];
                if (!allAttrsSheet) {
                    toast({ title: 'No session data found', description: 'This Excel was not exported from CleverTap Tracker.', variant: 'destructive' });
                    return;
                }
                const allAttrsRows = (XLSX.utils.sheet_to_json<any[]>(allAttrsSheet, { header: 1 }) as any[][]).slice(1);

                // ── Detect Phase 1 vs Phase 2 by checking header row of All Attributes ──
                // Phase 1 header: [Event, Attribute, Group, Status, ...]
                // Phase 2 header: [Event, Sheet, Attribute, Group, Status, ...]
                const headerRow = (XLSX.utils.sheet_to_json<any[]>(allAttrsSheet, { header: 1 }) as any[][])[0] || [];
                // If col[1] is "Sheet" it's Phase 2; otherwise Phase 1
                const isPhase2 = String(headerRow[1] || '').trim().toLowerCase() === 'sheet';

                // ── Build results per event from All Attributes ──
                const resultsByEvent: Record<string, AttrResult[]> = {};
                const sheetByEvent: Record<string, string> = {};
                allAttrsRows.forEach(r => {
                    const evName = String(r[0] || '').trim();
                    if (!evName) return;
                    const attrCol   = isPhase2 ? 2 : 1;
                    const statusCol = isPhase2 ? 4 : 3;
                    const expCol    = isPhase2 ? 5 : 4;
                    const actCol    = isPhase2 ? 6 : 5;
                    const msgCol    = isPhase2 ? 7 : 6;
                    const attrRaw   = String(r[attrCol] || '').trim();
                    if (!attrRaw) return;
                    const isOthers  = attrRaw.startsWith('others(');
                    const attr      = isOthers ? attrRaw.slice(7, -1) : attrRaw;
                    const statusRaw = String(r[statusCol] || '').replace('✓ ', '').trim() as ValidationStatus;
                    const expected  = String(r[expCol] || '').trim() || undefined;
                    const actualRaw = String(r[actCol] || '').trim();
                    const actual    = actualRaw === '(absent)' ? undefined : actualRaw || undefined;
                    const message   = String(r[msgCol] || '').trim();
                    if (isPhase2 && !sheetByEvent[evName]) sheetByEvent[evName] = String(r[1] || '').trim();
                    if (!resultsByEvent[evName]) resultsByEvent[evName] = [];
                    resultsByEvent[evName].push({ attr, status: statusRaw, expected, actual, message, mainAttr: isOthers ? 'others' : undefined });
                });

                if (Object.keys(resultsByEvent).length === 0) {
                    toast({ title: 'No data found', description: 'The Excel file appears to be empty.', variant: 'destructive' });
                    return;
                }

                // ── Try Session JSON tab for raw JSON (new exports only) ──
                const jsonSheet = wb.Sheets['5. Session JSON'];
                const jsonByEvent: Record<string, string> = {};
                if (jsonSheet) {
                    const jsonRows = (XLSX.utils.sheet_to_json<any[]>(jsonSheet, { header: 1 }) as any[][]).slice(1);
                    jsonRows.forEach(r => {
                        const evName = String(r[0] || '').trim();
                        const json   = String(r[3] || '').trim();
                        if (evName && json) jsonByEvent[evName] = json;
                    });
                }

                if (!isPhase2) {
                    // ── Phase 1 restore ──
                    // Always use pre-built results from the Excel — no re-validation needed
                    // (schema may not be loaded yet, and results are already correct)
                    // Post-process: reclassify WEB_NA attrs if platform is web (handles old exports)
                    const isWebPlatform = config?.platform === 'web';
                    const reclassify = (results: AttrResult[], isWeb: boolean): AttrResult[] => {
                        if (!isWeb) return results;
                        return results.map(r =>
                            WEB_NA_ATTRS.has(r.attr) && r.status !== 'PASS' && r.status !== 'WEB_NA'
                                ? { ...r, status: 'WEB_NA' as ValidationStatus, message: 'Web sheet — dev team does not capture this attribute' }
                                : r
                        );
                    };
                    const newInputs: Record<string, string> = {};
                    const autoResults: Record<string, AttrResult[]> = {};
                    for (const ev of PHASE1_EVENTS) {
                        if (jsonByEvent[ev.name]) newInputs[ev.name] = jsonByEvent[ev.name];
                        if (resultsByEvent[ev.name]) autoResults[ev.name] = reclassify(resultsByEvent[ev.name], isWebPlatform);
                    }
                    if (Object.keys(newInputs).length > 0) {
                        setPhase1Inputs(prev => ({ ...prev, ...newInputs }));
                    }
                    if (Object.keys(autoResults).length > 0) {
                        setPhase1Results(autoResults);
                    }
                    toast({ title: 'Phase 1 session restored', description: `${Object.keys(autoResults).length} event(s) loaded.` });
                } else {
                    // ── Phase 2 restore ──
                    // Post-process: reclassify WEB_NA attrs for web sheet (handles old exports)
                    const reclassify = (results: AttrResult[], sheet: string): AttrResult[] => {
                        if (sheet !== 'Web - Non Play Back Event') return results;
                        return results.map(r =>
                            WEB_NA_ATTRS.has(r.attr) && r.status !== 'PASS' && r.status !== 'WEB_NA'
                                ? { ...r, status: 'WEB_NA' as ValidationStatus, message: 'Web sheet — dev team does not capture this attribute' }
                                : r
                        );
                    };
                    const newSaved: Record<string, { json: string; results: AttrResult[]; score: number; sheet: string }> = {};
                    Object.keys(resultsByEvent).forEach(evName => {
                        const sheet = sheetByEvent[evName] || '';
                        const results = reclassify(resultsByEvent[evName], sheet);
                        const score = Math.round((results.filter(r => r.status === 'PASS' || r.status === 'WEB_NA').length / (results.length || 1)) * 100);
                        newSaved[evName] = {
                            json: jsonByEvent[evName] || '',
                            results,
                            score,
                            sheet,
                        };
                    });
                    const firstSheet = Object.values(sheetByEvent)[0] || '';
                    let matchedSheet = firstSheet;
                    if (firstSheet) {
                        // Normalize: exact match first, then case-insensitive, then use as-is
                        matchedSheet = xlsxSheetNames.find(s => s === firstSheet)
                            || xlsxSheetNames.find(s => s.toLowerCase() === firstSheet.toLowerCase())
                            || firstSheet;
                        setP2SelectedSheet(matchedSheet);
                    }

                    // ── Instantly resolve all sheet events ──────────────────────────
                    // Priority 1: Tab 6 from imported Excel (new exports — complete list)
                    // Priority 2: Cached Data Dictionary workbook header row (instant if loaded)
                    // Priority 3: Summary tab (older exports — captured events only)
                    const importedEvents: string[] = [];

                    // Priority 1 — Tab 6
                    const sheetEventsTab = wb.Sheets['6. Sheet Events'];
                    if (sheetEventsTab) {
                        const evRows = (XLSX.utils.sheet_to_json<any[]>(sheetEventsTab, { header: 1 }) as any[][]).slice(1);
                        evRows.forEach(r => { const evName = String(r[0] || '').trim(); if (evName) importedEvents.push(evName); });
                    }

                    // Priority 2 — Cached workbook header row
                    if (importedEvents.length === 0 && xlsxCacheRef.current && matchedSheet) {
                        try {
                            const cachedWb = xlsxCacheRef.current.wb;
                            const ws = cachedWb.Sheets[matchedSheet];
                            if (ws) {
                                const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
                                const hRow = rows[0] as any[];
                                let startCol = hRow.findIndex((cell: any, idx: number) => {
                                    if (idx < 2) return false;
                                    const s = String(cell || '').trim().toLowerCase();
                                    return s.length > 2 && (s.includes('_') || /^[a-z]/.test(s));
                                });
                                if (startCol < 0) startCol = matchedSheet.toLowerCase().includes('play back') ? 3 : 5;
                                for (let c = startCol; c < hRow.length; c++) {
                                    const evName = String(hRow[c] || '').trim().toLowerCase().replace(/\s+/g, '_');
                                    if (evName && evName !== 'client_remarks' && evName !== 'qa_remarks') importedEvents.push(evName);
                                }
                            }
                        } catch {}
                    }

                    // Priority 3 — Summary tab (captured events only, older exports)
                    if (importedEvents.length === 0) {
                        const summarySheetWb = wb.Sheets['1. Summary'];
                        if (summarySheetWb) {
                            const summaryRows = (XLSX.utils.sheet_to_json<any[]>(summarySheetWb, { header: 1 }) as any[][]).slice(1);
                            summaryRows.forEach(r => { const evName = String(r[0] || '').trim(); if (evName) importedEvents.push(evName); });
                        }
                    }

                    setP2ImportedSheetEvents(importedEvents.length > 0 ? importedEvents : Object.keys(newSaved));
                    setP2SavedEvents(prev => ({ ...prev, ...newSaved }));
                    toast({ title: 'Phase 2 session restored', description: `${Object.keys(newSaved).length} event(s) loaded. Click any event chip to resume.` });
                }
            } catch {
                toast({ title: 'Import failed', description: 'Could not read the Excel file.', variant: 'destructive' });
            }
        };
        reader.readAsArrayBuffer(file);
        // reset so same file can be re-imported
        e.target.value = '';
    };

    const HTML_EVENT_NAME_MAP: Record<string, string> = {
        'Content Started': 'content_attempted',
        'Content Played': 'content_played',
        'Ads Played': 'ads_played',
    };

    const saveHtmlEvents = (contentTypeId: string) => {
        const inputs = htmlInputs[contentTypeId] || {};
        const newCaptures: Record<string, EventCapture> = { ...(capturedEvents[contentTypeId] || {}) };
        let count = 0;
        for (const [displayName, html] of Object.entries(inputs)) {
            if (!html.trim()) continue;
            try {
                const params = parseHtmlToParams(html);
                const schemaKey = HTML_EVENT_NAME_MAP[displayName] || displayName.toLowerCase().replace(/\s+/g, '_');
                const schemaEvent = schema[schemaKey] || {};
                const eventMeta = schemaMeta[schemaKey] || {};
                const results = Object.keys(schemaEvent).length ? validateParams(params, schemaEvent, eventMeta) : [];
                newCaptures[displayName] = { eventName: schemaKey, rawJson: html, params, validationResults: results, validationScore: calcScore(results) };
                count++;
            } catch { toast({ title: `Parse error for ${displayName}`, variant: 'destructive' }); }
        }
        setCapturedEvents(prev => ({ ...prev, [contentTypeId]: newCaptures }));
        setActiveHtmlModal(null);
        toast({ title: `Saved ${count} events` });
    };

    // ── Quick Session Validator ──
    const runSessionValidation = () => {
        if (!sessionEventType || !sessionJson.trim()) return;
        try {
            const params = parseJsonToParams(sessionJson);
            const schemaEvent = schema[sessionEventType] || {};
            const eventMeta = schemaMeta[sessionEventType] || {};
            const isWeb = config?.platform === 'web';
            setSessionResults(validateParams(params, schemaEvent, eventMeta, isWeb));
        } catch { toast({ title: 'Invalid JSON', variant: 'destructive' }); }
    };

    // ── Generate report from Phase 1 results ──
    const generateReport = () => {
        const data = PHASE1_EVENTS
            .filter(ev => phase1Results[ev.name])
            .map(ev => ({ event: ev.name, results: phase1Results[ev.name], score: calcScore(phase1Results[ev.name]) }));
        setReportData(data);
        setIsReportOpen(true);
    };

    const totalCaptured = Object.values(capturedEvents).reduce((a, b) => a + Object.keys(b).length, 0);
    const onStep1Submit = (data: ConfigForm) => { setConfig(data); setStep(2); };
    const onStep2Submit = () => setStep(3);

    return (
        <div className="space-y-6 animate-fade-in relative max-w-7xl mx-auto">

            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-red-500/10 to-pink-500/10 border border-orange-500/20 p-8">
                <div className="relative z-10 flex items-center gap-4">
                    <Link href="/apps">
                        <Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                    </Link>
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-medium mb-3">
                            <Database className="w-3 h-3" /> Telemetry Composer
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight"><span className="text-gradient">CleverTap Tracker</span></h1>
                        <p className="text-muted-foreground text-lg mt-1">Capture · Validate · Export analytics events</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        {([1, 2, 3] as Step[]).map(s => (
                            <div key={s} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${step === s ? 'bg-orange-500 text-white' : step > s ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                {step > s ? <CheckCircle2 className="w-3 h-3" /> : <span>{s}</span>}
                                {s === 1 ? 'Initialize' : s === 2 ? 'Define' : 'Capture'}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
            </div>

            <AnimatePresence mode="wait">
                {/* ── STEP 1 ── */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <form onSubmit={form.handleSubmit(onStep1Submit)} className="space-y-6">
                            <Card><CardContent className="p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600"><Rocket className="w-6 h-6 text-white" /></div>
                                    <div><h2 className="text-xl font-bold">Platform Configuration</h2><p className="text-sm text-muted-foreground">Select your testing platform and environment</p></div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold mb-3 block">Platform *</Label>
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                        {PLATFORMS.map(p => {
                                            const selected = form.watch('platform') === p.id;
                                            return (
                                                <button type="button" key={p.id} onClick={() => form.setValue('platform', p.id, { shouldValidate: true })}
                                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selected ? 'border-orange-500 bg-orange-500/10' : 'border-border hover:border-orange-500/50'}`}>
                                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${p.gradient}`}><p.icon className="w-5 h-5 text-white" /></div>
                                                    <span className="text-xs font-medium text-center leading-tight">{p.label}</span>
                                                    {selected && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-orange-500" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {form.formState.errors.platform && <p className="text-xs text-red-500 mt-1">{form.formState.errors.platform.message}</p>}
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Test Environment *</Label>
                                        <Select defaultValue="Production" onValueChange={v => form.setValue('environment', v as any)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Production">Production</SelectItem>
                                                <SelectItem value="Pre-Production">Pre-Production</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>App Version *</Label>
                                        <Input placeholder="e.g. 4.2.1" {...form.register('appVersion')} />
                                        {form.formState.errors.appVersion && <p className="text-xs text-red-500">{form.formState.errors.appVersion.message}</p>}
                                    </div>
                                </div>
                                <Button type="submit" className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 text-white">
                                    Continue to Scope <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </CardContent></Card>
                        </form>
                    </motion.div>
                )}

                {/* ── STEP 2 ── */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <Card><CardContent className="p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600"><BarChart3 className="w-6 h-6 text-white" /></div>
                                <div><h2 className="text-xl font-bo
ld">Scope Configuration</h2><p className="text-sm text-muted-foreground">Select content types to test on <strong>{PLATFORMS.find(p => p.id === config?.platform)?.label}</strong></p></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {CONTENT_TYPES.map(ct => {
                                    const selected = selectedContentTypes.includes(ct.id);
                                    return (
                                        <button type="button" key={ct.id}
                                            onClick={() => setSelectedContentTypes(prev => selected ? prev.filter(x => x !== ct.id) : [...prev, ct.id])}
                                            className={`relative p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${selected ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-purple-500/50'}`}>
                                            <div className="p-3 rounded-xl" style={{ background: `${ct.color}20` }}><ct.icon className="w-6 h-6" style={{ color: ct.color }} /></div>
                                            <span className="font-semibold text-sm">{ct.label}</span>
                                            {selected && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-purple-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                                <Checkbox id="ads" checked={includeAds} onCheckedChange={v => setIncludeAds(!!v)} />
                                <Label htmlFor="ads" className="cursor-pointer">Include Ads events for selected content types</Label>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                                <Button variant="outline" onClick={() => setStep(3)} className="flex-1 border-muted-foreground/40 text-muted-foreground">Skip</Button>
                                <Button onClick={onStep2Submit} className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white">
                                    Open Workspace <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent></Card>
                    </motion.div>
                )}

                {/* ── STEP 3 ── */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Platform', value: PLATFORMS.find(p => p.id === config?.platform)?.label || '', gradient: 'from-orange-500 to-red-600' },
                                { label: 'Environment', value: config?.environment || '', gradient: 'from-pink-500 to-rose-600' },
                                { label: 'Content Types', value: selectedContentTypes.length, gradient: 'from-purple-500 to-indigo-600' },
                                { label: 'Events Captured', value: totalCaptured, gradient: 'from-cyan-500 to-blue-600' },
                            ].map((s, i) => (
                                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                                    <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                        <CardContent className="p-5">
                                            <div className="text-xl font-bold">{s.value}</div>
                                            <div className="text-xs text-muted-foreground">{s.label}</div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                        <Card><CardContent className="p-5">
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => setIsCustomEventOpen(true)} variant="outline" className="border-orange-500 text-orange-600">
                                    <PlusCircle className="w-4 h-4 mr-2" /> Custom Event
                                </Button>
                                <Button onClick={() => { setInHousePhase('choose'); setIsInHouseOpen(true); }} className="bg-gradient-to-r from-purple-500 to-violet-600">
                                    <FileJson className="w-4 h-4 mr-2" /> In-House Analytics
                                </Button>
                                <Button onClick={() => setIsSessionValidatorOpen(true)} variant="outline" className="border-amber-500 text-amber-600">
                                    <Zap className="w-4 h-4 mr-2" /> Quick Validator
                                </Button>
                                <Button onClick={generateReport} variant="outline" className="border-blue-500 text-blue-600">
                                    <Shield className="w-4 h-4 mr-2" /> Validation Report
                                </Button>
                                <Button onClick={exportToSheets} disabled={Object.keys(phase1Results).length === 0} className="bg-gradient-to-r from-emerald-500 to-green-600 ml-auto">
                                    <FileDown className="w-4 h-4 mr-2" /> Export to Sheets
                                </Button>
                            </div>
                        </CardContent></Card>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedContentTypes.map((ctId, i) => {
                                const ct = CONTENT_TYPES.find(c => c.id === ctId)!;
                                const captured = capturedEvents[ctId] || {};
                                const eventCount = Object.keys(captured).length;
                                return (
                                    <motion.div key={ctId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                                        <Card className="group hover:shadow-xl transition-all cursor-pointer" onClick={() => setActiveHtmlModal(ctId)}>
                                            <CardContent className="p-6">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="p-3 rounded-xl" style={{ background: `${ct.color}20` }}><ct.icon className="w-6 h-6" style={{ color: ct.color }} /></div>
                                                    <div className="flex-1"><h3 className="font-semibold">{ct.label}</h3><p className="text-xs text-muted-foreground">{eventCount} events captured</p></div>
                                                    {eventCount > 0 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {['Content Started', 'Content Played', ...(includeAds ? ['Ads Played'] : [])].map(ev => (
                                                        <div key={ev} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                                                            <span>{ev}</span>
                                                            {captured[ev] ? <Badge className="bg-emerald-500/20 text-emerald-600 border-0 text-xs">{captured[ev].validationScore ?? 0}%</Badge>
                                                                : <Badge variant="outline" className="text-xs">Pending</Badge>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── HTML Modal ── */}
            {activeHtmlModal && (() => {
                const ct = CONTENT_TYPES.find(c => c.id === activeHtmlModal)!;
                const eventNames = ['Content Started', 'Content Played', ...(includeAds ? ['Ads Played'] : [])];
                return (
                    <Dialog open onOpenChange={() => setActiveHtmlModal(null)}>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Capture Events – {ct.label}</DialogTitle>
                                <DialogDescription>Paste raw HTML tooltip markup for each event</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {eventNames.map(ev => (
                                    <div key={ev} className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ background: ct.color }} />{ev}
                                        </Label>
                                        <Textarea
                                            value={htmlInputs[activeHtmlModal]?.[ev] || ''}
                                            onChange={e => setHtmlInputs(prev => ({ ...prev, [activeHtmlModal]: { ...(prev[activeHtmlModal] || {}), [ev]: e.target.value } }))}
                                            placeholder={`Paste HTML for ${ev}...`} rows={3} className="font-mono text-xs"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setActiveHtmlModal(null)}>Cancel</Button>
                                <Button onClick={() => saveHtmlEvents(activeHtmlModal)} className="bg-gradient-to-r from-orange-500 to-red-600">Save Events</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                );
            })()}

            {/* ════════════════════════════════════════════════════════
                IN-HOUSE ANALYTICS MODAL
            ════════════════════════════════════════════════════════ */}
            <Dialog open={isInHouseOpen} onOpenChange={v => { setIsInHouseOpen(v); if (!v) setInHousePhase('choose'); }}>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-purple-500" /> In-House Analytics Validator
                        </DialogTitle>
                        <DialogDescription>
                            {inHousePhase === 'choose' && 'Select a validation phase to begin'}
                            {inHousePhase === 'phase1' && 'Phase 1 — Core Events: app_launch · content_click · content_attempted · content_played'}
                            {inHousePhase === 'phase2' && 'Phase 2 — Full Sheet Validation: select a sheet and paste your JSON'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* ── Phase Chooser ── */}
                    {inHousePhase === 'choose' && (
                        <div className="py-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Phase 1 card */}
                                <button
                                    onClick={() => setInHousePhase('phase1')}
                                    className="group relative p-6 rounded-2xl border-2 border-border hover:border-purple-500 bg-card hover:bg-purple-500/5 transition-all text-left space-y-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                                            <Layers className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Phase 1</h3>
                                            <p className="text-xs text-muted-foreground">Core Events Validation</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Validate the 4 core in-house events against the schema.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {PHASE1_EVENTS.map(ev => (
                                            <span key={ev.name} className={`px-2 py-0.5 rounded text-xs font-semibold bg-gradient-to-r ${ev.color} text-white`}>{ev.name}</span>
                                        ))}
                                    </div>
                                    <ChevronRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                                </button>

                                {/* Phase 2 card */}
                                <button
                                    onClick={() => { setInHousePhase('phase2'); setP2SelectedSheet(''); setP2Results(null); setP2Score(null); setP2Json(''); setP2EventName(''); }}
                                    className="group relative p-6 rounded-2xl border-2 border-border hover:border-emerald-500 bg-card hover:bg-emerald-500/5 transition-all text-left space-y-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                                            <BookOpen className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Phase 2</h3>
                                            <p className="text-xs text-muted-foreground">Full Sheet Validation</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Select any sheet from the SunNxt Data Dictionary and validate your JSON payload against it.</p>
                                    <p className="text-xs text-muted-foreground">{xlsxSheetNames.length} sheets available</p>
                                    <ChevronRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Phase 1 ── */}
                    {inHousePhase === 'phase1' && (
                        <div className="space-y-5 py-2">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setInHousePhase('choose')} className="gap-1">
                                    <ChevronLeft className="w-4 h-4" /> Back
                                </Button>
                                <span className="text-sm text-muted-foreground">Paste JSON for each event, then validate all at once</span>
                            </div>

                            {/* 4 event input cards */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {PHASE1_EVENTS.map(ev => {
                                    const results = phase1Results[ev.name];
                                    const score = results ? calcScore(results) : null;
                                    return (
                                        <Card key={ev.name} className={`border-2 transition-all ${results ? (score === 100 ? 'border-emerald-400' : score! >= 70 ? 'border-amber-400' : 'border-red-400') : 'border-border'}`}>
                                            <CardContent className="p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r ${ev.color} text-white`}>{ev.name}</span>
                                                    {score !== null && (
                                                        <Badge className={score === 100 ? 'bg-emerald-500 text-white' : score >= 70 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}>
                                                            {score}%
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Textarea
                                                    value={phase1Inputs[ev.name] || ''}
                                                    onChange={e => setPhase1Inputs(prev => ({ ...prev, [ev.name]: e.target.value }))}
                                                    placeholder={`Paste ${ev.name} JSON from Kibana / CleverTap...`}
                                                    rows={4} className="font-mono text-xs resize-none"
                                                />
                                                {results && <ValidationPanel results={results} eventName={ev.name} />}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* Single validate all button */}
                            <div className="flex gap-3 pt-2">
                                <Button onClick={validatePhase1} className="flex-1 h-11 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-semibold">
                                    <Shield className="w-4 h-4 mr-2" /> Validate All Events
                                </Button>
                                <Button variant="outline" className="border-amber-500 text-amber-600 gap-1 h-11" onClick={() => importInputRef.current?.click()}>
                                    <UploadCloud className="w-4 h-4" /> Import Session
                                </Button>
                                {Object.keys(phase1Results).length > 0 && (
                                    <Button variant="outline" onClick={() => { setPhase1Results({}); setPhase1Inputs({}); }} className="border-red-300 text-red-500">
                                        Clear
                                    </Button>
                                )}
                            </div>

                            {/* Summary row */}
                            {Object.keys(phase1Results).length > 0 && (
                                <div className="grid grid-cols-4 gap-3 pt-1">
                                    {PHASE1_EVENTS.map(ev => {
                                        const r = phase1Results[ev.name];
                                        const s = r ? calcScore(r) : null;
                                        return (
                                            <div key={ev.name} className={`p-3 rounded-xl text-center border ${s === null ? 'bg-muted/40 border-border' : s === 100 ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300' : s! >= 70 ? 'bg-amber-50 dark:bg-amber-950 border-amber-300' : 'bg-red-50 dark:bg-red-950 border-red-300'}`}>
                                                <div className="text-lg font-bold">{s !== null ? `${s}%` : '—'}</div>
                                                <div className="text-xs text-muted-foreground truncate">{ev.name}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {/* Web platform notice removed — WEB_NA shown as section in ValidationPanel */}
                        </div>
                    )}

                    {/* ── Phase 2 ── */}
                    {inHousePhase === 'phase2' && (
                        <div className="space-y-5 py-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setInHousePhase('choose'); setP2Results(null); }} className="gap-1">
                                        <ChevronLeft className="w-4 h-4" /> Back
                                    </Button>
                                    <span className="text-sm text-muted-foreground">Select a sheet, pick an event, paste JSON, then save & validate</span>
                                </div>
                                {Object.keys(p2SavedEvents).length > 0 && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="border-blue-500 text-blue-600 gap-1" onClick={() => setIsP2ReportOpen(true)}>
                                            <Shield className="w-3.5 h-3.5" /> Report
                                        </Button>
                                        <Button size="sm" onClick={exportPhase2ToSheets} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white gap-1">
                                            <FileDown className="w-3.5 h-3.5" /> Export to Sheets
                                        </Button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
                                    <Button size="sm" variant="outline" className="border-amber-500 text-amber-600 gap-1" onClick={() => importInputRef.current?.click()}>
                                        <UploadCloud className="w-3.5 h-3.5" /> Import Session
                                    </Button>
                                </div>
                            </div>

                            {/* Sheet selector — collapsed when sheet already selected */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">Select Sheet *</Label>
                                    {p2SelectedSheet && (
                                        <button
                                            onClick={() => {
                                                if (Object.keys(p2SavedEvents).length > 0) {
                                                    const ok = window.confirm(`Changing sheet will clear ${Object.keys(p2SavedEvents).length} saved event(s). Continue?`);
                                                    if (!ok) return;
                                                    setP2SavedEvents({});
                                                }
                                                setP2SelectedSheet(''); setP2Results(null); setP2Score(null); setP2EventName(''); setP2Json('');
                                            }}
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                        >
                                            Change sheet
                                        </button>
                                    )}
                                </div>
                                {!p2SelectedSheet && (
                                    <ScrollArea className="h-44 rounded-xl border bg-muted/30 p-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {xlsxSheetNames.map(sName => (
                                                <button key={sName}
                                                    onClick={() => {
                                                        if (Object.keys(p2SavedEvents).length > 0) {
                                                            const ok = window.confirm(`Switching sheet will clear ${Object.keys(p2SavedEvents).length} saved event(s). Continue?`);
                                                            if (!ok) return;
                                                        }
                                                        setP2SelectedSheet(sName); setP2Results(null); setP2Score(null); setP2EventName(''); setP2Json(''); setP2SavedEvents({}); setP2ImportedSheetEvents([]);
                                                    }}
                                                    className={`px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all border ${p2SelectedSheet === sName ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-card border-border hover:border-emerald-400 hover:bg-emerald-500/5'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {p2SelectedSheet === sName && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                                        <span className="truncate">{sName}</span>
                                                    </div>
                                                </button>
                                            ))}
                                            {xlsxSheetNames.length === 0 && (
                                                <div className="col-span-2 text-center py-6 text-muted-foreground text-sm">
                                                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    No sheets loaded — ensure SunNxt Data Dictionary.xlsx is in /public
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>

                            {/* Selected sheet info */}
                            {p2SelectedSheet && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Sheet:</span>
                                    <span className="font-semibold">{p2SelectedSheet}</span>
                                    {sheetSchema[p2SelectedSheet] && (
                                        <Badge variant="outline" className="ml-auto text-xs">
                                            {Object.keys(sheetSchema[p2SelectedSheet]).filter(e => e !== 'client_remarks' && e !== 'qa_remarks').length} events
                                        </Badge>
                                    )}
                                    {Object.keys(p2SavedEvents).length > 0 && (
                                        <Badge className="bg-purple-500 text-white text-xs ml-1">
                                            {Object.keys(p2SavedEvents).length} saved
                                        </Badge>
                                    )}
                                </div>
                            )}

                            {/* Event name chips — all events, click to switch */}
                            {p2SelectedSheet && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Select Event *</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(() => {
                                            const schemaEvents = sheetSchema[p2SelectedSheet]
                                                ? Object.keys(sheetSchema[p2SelectedSheet]).filter(e => e !== 'client_remarks' && e !== 'qa_remarks')
                                                : [];
                                            const baseEvents = schemaEvents.length > 0 ? schemaEvents
                                                : p2ImportedSheetEvents.length > 0 ? p2ImportedSheetEvents
                                                : Object.keys(p2SavedEvents);
                                            const savedKeys = Object.keys(p2SavedEvents).filter(k => !baseEvents.includes(k));
                                            const allEvents = [...baseEvents, ...savedKeys];

                                            return allEvents.map(evName => {
                                                const isSaved = !!p2SavedEvents[evName];
                                                const isActive = p2EventName === evName;
                                                const savedScore = p2SavedEvents[evName]?.score;
                                                return (
                                                    <button key={evName} onClick={() => selectP2Event(evName)}
                                                        className={`relative px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                            isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                                            : isSaved ? 'bg-purple-500/10 border-purple-400 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                                                            : 'bg-muted border-border hover:border-emerald-400 hover:bg-emerald-500/5'
                                                        }`}>
                                                        {evName}
                                                        {isSaved && (
                                                            <span className={`ml-1.5 text-xs font-bold ${savedScore === 100 ? 'text-emerald-400' : savedScore! >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                {savedScore}%
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Purple = saved · Green = active · Grey = not yet validated · Click to switch</p>
                                </div>
                            )}

                            {/* JSON input + actions */}
                            {p2EventName && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">
                                            JSON for <span className="text-emerald-600 font-mono">{p2EventName}</span>
                                        </Label>
                                        {p2SavedEvents[p2EventName] && (
                                            <Button size="sm" variant="outline" onClick={clearP2Event} className="border-red-300 text-red-500 hover:bg-red-50 gap-1 h-7 text-xs">
                                                <XCircle className="w-3 h-3" /> Clear
                                            </Button>
                                        )}
                                    </div>
                                    <Textarea
                                        value={p2Json}
                                        onChange={e => { setP2Json(e.target.value); setP2Results(null); setP2Score(null); }}
                                        placeholder={`Paste ${p2EventName} JSON from Kibana / CleverTap / Logcat...`}
                                        rows={7} className="font-mono text-xs resize-none"
                                    />
                                    <Button onClick={validatePhase2} disabled={!p2Json.trim()}
                                        className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold disabled:opacity-50">
                                        <Shield className="w-4 h-4 mr-2" /> Save & Validate
                                    </Button>
                                </div>
                            )}

                            {/* Results */}
                            {p2Results && p2Score !== null && (
                                <Card className={`border-2 ${p2Score === 100 ? 'border-emerald-400' : p2Score >= 70 ? 'border-amber-400' : 'border-red-400'}`}>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-base">Results — <span className="font-mono text-emerald-600">{p2EventName}</span></h4>
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-3 text-xs">
                                                    <span className="text-emerald-600">{p2Results.filter(r => r.status === 'PASS').length} Pass</span>
                                                    <span className="text-red-500">{p2Results.filter(r => r.status !== 'PASS').length} Fail</span>
                                                </div>
                                                <Badge className={`text-white ${p2Score === 100 ? 'bg-emerald-500' : p2Score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}>{p2Score}%</Badge>
                                            </div>
                                        </div>
                                        {(['VALUE_REQUIRED', 'MISSING', 'UNEXPECTED_VALUE', 'CAPITAL_ATTR', 'EXTRA'] as ValidationStatus[]).map(status => {
                                            const items = p2Results.filter(r => r.status === status);
                                            if (!items.length) return null;
                                            const labels: Record<string, string> = {
                                                VALUE_REQUIRED: 'Value Required — YES rule, got NA/null/blank/false',
                                                MISSING: 'Missing Attributes',
                                                UNEXPECTED_VALUE: 'Unexpected Value — NO rule, should be NA',
                                                CAPITAL_ATTR: 'Capital Letters in Key',
                                                EXTRA: 'Extra Attributes — not in schema',
                                            };
                                            return (
                                                <div key={status} className="space-y-1.5">
                                                    <div className={`text-xs font-semibold px-2 py-1 rounded ${statusColor[status]}`}>{labels[status]} ({items.length})</div>
                                                    <div className="space-y-1 pl-2">
                                                        {items.map((r, i) => (
                                                            <div key={i} className={`text-xs p-2 rounded border ${statusColor[r.status]}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-mono font-semibold">
                                                                        {r.mainAttr === 'others' ? `others(${r.attr})` : r.attr}
                                                                    </span>
                                                                    {(r.expected || r.actual) && (
                                                                        <span className="opacity-70 text-xs">
                                                                            {r.expected && <>exp: <strong>{r.expected}</strong></>}
                                                                            {r.actual && <> · got: <strong>{r.actual}</strong></>}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {p2Results.filter(r => r.status === 'WEB_NA').length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className={`text-xs font-semibold px-2 py-1 rounded ${statusColor['WEB_NA']}`}>Web Platform Bypass — Not captured by dev team ({p2Results.filter(r => r.status === 'WEB_NA').length})</div>
                                                <div className="space-y-1 pl-2">
                                                    {p2Results.filter(r => r.status === 'WEB_NA').map((r, i) => (
                                                        <div key={i} className={`text-xs p-2 rounded border ${statusColor['WEB_NA']}`}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-mono font-semibold">
                                                                    {r.mainAttr === 'others' ? `others(${r.attr})` : r.attr}
                                                                </span>
                                                                <span className="opacity-70 font-mono">{r.actual ?? 'na'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {p2Results.filter(r => r.status === 'PASS').length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className={`text-xs font-semibold px-2 py-1 rounded ${statusColor['PASS']}`}>Passed ({p2Results.filter(r => r.status === 'PASS').length})</div>
                                                <div className="flex flex-wrap gap-1.5 pl-2">
                                                    {p2Results.filter(r => r.status === 'PASS').map((r, i) => (
                                                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-700">
                                                            {r.mainAttr === 'others' ? `others(${r.attr})` : r.attr}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                    <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
                </DialogContent>
            </Dialog>

            {/* ── Quick Session Validator ── */}
            <Dialog open={isSessionValidatorOpen} onOpenChange={setIsSessionValidatorOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Quick Session Validator</DialogTitle>
                        <DialogDescription>Validate a single event JSON against the schema</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Event Type</Label>
                            <Select value={sessionEventType} onValueChange={setSessionEventType}>
                                <SelectTrigger><SelectValue placeholder="Select event type..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.keys(schema).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Event JSON</Label>
                            <Textarea value={sessionJson} onChange={e => setSessionJson(e.target.value)} placeholder="Paste JSON from Kibana / CleverTap..." rows={8} className="font-mono text-xs" />
                        </div>
                        <Button onClick={runSessionValidation} className="w-full bg-gradient-to-r from-amber-500 to-orange-600">
                            <Zap className="w-4 h-4 mr-2" /> Validate
                        </Button>
                        {sessionResults && <ValidationPanel results={sessionResults} eventName={sessionEventType} />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Validation Report ── */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500" /> Phase 1 Validation Report</DialogTitle>
                        <DialogDescription>Summary of all validated Phase 1 events</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-end">
                            <Button onClick={exportToSheets} className="bg-gradient-to-r from-emerald-500 to-green-600">
                                <FileDown className="w-4 h-4 mr-2" /> Export to Sheets
                            </Button>
                        </div>
                        <ScrollArea className="h-[55vh]">
                            <div className="space-y-3 pr-2">
                                {reportData.map((d, i) => (
                                    <Card key={i} className={`border-l-4 ${d.score === 100 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold">{d.event}</h4>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={d.score === 100 ? 'bg-emerald-500' : d.score > 50 ? 'bg-amber-500' : 'bg-red-500'}>{d.score}%</Badge>
                                                    {d.score === 100 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                                </div>
                                            </div>
                                            {d.results.filter(r => r.status !== 'PASS').length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {d.results.filter(r => r.status !== 'PASS').map((r, j) => (
                                                        <div key={j} className={`text-xs p-2 rounded border ${statusColor[r.status]}`}>
                                                            <span className="font-mono font-semibold">{r.attr}</span>: {r.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                                {reportData.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p>No Phase 1 events validated yet</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Custom Event Modal ── */}
            <Dialog open={isCustomEventOpen} onOpenChange={v => { setIsCustomEventOpen(v); if (!v) setCustomResults(null); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Custom Event</DialogTitle>
                        <DialogDescription>Capture and validate any event not in the standard list</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Event Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={customEventName} onChange={e => setCustomEventName(e.target.value)} placeholder="e.g. search_performed" />
                        </div>
                        <div className="space-y-2">
                            <Label>Event JSON</Label>
                            <Textarea value={customEventJson} onChange={e => { setCustomEventJson(e.target.value); setCustomResults(null); }} placeholder="Paste JSON..." rows={7} className="font-mono text-xs" />
                        </div>
                        <Button onClick={() => {
                            if (!customEventJson.trim()) return;
                            try {
                                const params = parseJsonToParams(customEventJson);
                                const evName = customEventName.trim().toLowerCase().replace(/\s+/g, '_') ||
                                    (params['event_name'] || params['event'] || 'custom_event').toLowerCase().replace(/\s+/g, '_');
                                const schemaEvent = schema[evName] || {};
                                const eventMeta = schemaMeta[evName] || {};
                                const isWeb = config?.platform === 'web';
                                const results = Object.keys(schemaEvent).length ? validateParams(params, schemaEvent, eventMeta, isWeb) : [];
                                setCustomResults(results);
                                toast({ title: `Validated "${evName}"`, description: results.length ? `Score: ${calcScore(results)}%` : 'No schema — showing raw params' });
                            } catch { toast({ title: 'Invalid JSON', variant: 'destructive' }); }
                        }} className="w-full bg-gradient-to-r from-orange-500 to-red-600">
                            <Shield className="w-4 h-4 mr-2" /> Validate
                        </Button>
                        {customResults && <ValidationPanel results={customResults} />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Phase 2 Report Modal ── */}
            <Dialog open={isP2ReportOpen} onOpenChange={setIsP2ReportOpen}>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-500" /> Phase 2 Validation Report
                        </DialogTitle>
                        <DialogDescription>
                            Sheet: <strong>{p2SelectedSheet}</strong> · {Object.keys(p2SavedEvents).length} event(s) validated
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="flex justify-end">
                            <Button onClick={exportPhase2ToSheets} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white gap-2">
                                <FileDown className="w-4 h-4" /> Export to Sheets
                            </Button>
                        </div>
                        {/* Summary table */}
                        <div className="rounded-xl border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/60">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 font-semibold">Event</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Score</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Pass</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Fail</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Missing</th>
                                        <th className="text-center px-3 py-2.5 font-semibold">Extra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(p2SavedEvents).map(([evName, data], i) => (
                                        <tr key={evName} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                            <td className="px-4 py-2.5 font-mono font-semibold text-sm">{evName}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <Badge className={`text-white text-xs ${data.score === 100 ? 'bg-emerald-500' : data.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}>{data.score}%</Badge>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {data.score === 100
                                                    ? <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />PASS</span>
                                                    : <span className="flex items-center justify-center gap-1 text-red-500 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" />FAIL</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">{data.results.filter(r => r.status === 'PASS').length}</td>
                                            <td className="px-3 py-2.5 text-center text-red-500 font-semibold">{data.results.filter(r => r.status !== 'PASS').length}</td>
                                            <td className="px-3 py-2.5 text-center text-rose-500">{data.results.filter(r => r.status === 'MISSING').length}</td>
                                            <td className="px-3 py-2.5 text-center text-blue-500">{data.results.filter(r => r.status === 'EXTRA').length}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Per-event failure details */}
                        <ScrollArea className="h-[45vh]">
                            <div className="space-y-4 pr-2">
                                {Object.entries(p2SavedEvents).map(([evName, data]) => {
                                    const failures = data.results.filter(r => r.status !== 'PASS');
                                    if (!failures.length) return (
                                        <div key={evName} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                            <span className="font-mono font-semibold text-sm">{evName}</span>
                                            <span className="text-xs text-emerald-600">All attributes passed</span>
                                        </div>
                                    );
                                    return (
                                        <Card key={evName} className="border-l-4 border-l-red-400">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="font-mono font-bold text-sm">{evName}</span>
                                                    <Badge className={`text-white text-xs ${data.score === 100 ? 'bg-emerald-500' : data.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}>{data.score}%</Badge>
                                                </div>
                                                <div className="rounded-lg border overflow-hidden">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-muted/50">
                                                            <tr>
                                                                <th className="text-left px-3 py-2 font-semibold">Attribute</th>
                                                                <th className="text-left px-3 py-2 font-semibold">Issue</th>
                                                                <th className="text-left px-3 py-2 font-semibold">Expected</th>
                                                                <th className="text-left px-3 py-2 font-semibold">Actual</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {failures.map((r, i) => (
                                                                <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                                                    <td className="px-3 py-1.5 font-mono font-semibold">
                                                                        {r.mainAttr === 'others' ? `others(${r.attr})` : r.attr}
                                                                    </td>
                                                                    <td className="px-3 py-1.5">
                                                                        <Badge variant="outline" className={`text-xs border-current ${statusColor[r.status]}`}>{r.status}</Badge>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-muted-foreground">{r.expected || '—'}</td>
                                                                    <td className="px-3 py-1.5 text-muted-foreground">{r.actual || '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
