/**
 * Test-case export helpers (repository + sessions).
 *
 * Produces spreadsheet-ready rows for a suite of test cases, with:
 *  - a fixed, human-readable header order,
 *  - one row per test case,
 *  - XLSX output with a styled header (bold white on blue), frozen header row,
 *    auto-filter, per-cell borders, wrapped text, sensible column widths and
 *    status-coloured rows,
 *  - CSV output with proper RFC-4180 quoting.
 *
 * Kept free of React so it can be unit-tested.
 */

import * as XLSX from 'xlsx';
import type { TestCase, TestCaseStatus } from '@/types';

export interface TestCaseExportSource {
  testBed?: string;
  testCaseTitle?: string;
  testSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  status?: string;
  priority?: string;
  bugId?: string | null;
  naReason?: string | null;
  notes?: string;
  orderIndex?: number;
}

/** Header order used by every export. */
export const CASE_EXPORT_HEADERS = [
  'S.No',
  'Test Bed',
  'Test Case Title',
  'Test Steps',
  'Expected Result',
  'Actual Result',
  'Status',
  'Priority',
  'Bug ID',
  'Reason',
  'Notes',
] as const;

function stepsForCell(steps?: string): string {
  const raw = (steps || '').trim();
  if (!raw) return '';
  // Keep step line breaks inside the cell (wrapText is on for XLSX).
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

/** Map a test case into a `{ header: value }` row object for the workbook. */
export function testCaseToRow(tc: TestCaseExportSource, index: number): Record<string, string | number> {
  return {
    'S.No': index + 1,
    'Test Bed': tc.testBed || '',
    'Test Case Title': tc.testCaseTitle || '',
    'Test Steps': stepsForCell(tc.testSteps),
    'Expected Result': tc.expectedResult || '',
    'Actual Result': tc.actualResult || '',
    Status: tc.status || 'Untested',
    Priority: tc.priority || '',
    'Bug ID': tc.bugId || '',
    Reason: tc.naReason || '',
    Notes: tc.notes || '',
  };
}

/** Map a list of cases into export rows, ordered by `orderIndex` when present. */
export function testCasesToRows(cases: TestCaseExportSource[]): Record<string, string | number>[] {
  const ordered = [...cases].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  return ordered.map((tc, i) => testCaseToRow(tc, i));
}

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2563EB' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: { bottom: { style: 'medium', color: { rgb: '000000' } } },
};

const DEFAULT_CELL_STYLE = {
  alignment: { vertical: 'top', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'D3D3D3' } },
    bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
    left: { style: 'thin', color: { rgb: 'D3D3D3' } },
    right: { style: 'thin', color: { rgb: 'D3D3D3' } },
  },
};

function statusStyle(status: string): Record<string, unknown> {
  switch (status as TestCaseStatus) {
    case 'Pass':
      return { fill: { fgColor: { rgb: 'C6EFCE' } }, font: { color: { rgb: '006100' } } };
    case 'Fail':
      return { fill: { fgColor: { rgb: 'FFC7CE' } }, font: { color: { rgb: '9C0006' }, bold: true } };
    case 'Fail (Known)':
      return { fill: { fgColor: { rgb: 'FFEB9C' } }, font: { color: { rgb: '9C5700' } } };
    case 'N/A':
      return { fill: { fgColor: { rgb: 'E7E6E6' } }, font: { color: { rgb: '3A3A3A' }, italic: true } };
    case 'Untested':
      return { font: { color: { rgb: '808080' } } };
    default:
      return {};
  }
}

function columnWidths(rows: Record<string, unknown>[], headers: readonly string[]) {
  return headers.map((header) => {
    const longest = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0)),
    );
    return { wch: Math.min(Math.max(longest, 10), 60) + 2 };
  });
}

/** Build a styled worksheet for a set of export rows. */
export function buildStyledSheet(rows: Record<string, unknown>[], headers: readonly string[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers as string[], skipHeader: false });
  const range = XLSX.utils.decode_range(ws['!ref']!);
  const statusCol = headers.indexOf('Status');

  for (let R = range.s.r; R <= range.e.r; ++R) {
    let rowStyle: Record<string, unknown> | null = null;
    if (R > 0 && statusCol !== -1) {
      const addr = XLSX.utils.encode_cell({ c: statusCol, r: R });
      const status = ws[addr]?.v as string | undefined;
      if (status) rowStyle = { ...DEFAULT_CELL_STYLE, ...statusStyle(status) };
    }
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const ref = XLSX.utils.encode_cell({ c: C, r: R });
      if (!ws[ref]) continue;
      ws[ref].s = R === 0 ? HEADER_STYLE : rowStyle || DEFAULT_CELL_STYLE;
    }
  }

  ws['!cols'] = columnWidths(rows, headers);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
  return ws;
}

/**
 * Escape a single CSV field per RFC 4180 — wrap in quotes when it contains a
 * comma, quote, CR or LF, and double any embedded quotes.
 */
export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialise rows to a CSV string (with a UTF-8 BOM so Excel opens it correctly). */
export function rowsToCsv(rows: Record<string, unknown>[], headers: readonly string[]): string {
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')).join('\r\n');
  return `\uFEFF${head}\r\n${body}\r\n`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeName(name: string): string {
  return (name || 'test-cases').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}

/** Download the given cases as a styled .xlsx file. */
export function downloadCasesAsXlsx(cases: TestCaseExportSource[], suiteName: string) {
  const rows = testCasesToRows(cases);
  const ws = buildStyledSheet(rows, CASE_EXPORT_HEADERS);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, suiteName.slice(0, 31) || 'Test Cases');
  XLSX.writeFile(wb, `${safeName(suiteName)}_testcases.xlsx`);
}

/** Download the given cases as a .csv file. */
export function downloadCasesAsCsv(cases: TestCaseExportSource[], suiteName: string) {
  const rows = testCasesToRows(cases);
  const csv = rowsToCsv(rows, CASE_EXPORT_HEADERS);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeName(suiteName)}_testcases.csv`);
}

/** Convenience: a `TestCase[]` (session shape) is also accepted. */
export type ExportedCase = TestCase;
