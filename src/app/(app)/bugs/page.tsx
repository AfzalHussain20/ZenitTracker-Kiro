import { redirect } from 'next/navigation';

/**
 * Legacy duplicate of the Jira KPI dashboard. `/analytics/bugs` is the
 * maintained superset (per-person/team KPIs, priority breakdown, trends, story
 * points, live view), so this route permanently forwards there rather than
 * keeping a second 1,300-line copy in sync.
 */
export default function LegacyBugsRedirect() {
  redirect('/analytics/bugs');
}
