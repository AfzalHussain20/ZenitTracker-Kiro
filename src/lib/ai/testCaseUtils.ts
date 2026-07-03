// src/lib/ai/testCaseUtils.ts
// Pure utility functions for test case filtering, sorting, and summary computation.
// Extracted for property-based testing.

import type { StoredTestCase, Priority, ReviewStatus } from '@/types/test-cases';

/**
 * Filters test cases by priority and/or review status.
 * If a filter is null/undefined, that dimension is not filtered.
 * Returns exactly those test cases matching ALL active filters.
 */
export function filterTestCases(
  testCases: StoredTestCase[],
  priorityFilter: Priority | null,
  statusFilter: ReviewStatus | null
): StoredTestCase[] {
  return testCases.filter((tc) => {
    if (priorityFilter && tc.priority !== priorityFilter) return false;
    if (statusFilter && tc.reviewStatus !== statusFilter) return false;
    return true;
  });
}

/**
 * Valid sort columns for test case tables.
 */
export type SortColumn =
  | 'testcaseId'
  | 'module'
  | 'priority'
  | 'testScenario'
  | 'expectedResult';

export type SortDirection = 'asc' | 'desc';

/**
 * Priority ordering for consistent sorting.
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

/**
 * Sorts test cases by the specified column and direction.
 * Uses Array.prototype.slice() + sort() for stable sort behavior
 * (modern JS engines guarantee stable sort for Array.prototype.sort).
 * Elements with equal sort values maintain their relative order.
 */
export function sortTestCases(
  testCases: StoredTestCase[],
  column: SortColumn,
  direction: SortDirection
): StoredTestCase[] {
  const sorted = testCases.slice();

  sorted.sort((a, b) => {
    let comparison = 0;

    if (column === 'priority') {
      comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    } else {
      const aVal = a[column].toLowerCase();
      const bVal = b[column].toLowerCase();
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      else comparison = 0;
    }

    return direction === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Computes review status counts across a set of test cases.
 * Guarantees: accepted + edited + rejected + pending = total test cases.
 */
export function computeReviewSummary(testCases: StoredTestCase[]): {
  accepted: number;
  edited: number;
  rejected: number;
  pending: number;
} {
  const summary = { accepted: 0, edited: 0, rejected: 0, pending: 0 };

  for (const tc of testCases) {
    switch (tc.reviewStatus) {
      case 'accepted':
        summary.accepted++;
        break;
      case 'edited':
        summary.edited++;
        break;
      case 'rejected':
        summary.rejected++;
        break;
      case 'pending':
      default:
        summary.pending++;
        break;
    }
  }

  return summary;
}
