/**
 * Pure helpers for multi-tester (shared) test sessions.
 *
 * Sessions keep their cases in the `testCases` array on the session document.
 * To stay concurrent-safe we never rewrite the whole array from a tester's
 * client — instead we write atomic field paths (e.g. `testCases.12.status`) and
 * use a transaction when claiming a case. These helpers build those payloads
 * and make the access/summary logic unit-testable.
 */

import type { TestCase, TestSession } from '@/types';

export interface SessionSummary {
  total: number;
  pass: number;
  fail: number;
  na: number;
  untested: number;
  failKnown: number;
}

export interface SessionTester {
  uid: string;
  name: string;
}

/** Normalise a raw Firestore session document into a `TestSession`. */
export function parseSessionDoc(id: string, data: any): TestSession {
  return {
    id,
    ...data,
    createdAt: (data?.createdAt as any)?.toDate?.() ?? new Date(),
    updatedAt: (data?.updatedAt as any)?.toDate?.() ?? new Date(),
    completedAt: (data?.completedAt as any)?.toDate?.() ?? (data?.completedAt ?? undefined),
    testCases: (data?.testCases || []).map((tc: any) => ({
      ...tc,
      lastModified: (tc?.lastModified as any)?.toDate?.() ?? new Date(),
    })),
  } as TestSession;
}

/** Recompute the denormalised summary from a list of cases. */
export function computeSummary(cases: TestCase[]): SessionSummary {
  let pass = 0;
  let fail = 0;
  let failKnown = 0;
  let na = 0;
  let untested = 0;
  for (const t of cases) {
    const s = t.status;
    if (s === 'Pass') pass++;
    else if (s === 'Fail (Known)') { fail++; failKnown++; }
    else if (s === 'Fail') fail++;
    else if (s === 'N/A') na++;
    else if (s === 'Untested') untested++;
  }
  return { total: cases.length, pass, fail, na, untested, failKnown };
}

export interface SessionAccess {
  uid: string;
  isLead?: boolean;
}

/** Owner, invited tester, or lead may open the session runner. */
export function canAccessSession(data: Partial<TestSession> | null | undefined, access: SessionAccess): boolean {
  if (!data) return false;
  if (data.userId === access.uid) return true;
  if (access.isLead) return true;
  return (data.testerIds || []).includes(access.uid);
}

export function isSessionOwner(data: Partial<TestSession> | null | undefined, uid: string): boolean {
  return !!data && data.userId === uid;
}

/**
 * Build an `updateDoc` payload of atomic field paths for a single case.
 * `undefined` values are skipped (Firestore rejects them). `null` is allowed
 * and clears a field.
 */
export function buildCasePatch(index: number, patch: Partial<TestCase>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[`testCases.${index}.${k}`] = v;
  }
  return out;
}

/**
 * Build an `updateDoc` payload assigning a contiguous index range (inclusive)
 * to a tester, clamped to the session bounds.
 */
export function buildAssignRangePatch(
  startIndex: number,
  endIndex: number,
  tester: SessionTester,
  total: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(total - 1, Math.max(startIndex, endIndex));
  for (let i = lo; i <= hi; i++) {
    out[`testCases.${i}.assignedToUid`] = tester.uid;
    out[`testCases.${i}.assignedToName`] = tester.name;
  }
  return out;
}

/** Build a payload clearing the assignment on an index range. */
export function buildUnassignRangePatch(startIndex: number, endIndex: number, total: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(total - 1, Math.max(startIndex, endIndex));
  for (let i = lo; i <= hi; i++) {
    out[`testCases.${i}.assignedToUid`] = null;
    out[`testCases.${i}.assignedToName`] = null;
  }
  return out;
}

/** Merge testers without duplicates (later entries win). */
export function mergeTesters(current: SessionTester[] | undefined, add: SessionTester[]): SessionTester[] {
  const map = new Map<string, SessionTester>();
  (current || []).forEach(t => map.set(t.uid, t));
  add.forEach(t => map.set(t.uid, t));
  return Array.from(map.values());
}

export function removeTester(current: SessionTester[] | undefined, uid: string): SessionTester[] {
  return (current || []).filter(t => t.uid !== uid);
}

/** Split `count` cases into `parts` roughly equal ranges (for even distribution). */
export function splitEvenRanges(count: number, parts: number): { start: number; end: number }[] {
  if (count <= 0 || parts <= 0) return [];
  const n = Math.min(parts, count);
  const base = Math.floor(count / n);
  const extra = count % n;
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    ranges.push({ start: cursor, end: cursor + size - 1 });
    cursor += size;
  }
  return ranges;
}

/** First unassigned case index at/after `fromIndex` (wraps once), else -1. */
export function findNextUnassigned(cases: TestCase[], fromIndex = 0): number {
  const n = cases.length;
  for (let step = 0; step < n; step++) {
    const i = (fromIndex + step) % n;
    if (!cases[i]?.assignedToUid) return i;
  }
  return -1;
}

/** Count cases assigned to a given tester (or unassigned when uid is null). */
export function countAssigned(cases: TestCase[], uid: string | null): number {
  return cases.filter(c => (c.assignedToUid || null) === uid).length;
}
