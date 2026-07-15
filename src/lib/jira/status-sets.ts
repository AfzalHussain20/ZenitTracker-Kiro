/**
 * Jira Status Sets — single source of truth.
 *
 * Previously defined separately in:
 *   - jira-insights/route.ts
 *   - investigation-builder.ts
 *   - analytics/bugs/page.tsx
 *   - useJiraKPI.ts
 *
 * All of those should import from here to prevent divergence.
 */

export const CLOSED_SET = new Set([
  'done', 'closed', 'resolved', 'live', 'fixed', 'qa verified', 'by design',
  'not an issue', 'expected behaviour', 'not reproducing', 'qa completed',
  'dev completed', 'completed', 'infra completed', 'verified', 'released',
  'deployed', 'deferred', 'change', 'changed', 'duplicate', "won't do",
]);

export const IN_PROGRESS_SET = new Set([
  'in progress', 'inprogress', 'in development', 'testing', 'qa',
  'in review', 'code review', 'uat', 'staging', 'retest', 'reopen',
]);

export const OPEN_SET = new Set([
  'open', 'to do', 'new', 'reopen',
]);

/** Classify a Jira status string into one of three categories */
export function classifyStatus(status: string): 'open' | 'in_progress' | 'closed' {
  const s = status.toLowerCase().trim();
  if (CLOSED_SET.has(s)) return 'closed';
  if (IN_PROGRESS_SET.has(s)) return 'in_progress';
  return 'open';
}
