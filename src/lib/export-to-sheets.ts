// src/lib/export-to-sheets.ts
import { format } from 'date-fns';

export type ValidationStatus = 'VALUE_REQUIRED' | 'UNEXPECTED_VALUE' | 'CAPITAL_ATTR' | 'MISSING' | 'EXTRA' | 'PASS' | 'WEB_NA';

export interface AttrResult {
    attr: string;
    status: ValidationStatus;
    expected?: string;
    actual?: string;
    message: string;
    mainAttr?: string;
}

export interface SheetTab {
    tabName: string;
    headers: string[];
    rows: any[][];
    headerColor: { red: number; green: number; blue: number };
}

const TAB_COLORS = {
    summary:  { red: 0.15, green: 0.39, blue: 0.78 },
    full:     { red: 0.20, green: 0.60, blue: 0.40 },
    failures: { red: 0.76, green: 0.18, blue: 0.18 },
    missing:  { red: 0.80, green: 0.40, blue: 0.10 },
};

function getStatusLabel(status: ValidationStatus): string {
    const map: Record<ValidationStatus, string> = {
        PASS: '✓ PASS', MISSING: 'MISSING', VALUE_REQUIRED: 'VALUE_REQUIRED',
        UNEXPECTED_VALUE: 'UNEXPECTED_VALUE', CAPITAL_ATTR: 'CAPITAL_ATTR', EXTRA: 'EXTRA',
        WEB_NA: 'WEB_NA — Web team sends NA',
    };
    return map[status] ?? status;
}

function getActionRequired(status: ValidationStatus): string {
    const map: Record<ValidationStatus, string> = {
        PASS: '',
        MISSING: 'Add this attribute to the event payload',
        VALUE_REQUIRED: 'Ensure a real value is sent — not NA, null, false, or empty',
        UNEXPECTED_VALUE: 'Set this attribute to null/NA when not applicable',
        CAPITAL_ATTR: 'Rename key to lowercase snake_case',
        EXTRA: 'Remove from payload or add to schema if intentional',
        WEB_NA: 'Web team always sends NA for this attribute — expected behaviour',
    };
    return map[status] ?? '';
}

export function buildPhase1Tabs(
    liveData: { event: string; results: AttrResult[]; score: number }[],
    config: { platform: string; environment: string; appVersion: string },
    phase1Inputs?: Record<string, string>
): SheetTab[] {
    const tabs: SheetTab[] = [];

    // ── 1. Summary ──────────────────────────────────────────────────────
    tabs.push({
        tabName: '1. Summary',
        headerColor: TAB_COLORS.summary,
        headers: ['Event', 'Score', 'Status', 'Total Attrs', 'Pass', 'Fail', 'Missing', 'Value Required', 'Unexpected', 'Extra', 'Platform', 'Environment', 'App Version', 'Exported At'],
        rows: liveData.map(d => [
            d.event,
            `${d.score}%`,
            d.score === 100 ? '✓ PASS' : '✗ FAIL',
            d.results.length,
            d.results.filter(r => r.status === 'PASS').length,
            d.results.filter(r => r.status !== 'PASS').length,
            d.results.filter(r => r.status === 'MISSING').length,
            d.results.filter(r => r.status === 'VALUE_REQUIRED').length,
            d.results.filter(r => r.status === 'UNEXPECTED_VALUE').length,
            d.results.filter(r => r.status === 'EXTRA').length,
            config.platform, config.environment, config.appVersion,
            format(new Date(), 'dd MMM yyyy HH:mm'),
        ]),
    });

    // ── 2. All Attributes ───────────────────────────────────────────────
    const fullRows: any[][] = [];
    liveData.forEach(d => {
        d.results.forEach(r => {
            const displayAttr = r.mainAttr === 'others' ? `others(${r.attr})` : r.attr;
            fullRows.push([d.event, displayAttr, r.mainAttr === 'others' ? 'others group' : 'standard', getStatusLabel(r.status), r.expected || '', r.actual ?? '(absent)', r.message, getActionRequired(r.status)]);
        });
        fullRows.push(['', '', '', '', '', '', '', '']);
    });
    tabs.push({ tabName: '2. All Attributes', headerColor: TAB_COLORS.full, headers: ['Event', 'Attribute', 'Group', 'Status', 'Expected', 'Actual Value', 'Message', 'Action Required'], rows: fullRows });

    // ── 3. Failures + Actions ───────────────────────────────────────────
    const failRows: any[][] = [];
    liveData.forEach(d => {
        d.results.filter(r => r.status !== 'PASS').forEach(r => {
            const displayAttr = r.mainAttr === 'others' ? `others(${r.attr})` : r.attr;
            failRows.push([d.event, displayAttr, getStatusLabel(r.status), r.expected || '', r.actual ?? '(absent)', r.message, getActionRequired(r.status)]);
        });
    });
    if (failRows.length) tabs.push({ tabName: '3. Failures + Actions', headerColor: TAB_COLORS.failures, headers: ['Event', 'Attribute', 'Issue Type', 'Expected', 'Actual Value', 'Message', 'Action Required'], rows: failRows });

    // ── 4. Missing Attrs ────────────────────────────────────────────────
    const missingRows: any[][] = [];
    liveData.forEach(d => {
        d.results.filter(r => r.status === 'MISSING').forEach(r => {
            missingRows.push([d.event, r.mainAttr === 'others' ? `others(${r.attr})` : r.attr, r.mainAttr === 'others' ? 'Missing from others object' : 'Missing from payload', `Add "${r.attr}" to the ${d.event} payload`]);
        });
    });
    if (missingRows.length) tabs.push({ tabName: '4. Missing Attrs', headerColor: TAB_COLORS.missing, headers: ['Event', 'Missing Attribute', 'Detail', 'Developer Note'], rows: missingRows });

    // ── 5. Session JSON (for re-import) ────────────────────────────────
    tabs.push({
        tabName: '5. Session JSON',
        headerColor: { red: 0.3, green: 0.3, blue: 0.3 },
        headers: ['Event', 'Sheet', 'Score', 'JSON'],
        rows: liveData.map(d => [d.event, 'Phase1', d.score, phase1Inputs?.[d.event] ?? '']),
    });

    return tabs;
}

export function buildPhase2Tabs(
    savedEvents: Record<string, { json: string; results: AttrResult[]; score: number; sheet: string }>,
    config: { platform: string; environment: string; appVersion: string },
    allSheetEvents?: string[]
): SheetTab[] {
    const tabs: SheetTab[] = [];
    const saved = Object.entries(savedEvents);

    // ── 1. Summary ──────────────────────────────────────────────────────
    tabs.push({
        tabName: '1. Summary',
        headerColor: TAB_COLORS.summary,
        headers: ['Event', 'Sheet', 'Score', 'Status', 'Total', 'Pass', 'Fail', 'Missing', 'Value Required', 'Unexpected', 'Extra', 'Platform', 'Environment', 'App Version'],
        rows: saved.map(([evName, data]) => [
            evName, data.sheet, `${data.score}%`, data.score === 100 ? '✓ PASS' : '✗ FAIL',
            data.results.length,
            data.results.filter(r => r.status === 'PASS').length,
            data.results.filter(r => r.status !== 'PASS').length,
            data.results.filter(r => r.status === 'MISSING').length,
            data.results.filter(r => r.status === 'VALUE_REQUIRED').length,
            data.results.filter(r => r.status === 'UNEXPECTED_VALUE').length,
            data.results.filter(r => r.status === 'EXTRA').length,
            config.platform, config.environment, config.appVersion,
        ]),
    });

    // ── 2. All Attributes ───────────────────────────────────────────────
    const fullRows: any[][] = [];
    saved.forEach(([evName, data]) => {
        data.results.forEach(r => {
            const displayAttr = r.mainAttr === 'others' ? `others(${r.attr})` : r.attr;
            fullRows.push([evName, data.sheet, displayAttr, r.mainAttr === 'others' ? 'others group' : 'standard', getStatusLabel(r.status), r.expected || '', r.actual ?? '(absent)', r.message, getActionRequired(r.status)]);
        });
        fullRows.push(['', '', '', '', '', '', '', '', '']);
    });
    tabs.push({ tabName: '2. All Attributes', headerColor: TAB_COLORS.full, headers: ['Event', 'Sheet', 'Attribute', 'Group', 'Status', 'Expected', 'Actual Value', 'Message', 'Action Required'], rows: fullRows });

    // ── 3. Failures + Actions ───────────────────────────────────────────
    const failRows: any[][] = [];
    saved.forEach(([evName, data]) => {
        data.results.filter(r => r.status !== 'PASS').forEach(r => {
            const displayAttr = r.mainAttr === 'others' ? `others(${r.attr})` : r.attr;
            failRows.push([evName, data.sheet, displayAttr, getStatusLabel(r.status), r.expected || '', r.actual ?? '(absent)', r.message, getActionRequired(r.status)]);
        });
    });
    if (failRows.length) tabs.push({ tabName: '3. Failures + Actions', headerColor: TAB_COLORS.failures, headers: ['Event', 'Sheet', 'Attribute', 'Issue Type', 'Expected', 'Actual Value', 'Message', 'Action Required'], rows: failRows });

    // ── 4. Missing Attrs ────────────────────────────────────────────────
    const missingRows: any[][] = [];
    saved.forEach(([evName, data]) => {
        data.results.filter(r => r.status === 'MISSING').forEach(r => {
            missingRows.push([evName, data.sheet, r.mainAttr === 'others' ? `others(${r.attr})` : r.attr, r.mainAttr === 'others' ? 'Missing from others object' : 'Missing from payload', `Add "${r.attr}" to the ${evName} payload`]);
        });
    });
    if (missingRows.length) tabs.push({ tabName: '4. Missing Attrs', headerColor: TAB_COLORS.missing, headers: ['Event', 'Sheet', 'Missing Attribute', 'Detail', 'Developer Note'], rows: missingRows });

    // ── 5. Session JSON (for re-import) ────────────────────────────────
    tabs.push({
        tabName: '5. Session JSON',
        headerColor: { red: 0.3, green: 0.3, blue: 0.3 },
        headers: ['Event', 'Sheet', 'Score', 'JSON'],
        rows: saved.map(([evName, data]) => [evName, data.sheet, data.score, data.json]),
    });

    // ── 6. Sheet Events (all events in sheet, for instant chip restore) ──
    if (allSheetEvents && allSheetEvents.length > 0) {
        tabs.push({
            tabName: '6. Sheet Events',
            headerColor: { red: 0.2, green: 0.4, blue: 0.6 },
            headers: ['Event'],
            rows: allSheetEvents.map(e => [e]),
        });
    }

    return tabs;
}

export async function exportToGoogleSheets(title: string, tabs: SheetTab[], accessToken: string): Promise<string> {
    const res = await fetch('/api/google/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, title, sheets: tabs }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
    }
    const { url } = await res.json();
    return url;
}
