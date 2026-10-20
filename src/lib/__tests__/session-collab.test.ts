import {
  applyAssignRange, applyCasePatch, applyDeleteCase, applyEvenSplit, applyInsertCase,
  applyUnassignRange, makeBlankCase, reindexCases, stripUndefined,
  canAccessSession, computeSummary, countAssigned, findNextUnassigned,
  findResumeIndex, getCaseBugs, isSessionOwner, mergeTesters, normalizeCases, parseSessionDoc, removeTester, splitEvenRanges,
} from '../session-collab';
import type { TestCase } from '@/types';

const tc = (over: Partial<TestCase> = {}): TestCase => ({
  id: 't', orderIndex: 0, testBed: 'General', testCaseTitle: 'Case',
  testSteps: '', expectedResult: '', status: 'Untested', lastModified: new Date(),
  ...over,
});

describe('session-collab', () => {
  describe('computeSummary', () => {
    it('counts each status bucket and failKnown', () => {
      const cases = [
        tc({ status: 'Pass' }), tc({ status: 'Pass' }),
        tc({ status: 'Fail' }), tc({ status: 'Fail (Known)' }),
        tc({ status: 'N/A' }), tc({ status: 'Untested' }),
      ];
      expect(computeSummary(cases)).toEqual({
        total: 6, pass: 2, fail: 2, na: 1, untested: 1, failKnown: 1,
      });
    });

    it('handles an empty list', () => {
      expect(computeSummary([])).toEqual({ total: 0, pass: 0, fail: 0, na: 0, untested: 0, failKnown: 0 });
    });
  });

  describe('canAccessSession', () => {
    it('allows the owner', () => {
      expect(canAccessSession({ userId: 'u1' }, { uid: 'u1' })).toBe(true);
    });
    it('allows an invited tester', () => {
      expect(canAccessSession({ userId: 'u1', testerIds: ['u2'] }, { uid: 'u2' })).toBe(true);
    });
    it('rejects a non-member tester', () => {
      expect(canAccessSession({ userId: 'u1', testerIds: ['u2'] }, { uid: 'u3' })).toBe(false);
    });
    it('allows a lead even if not a member', () => {
      expect(canAccessSession({ userId: 'u1' }, { uid: 'u9', isLead: true })).toBe(true);
    });
    it('rejects null data', () => {
      expect(canAccessSession(null, { uid: 'u1' })).toBe(false);
    });
  });

  describe('isSessionOwner', () => {
    it('detects the owner', () => {
      expect(isSessionOwner({ userId: 'u1' }, 'u1')).toBe(true);
      expect(isSessionOwner({ userId: 'u1' }, 'u2')).toBe(false);
      expect(isSessionOwner(null, 'u1')).toBe(false);
    });
  });

  describe('applyCasePatch', () => {
    it('merges a patch without touching the other cases (pure)', () => {
      const cases = [tc({ id: 'a' }), tc({ id: 'b' }), tc({ id: 'c' })];
      const next = applyCasePatch(cases, 1, { status: 'Pass', bugId: 'ABC-1' });
      expect(next[1].status).toBe('Pass');
      expect(next[1].bugId).toBe('ABC-1');
      expect(next[0].status).toBe('Untested');
      expect(next).toHaveLength(3);
      expect(cases[1].status).toBe('Untested');
    });
    it('drops undefined values but keeps null so Firestore accepts the write', () => {
      const next = applyCasePatch([tc()], 0, { status: 'Fail', notes: undefined, assignedToUid: null });
      expect('notes' in next[0]).toBe(false);
      expect(next[0].assignedToUid).toBeNull();
    });
    it('ignores out-of-range indices', () => {
      const cases = [tc()];
      expect(applyCasePatch(cases, 5, { status: 'Pass' })).toEqual(cases);
    });
  });

  describe('applyAssignRange / applyUnassignRange', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => tc({ orderIndex: i }));
    it('assigns an inclusive range clamped to bounds', () => {
      const next = applyAssignRange(make(10), 2, 4, { uid: 'u2', name: 'Bob' });
      expect(next[2].assignedToUid).toBe('u2');
      expect(next[4].assignedToName).toBe('Bob');
      expect(next[5].assignedToUid).toBeUndefined();
    });
    it('normalises reversed ranges', () => {
      const next = applyAssignRange(make(10), 4, 2, { uid: 'u2', name: 'Bob' });
      expect(next[2].assignedToUid).toBe('u2');
      expect(next[4].assignedToName).toBe('Bob');
    });
    it('clamps the end to the last index', () => {
      const next = applyAssignRange(make(10), 8, 99, { uid: 'u2', name: 'Bob' });
      expect(next[9].assignedToUid).toBe('u2');
      expect(next).toHaveLength(10);
    });
    it('nulls the assignment fields on an unassign range', () => {
      const cases = [tc({ assignedToUid: 'x', assignedToName: 'X' }), tc({ assignedToUid: 'x' }), tc()];
      const next = applyUnassignRange(cases, 0, 1);
      expect(next[0].assignedToUid).toBeNull();
      expect(next[0].assignedToName).toBeNull();
      expect(next[1].assignedToUid).toBeNull();
    });
  });

  describe('applyEvenSplit', () => {
    it('splits cases across participants in order', () => {
      const cases = Array.from({ length: 500 }, (_, i) => tc({ orderIndex: i }));
      const next = applyEvenSplit(cases, [{ uid: 'a', name: 'A' }, { uid: 'b', name: 'B' }, { uid: 'c', name: 'C' }]);
      expect(next[0].assignedToUid).toBe('a');
      expect(next[166].assignedToUid).toBe('a');
      expect(next[167].assignedToUid).toBe('b');
      expect(next[499].assignedToUid).toBe('c');
    });
  });

  describe('stripUndefined', () => {
    it('recursively removes undefined while keeping null, arrays and Dates', () => {
      const d = new Date();
      const out = stripUndefined({ a: 1, b: undefined, c: null, d: { e: undefined, f: 2 }, g: [1, undefined, 3], h: d });
      expect(out).toEqual({ a: 1, c: null, d: { f: 2 }, g: [1, 3], h: d });
      expect(out.h).toBe(d);
    });
  });

  describe('mergeTesters / removeTester', () => {
    it('dedupes by uid with later entries winning', () => {
      const merged = mergeTesters([{ uid: 'a', name: 'Al' }], [{ uid: 'a', name: 'Alice' }, { uid: 'b', name: 'Bob' }]);
      expect(merged).toEqual([{ uid: 'a', name: 'Alice' }, { uid: 'b', name: 'Bob' }]);
    });
    it('handles undefined current', () => {
      expect(mergeTesters(undefined, [{ uid: 'a', name: 'Al' }])).toEqual([{ uid: 'a', name: 'Al' }]);
    });
    it('removes a tester', () => {
      expect(removeTester([{ uid: 'a', name: 'Al' }, { uid: 'b', name: 'Bob' }], 'a')).toEqual([{ uid: 'b', name: 'Bob' }]);
    });
  });

  describe('splitEvenRanges', () => {
    it('splits evenly with remainder spread over the first ranges', () => {
      expect(splitEvenRanges(500, 3)).toEqual([
        { start: 0, end: 166 }, { start: 167, end: 333 }, { start: 334, end: 499 },
      ]);
    });
    it('caps parts at the number of cases', () => {
      expect(splitEvenRanges(2, 5)).toEqual([{ start: 0, end: 0 }, { start: 1, end: 1 }]);
    });
    it('returns empty for zero inputs', () => {
      expect(splitEvenRanges(0, 3)).toEqual([]);
      expect(splitEvenRanges(10, 0)).toEqual([]);
    });
  });

  describe('findNextUnassigned', () => {
    it('finds the next unassigned case', () => {
      const cases = [tc({ assignedToUid: 'a' }), tc({ assignedToUid: 'b' }), tc(), tc()];
      expect(findNextUnassigned(cases, 0)).toBe(2);
    });
    it('wraps around', () => {
      const cases = [tc(), tc({ assignedToUid: 'a' })];
      expect(findNextUnassigned(cases, 1)).toBe(0);
    });
    it('returns -1 when all assigned', () => {
      expect(findNextUnassigned([tc({ assignedToUid: 'a' })], 0)).toBe(-1);
    });
  });

  describe('countAssigned', () => {
    it('counts per tester and unassigned', () => {
      const cases = [tc({ assignedToUid: 'a' }), tc({ assignedToUid: 'a' }), tc({ assignedToUid: null }), tc()];
      expect(countAssigned(cases, 'a')).toBe(2);
      expect(countAssigned(cases, null)).toBe(2);
    });
  });

  describe('normalizeCases', () => {
    it('passes an array through and dates lastModified', () => {
      const out = normalizeCases([{ id: 'x', testCaseTitle: 'T', lastModified: '2026-01-02T00:00:00Z' }]);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('x');
      expect(out[0].lastModified).toBeInstanceOf(Date);
    });

    it('converts a results map keyed by orderIndex into a sorted array', () => {
      const out = normalizeCases({
        '101': { status: 'Pass', actualResult: 'b' },
        '100': { status: 'Fail', bugId: 'SUN-1' },
      });
      expect(out.map((c) => c.id)).toEqual(['100', '101']);
      expect(out[0].orderIndex).toBe(100);
      expect(out[0].status).toBe('Fail');
      expect(out[0].testCaseTitle).toBe('Test case 100');
      expect(out[1].testCaseTitle).toBe('Test case 101');
    });

    it('returns an empty array for null / primitives', () => {
      expect(normalizeCases(null)).toEqual([]);
      expect(normalizeCases(undefined)).toEqual([]);
      expect(normalizeCases('nope')).toEqual([]);
    });
  });

  describe('getCaseBugs', () => {
    it('returns the primary bug with its title', () => {
      expect(getCaseBugs(tc({ bugId: 'SUN-1', bugTitle: 'Crash on login' }))).toEqual([
        { id: 'SUN-1', title: 'Crash on login' },
      ]);
    });

    it('includes linked bugs in order after the primary', () => {
      const bugs = getCaseBugs(tc({
        bugId: 'SUN-1', bugTitle: 'Primary',
        linkedBugs: ['SUN-2', 'SUN-3'],
        linkedBugDetails: [{ id: 'SUN-2', title: 'Second' }, { id: 'SUN-3', title: 'Third' }],
      }));
      expect(bugs).toEqual([
        { id: 'SUN-1', title: 'Primary' },
        { id: 'SUN-2', title: 'Second' },
        { id: 'SUN-3', title: 'Third' },
      ]);
    });

    it('resolves a missing primary title from linkedBugDetails', () => {
      expect(getCaseBugs(tc({ bugId: 'SUN-9', linkedBugDetails: [{ id: 'SUN-9', title: 'Fetched' }] })))
        .toEqual([{ id: 'SUN-9', title: 'Fetched' }]);
    });

    it('de-duplicates a linked bug that repeats the primary', () => {
      expect(getCaseBugs(tc({ bugId: 'SUN-1', bugTitle: 'A', linkedBugs: ['SUN-1', 'SUN-2'] })))
        .toEqual([{ id: 'SUN-1', title: 'A' }, { id: 'SUN-2', title: null }]);
    });

    it('renders linked bugs with a null title when none is stored', () => {
      expect(getCaseBugs(tc({ linkedBugs: ['SUN-2'] }))).toEqual([{ id: 'SUN-2', title: null }]);
    });

    it('includes bugs that exist only in linkedBugDetails', () => {
      expect(getCaseBugs(tc({
        bugId: 'SUN-1', bugTitle: 'One',
        linkedBugDetails: [{ id: 'SUN-1', title: 'One' }, { id: 'SUN-9', title: 'Nine' }],
      }))).toEqual([{ id: 'SUN-1', title: 'One' }, { id: 'SUN-9', title: 'Nine' }]);
    });

    it('returns an empty list when there are no bugs', () => {
      expect(getCaseBugs(tc())).toEqual([]);
      expect(getCaseBugs(null)).toEqual([]);
    });
  });

  describe('parseSessionDoc', () => {
    it('normalises a map-shaped testCases without throwing', () => {
      const parsed = parseSessionDoc('s1', {
        userId: 'u1', status: 'Aborted',
        testCases: { '5': { status: 'Pass' } },
      });
      expect(Array.isArray(parsed.testCases)).toBe(true);
      expect(parsed.testCases).toHaveLength(1);
      expect(parsed.testCases[0].id).toBe('5');
    });
  });

  describe('findResumeIndex', () => {
    const d = (t: number) => new Date(2026, 0, 1, 0, 0, t);
    it('returns the first untested case for a fresh session', () => {
      const cases = [tc(), tc(), tc()];
      expect(findResumeIndex(cases)).toBe(0);
    });
    it('resumes after the most recently executed case (mid-suite start)', () => {
      const cases = Array.from({ length: 10 }, (_, i) => tc({ orderIndex: i }));
      cases[0].status = 'Pass'; cases[0].lastModified = d(1);
      cases[3].status = 'Pass'; cases[3].lastModified = d(5);
      cases[4].status = 'Fail'; cases[4].lastModified = d(9);
      // untested 1,2 and 5..9 remain; last executed is 4 -> resume at 5
      expect(findResumeIndex(cases)).toBe(5);
    });
    it('wraps to the first untested when the tail is all executed', () => {
      const cases = Array.from({ length: 4 }, (_, i) => tc({ orderIndex: i }));
      cases[1].status = 'Pass'; cases[1].lastModified = d(3);
      cases[2].status = 'Pass'; cases[2].lastModified = d(4);
      cases[3].status = 'Pass'; cases[3].lastModified = d(5);
      expect(findResumeIndex(cases)).toBe(0);
    });
    it('handles empty and all-executed lists', () => {
      expect(findResumeIndex([])).toBe(0);
      expect(findResumeIndex(null)).toBe(0);
      const done = Array.from({ length: 3 }, (_, i) => tc({ orderIndex: i, status: 'Pass', lastModified: d(i) }));
      expect(findResumeIndex(done)).toBe(2);
    });
  });
});
