import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/providers';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { isAIEnabled } from '@/lib/ai/feature-flags';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';
const FIELDS = ['summary', 'status', 'priority', 'assignee', 'reporter', 'created', 'updated', 'resolutiondate', 'issuetype', 'labels', 'customfield_10103', 'customfield_10201', 'customfield_10237'];

interface JiraInsightsRequest {
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

const SYSTEM_PROMPT = `You are a forensic Jira intelligence analyst for the Zenit QA team. You have access to raw Jira data and must provide precise, actionable analysis.

Your capabilities:
- Detect suspicious patterns: rapid bug filing, duplicate-like bugs, bugs with minimal reproduction steps
- Surface exact numbers, names, percentages — never approximate when you have data
- Identify outliers: who files the most vs resolves the least, unusual time patterns, same reporter/platform combinations
- Call out gaming patterns: rapid filing sprees, single-platform focus, unusually high counts in short periods
- Provide detailed breakdowns by person, platform, priority, status
- Flag specific ticket IDs when relevant

For POSTMORTEM / deep investigation queries, your job is to:
1. Summarize all key findings from the structured data provided
2. Call out the SAME-DAY MULTI-PLATFORM section — explain what it means (filing the same bug title across platforms on the same day to inflate counts)
3. Call out SAME-TITLE REPEAT FILINGS — these are potential duplicate bugs
4. Explain the VELOCITY SPIKES — what triggered them and what it means
5. Give a VERDICT with risk level: Low / Medium / High / Critical
6. Give concrete NEXT STEPS for a QA lead to investigate or escalate

Response rules:
- Lead with the key finding in one sentence
- Use the structured data as-is — do not make up numbers
- Show exact bug counts and ticket IDs from the data
- Plain text only — no markdown headers, no code blocks
- End with "Verdict: [Low/Medium/High/Critical] — [one line reason]"
- Then "Next Steps: [3 bullet points for QA lead]"

You have access to the following raw Jira data for this query:`;

function buildJQL(question: string): string {
  const q = question.toLowerCase();
  const clauses: string[] = [`project = ${PROJECT_KEY}`];

  // ─── Name/alias extraction — try quoted first, then unquoted ─────────────
  // Handles: investigate alias "Tamil Arasi" and investigate alias Tamil Arasi
  const quotedNameMatch = question.match(/(?:alias|investigate|about|analyze|who is|what about|postmortem on|postmortem)\s+"([^"]+)"/i);
  const unquotedNameMatch = !quotedNameMatch && question.match(/(?:alias|about|from|investigate|analyze|who is|what about|postmortem on|postmortem)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i);
  const extractedName = quotedNameMatch?.[1] || unquotedNameMatch?.[1] || null;

  // If this is a person-investigation query, skip most other filters
  // to avoid over-constraining the JQL and getting zero results
  const isPersonQuery = !!extractedName || /\bwho\b|\balias\b|\bperson\b|\breporter\b|\bassignee\b/i.test(question);

  if (extractedName) {
    clauses.push(`(reporter = "${extractedName}" OR assignee = "${extractedName}")`);
    // Jira: use = not ~ for user fields (~ is for text fields only)
    // unless the question explicitly requests a time filter
    const hasExplicitTime = /this sprint|last sprint|today|this week|this month|this quarter/i.test(question);
    if (!hasExplicitTime) {
      // No time filter — return all-time data for proper forensic analysis
      return clauses.join(' AND ') + ' ORDER BY created DESC';
    }
  }

  // ─── Time ranges (only applied when not a broad alias investigation) ──────
  if (q.includes('this sprint') || q.includes('current sprint')) clauses.push('sprint in openSprints()');
  else if (q.includes('last sprint')) clauses.push('sprint in closedSprints()');
  else if (q.includes('today')) clauses.push('created >= startOfDay()');
  else if (q.includes('this week') || q.includes('past 7') || q.includes('last 7')) clauses.push('created >= -7d');
  else if (q.includes('this month') || q.includes('past 30') || q.includes('last 30') || q.includes('last month')) clauses.push('created >= -30d');
  else if (q.includes('this quarter') || q.includes('past 90') || q.includes('last 90')) clauses.push('created >= -90d');

  // ─── Issue type (skip for person queries — we want all types) ─────────────
  if (!isPersonQuery) {
    // Be careful: "bugs" in a general question is fine, but don't apply
    // issuetype=Bug for open-ended questions about people
    const hasBugWord = /\bbugs?\b/.test(q) && !q.includes('story') && !q.includes('feature');
    if (hasBugWord) clauses.push('issuetype = Bug');
    else if (/\bstories?\b/.test(q)) clauses.push('issuetype = Story');
  }

  // ─── Priority ─────────────────────────────────────────────────────────────
  if (/\bp[0-]?1\b|critical|highest priority/.test(q)) clauses.push('priority = Highest');
  else if (/\bp[0-]?2\b|high priority/.test(q)) clauses.push('priority = High');

  // ─── Status ───────────────────────────────────────────────────────────────
  if (/\bunresolved\b/.test(q) || (q.includes('open') && !q.includes('open bugs'))) {
    clauses.push('resolution = Unresolved');
  } else if (/\bresolved\b|\bclosed\b/.test(q)) {
    clauses.push('resolution != Unresolved');
  }

  return clauses.join(' AND ') + ' ORDER BY created DESC';
}

async function fetchAll(jql: string, maxPages = 5): Promise<any[]> {
  const all: any[] = [];
  let nextPageToken: string | null = null;
  const encodedJql = encodeURIComponent(jql);
  const fieldsParam = FIELDS.join(',');

  for (let page = 0; page < maxPages; page++) {
    let url = `${JIRA_BASE}/rest/api/3/search/jql?jql=${encodedJql}&maxResults=100&fields=${fieldsParam}`;
    if (nextPageToken) url += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${JIRA_AUTH()}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) break;
    const data = await res.json();
    all.push(...(data.issues || []));
    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return all;
}

function buildDeepAnalysis(issues: any[], question: string): string {
  const q = question.toLowerCase();

  // Per-person stats
  const reporterStats: Record<string, { filed: number; open: number; resolved: number; platforms: Set<string>; priorities: Record<string, number>; types: Record<string, number>; recentDays: Record<string, number> }> = {};
  const assigneeStats: Record<string, { assigned: number; resolved: number; open: number }> = {};

  const OPEN_SET = new Set(['open', 'to do', 'new', 'reopen', 'in progress', 'inprogress']);
  const CLOSED_SET = new Set(['done', 'closed', 'resolved', 'live', 'fixed', 'qa verified', 'by design']);
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const issue of issues) {
    const f = issue.fields;
    const reporter = f.reporter?.displayName || 'Unknown';
    const assignee = f.assignee?.displayName;
    const status = (f.status?.name || '').toLowerCase();
    const priority = f.priority?.name || 'Unknown';
    const type = f.issuetype?.name || 'Unknown';
    const platform = f.customfield_10103?.[0]?.value || 'Unknown';
    const createdTs = new Date(f.created).getTime();
    const dayKey = f.created?.substring(0, 10) || '';

    // Reporter stats
    if (!reporterStats[reporter]) {
      reporterStats[reporter] = { filed: 0, open: 0, resolved: 0, platforms: new Set(), priorities: {}, types: {}, recentDays: {} };
    }
    const rs = reporterStats[reporter];
    rs.filed++;
    if (OPEN_SET.has(status)) rs.open++;
    if (CLOSED_SET.has(status)) rs.resolved++;
    rs.platforms.add(platform);
    rs.priorities[priority] = (rs.priorities[priority] || 0) + 1;
    rs.types[type] = (rs.types[type] || 0) + 1;
    if (createdTs >= oneWeekAgo) rs.recentDays[dayKey] = (rs.recentDays[dayKey] || 0) + 1;

    // Assignee stats
    if (assignee) {
      if (!assigneeStats[assignee]) assigneeStats[assignee] = { assigned: 0, resolved: 0, open: 0 };
      const as = assigneeStats[assignee];
      as.assigned++;
      if (CLOSED_SET.has(status)) as.resolved++;
      if (OPEN_SET.has(status)) as.open++;
    }
  }

  const totalIssues = issues.length;
  const totalReporters = Object.keys(reporterStats).length;
  const avgPerReporter = totalReporters > 0 ? (totalIssues / totalReporters).toFixed(1) : '0';
  const totalOpen = issues.filter(i => OPEN_SET.has((i.fields.status?.name || '').toLowerCase())).length;
  const totalClosed = issues.filter(i => CLOSED_SET.has((i.fields.status?.name || '').toLowerCase())).length;
  const resolutionRate = totalIssues > 0 ? Math.round((totalClosed / totalIssues) * 100) : 0;

  // Status breakdown
  const statusMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const platformMap: Record<string, number> = {};

  for (const issue of issues) {
    const f = issue.fields;
    const s = f.status?.name || 'Unknown';
    const p = f.priority?.name || 'Unknown';
    const t = f.issuetype?.name || 'Unknown';
    const pl = f.customfield_10103?.[0]?.value || 'Unknown';
    statusMap[s] = (statusMap[s] || 0) + 1;
    priorityMap[p] = (priorityMap[p] || 0) + 1;
    typeMap[t] = (typeMap[t] || 0) + 1;
    platformMap[pl] = (platformMap[pl] || 0) + 1;
  }

  const top = (obj: Record<string, number>, n = 8) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

  // Sort reporters by filed count
  const sortedReporters = Object.entries(reporterStats).sort((a, b) => b[1].filed - a[1].filed);
  const sortedAssignees = Object.entries(assigneeStats).sort((a, b) => b[1].assigned - a[1].assigned);

  // Detect alias-specific investigation — handle both quoted and unquoted names
  const quotedAlias = question.match(/(?:alias|investigate|about|analyze|who is|what about|fishy|suspicious|postmortem|scam|pattern)\s+"([^"]+)"/i);
  const unquotedAlias = !quotedAlias && question.match(/(?:alias|about|from|investigate|analyze|who is|what about|fishy|suspicious|postmortem|scam|pattern)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i);
  const targetAlias = (quotedAlias?.[1] || unquotedAlias?.[1] || '').toLowerCase().trim();

  let aliasDetail = '';
  if (targetAlias) {
    const matched = Object.entries(reporterStats).find(([name]) => name.toLowerCase().includes(targetAlias));
    if (matched) {
      const [name, stats] = matched;

      // Get all issues filed by this person for deep analysis
      const personIssues = issues.filter(i =>
        (i.fields.reporter?.displayName || '').toLowerCase().includes(targetAlias)
      );

      const resRate = stats.filed > 0 ? Math.round((stats.resolved / stats.filed) * 100) : 0;
      const teamAvgNum = parseFloat(avgPerReporter);
      const filedVsAvg = stats.filed > teamAvgNum * 2 ? '⚠ ABOVE AVERAGE (2x+)' : stats.filed > teamAvgNum ? 'Above average' : 'Below average';
      const recentTotal = Object.values(stats.recentDays).reduce((a, b) => a + b, 0);
      const recentDayCount = Object.keys(stats.recentDays).length;
      const avgPerDay = recentDayCount > 0 ? (recentTotal / recentDayCount).toFixed(1) : '0';

      // ── All-time daily rate ────────────────────────────────────────────────
      const allTimeDays: Record<string, number> = {};
      personIssues.forEach(i => {
        const d = i.fields.created?.substring(0, 10) || '';
        if (d) allTimeDays[d] = (allTimeDays[d] || 0) + 1;
      });
      const totalActiveDays = Object.keys(allTimeDays).length;
      const allTimeAvgPerDay = totalActiveDays > 0 ? (personIssues.length / totalActiveDays).toFixed(1) : '0';

      // ── Spike detection — top 10 highest days ─────────────────────────────
      const topSpikeDays = Object.entries(allTimeDays)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // ── Same-day multi-platform detection ─────────────────────────────────
      // Group by date, then check if same/similar titles appear across platforms
      type DayEntry = { summary: string; platform: string; key: string };
      const issuesByDay: Record<string, DayEntry[]> = {};
      personIssues.forEach(i => {
        const d = i.fields.created?.substring(0, 10) || '';
        const summary = (i.fields.summary || '').trim();
        const platform = i.fields.customfield_10103?.[0]?.value || 'Unknown';
        if (!issuesByDay[d]) issuesByDay[d] = [];
        issuesByDay[d].push({ summary, platform, key: i.key });
      });

      // Find days where multiple bugs have very similar titles (first 40 chars match)
      const suspiciousDays: string[] = [];
      const sameDayMultiPlatform: string[] = [];

      Object.entries(issuesByDay).forEach(([day, dayIssues]) => {
        if (dayIssues.length < 3) return;

        // Check for similar titles (strip platform/version info, compare base text)
        const normalise = (s: string) => s.toLowerCase()
          .replace(/\b(v\d+[\.\d]*|version\s*\d+|720p|1080p|preprod|prod|production|pre-production)\b/gi, '')
          .replace(/\|\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50);

        const normTitles = dayIssues.map(i => ({ norm: normalise(i.summary), ...i }));

        // Group by normalised prefix
        const titleGroups: Record<string, typeof normTitles> = {};
        normTitles.forEach(item => {
          const prefix = item.norm.substring(0, 35);
          (titleGroups[prefix] = titleGroups[prefix] || []).push(item);
        });

        const duplicateGroups = Object.values(titleGroups).filter(g => g.length >= 2);
        if (duplicateGroups.length > 0) {
          duplicateGroups.forEach(group => {
            const platforms = [...new Set(group.map(g => g.platform))];
            if (platforms.length >= 2) {
              sameDayMultiPlatform.push(
                `  ${day} — "${group[0].summary.substring(0, 60)}" filed across: ${platforms.join(', ')} (${group.length} bugs)`
              );
            } else {
              suspiciousDays.push(
                `  ${day} — Similar title filed ${group.length}x: "${group[0].summary.substring(0, 55)}..."`
              );
            }
          });
        }
      });

      // ── Duplicate title detection across all time ──────────────────────────
      const titleMap: Record<string, string[]> = {};
      personIssues.forEach(i => {
        const norm = (i.fields.summary || '')
          .toLowerCase()
          .replace(/\b(v\d+[\.\d]*|version\s*\d+|720p|1080p|preprod|prod)\b/gi, '')
          .replace(/\|\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50);
        (titleMap[norm] = titleMap[norm] || []).push(i.key);
      });
      const duplicateTitles = Object.entries(titleMap)
        .filter(([, keys]) => keys.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

      // ── Platform abuse detection ───────────────────────────────────────────
      const platformByDay: Record<string, Set<string>> = {};
      personIssues.forEach(i => {
        const d = i.fields.created?.substring(0, 10) || '';
        const pl = i.fields.customfield_10103?.[0]?.value || 'Unknown';
        if (!platformByDay[d]) platformByDay[d] = new Set();
        platformByDay[d].add(pl);
      });
      const multiPlatformDays = Object.entries(platformByDay)
        .filter(([, platforms]) => platforms.size >= 4)
        .sort((a, b) => (issuesByDay[b[0]]?.length || 0) - (issuesByDay[a[0]]?.length || 0))
        .slice(0, 5);

      // ── Platform distribution ──────────────────────────────────────────────
      const platformDist: Record<string, number> = {};
      personIssues.forEach(i => {
        const pl = i.fields.customfield_10103?.[0]?.value || 'Unknown';
        platformDist[pl] = (platformDist[pl] || 0) + 1;
      });

      // ── Velocity spike scoring ─────────────────────────────────────────────
      const bugsPerDayValues = Object.values(allTimeDays);
      const medianDay = bugsPerDayValues.sort((a, b) => a - b)[Math.floor(bugsPerDayValues.length / 2)] || 1;
      const maxDay = Math.max(...bugsPerDayValues);

      const spikeWarning = maxDay >= 10 ? `⚠ CRITICAL SPIKE: ${maxDay} bugs in single day (${maxDay / medianDay}x normal)` :
        maxDay >= 5 ? `⚠ NOTABLE SPIKE: ${maxDay} bugs in single day` : '';

      aliasDetail = `
${'═'.repeat(60)}
FORENSIC POSTMORTEM: ${name}
${'═'.repeat(60)}

CORE METRICS
  Total bugs filed:    ${stats.filed} (${filedVsAvg}, team avg: ${avgPerReporter})
  Open / Resolved:     ${stats.open} open | ${stats.resolved} resolved | ${resRate}% resolution rate
  Active days:         ${totalActiveDays} days with at least 1 bug filed
  All-time avg/day:    ${allTimeAvgPerDay} bugs/day (across active days only)
  Last 7-day avg:      ${avgPerDay} bugs/day
  ${spikeWarning}

PLATFORM DISTRIBUTION
${Object.entries(platformDist).sort((a, b) => b[1] - a[1]).map(([p, c]) => `  ${p.padEnd(18)} ${c}`).join('\n')}

TOP 10 FILING SPIKES (highest single-day counts)
${topSpikeDays.map(([d, c]) => `  ${d}: ${c} bugs  ${'█'.repeat(Math.min(c, 30))} ${c >= 8 ? '⚠' : ''}`).join('\n') || '  No spikes detected'}

SAME-DAY MULTI-PLATFORM DUPLICATES${sameDayMultiPlatform.length === 0 ? '\n  None detected' : '\n' + sameDayMultiPlatform.join('\n')}
  ↑ These are the same bug title filed across multiple platforms on the same day.

SAME-TITLE REPEAT FILINGS (possible duplicate bugs)
${duplicateTitles.length === 0 ? '  None detected' : duplicateTitles.map(([title, keys]) => `  [${keys.length}x] "${title.substring(0, 55)}"\n       Keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ' ...' : ''}`).join('\n')}

DAYS WITH 4+ PLATFORMS TESTED (unusual breadth)
${multiPlatformDays.length === 0 ? '  None' : multiPlatformDays.map(([d, platforms]) => `  ${d}: ${platforms.size} platforms | ${issuesByDay[d]?.length || 0} bugs filed that day`).join('\n')}

SUSPICIOUS SAME-DAY TITLE CLUSTERS (same day, same title, same platform)
${suspiciousDays.length === 0 ? '  None detected' : suspiciousDays.slice(0, 5).join('\n')}

RECENT DAILY BREAKDOWN (last 7 days)
${Object.entries(stats.recentDays).sort((a, b) => a[0].localeCompare(b[0])).map(([d, c]) => `  ${d}: ${c} bug${c !== 1 ? 's' : ''}  ${'■'.repeat(Math.min(c, 20))}`).join('\n') || '  No recent activity'}`;
    }
  }

  // Top reporters table
  const reporterTable = sortedReporters.slice(0, 10).map(([name, s]) => {
    const rate = s.filed > 0 ? Math.round((s.resolved / s.filed) * 100) : 0;
    const n = name.length > 20 ? name.substring(0, 18) + '..' : name.padEnd(20);
    return `  ${n} | Filed: ${String(s.filed).padStart(3)} | Open: ${String(s.open).padStart(3)} | Resolved: ${String(s.resolved).padStart(3)} | Rate: ${String(rate).padStart(3)}%`;
  }).join('\n');

  // Top assignee table
  const assigneeTable = sortedAssignees.slice(0, 8).map(([name, s]) => {
    const rate = s.assigned > 0 ? Math.round((s.resolved / s.assigned) * 100) : 0;
    const n = name.length > 20 ? name.substring(0, 18) + '..' : name.padEnd(20);
    return `  ${n} | Assigned: ${String(s.assigned).padStart(3)} | Resolved: ${String(s.resolved).padStart(3)} | Open: ${String(s.open).padStart(3)} | Rate: ${String(rate).padStart(3)}%`;
  }).join('\n');

  return `JIRA ANALYSIS — ${totalIssues} matching issues
${'═'.repeat(50)}
Total:             ${totalIssues}
Open:              ${totalOpen} (${totalIssues > 0 ? Math.round((totalOpen / totalIssues) * 100) : 0}%)
Resolved/Closed:   ${totalClosed} (${resolutionRate}%)
Unique reporters:  ${totalReporters}
Avg bugs/reporter: ${avgPerReporter}

BY STATUS:
${top(statusMap).map(([k, v]) => `  ${k.padEnd(25)} ${v}`).join('\n')}

BY PRIORITY:
${top(priorityMap).map(([k, v]) => `  ${k.padEnd(25)} ${v}`).join('\n')}

BY PLATFORM:
${top(platformMap).map(([k, v]) => `  ${k.padEnd(25)} ${v}`).join('\n')}

TOP REPORTERS (Name | Filed | Open | Resolved | Resolve Rate):
${reporterTable}

TOP ASSIGNEES (Name | Assigned | Resolved | Open | Resolve Rate):
${assigneeTable}
${aliasDetail}
JQL: ${buildJQL(question)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: JiraInsightsRequest = await req.json();
    const { question, history = [] } = body;

    if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 });

    // ─── Feature flag check ───────────────────────────────────────────────
    if (!await isAIEnabled('jira-insights')) {
      return NextResponse.json({ answer: 'Jira AI is currently disabled. Enable it in AI Settings.', issueCount: 0 });
    }

    if (!JIRA_BASE || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
      return NextResponse.json({ answer: 'Jira not configured. Check JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.' });
    }

    const jql = buildJQL(question);

    // Fetch more data for investigative queries — need all bugs to detect duplicates
    const isInvestigation = /alias|fishy|suspicious|gaming|cheat|trick|manipulate|inflate|analyze|investigate|who is|what about|postmortem|scam|pattern|duplicate/i.test(question);
    const issues = await fetchAll(jql, isInvestigation ? 20 : 5); // 20 pages = up to 2000 issues

    if (issues.length === 0) {
      return NextResponse.json({ answer: "No Jira issues found for this query. Try broadening the search — e.g., remove time/status filters.", issueCount: 0 });
    }

    const dataSummary = buildDeepAnalysis(issues, question);
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${dataSummary}`;

    const provider = getAIProvider();
    let result;
    try {
      result = await withTokenTracking(
        'jira-insights',
        provider.name,
        'gemini-2.0-flash-lite',
        () => provider.askAI({ systemPrompt: fullSystemPrompt, history, question }),
        { question }
      );
    } catch (err: any) {
      if (err?.message?.includes('429')) {
        return NextResponse.json({ answer: `AI quota reached. Raw data shows ${issues.length} matching issues. Try again later.`, issueCount: issues.length });
      }
      return NextResponse.json({ answer: 'AI request failed. Raw data was fetched — try again.', issueCount: issues.length });
    }

    return NextResponse.json({ answer: result.answer, issueCount: issues.length, provider: provider.name });
  } catch (err: any) {
    console.error('[jira-insights]', err.message);
    return NextResponse.json({ answer: 'Error: ' + err.message, issueCount: 0 });
  }
}
