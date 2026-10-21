/**
 * Pure helpers for multi-tester (shared) test sessions.
 *
 * Sessions keep their cases in the `testCases` array on the session document.
 * Per-case updates are applied as pure array transforms and persisted inside a
 * `runTransaction`, which is concurrency-safe (conflicting writers retry) while
 * never using dotted field paths — those silently convert an array into a map
 * in Firestore and destroy every other case. These helpers keep that logic
 * unit-testable.
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

/** Coerce a Firestore Timestamp | ISO string | Date into a Date. */
function coerceDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Normalise a session's `testCases` into an array. Most sessions store an array
 * of full case objects, but a few legacy sessions store only results as a map
 * keyed by the case `orderIndex`. Those are converted to an array so downstream
 * code never crashes on a missing `.map`/`.filter`.
 */
export function normalizeCases(raw: any): TestCase[] {
  if (Array.isArray(raw)) {
    return raw.map((tc: any) => ({ ...tc, lastModified: coerceDate(tc?.lastModified) }));
  }
  if (raw && typeof raw === 'object') {
    return Object.keys(raw)
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      })
      .map((key) => {
        const tc: any = raw[key] || {};
        const numeric = Number(key);
        return {
          ...tc,
          id: tc.id ?? key,
          orderIndex: tc.orderIndex ?? (isNaN(numeric) ? undefined : numeric),
          testCaseTitle: tc.testCaseTitle ?? tc.title ?? `Test case ${key}`,
          lastModified: coerceDate(tc.lastModified),
        };
      }) as TestCase[];
  }
  return [];
}

/** Normalise a raw Firestore session document into a `TestSession`. */
export function parseSessionDoc(id: string, data: any): TestSession {
  return {
    id,
    ...data,
    createdAt: (data?.createdAt as any)?.toDate?.() ?? new Date(),
    updatedAt: (data?.updatedAt as any)?.toDate?.() ?? new Date(),
    completedAt: (data?.completedAt as any)?.toDate?.() ?? (data?.completedAt ?? undefined),
    testCases: normalizeCases(data?.testCases),
  } as TestSession;
}

export interface CaseBug {
  id: string;
  title: string | null;
}

/**
 * Every Jira bug attached to a case (primary `bugId` + `linkedBugs`), each with
 * its summary, de-duplicated and in display order. Resolves titles from the
 * case's own `bugTitle` and from `linkedBugDetails` so legacy cases that only
 * persisted ids (or linked ids) still render as "ID — summary" wherever the
 * summary is known, and never as an id-only entry.
 */
export function getCaseBugs(
  tc: Pick<TestCase, 'bugId' | 'bugTitle' | 'linkedBugs' | 'linkedBugDetails'> | null | undefined,
): CaseBug[] {
  if (!tc) return [];
  const details = new Map<string, string | null>();
  for (const d of tc.linkedBugDetails || []) {
    if (d?.id) details.set(d.id, d.title ?? null);
  }
  const out: CaseBug[] = [];
  const seen = new Set<string>();
  const add = (id: string, title: string | null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, title });
  };
  if (tc.bugId) add(tc.bugId, tc.bugTitle ?? details.get(tc.bugId) ?? null);
  for (const id of tc.linkedBugs || []) {
    if (id && !seen.has(id)) add(id, details.get(id) ?? null);
  }
  for (const d of tc.linkedBugDetails || []) {
    if (d?.id && !seen.has(d.id)) add(d.id, d.title ?? null);
  }
  return out;
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
 * Recursively drop `undefined` members so the value can be written to Firestore
 * (which rejects undefined at any depth). `Date` and Firestore `Timestamp`
 * values are kept as leaves.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof (value as any).toDate !== 'function') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Return a copy of `cases` with `patch` merged into the case at `index`.
 *
 * IMPORTANT: never write per-case updates as dotted field paths
 * (e.g. `testCases.3.status`). Firestore treats the numeric segment as a *map*
 * key, so the first such write silently converts the `testCases` array into a
 * map and destroys every other case. Instead, callers persist the returned
 * array inside a `runTransaction` — concurrent writers conflict and retry, so
 * two testers editing different cases never clobber each other.
 */
export function applyCasePatch(cases: TestCase[], index: number, patch: Partial<TestCase>): TestCase[] {
  const next = [...cases];
  if (index >= 0 && next[index]) {
    next[index] = { ...next[index], ...(stripUndefined(patch) as Partial<TestCase>) } as TestCase;
  }
  return next;
}

/**
 * Build a blank, execution-ready test case. `id` must be unique within the
 * session; callers seed it from the session id plus a unique suffix.
 */
export function makeBlankCase(id: string, orderIndex: number, seed: Partial<TestCase> = {}): TestCase {
  return {
    id,
    orderIndex,
    testBed: seed.testBed ?? '',
    testCaseTitle: seed.testCaseTitle ?? 'New test case',
    testSteps: seed.testSteps ?? '',
    expectedResult: seed.expectedResult ?? '',
    actualResult: seed.actualResult ?? '',
    notes: seed.notes ?? '',
    status: seed.status ?? 'Untested',
    priority: seed.priority ?? 'Medium',
    lastModified: seed.lastModified ?? new Date(),
    ...seed,
  } as TestCase;
}

/**
 * Re-number `orderIndex` sequentially from the array position. Inserts and
 * deletes shift positions, so every case's `orderIndex` is resynced after a
 * structural change (the UI already numbers cases by array index, but exports
 * and sorts rely on `orderIndex`). Positions are preserved as dates/objects.
 */
export function reindexCases(cases: TestCase[]): TestCase[] {
  return cases.map((tc, i) => (tc.orderIndex === i ? tc : ({ ...tc, orderIndex: i } as TestCase)));
}

/**
 * Insert `newCase` at `atIndex` (clamped to `[0, length]`) and re-number the
 * following cases. Returns a new array; the caller persists it inside a
 * transaction.
 */
export function applyInsertCase(cases: TestCase[], atIndex: number, newCase: TestCase): TestCase[] {
  const next = [...cases];
  const pos = Math.max(0, Math.min(atIndex, next.length));
  next.splice(pos, 0, newCase);
  return reindexCases(next);
}

/**
 * Remove the case at `index` and re-number the remaining cases. No-ops on an
 * out-of-range index so concurrent writers can't blow up.
 */
export function applyDeleteCase(cases: TestCase[], index: number): TestCase[] {
  if (index < 0 || index >= cases.length) return cases;
  const next = [...cases];
  next.splice(index, 1);
  return reindexCases(next);
}

/** Assign an inclusive index range to a tester, clamped to the array bounds. */
export function applyAssignRange(
  cases: TestCase[],
  startIndex: number,
  endIndex: number,
  tester: SessionTester,
): TestCase[] {
  const next = [...cases];
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(next.length - 1, Math.max(startIndex, endIndex));
  for (let i = lo; i <= hi; i++) {
    next[i] = { ...next[i], assignedToUid: tester.uid, assignedToName: tester.name } as TestCase;
  }
  return next;
}

/** Clear the assignment on an inclusive index range. */
export function applyUnassignRange(cases: TestCase[], startIndex: number, endIndex: number): TestCase[] {
  const next = [...cases];
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(next.length - 1, Math.max(startIndex, endIndex));
  for (let i = lo; i <= hi; i++) {
    next[i] = { ...next[i], assignedToUid: null, assignedToName: null } as TestCase;
  }
  return next;
}

/** Split cases evenly across participants (in order). */
export function applyEvenSplit(cases: TestCase[], participants: SessionTester[]): TestCase[] {
  const ranges = splitEvenRanges(cases.length, participants.length);
  return ranges.reduce((acc, r, i) => applyAssignRange(acc, r.start, r.end, participants[i]), [...cases]);
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

/**
 * Index to resume a session at so "Continue" lands where the tester left off
 * rather than at case 1. Returns the first untested case *after* the most
 * recently executed one (testers often start mid-suite, e.g. an assigned
 * range), falling back to the first untested case anywhere, then 0.
 */
export function findResumeIndex(cases: TestCase[] | undefined | null): number {
  if (!cases || cases.length === 0) return 0;
  const isUntested = (tc: TestCase | undefined) => !tc || !tc.status || tc.status === 'Untested';

  let lastExecuted = -1;
  let lastTime = -Infinity;
  for (let i = 0; i < cases.length; i++) {
    if (isUntested(cases[i])) continue;
    const lm: any = cases[i].lastModified;
    const t = lm instanceof Date ? lm.getTime() : (lm?.getTime?.() ?? (lm ? new Date(lm).getTime() : 0)) || 0;
    if (t >= lastTime) { lastTime = t; lastExecuted = i; }
  }
  if (lastExecuted === -1) {
    const first = cases.findIndex(isUntested);
    return first !== -1 ? first : 0;
  }
  for (let i = lastExecuted + 1; i < cases.length; i++) {
    if (isUntested(cases[i])) return i;
  }
  const anyUntested = cases.findIndex(isUntested);
  return anyUntested !== -1 ? anyUntested : lastExecuted;
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

/**
 * Index of the next untested case after `fromIndex`, wrapping around once so the
 * last remaining case is still reachable. Returns -1 when every case is done.
 */
export function findNextUntested(cases: TestCase[], fromIndex = -1): number {
  const n = cases.length;
  if (n === 0) return -1;
  const isUntested = (tc: TestCase | undefined) => !tc || !tc.status || tc.status === 'Untested';
  for (let step = 1; step <= n; step++) {
    const i = (fromIndex + step) % n;
    if (isUntested(cases[i])) return i;
  }
  return -1;
}
