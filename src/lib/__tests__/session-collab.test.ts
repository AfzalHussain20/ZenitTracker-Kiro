import {
  buildAssignRangePatch, buildCasePatch, buildUnassignRangePatch,
  canAccessSession, computeSummary, countAssigned, findNextUnassigned,
  isSessionOwner, mergeTesters, removeTester, splitEvenRanges,
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

  describe('buildCasePatch', () => {
    it('builds dotted field paths', () => {
      expect(buildCasePatch(3, { status: 'Pass', bugId: 'ABC-1' })).toEqual({
        'testCases.3.status': 'Pass',
        'testCases.3.bugId': 'ABC-1',
      });
    });
    it('skips undefined but keeps null', () => {
      expect(buildCasePatch(0, { status: 'Fail', assignedToUid: null, notes: undefined })).toEqual({
        'testCases.0.status': 'Fail',
        'testCases.0.assignedToUid': null,
      });
    });
  });

  describe('buildAssignRangePatch', () => {
    it('assigns an inclusive range clamped to bounds', () => {
      const patch = buildAssignRangePatch(2, 4, { uid: 'u2', name: 'Bob' }, 10);
      expect(Object.keys(patch)).toHaveLength(6);
      expect(patch['testCases.2.assignedToUid']).toBe('u2');
      expect(patch['testCases.4.assignedToName']).toBe('Bob');
      expect(patch['testCases.5.assignedToUid']).toBeUndefined();
    });
    it('normalises reversed ranges and clamps the end', () => {
      const patch = buildAssignRangePatch(4, 2, { uid: 'u2', name: 'Bob' }, 100);
      expect(patch['testCases.2.assignedToUid']).toBe('u2');
      expect(patch['testCases.4.assignedToName']).toBe('Bob');
    });
    it('clamps to the last index', () => {
      const patch = buildAssignRangePatch(8, 99, { uid: 'u2', name: 'Bob' }, 10);
      expect(patch['testCases.9.assignedToUid']).toBe('u2');
      expect(patch['testCases.10.assignedToUid']).toBeUndefined();
    });
  });

  describe('buildUnassignRangePatch', () => {
    it('nulls the assignment fields', () => {
      const patch = buildUnassignRangePatch(0, 1, 5);
      expect(patch).toEqual({
        'testCases.0.assignedToUid': null,
        'testCases.0.assignedToName': null,
        'testCases.1.assignedToUid': null,
        'testCases.1.assignedToName': null,
      });
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
});
