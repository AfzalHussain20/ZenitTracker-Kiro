/**
 * POST /api/ai/investigate
 *
 * Generates a structured InvestigationReport JSON from a Jira reporter query.
 * Persists the report to Firestore for the investigation history page.
 * The chat receives a compact summary; the full report is on /investigations/[id].
 *
 * Architecture:
 *   buildJQL (unchanged) → fetchAll (unchanged) → buildInvestigationReport (new JSON)
 *   → AI verdict prompt (focused, ~400 tokens) → persist Firestore → return summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompatDb } from '@/lib/firebase-compat';
import { getAIProviderFor } from '@/lib/ai/providers';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { isAIEnabled } from '@/lib/ai/feature-flags';
import { buildInvestigationReport } from '@/lib/jira/investigation-builder';
import { buildInvestigationReportV2, type InvestigationType } from '@/lib/jira/investigation-engine-v2';
import type { AIFindings, RiskLevel } from '@/types/investigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_AUTH = () => Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SUN';
const FIELDS = [
  // Core fields (existing)
  'summary', 'status', 'priority', 'assignee', 'reporter', 'created', 'updated',
  'resolutiondate', 'issuetype', 'labels', 'customfield_10103', 'customfield_10201', 'customfield_10237',
  // v2 additions (Phase 1 Step 1)
  'resolution',       // Confirmed duplicate detection — CRITICAL
  'issuelinks',       // Linked-as-duplicate signal — CRITICAL
  'components',       // Component-based clustering — HIGH
  'fixVersions',      // Version-based clustering — HIGH
  'versions',         // Affected version — HIGH
  'description',      // Description similarity — MEDIUM
];

// ─── Name extraction — same regex as jira-insights/route.ts ──────────────────
function extractName(question: string): string | null {
  const quoted = question.match(/(?:alias|investigate|about|analyze|who is|what about|postmortem on|postmortem|full postmortem on)\s+"([^"]+)"/i);
  if (quoted) return quoted[1];
  const unquoted = question.match(/(?:alias|about|from|investigate|analyze|who is|what about|postmortem on|postmortem|full postmortem on)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i);
  return unquoted?.[1] || null;
}

// ─── JQL builder — identical to jira-insights/route.ts ───────────────────────
function buildJQL(question: string, name: string): string {
  return `project = ${PROJECT_KEY} AND (reporter = "${name}" OR assignee = "${name}") ORDER BY created DESC`;
}

// ─── Cursor-paginated Jira fetch — identical to jira-insights/route.ts ────────
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

// ─── Focused AI verdict prompt ────────────────────────────────────────────────
async function generateAIFindings(
  report: ReturnType<typeof buildInvestigationReport>,
  provider: ReturnType<typeof getAIProviderFor>
): Promise<AIFindings> {
  const evidenceSummary = report.evidence.map(e =>
    `- ${e.type}: ${e.title} (confidence: ${e.confidence}, severity: ${e.severity})`
  ).join('\n');

  const verdictPrompt = `You are a QA forensics analyst. Below are the pre-computed findings from a Jira investigation engine.

REPORTER: ${report.reporter.name}
INVESTIGATION SCORE: ${report.metadata.investigationScore}/100
RISK LEVEL: ${report.metadata.riskLevel}

KEY METRICS (real data — do not modify):
- Total filed: ${report.reporter.totalFiled} bugs
- Open: ${report.reporter.open} | Resolved: ${report.reporter.resolved} (${report.reporter.resolutionRate}% rate)
- Team avg per person: ${report.teamComparison.teamAvgBugsPerPerson} | Rank: #${report.teamComparison.reporterRank} of ${report.teamComparison.totalReporters}
- Max single-day: ${report.velocity.maxSingleDay} bugs | Spike ratio: ${report.velocity.spikeRatio}x
- Duplicate clusters: ${report.duplicateClusters.length}
- Same-day cross-platform incidents: ${report.sameDayClusters.filter(c => c.isCrossPlatform).length}

EVIDENCE ITEMS:
${evidenceSummary || 'No specific evidence flags generated.'}

Write ONLY:
1. EXECUTIVE_SUMMARY: 2-3 sentences explaining what these numbers mean for a QA lead. Reference real figures above. Do not invent any numbers.
2. VERDICT: One of CRITICAL / HIGH / MEDIUM / LOW
3. VERDICT_REASON: One sentence.
4. NEXT_STEP_1: Specific action with ticket IDs if available.
5. NEXT_STEP_2: Specific action.
6. NEXT_STEP_3: Specific action.

Format as JSON only: {"executiveSummary":"...","verdict":"HIGH","verdictReason":"...","nextSteps":["...","...","..."]}`;

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
        question: verdictPrompt,
      }),
      { question: `investigation verdict for ${report.reporter.name}` }
    );

    let cleaned = result.answer.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);

    return {
      executiveSummary: parsed.executiveSummary || '',
      verdict: (parsed.verdict as RiskLevel) || report.metadata.riskLevel,
      verdictReason: parsed.verdictReason || '',
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3) : [],
      generatedFrom: 'ai',
    };
  } catch {
    return {
      executiveSummary: `${report.reporter.name} has filed ${report.reporter.totalFiled} bugs (rank #${report.teamComparison.reporterRank} of ${report.teamComparison.totalReporters}). Resolution rate is ${report.reporter.resolutionRate}% with ${report.duplicateClusters.length} duplicate clusters and a ${report.velocity.maxSingleDay}-bug peak day.`,
      verdict: report.metadata.riskLevel,
      verdictReason: `Investigation score: ${report.metadata.investigationScore}/100.`,
      nextSteps: [
        `Review duplicate clusters (${report.duplicateClusters.slice(0, 3).map(c => c.ticketIds[0]).join(', ')})`,
        `Investigate same-day multi-platform filings`,
        `Monitor future filing patterns`,
      ],
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

    // Store full report
    await db.collection('investigations').doc(report.metadata.id).set({
      ...report,
      // Convert Sets to arrays for Firestore
      reporter: {
        ...report.reporter,
        platforms: report.reporter.platforms,
      },
    });

    // Store summary index for history list
    await db.collection('investigation_index').doc(report.metadata.id).set({
      id: report.metadata.id,
      reporterName: report.metadata.reporterName,
      query: report.metadata.query,
      generatedAt: report.metadata.generatedAt,
      totalIssuesAnalyzed: report.metadata.totalIssuesAnalyzed,
      investigationScore: report.metadata.investigationScore,
      riskLevel: report.metadata.riskLevel,
      executiveSummary: report.aiFindings.executiveSummary,
      verdict: report.aiFindings.verdict,
    });
  } catch (err: any) {
    console.error('[investigate] Firestore persist failed:', err.message);
  }
}

// ─── Persist v2 report to Firestore ──────────────────────────────────────────
async function persistInvestigationV2(report: ReturnType<typeof buildInvestigationReportV2>): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return;

  try {
    const db = await getCompatDb();

    // Store full v2 report under its own collection to preserve v1 data
    await db.collection('investigations_v2').doc(report.metadata.id).set(report);

    // Update the shared index with v2 data
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

    const name = extractName(question);
    if (!name) {
      return NextResponse.json({
        error: 'Could not extract a person name from the query. Try: investigate "Name" or full postmortem on "Name"',
      }, { status: 400 });
    }

    const jql = buildJQL(question, name);
    const issues = await fetchAll(jql, 20);

    if (issues.length === 0) {
      return NextResponse.json({
        error: `No Jira issues found for "${name}". Check the exact display name.`,
      }, { status: 404 });
    }

    const provider = getAIProviderFor('investigate');

    // Build placeholder report first (needed for AI prompt)
    const placeholderAI: AIFindings = {
      executiveSummary: '',
      verdict: 'MEDIUM',
      verdictReason: '',
      nextSteps: [],
      generatedFrom: 'fallback',
    };
    const report = buildInvestigationReport(issues, name, question, jql, placeholderAI);

    // Generate AI findings from the structured data
    const aiFindings = await generateAIFindings(report, provider);
    report.aiFindings = aiFindings;
    report.metadata.riskLevel = aiFindings.verdict;

    // ─── Build v2 structured report (Phase 1 — runs alongside v1) ────────
    const reportV2 = buildInvestigationReportV2(issues, name, question, jql, 'reporter');

    // Persist in background — store both v1 and v2
    persistInvestigation(report).catch(err => console.error('[investigate] persist error:', err.message));
    persistInvestigationV2(reportV2).catch(err => console.error('[investigate-v2] persist error:', err.message));

    // Return compact response for chat + investigation ID for deep-link
    return NextResponse.json({
      investigationId: reportV2.metadata.id,  // v2 ID is canonical going forward
      reporterName: name,
      totalIssues: issues.length,
      investigationScore: report.metadata.investigationScore,
      riskLevel: report.metadata.riskLevel,
      executiveSummary: aiFindings.executiveSummary,
      verdict: aiFindings.verdict,
      verdictReason: aiFindings.verdictReason,
      nextSteps: aiFindings.nextSteps,
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
      // v2 report is the primary payload for the new report page
      report: reportV2,
      // v1 kept for backward compatibility during transition
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

    const doc = await db.collection('investigations').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });

    return NextResponse.json({ report: doc.data() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
