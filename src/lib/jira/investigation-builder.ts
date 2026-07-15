/**
 * Investigation Builder
 *
 * Converts raw Jira issues into a structured InvestigationReport JSON.
 * This is the structured equivalent of buildDeepAnalysis() in jira-insights/route.ts.
 * The original ASCII string output is preserved for the chat; this is additive.
 *
 * Re-uses the same algorithms:
 * - Same OPEN_SET / CLOSED_SET definitions
 * - Same normalise() for title deduplication
 * - Same spike thresholds
 * - Same platform detection via customfield_10103
 */

import type {
  InvestigationReport, ReporterOverview, TimelineEntry, VelocityAnalysis,
  DuplicateCluster, SameDayCluster, PlatformCluster, Evidence, AIFindings,
  RiskLevel,
} from '@/types/investigation';

function nanoid(len = 8): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(16).padStart(2, '0')).join('').substring(0, len);
}

// ─── Shared with jira-insights/route.ts ──────────────────────────────────────
// These match exactly the sets in the route to avoid divergence
const OPEN_SET = new Set(['open', 'to do', 'new', 'reopen', 'in progress', 'inprogress']);
const CLOSED_SET = new Set(['done', 'closed', 'resolved', 'live', 'fixed', 'qa verified', 'by design',
  'not an issue', 'expected behaviour', 'not reproducing', 'qa completed', 'dev completed',
  'inprogress', 'completed']);

function normalise(s: string): string {
  return s.toLowerCase()
    .replace(/\b(v\d+[\.\d]*|version\s*\d+|720p|1080p|preprod|prod|production|pre-production)\b/gi, '')
    .replace(/\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

function classify(status: string): 'open' | 'in_progress' | 'closed' {
  const s = status.toLowerCase().trim();
  if (CLOSED_SET.has(s)) return 'closed';
  if (OPEN_SET.has(s)) return 'in_progress';
  return 'open';
}

/** Compute investigation score 0–100 based on suspicious signals */
function computeScore(params: {
  resolutionRate: number;
  maxSpikeDay: number;
  duplicateCount: number;
  sameDayCount: number;
  filedVsTeamAvg: number; // reporter count / team avg
}): number {
  let score = 0;

  // Resolution quality (0–20 pts) — lower rate = more suspicious
  score += Math.min(20, Math.round((1 - params.resolutionRate / 100) * 20));

  // Velocity spikes (0–25 pts)
  if (params.maxSpikeDay >= 15) score += 25;
  else if (params.maxSpikeDay >= 10) score += 20;
  else if (params.maxSpikeDay >= 7) score += 15;
  else if (params.maxSpikeDay >= 5) score += 10;
  else score += 5;

  // Duplicates (0–25 pts)
  if (params.duplicateCount >= 5) score += 25;
  else if (params.duplicateCount >= 3) score += 20;
  else if (params.duplicateCount >= 1) score += 10;

  // Same-day cross-platform (0–20 pts)
  if (params.sameDayCount >= 5) score += 20;
  else if (params.sameDayCount >= 2) score += 15;
  else if (params.sameDayCount >= 1) score += 8;

  // Volume vs team avg (0–10 pts)
  if (params.filedVsTeamAvg >= 3) score += 10;
  else if (params.filedVsTeamAvg >= 2) score += 7;
  else if (params.filedVsTeamAvg >= 1.5) score += 4;

  return Math.min(100, score);
}

function scoreToRisk(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

export function buildInvestigationReport(
  issues: any[],
  targetName: string,
  question: string,
  jql: string,
  aiFindings: AIFindings
): InvestigationReport {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // ─── Reporter stats ───────────────────────────────────────────────────────
  const reporterStats: Record<string, {
    filed: number; open: number; resolved: number; recentDays: Record<string, number>;
    platforms: Set<string>; priorities: Record<string, number>; types: Record<string, number>;
    statuses: Record<string, number>;
  }> = {};

  const allReporters = new Set<string>();

  for (const issue of issues) {
    const f = issue.fields;
    const reporter = f.reporter?.displayName || 'Unknown';
    const status = (f.status?.name || '').toLowerCase();
    const platform = f.customfield_10103?.[0]?.value || 'Unknown';
    const priority = f.priority?.name || 'Unknown';
    const type = f.issuetype?.name || 'Unknown';
    const statusName = f.status?.name || 'Unknown';
    const createdTs = new Date(f.created).getTime();
    const dayKey = f.created?.substring(0, 10) || '';

    allReporters.add(reporter);

    if (!reporterStats[reporter]) {
      reporterStats[reporter] = { filed: 0, open: 0, resolved: 0, recentDays: {}, platforms: new Set(), priorities: {}, types: {}, statuses: {} };
    }
    const rs = reporterStats[reporter];
    rs.filed++;
    if (OPEN_SET.has(status)) rs.open++;
    if (CLOSED_SET.has(status)) rs.resolved++;
    rs.platforms.add(platform);
    rs.priorities[priority] = (rs.priorities[priority] || 0) + 1;
    rs.types[type] = (rs.types[type] || 0) + 1;
    rs.statuses[statusName] = (rs.statuses[statusName] || 0) + 1;
    if (createdTs >= oneWeekAgo) rs.recentDays[dayKey] = (rs.recentDays[dayKey] || 0) + 1;
  }

  const totalReporters = allReporters.size;
  const teamAvgPerReporter = totalReporters > 0 ? issues.length / totalReporters : 0;

  // ─── Target person's issues ───────────────────────────────────────────────
  const targetLower = targetName.toLowerCase();
  const personIssues = issues.filter(i =>
    (i.fields.reporter?.displayName || '').toLowerCase().includes(targetLower)
  );

  const targetStats = Object.entries(reporterStats).find(([name]) =>
    name.toLowerCase().includes(targetLower)
  );

  const ts = targetStats?.[1] || { filed: 0, open: 0, resolved: 0, recentDays: {}, platforms: new Set<string>(), priorities: {}, types: {}, statuses: {} };
  const resolutionRate = ts.filed > 0 ? Math.round((ts.resolved / ts.filed) * 100) : 0;

  // ─── Timeline ─────────────────────────────────────────────────────────────
  const allTimeDays: Record<string, number> = {};
  personIssues.forEach(i => {
    const d = i.fields.created?.substring(0, 10) || '';
    if (d) allTimeDays[d] = (allTimeDays[d] || 0) + 1;
  });

  const totalActiveDays = Object.keys(allTimeDays).length;
  const allTimeAvgPerDay = totalActiveDays > 0 ? personIssues.length / totalActiveDays : 0;

  const recentTotal = Object.values(ts.recentDays).reduce((a, b) => a + b, 0);
  const recentDayCount = Object.keys(ts.recentDays).length;
  const last7DayAvgPerDay = recentDayCount > 0 ? recentTotal / recentDayCount : 0;

  // Build all-time sorted days
  const topSpikeDaysRaw = Object.entries(allTimeDays).sort((a, b) => b[1] - a[1]);
  const maxSingleDay = topSpikeDaysRaw[0]?.[1] || 0;
  const sortedValues = Object.values(allTimeDays).sort((a, b) => a - b);
  const medianDay = sortedValues[Math.floor(sortedValues.length / 2)] || 1;

  const timeline: TimelineEntry[] = Object.entries(allTimeDays)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({
      date,
      count,
      isSpikeDay: count >= 8,
      isRecentWeek: new Date(date).getTime() >= oneWeekAgo,
    }));

  // ─── Velocity ─────────────────────────────────────────────────────────────
  const velocity: VelocityAnalysis = {
    topSpikeDays: topSpikeDaysRaw.slice(0, 10).map(([date, count]) => ({
      date, count, isSpike: count >= 8,
    })),
    maxSingleDay,
    medianDay,
    spikeRatio: medianDay > 0 ? Math.round((maxSingleDay / medianDay) * 10) / 10 : 0,
    spikeWarning: maxSingleDay >= 10
      ? `⚠ Critical: ${maxSingleDay} bugs in one day (${(maxSingleDay / medianDay).toFixed(1)}x normal)`
      : maxSingleDay >= 5
      ? `⚠ Notable: ${maxSingleDay} bugs in one day`
      : null,
  };

  // ─── Duplicate clusters ───────────────────────────────────────────────────
  const titleMap: Record<string, { key: string; platform: string; date: string; summary: string }[]> = {};
  personIssues.forEach(i => {
    const norm = normalise(i.fields.summary || '');
    const platform = i.fields.customfield_10103?.[0]?.value || 'Unknown';
    const date = i.fields.created?.substring(0, 10) || '';
    (titleMap[norm] = titleMap[norm] || []).push({ key: i.key, platform, date, summary: i.fields.summary || '' });
  });

  const duplicateClusters: DuplicateCluster[] = Object.entries(titleMap)
    .filter(([, entries]) => entries.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15)
    .map(([title, entries]): DuplicateCluster => {
      const platforms = [...new Set(entries.map(e => e.platform))];
      const count = entries.length;
      return {
        id: nanoid(8),
        normalisedTitle: title,
        count,
        ticketIds: entries.map(e => e.key),
        platforms,
        dates: entries.map(e => e.date).sort(),
        confidence: count >= 5 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
        engineeringImpact: count >= 5 ? 'BLOCKER' : count >= 3 ? 'MAJOR' : 'MINOR',
      };
    });

  // ─── Same-day cross-platform clusters ─────────────────────────────────────
  const issuesByDay: Record<string, { summary: string; platform: string; key: string }[]> = {};
  personIssues.forEach(i => {
    const d = i.fields.created?.substring(0, 10) || '';
    const platform = i.fields.customfield_10103?.[0]?.value || 'Unknown';
    if (!issuesByDay[d]) issuesByDay[d] = [];
    issuesByDay[d].push({ summary: i.fields.summary || '', platform, key: i.key });
  });

  const sameDayClusters: SameDayCluster[] = [];
  Object.entries(issuesByDay).forEach(([day, dayIssues]) => {
    if (dayIssues.length < 2) return;
    const titleGroups: Record<string, typeof dayIssues> = {};
    dayIssues.forEach(b => {
      const prefix = normalise(b.summary).substring(0, 35);
      (titleGroups[prefix] = titleGroups[prefix] || []).push(b);
    });
    Object.values(titleGroups).forEach(group => {
      if (group.length < 2) return;
      const platforms = [...new Set(group.map(g => g.platform))];
      sameDayClusters.push({
        date: day,
        titleSnippet: group[0].summary.substring(0, 70),
        platforms,
        tickets: group.map(g => ({ key: g.key, platform: g.platform, summary: g.summary.substring(0, 80) })),
        isCrossPlatform: platforms.length >= 2,
      });
    });
  });

  const sortedSameDayClusters = sameDayClusters
    .sort((a, b) => b.tickets.length - a.tickets.length)
    .slice(0, 10);

  // ─── Platform clusters ─────────────────────────────────────────────────────
  const platformDist: Record<string, number> = {};
  personIssues.forEach(i => {
    const pl = i.fields.customfield_10103?.[0]?.value || 'Unknown';
    platformDist[pl] = (platformDist[pl] || 0) + 1;
  });

  const platformClusters: PlatformCluster[] = Object.entries(platformDist)
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: ts.filed > 0 ? Math.round((count / ts.filed) * 100) : 0,
      isSingleFocus: ts.filed > 0 && count / ts.filed > 0.6,
    }));

  // ─── Evidence ─────────────────────────────────────────────────────────────
  const evidence: Evidence[] = [];

  if (velocity.spikeWarning) {
    const topDay = velocity.topSpikeDays[0];
    evidence.push({
      id: nanoid(8),
      type: 'SPIKE',
      title: `Filing spike: ${topDay.count} bugs on ${topDay.date}`,
      description: `Peak single-day filing rate is ${velocity.spikeRatio}x the person's normal daily average. This is a ${topDay.count >= 10 ? 'critical' : 'notable'} anomaly.`,
      confidence: topDay.count >= 10 ? 'HIGH' : 'MEDIUM',
      metrics: [
        { label: 'Peak day count', value: topDay.count },
        { label: 'Normal median', value: medianDay },
        { label: 'Spike ratio', value: `${velocity.spikeRatio}x` },
      ],
      relatedTickets: personIssues
        .filter(i => i.fields.created?.startsWith(topDay.date))
        .map(i => i.key)
        .slice(0, 10),
      severity: topDay.count >= 10 ? 'CRITICAL' : 'HIGH',
    });
  }

  if (duplicateClusters.length > 0) {
    const topCluster = duplicateClusters[0];
    evidence.push({
      id: nanoid(8),
      type: 'DUPLICATE',
      title: `${duplicateClusters.length} duplicate title cluster${duplicateClusters.length > 1 ? 's' : ''} detected`,
      description: `The same bug title was filed ${topCluster.count} times with minor variations. Top cluster: "${topCluster.normalisedTitle.substring(0, 60)}..."`,
      confidence: topCluster.confidence,
      metrics: [
        { label: 'Total clusters', value: duplicateClusters.length },
        { label: 'Largest cluster', value: topCluster.count },
        { label: 'Platforms in largest', value: topCluster.platforms.join(', ') },
      ],
      relatedTickets: topCluster.ticketIds.slice(0, 10),
      severity: topCluster.count >= 5 ? 'HIGH' : 'MEDIUM',
    });
  }

  const crossPlatformClusters = sortedSameDayClusters.filter(c => c.isCrossPlatform);
  if (crossPlatformClusters.length > 0) {
    const top = crossPlatformClusters[0];
    evidence.push({
      id: nanoid(8),
      type: 'CROSS_PLATFORM',
      title: `Same bug filed across ${top.platforms.length} platforms on ${top.date}`,
      description: `"${top.titleSnippet}" was filed on ${top.platforms.join(', ')} on the same day. This pattern suggests copy-paste bug inflation rather than genuine multi-platform testing.`,
      confidence: 'HIGH',
      metrics: [
        { label: 'Platforms', value: top.platforms.join(', ') },
        { label: 'Date', value: top.date },
        { label: 'Ticket count', value: top.tickets.length },
      ],
      relatedTickets: top.tickets.map(t => t.key),
      severity: 'HIGH',
    });
  }

  if (resolutionRate < 30 && ts.filed >= 10) {
    evidence.push({
      id: nanoid(8),
      type: 'RESOLUTION',
      title: `Low resolution rate: ${resolutionRate}%`,
      description: `Only ${ts.resolved} of ${ts.filed} filed bugs have been resolved. This could indicate low-quality bugs that cannot be reproduced, or bugs that are invalid but not formally rejected.`,
      confidence: 'MEDIUM',
      metrics: [
        { label: 'Filed', value: ts.filed },
        { label: 'Resolved', value: ts.resolved },
        { label: 'Open', value: ts.open },
        { label: 'Rate', value: `${resolutionRate}%` },
      ],
      relatedTickets: [],
      severity: resolutionRate < 20 ? 'HIGH' : 'MEDIUM',
    });
  }

  // ─── Investigation score ──────────────────────────────────────────────────
  const investigationScore = computeScore({
    resolutionRate,
    maxSpikeDay: maxSingleDay,
    duplicateCount: duplicateClusters.length,
    sameDayCount: crossPlatformClusters.length,
    filedVsTeamAvg: teamAvgPerReporter > 0 ? ts.filed / teamAvgPerReporter : 1,
  });
  const riskLevel = scoreToRisk(investigationScore);

  // ─── Team comparison ──────────────────────────────────────────────────────
  const sortedByFiled = Object.entries(reporterStats).sort((a, b) => b[1].filed - a[1].filed);
  const reporterRank = sortedByFiled.findIndex(([name]) => name.toLowerCase().includes(targetLower)) + 1;
  const teamAvgResolutionRate = totalReporters > 0
    ? Math.round(Object.values(reporterStats).reduce((sum, s) => sum + (s.filed > 0 ? s.resolved / s.filed : 0), 0) / totalReporters * 100)
    : 0;

  // ─── Reporter overview ────────────────────────────────────────────────────
  const reporter: ReporterOverview = {
    name: targetStats?.[0] || targetName,
    totalFiled: ts.filed,
    open: ts.open,
    resolved: ts.resolved,
    resolutionRate,
    activeDays: totalActiveDays,
    allTimeAvgPerDay: Math.round(allTimeAvgPerDay * 10) / 10,
    last7DayAvgPerDay: Math.round(last7DayAvgPerDay * 10) / 10,
    teamAvgPerReporter: Math.round(teamAvgPerReporter * 10) / 10,
    vsTeamAvg: ts.filed > teamAvgPerReporter * 2 ? 'above_2x' : ts.filed > teamAvgPerReporter ? 'above' : ts.filed < teamAvgPerReporter ? 'below' : 'at',
    platformCount: [...ts.platforms].length,
    platforms: platformClusters,
    statusBreakdown: Object.entries(ts.statuses).sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count })),
    priorityBreakdown: Object.entries(ts.priorities).sort((a, b) => b[1] - a[1]).map(([priority, count]) => ({ priority, count })),
    typeBreakdown: Object.entries(ts.types).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
  };

  const report: InvestigationReport = {
    metadata: {
      id: nanoid(12),
      reporterName: reporter.name,
      query: question,
      generatedAt: new Date().toISOString(),
      totalIssuesAnalyzed: issues.length,
      jql,
      investigationScore,
      riskLevel,
    },
    reporter,
    timeline,
    velocity,
    duplicateClusters,
    sameDayClusters: sortedSameDayClusters,
    platformClusters,
    evidence,
    aiFindings,
    teamComparison: {
      teamAvgBugsPerPerson: Math.round(teamAvgPerReporter * 10) / 10,
      teamAvgResolutionRate,
      teamTopReporters: sortedByFiled.slice(0, 8).map(([name, s]) => ({
        name,
        count: s.filed,
        rate: s.filed > 0 ? Math.round(s.resolved / s.filed * 100) : 0,
      })),
      reporterRank,
      totalReporters,
    },
  };

  return report;
}
