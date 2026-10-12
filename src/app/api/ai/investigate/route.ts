/**
 * POST /api/ai/investigate
 *
 * Generates a structured InvestigationReport from a Jira query and persists it.
 * Supports multiple investigation types (reporter, assignee, sprint, release,
 * feature, regression, component, team) and optional date-range filtering.
 *
 * Architecture:
 *   buildJQL → fetchAll → buildInvestigationReportV2 (deterministic engine)
 *   → AI narrative (v2 data only) → persist → return summary + full report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { getAIProviderFor } from '@/lib/ai/providers';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { isAIEnabled } from '@/lib/ai/feature-flags';
import { buildInvestigationReport } from '@/lib/jira/investigation-builder';
import { buildInvestigationReportV2, type InvestigationType, type InvestigationReportV2 } from '@/lib/jira/investigation-engine-v2';
import { quoteJql } from '@/lib/jira/jql';
import type { AIFindings } from '@/types/investigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';
const FIELDS = [
  'summary', 'status', 'priority', 'assignee', 'reporter', 'created', 'updated',
  'resolutiondate', 'issuetype', 'labels', 'customfield_10103', 'customfield_10201', 'customfield_10237',
  'resolution', 'issuelinks', 'components', 'fixVersions', 'versions', 'description',
];

const VALID_TYPES: InvestigationType[] = [
  'reporter', 'assignee', 'sprint', 'release', 'feature', 'regression', 'component', 'team',
];

interface InvestigateParams {
  type: InvestigationType;
  name: string | null;
  target: string | null;
  days: number | null;
  from: string | null;
  to: string | null;
}

// ─── Detection helpers ────────────────────────────────────────────────────────
function detectType(question: string, explicit?: string): InvestigationType {
  if (explicit && (VALID_TYPES as string[]).includes(explicit)) return explicit as InvestigationType;
  const q = question.toLowerCase();
  if (/\bregression\b/.test(q)) return 'regression';
  if (/\bsprint\b/.test(q)) return 'sprint';
  if (/\bcomponent\b/.test(q)) return 'component';
  if (/\brelease\b|\bfix ?version\b/.test(q)) return 'release';
  return 'reporter';
}

function extractTarget(question: string): string | null {
  const m = question.match(/(?:sprint|component|release|fix ?version|version|team|feature)\s+"([^"]+)"/i)
    || question.match(/(?:sprint|component|release|fix ?version|version|team|feature)\s+([A-Za-z0-9][\w .\-]{1,40})/i);
  return m?.[1]?.trim() || null;
}

// ─── Name extraction — same regex as jira-insights/route.ts ──────────────────
function extractName(question: string): string | null {
  const quoted = question.match(/(?:alias|investigate|about|analyze|who is|what about|postmortem on|postmortem|full postmortem on)\s+"([^"]+)"/i);
  if (quoted) return quoted[1];
  const unquoted = question.match(/(?:alias|about|from|investigate|analyze|who is|what about|postmortem on|postmortem|full postmortem on)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i);
  return unquoted?.[1] || null;
}

// ─── JQL builder — type + date-range aware ───────────────────────────────────
function buildJQL(params: InvestigateParams): string {
  const parts = [`project = ${PROJECT_KEY}`];
  const nameQ = params.name ? quoteJql(params.name) : null;
  const targetQ = params.target ? quoteJql(params.target) : null;

  switch (params.type) {
    case 'reporter':
      if (nameQ) parts.push(`(reporter = ${nameQ} OR assignee = ${nameQ})`);
      break;
    case 'assignee':
      if (nameQ) parts.push(`assignee = ${nameQ}`);
      break;
    case 'component':
      if (targetQ) parts.push(`component = ${targetQ}`);
      break;
    case 'sprint':
      parts.push(targetQ ? `sprint = ${targetQ}` : 'sprint in openSprints()');
      break;
    case 'release':
      if (targetQ) parts.push(`fixVersion = ${targetQ}`);
      break;
    case 'team':
      parts.push(targetQ ? `assignee in membersOf(${targetQ})` : 'assignee is not EMPTY');
      break;
    case 'feature':
      parts.push('issuetype in (Story, Epic)');
      if (targetQ) parts.push(`text ~ ${targetQ}`);
      break;
    case 'regression':
      parts.push('issuetype = Bug');
      if (targetQ) parts.push(`text ~ ${targetQ}`);
      else parts.push('(labels = regression OR summary ~ "regression")');
      break;
    default:
      parts.push('issuetype = Bug');
  }

  // Date range: explicit from/to wins, else trailing N days.
  if (params.from || params.to) {
    if (params.from) parts.push(`created >= "${params.from}"`);
    if (params.to) parts.push(`created <= "${params.to}"`);
  } else if (params.days) {
    parts.push(`created >= -${params.days}d`);
  }

  return `${parts.join(' AND ')} ORDER BY created DESC`;
}

// ─── Cursor-paginated Jira fetch ─────────────────────────────────────────────
async function fetchAll(jql: string, maxPages = 20): Promise<any[]> {
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

// ─── AI narrative — built from the deterministic v2 report ───────────────────
async function generateAINarrative(
  report: InvestigationReportV2,
  provider: ReturnType<typeof getAIProviderFor>
): Promise<{ executiveSummary: string; nextSteps: string[]; generatedFrom: 'ai' | 'fallback' }> {
  const topPairs = report.findings.duplicatePairs
    .filter(p => p.confidenceLabel === 'CONFIRMED' || p.confidenceLabel === 'LIKELY')
    .slice(0, 5)
    .map(p => `${p.issueA}↔${p.issueB} (${p.confidenceLabel})`)
    .join(', ') || 'none';

  const unusual = report.findings.velocity.unusualDays
    .slice(0, 3)
    .map(d => `${d.date}:${d.count}`)
    .join(', ') || 'none';

  const platforms = report.findings.platformCoverage
    .slice(0, 5)
    .map(p => `${p.platform} ${p.percentage}%`)
    .join(', ') || 'none';

  const rc = report.findings.reportingCharacteristics;

  const prompt = `You are a QA forensics analyst. Write an evidence-grounded investigation narrative.
Use ONLY the numbers provided — never invent figures or ticket keys.

SCOPE: ${report.metadata.scope} (type: ${report.investigationType})
ISSUES ANALYZED: ${report.metadata.totalIssuesAnalyzed}
DETERMINISTIC RISK: ${report.metadata.riskLevel} (score ${report.metadata.investigationScore}/100)
RISK DRIVERS: ${report.metadata.verdictReason}

FACTS:
- Status counts: ${JSON.stringify(report.facts.statusCounts)}
- Priority counts: ${JSON.stringify(report.facts.priorityCounts)}
- Data completeness: ${report.dataQuality.overallCompleteness}%
${rc ? `- Acceptance rate: ${Math.round(rc.acceptanceRate * 100)}% | Invalid: ${rc.invalid} | By design: ${rc.byDesign} | Duplicates: ${rc.confirmed}` : ''}
- High-confidence duplicate pairs: ${topPairs}
- Unusual filing days (date:count): ${unusual}
- Platform coverage: ${platforms}
- Evidence findings: ${report.findings.evidence.map(e => e.title).join(' | ') || 'none'}

Write ONLY JSON:
{"executiveSummary":"3-5 sentences for a QA lead, referencing the real figures above and what they mean.","nextSteps":["action 1","action 2","action 3","action 4"]}`;

  try {
    const modelName = provider.name === 'nvidia'
      ? (process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b')
      : 'gemini-2.0-flash-lite';
    const result = await withTokenTracking(
      'jira-insights',
      provider.name,
      modelName,
      () => provider.askAI({
        systemPrompt: 'You are a QA forensics analyst. Output only valid JSON. Never invent numbers.',
        history: [],
        question: prompt,
      }),
      { question: `investigation narrative for ${report.metadata.scope}` }
    );

    let cleaned = result.answer.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);

    const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [];
    return {
      executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : '',
      nextSteps: nextSteps.length ? nextSteps : report.metadata.nextSteps,
      generatedFrom: 'ai',
    };
  } catch {
    const facts = report.facts;
    const openish = Object.entries(facts.statusCounts).filter(([s]) => /new|open|reopen|to do/i.test(s)).reduce((a, [, v]) => a + v, 0);
    return {
      executiveSummary: `Analyzed ${report.metadata.totalIssuesAnalyzed} issues for "${report.metadata.scope}" (${report.investigationType}). ${report.metadata.verdictReason} ${openish} issue(s) remain open. Data completeness is ${report.dataQuality.overallCompleteness}%.`,
      nextSteps: report.metadata.nextSteps,
      generatedFrom: 'fallback',
    };
  }
}

// ─── Persist to Firestore ─────────────────────────────────────────────────────
async function persistInvestigation(report: ReturnType<typeof buildInvestigationReport>): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return;

  try {
    const db = await getCompatDb();
    await db.collection('investigations').doc(report.metadata.id).set({ ...report });
    // Index is written canonically by persistInvestigationV2 (v2 id) to avoid
    // duplicate history entries.
  } catch (err: any) {
    console.error('[investigate] Firestore persist failed:', err.message);
  }
}

// ─── Persist v2 report to Firestore ──────────────────────────────────────────
async function persistInvestigationV2(report: InvestigationReportV2): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return;

  try {
    const db = await getCompatDb();
    await db.collection('investigations_v2').doc(report.metadata.id).set(report);

    const topEvidence = report.findings.evidence[0];
    const confirmedPairs = report.findings.duplicatePairs.filter(
      p => p.confidenceLabel === 'CONFIRMED' || p.confidenceLabel === 'LIKELY'
    ).length;

    await db.collection('investigation_index').doc(report.metadata.id).set({
      id: report.metadata.id,
      schema: '2.1',
      reporterName: report.metadata.scope,
      query: report.metadata.query,
      generatedAt: report.metadata.generatedAt,
      totalIssuesAnalyzed: report.metadata.totalIssuesAnalyzed,
      investigationType: report.investigationType,
      investigationScore: report.metadata.investigationScore,
      riskLevel: report.metadata.riskLevel,
      verdict: report.metadata.verdict,
      verdictReason: report.metadata.verdictReason,
      executiveSummary: report.metadata.aiExecutiveSummary || report.metadata.verdictReason,
      dataCompleteness: report.dataQuality.overallCompleteness,
      evidenceCount: report.findings.evidence.length,
      confirmedDuplicatePairs: confirmedPairs,
      unusualDays: report.findings.velocity.unusualDays.length,
      topFinding: topEvidence ? topEvidence.title : null,
    }, { merge: true });
  } catch (err: any) {
    console.error('[investigate-v2] Firestore persist failed:', err.message);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    if (!await isAIEnabled('jira-insights')) {
      return NextResponse.json({ error: 'Jira AI is currently disabled.' }, { status: 403 });
    }

    if (!JIRA_BASE || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
      return NextResponse.json({ error: 'Jira not configured.' }, { status: 500 });
    }

    const type = detectType(question, body.investigationType);
    const name = extractName(question);
    const target = body.target || extractTarget(question) || null;
    const days = Number.isFinite(Number(body.days)) && Number(body.days) > 0 ? Math.min(Number(body.days), 3650) : null;

    const params: InvestigateParams = {
      type,
      name,
      target,
      days,
      from: typeof body.from === 'string' && body.from ? body.from : null,
      to: typeof body.to === 'string' && body.to ? body.to : null,
    };

    // Person-scoped types need a resolvable name.
    if ((type === 'reporter' || type === 'assignee') && !name) {
      return NextResponse.json({
        error: 'Could not extract a person name from the query. Try: investigate "Name" or postmortem on "Name"',
      }, { status: 400 });
    }
    // Target-scoped types need a target.
    if ((type === 'component' || type === 'release') && !target) {
      return NextResponse.json({
        error: `A ${type} name is required. Try: investigate ${type} "Name"`,
      }, { status: 400 });
    }

    const jql = buildJQL(params);
    const issues = await fetchAll(jql, 20);

    if (issues.length === 0) {
      return NextResponse.json({
        error: `No Jira issues found for this ${type} investigation.`,
      }, { status: 404 });
    }

    const scope = target || name || PROJECT_KEY;

    // ─── Deterministic v2 report (primary) ───────────────────────────────
    const reportV2 = buildInvestigationReportV2(issues, scope, question, jql, type);

    // ─── AI narrative from real v2 data ──────────────────────────────────
    const provider = getAIProviderFor('investigate');
    const narrative = await generateAINarrative(reportV2, provider);
    reportV2.metadata.aiExecutiveSummary = narrative.executiveSummary;
    reportV2.metadata.aiGeneratedFrom = narrative.generatedFrom;
    if (narrative.nextSteps.length) reportV2.metadata.nextSteps = narrative.nextSteps.slice(0, 4);

    const aiFindings: AIFindings = {
      executiveSummary: narrative.executiveSummary,
      verdict: reportV2.metadata.verdict,
      verdictReason: reportV2.metadata.verdictReason,
      nextSteps: reportV2.metadata.nextSteps,
      generatedFrom: narrative.generatedFrom,
    };

    // ─── v1 report kept for backward compatibility / chat stats ──────────
    const report = buildInvestigationReport(issues, scope, question, jql, aiFindings);
    report.metadata.riskLevel = reportV2.metadata.riskLevel;
    report.metadata.investigationScore = reportV2.metadata.investigationScore;

    persistInvestigation(report).catch(err => console.error('[investigate] persist error:', err.message));
    persistInvestigationV2(reportV2).catch(err => console.error('[investigate-v2] persist error:', err.message));

    return NextResponse.json({
      investigationId: reportV2.metadata.id,
      investigationType: type,
      reporterName: scope,
      totalIssues: issues.length,
      investigationScore: reportV2.metadata.investigationScore,
      riskLevel: reportV2.metadata.riskLevel,
      executiveSummary: narrative.executiveSummary,
      verdict: reportV2.metadata.verdict,
      verdictReason: reportV2.metadata.verdictReason,
      nextSteps: reportV2.metadata.nextSteps,
      stats: {
        filed: report.reporter.totalFiled,
        open: report.reporter.open,
        resolved: report.reporter.resolved,
        resolutionRate: report.reporter.resolutionRate,
        maxSpikeDay: report.velocity.maxSingleDay,
        duplicateClusters: reportV2.findings.duplicatePairs.filter(p =>
          p.confidenceLabel === 'CONFIRMED' || p.confidenceLabel === 'LIKELY'
        ).length,
        crossPlatformIncidents: report.sameDayClusters.filter(c => c.isCrossPlatform).length,
        rank: report.teamComparison.reporterRank,
        totalReporters: report.teamComparison.totalReporters,
        dataCompleteness: reportV2.dataQuality.overallCompleteness,
        evidenceCount: reportV2.findings.evidence.length,
      },
      report: reportV2,
      reportV1: report,
    });
  } catch (err: any) {
    console.error('[investigate]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── GET /api/ai/investigate?id=xxx — fetch persisted report ──────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
    }

    const db = await getCompatDb();

    // Prefer the v2 report (canonical), fall back to v1 for older records.
    const docV2 = await db.collection('investigations_v2').doc(id).get();
    if (docV2.exists) {
      return NextResponse.json({ report: docV2.data() });
    }

    const doc = await db.collection('investigations').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });

    return NextResponse.json({ report: doc.data() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
