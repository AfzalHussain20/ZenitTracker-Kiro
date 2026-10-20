import {
  CASE_EXPORT_HEADERS, csvEscape, rowsToCsv, testCaseToRow, testCasesToRows, buildStyledSheet,
} from '../test-cases';
import * as XLSX from 'xlsx';

describe('export/test-cases', () => {
  describe('csvEscape', () => {
    it('leaves plain values untouched', () => {
      expect(csvEscape('hello')).toBe('hello');
      expect(csvEscape(42)).toBe('42');
    });
    it('quotes values containing a comma, quote or newline', () => {
      expect(csvEscape('a,b')).toBe('"a,b"');
      expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
      expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    });
    it('renders null/undefined as empty', () => {
      expect(csvEscape(null)).toBe('');
      expect(csvEscape(undefined)).toBe('');
    });
  });

  describe('testCaseToRow', () => {
    it('maps fields into the header order and 1-based S.No', () => {
      const row = testCaseToRow({
        testBed: 'Search', testCaseTitle: 'Find item', testSteps: '1. open\n2. type',
        expectedResult: 'shows results', status: 'Pass', priority: 'High', bugId: 'ABC-1',
      }, 0);
      expect(row['S.No']).toBe(1);
      expect(row['Test Bed']).toBe('Search');
      expect(row['Test Case Title']).toBe('Find item');
      expect(row['Test Steps']).toBe('1. open\n2. type');
      expect(row.Status).toBe('Pass');
      expect(row['Bug ID']).toBe('ABC-1');
    });
    it('defaults status to Untested and blanks missing fields', () => {
      const row = testCaseToRow({}, 4);
      expect(row['S.No']).toBe(5);
      expect(row.Status).toBe('Untested');
      expect(row['Test Bed']).toBe('');
      expect(row.Reason).toBe('');
    });
  });

  describe('testCasesToRows', () => {
    it('sorts by orderIndex and renumbers S.No', () => {
      const rows = testCasesToRows([
        { testCaseTitle: 'c', orderIndex: 2 },
        { testCaseTitle: 'a', orderIndex: 0 },
        { testCaseTitle: 'b', orderIndex: 1 },
      ]);
      expect(rows.map(r => r['Test Case Title'])).toEqual(['a', 'b', 'c']);
      expect(rows.map(r => r['S.No'])).toEqual([1, 2, 3]);
    });
  });

  describe('rowsToCsv', () => {
    it('emits a BOM, a header row and CRLF-separated records', () => {
      const rows = [testCaseToRow({ testCaseTitle: 'A, B', status: 'Fail' }, 0)];
      const csv = rowsToCsv(rows, CASE_EXPORT_HEADERS);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('S.No,Test Bed,Test Case Title');
      expect(csv).toContain('"A, B"');
      expect(csv.split('\r\n').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('buildStyledSheet', () => {
    it('creates a sheet with header, autofilter, frozen row and column widths', () => {
      const rows = [testCaseToRow({ testCaseTitle: 'Case 1', status: 'Pass' }, 0)];
      const ws = buildStyledSheet(rows, CASE_EXPORT_HEADERS);
      expect(ws['!ref']).toBeTruthy();
      expect(ws['!autofilter']).toBeTruthy();
      expect(ws['!views']?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(ws['!cols']?.length).toBe(CASE_EXPORT_HEADERS.length);
      // Header cell A1 carries the release name.
      expect(ws['A1'].v).toBe('S.No');
      expect(XLSX.utils.sheet_to_json(ws).length).toBe(1);
    });
  });
});
