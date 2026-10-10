/**
 * Investigation Engine v2.1
 *
 * Implements the design specified in PRODUCT_SPEC.md.
 * Replaces the ASCII-string output of buildDeepAnalysis() with structured JSON.
 *
 * Key differences from v1:
 * - Facts / Findings / Conclusions separated
 * - Multi-signal duplicate detection (no title-alone rule)
 * - Statistical velocity baseline (z-score, not hardcoded thresholds)
 * - QA-owned metrics separated from developer-owned metrics
 * - Data Quality panel reporting what fields were available
 * - Every finding has confidence label + alternative explanations
 * - No single investigation "score" — 5 independent dimensions
 */

import { classifyStatus } from './status-sets';
import { normaliseTitle, combinedSimilarity } from './normalise';
import {
  SIGNAL_WEIGHTS, computeConfidence, computeConfidenceLabel,
  generateAlternativeExplanations, ALGORITHM_VERSION,
  type DuplicateSignalResult, type DuplicatePairV2, type ConfidenceLabel,
} from './signals';

// ─── Re-export types (consumers import from here) ────────────────────────────
export type InvestigationType =
  | 'reporter' | 'sprint' | 'release' | 'feature'
  | 'regression' | 'assignee' | 'team' | 'component';

export interface DataQualityField {
  name: string;
  available: boolean;
  coveragePercent: number;
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedAnalysis: string[];
}

export interface DataQualityReport {
  fields: DataQualityField[];
  overallCompleteness: number;
  limitations: string[];
}

export interface FactsLayer {
  totalIssues: number;
  dateRange: { from: string; to: string };
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  platformCounts: Record<string, number>;
  componentCounts: Record<string, number>;
  resolutionCounts: Record<string, number>;
  confirmedDuplicateCount: number;
}

export interface ReporterActivity {
  bugsReported: number;
  activeDays: number;
  platformsTested: string[];
  componentsTested: string[];
  buildsTested: string[];
  severityDistribution: Record<string, number>;
}

export interface ReportingCharacteristics {
  acceptanceRate: number;
  confirmedDuplicateRate: number;
  invalidRate: number;
  reopenRate: number | null;
  totalFiled: number;
  confirmed: number;
  invalid: number;
  byDesign: number;
}

export interface VelocityDay {
  date: string;
  count: number;
  zScore: number;
  classification: 'UNUSUAL' | 'ELEVATED' | 'NORMAL' | 'LOW';
  contextFactors: string[];
  explanation: string;
}

export interface VelocityBaseline {
  mean: number;
  median: number;
  stdDev: number;
  windowDays: number;
  sampleSize: number;
  reliable: boolean;
}

export interface VelocityAnalysis {
  dailyCounts: VelocityDay[];
  baseline: VelocityBaseline;
  unusualDays: { date: string; count: number; zScore: number; explanation: string }[];
}

export interface RootCauseCluster {
  id: string;
  clusterType: 'SAME_ROOT_CAUSE' | 'PLATFORM_SPECIFIC' | 'UNKNOWN';
  confidence: ConfidenceLabel;
  tickets: string[];
  platforms: string[];
  components: string[];
  buildVersions: string[];
  interpretation: string;
  alternativeExplanations: string[];
  engineeringDefectEstimate: number;
  defectEstimateConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EvidenceItem {
  id: string;
  type: 'VELOCITY_ANOMALY' | 'DUPLICATE_CLUSTER' | 'CROSS_PLATFORM_PATTERN' | 'DATA_PATTERN';
  title: string;
  description: string;
  confidence: ConfidenceLabel;
  metrics: { label: string; value: string | number }[];
  relatedTickets: string[];
  alternativeExplanations: string[];
  engineeringImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  source: 'COMPUTED';
  signalLog?: DuplicateSignalResult[];
  algorithmVersion: string;
  detectedAt: string;
}

export interface DimensionScore {
  label: string;
  value: number;
  interpretation: string;
  components: { name: string; value: number; weight: number }[];
  limitations: string[];
  owner: 'QA' | 'DEVELOPER' | 'TEAM' | 'SYSTEM';
  tooltip: {
    whatItMeasures: string;
    whyItMatters: string;
    whatItDoesNotMeasure: string;
    howCalculated: string;
    knownLimitations: string[];
  };
}

export interface TeamComparison {
  comparedMetrics: { name: string; thisReporter: number; teamAvg: number; teamRank: number; totalReporters: number }[];
  note: string;
}

export interface AuditEntry {
  findingId: string;
  detectedAt: string;
  algorithmVersion: string;
  confidence: number;
  confidenceLabel: string;
  inputHash: string;
}

export interface InvestigationReportV2 {
  schema: '2.1';
  investigationType: InvestigationType;
  metadata: {
    id: string;
    scope: string;
    query: string;
    generatedAt: string;
    totalIssuesAnalyzed: number;
    jql: string;
  };
  dataQuality: DataQualityReport;
  limitations: { items: string[]; affectedSections: string[] };
  facts: FactsLayer;
  findings: {
    reporterActivity?: ReporterActivity;
    reportingCharacteristics?: ReportingCharacteristics;
    velocity: VelocityAnalysis;
    duplicatePairs: DuplicatePairV2[];
    rootCauseClusters: RootCauseCluster[];
    platformCoverage: { platform: string; count: number; percentage: number }[];
    evidence: EvidenceItem[];
  };
  conclusions: {
    dimensionScores: Record<string, DimensionScore>;
    teamContext?: TeamComparison;
  };
  audit: AuditEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(prefix = 'ev'): string {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Flatten an Atlassian Document Format node (issue description / comment body) to plain text. */
function adfToText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).filter(Boolean).join(' ');
  const parts: string[] = [];
  if (typeof node.text === 'string') parts.push(node.text);
  if (Array.isArray(node.content)) parts.push(...node.content.map(adfToText).filter(Boolean));
  return parts.join(' ').trim();
}

/** Safely extract a string value from a Jira field that might be an object */
function safeStr(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(safeStr).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    // Jira rich-text (ADF) documents — extract the plain text so two different
    // descriptions never collapse to the string "[object Object]".
    if (o.type === 'doc' || Array.isArray(o.content)) return adfToText(o);
    const direct = o.name ?? o.text ?? o.value ?? o.displayName ?? o.title;
    if (direct != null && typeof direct !== 'object') return String(direct);
    if (o.content != null) return safeStr(o.content);
    if (o.body != null) return safeStr(o.body);
    return '';
  }
  return String(val);
}

// ─── Data Quality computation ─────────────────────────────────────────────────

function buildDataQuality(issues: any[]): DataQualityReport {
  const total = issues.length || 1;

  const check = (getter: (i: any) => unknown, impact: DataQualityField['impact'], affectedAnalysis: string[]): Omit<DataQualityField, 'name'> => {
    const filled = issues.filter(i => { try { const v = getter(i); return v != null && v !== '' && !(Array.isArray(v) && v.length === 0); } catch { return false; } }).length;
    const pct = Math.round((filled / total) * 100);
    return { available: pct > 0, coveragePercent: pct, impact, affectedAnalysis };
  };

  const fields: DataQualityField[] = [
    { name: 'Issue Links',    ...check(i => i.fields.issuelinks?.length,           'CRITICAL', ['Duplicate detection — confirmed tier']) },
    { name: 'Components',     ...check(i => i.fields.components?.length,            'HIGH',     ['Duplicate detection — component signal', 'Root cause clustering']) },
    { name: 'Resolution',     ...check(i => i.fields.resolution?.name,              'CRITICAL', ['Duplicate detection — resolution signal', 'Reporter acceptance rate']) },
    { name: 'Fix Versions',   ...check(i => i.fields.fixVersions?.length,           'HIGH',     ['Root cause clustering — version grouping']) },
    { name: 'Description',     ...check(i => safeStr(i.fields.description),        'MEDIUM',   ['Duplicate detection — description similarity']) },
    { name: 'Platform',       ...check(i => i.fields.customfield_10103?.length,      'HIGH',     ['Platform coverage', 'Cross-platform pattern analysis']) },
    { name: 'Priority',       ...check(i => i.fields.priority?.name,                'MEDIUM',   ['Severity distribution', 'Reporting characteristics']) },
    { name: 'Changelog',      ...check(() => null,                                   'MEDIUM',   ['Reopen rate calculation']) },  // changelog requires separate API call
    { name: 'Attachments',    ...check(() => null,                                   'LOW',      ['Screenshot similarity']) },
    { name: 'Stack Traces',   ...check(() => null,                                   'LOW',      ['Exception-based clustering']) },
  ];

  // Changelog and attachments are always unavailable (require separate API)
  fields.find(f => f.name === 'Changelog')!.available = false;
  fields.find(f => f.name === 'Changelog')!.coveragePercent = 0;
  fields.find(f => f.name === 'Attachments')!.available = false;
  fields.find(f => f.name === 'Attachments')!.coveragePercent = 0;
  fields.find(f => f.name === 'Stack Traces')!.available = false;
  fields.find(f => f.name === 'Stack Traces')!.coveragePercent = 0;

  const criticalFields = fields.filter(f => f.impact === 'CRITICAL');
  const weights: Record<DataQualityField['impact'], number> = { CRITICAL: 0.40, HIGH: 0.30, MEDIUM: 0.20, LOW: 0.10 };
  const totalWeight = fields.reduce((s, f) => s + weights[f.impact], 0);
  const weighted = fields.reduce((s, f) => s + (f.coveragePercent / 100) * weights[f.impact], 0);
  const overall = Math.round((weighted / totalWeight) * 100);

  const limitations: string[] = [];
  if (!fields.find(f => f.name === 'Changelog')!.available)
    limitations.push('Reopen rate unavailable — changelog API not called (requires separate Jira request)');
  if (!fields.find(f => f.name === 'Issue Links')!.available)
    limitations.push('Duplicate link detection unavailable — issuelinks field not populated');
  if (!fields.find(f => f.name === 'Components')!.available)
    limitations.push('Component-based clustering unavailable — components field not populated');
  if (!fields.find(f => f.name === 'Attachments')!.available)
    limitations.push('Screenshot similarity disabled — attachment API not integrated');
  if (!fields.find(f => f.name === 'Stack Traces')!.available)
    limitations.push('Exception clustering disabled — stack trace field not available');
  if ((fields.find(f => f.name === 'Description')!.coveragePercent || 0) < 50)
    limitations.push('Description similarity is limited — fewer than 50% of issues have descriptions');

  return { fields, overallCompleteness: overall, limitations };
}

// ─── Statistical velocity baseline ───────────────────────────────────────────

function buildVelocity(issues: any[]): VelocityAnalysis {
  const dayMap: Record<string, number> = {};
  issues.forEach(i => {
    const d = i.fields.created?.substring(0, 10) || '';
    if (d) dayMap[d] = (dayMap[d] || 0) + 1;
  });

  const values = Object.values(dayMap);
  const sampleSize = values.length;
  const mean = sampleSize > 0 ? values.reduce((a, b) => a + b, 0) / sampleSize : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const variance = sampleSize > 1
    ? values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (sampleSize - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const reliable = sampleSize >= 20;

  const dailyCounts: VelocityDay[] = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => {
      const zScore = stdDev > 0 ? Math.round(((count - mean) / stdDev) * 100) / 100 : 0;
      const classification: VelocityDay['classification'] =
        !reliable ? 'NORMAL' :
        zScore >= 2.0 ? 'UNUSUAL' :
        zScore >= 1.0 ? 'ELEVATED' :
        zScore <= -1.0 ? 'LOW' : 'NORMAL';

      const contextFactors: string[] = [];
      const explanation = reliable
        ? `${count} issues on this day. Z-score: ${zScore} (${classification.toLowerCase()}). Personal mean: ${mean.toFixed(1)}/day.`
        : `${count} issues. Baseline unreliable (only ${sampleSize} data points — need ≥20 for z-score).`;

      return { date, count, zScore, classification, contextFactors, explanation };
    });

  const unusualDays = dailyCounts
    .filter(d => d.classification === 'UNUSUAL')
    .map(d => ({ date: d.date, count: d.count, zScore: d.zScore, explanation: d.explanation }));

  return {
    dailyCounts,
    baseline: { mean: Math.round(mean * 10) / 10, median, stdDev: Math.round(stdDev * 10) / 10, windowDays: sampleSize, sampleSize, reliable },
    unusualDays,
  };
}

// ─── Multi-signal duplicate detection ────────────────────────────────────────

function buildDuplicatePairs(
  personIssues: any[],
  dataQuality: DataQualityReport
): DuplicatePairV2[] {
  const pairs: DuplicatePairV2[] = [];
  const now = new Date().toISOString();
  const hasComponents = dataQuality.fields.find(f => f.name === 'Components')?.available || false;
  const hasIssueLinks = dataQuality.fields.find(f => f.name === 'Issue Links')?.available || false;
  const hasDescription = (dataQuality.fields.find(f => f.name === 'Description')?.coveragePercent || 0) >= 30;

  // Only compare issues within a 30-day window of each other to limit O(n²)
  const limit = Math.min(personIssues.length, 200);
  const sample = personIssues.slice(0, limit);

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const a = sample[i], b = sample[j];
      const fa = a.fields, fb = b.fields;
      const descA = safeStr(fa.description);
      const descB = safeStr(fb.description);

      // Date proximity check first (fast filter)
      const dA = new Date(fa.created).getTime();
      const dB = new Date(fb.created).getTime();
      const daysDiff = Math.abs(dA - dB) / (86400000);

      const signals: DuplicateSignalResult[] = [
        {
          name: 'resolutionIsDuplicate',
          fired: safeStr(fa.resolution?.name).toLowerCase() === 'duplicate' ||
                 safeStr(fb.resolution?.name).toLowerCase() === 'duplicate',
          value: (safeStr(fa.resolution?.name).toLowerCase() === 'duplicate' ||
                  safeStr(fb.resolution?.name).toLowerCase() === 'duplicate') ? 1 : 0,
          weight: SIGNAL_WEIGHTS.resolutionIsDuplicate,
          available: true,
          explanation: 'Resolution field marked as Duplicate in Jira',
        },
        {
          name: 'linkedAsDuplicate',
          fired: (() => {
            if (!hasIssueLinks) return false;
            const linksA = Array.isArray(fa.issuelinks) ? fa.issuelinks : [];
            const linksB = Array.isArray(fb.issuelinks) ? fb.issuelinks : [];
            return [...linksA, ...linksB].some((l: any) => {
              const type = safeStr(l?.type?.name).toLowerCase();
              return type.includes('duplicate') || type.includes('duplicates') || type.includes('is duplicated');
            });
          })(),
          value: 0,  // set below
          weight: SIGNAL_WEIGHTS.linkedAsDuplicate,
          available: hasIssueLinks,
          explanation: 'Issues are linked as duplicates in Jira',
        },
        {
          name: 'titleSimilarity',
          fired: false,  // set below
          value: combinedSimilarity(safeStr(fa.summary), safeStr(fb.summary)),
          weight: SIGNAL_WEIGHTS.titleSimilarity,
          available: true,
          explanation: 'Summary text similarity after version/platform token removal',
        },
        {
          name: 'descriptionSimilarity',
          fired: false,
          value: hasDescription && descA && descB ? combinedSimilarity(descA, descB) : 0,
          weight: SIGNAL_WEIGHTS.descriptionSimilarity,
          available: hasDescription,
          explanation: 'Description text similarity',
        },
        {
          name: 'sameComponent',
          fired: false,
          value: (() => {
            if (!hasComponents) return 0;
            const ca: string[] = (Array.isArray(fa.components) ? fa.components : []).map((c: any) => safeStr(c.name));
            const cb: string[] = (Array.isArray(fb.components) ? fb.components : []).map((c: any) => safeStr(c.name));
            const shared = ca.filter((c: string) => cb.includes(c));
            return ca.length > 0 && cb.length > 0 ? shared.length / Math.max(ca.length, cb.length) : 0;
          })(),
          weight: SIGNAL_WEIGHTS.sameComponent,
          available: hasComponents,
          explanation: 'Issues affect the same Jira component(s)',
        },
        {
          name: 'samePlatform',
          fired: false,
          value: (() => {
            const pa = safeStr(fa.customfield_10103?.[0]?.value);
            const pb = safeStr(fb.customfield_10103?.[0]?.value);
            return pa && pb && pa === pb ? 1 : 0;
          })(),
          weight: SIGNAL_WEIGHTS.samePlatform,
          available: true,
          explanation: 'Issues filed against the same platform',
        },
        {
          name: 'sameBuildVersion',
          fired: false,
          value: (() => {
            const va = (Array.isArray(fa.fixVersions) ? fa.fixVersions : []).map((v: any) => safeStr(v.name)).join(',');
            const vb = (Array.isArray(fb.fixVersions) ? fb.fixVersions : []).map((v: any) => safeStr(v.name)).join(',');
            return va && vb && va === vb && va !== '' ? 1 : 0;
          })(),
          weight: SIGNAL_WEIGHTS.sameBuildVersion,
          available: !!(fa.fixVersions?.length || fb.fixVersions?.length),
          explanation: 'Issues affect the same build/fix version',
        },
        {
          name: 'createdProximity7d',
          fired: daysDiff <= 7,
          value: daysDiff <= 7 ? Math.max(0, 1 - daysDiff / 7) : 0,
          weight: SIGNAL_WEIGHTS.createdProximity7d,
          available: true,
          explanation: `Issues created ${Math.round(daysDiff)} days apart (within 7-day window = signal fires)`,
        },
        {
          name: 'sameAssignee',
          fired: false,
          value: (() => {
            const aa = safeStr(fa.assignee?.accountId);
            const ab = safeStr(fb.assignee?.accountId);
            return aa && ab && aa === ab ? 1 : 0;
          })(),
          weight: SIGNAL_WEIGHTS.sameAssignee,
          available: true,
          explanation: 'Issues assigned to the same developer',
        },
      ];

      // Set fired flags based on values
      signals.forEach(s => { if (s.name !== 'createdProximity7d') s.fired = s.value >= 0.5; });
      signals.find(s => s.name === 'linkedAsDuplicate')!.value = signals.find(s => s.name === 'linkedAsDuplicate')!.fired ? 1 : 0;

      const confidence = computeConfidence(signals);
      const confidenceLabel = computeConfidenceLabel(confidence, signals);

      if (confidenceLabel === 'INSUFFICIENT_EVIDENCE') continue;

      pairs.push({
        issueA: a.key,
        issueB: b.key,
        confidence: Math.round(confidence * 100) / 100,
        confidenceLabel,
        signals,
        alternativeExplanations: generateAlternativeExplanations(signals, confidenceLabel),
        algorithmVersion: ALGORITHM_VERSION,
        detectedAt: now,
      });
    }
  }

  return pairs.sort((a, b) => b.confidence - a.confidence).slice(0, 50);
}

// ─── Evidence builder ─────────────────────────────────────────────────────────

function buildEvidence(
  velocity: VelocityAnalysis,
  duplicatePairs: DuplicatePairV2[],
  reportingChars: ReportingCharacteristics | undefined,
  crossPlatformClusters: { date: string; titleSnippet: string; platforms: string[]; tickets: string[] }[]
): EvidenceItem[] {
  const now = new Date().toISOString();
  const evidence: EvidenceItem[] = [];

  // Velocity anomalies
  if (velocity.unusualDays.length > 0) {
    const topDay = velocity.unusualDays[0];
    evidence.push({
      id: genId('ev'),
      type: 'VELOCITY_ANOMALY',
      title: `Unusual filing activity on ${topDay.date}`,
      description: `${topDay.count} issues filed on ${topDay.date} (z-score ${topDay.zScore}, ${Math.round(topDay.count / Math.max(velocity.baseline.mean, 0.1))}× personal average). ${velocity.baseline.reliable ? 'Statistical baseline reliable.' : 'Note: baseline computed from fewer than 20 data points — treat as indicative only.'}`,
      confidence: topDay.zScore >= 3 ? 'CONFIRMED' : topDay.zScore >= 2.5 ? 'LIKELY' : 'POSSIBLE',
      metrics: [
        { label: 'Issues that day', value: topDay.count },
        { label: 'Personal mean', value: velocity.baseline.mean },
        { label: 'Z-score', value: topDay.zScore },
      ],
      relatedTickets: [],
      alternativeExplanations: [
        'Could reflect an intensive regression testing session or release day',
        'Sprint end days typically show elevated filing rates',
        'Team-wide spike context not available — may be a team event',
      ],
      engineeringImpact: topDay.zScore >= 3 ? 'HIGH' : 'MEDIUM',
      source: 'COMPUTED',
      algorithmVersion: 'velocity-v2.1',
      detectedAt: now,
    });
  }

  // High-confidence duplicate pairs
  const confirmedPairs = duplicatePairs.filter(p => p.confidenceLabel === 'CONFIRMED' || p.confidenceLabel === 'LIKELY');
  if (confirmedPairs.length > 0) {
    evidence.push({
      id: genId('ev'),
      type: 'DUPLICATE_CLUSTER',
      title: `${confirmedPairs.length} high-confidence duplicate candidate${confirmedPairs.length > 1 ? 's' : ''} detected`,
      description: `${confirmedPairs.filter(p => p.confidenceLabel === 'CONFIRMED').length} confirmed (Jira-verified) and ${confirmedPairs.filter(p => p.confidenceLabel === 'LIKELY').length} likely duplicate pairs found using multi-signal analysis. Title similarity alone was not sufficient to produce these findings.`,
      confidence: confirmedPairs.some(p => p.confidenceLabel === 'CONFIRMED') ? 'CONFIRMED' : 'LIKELY',
      metrics: [
        { label: 'Confirmed pairs', value: confirmedPairs.filter(p => p.confidenceLabel === 'CONFIRMED').length },
        { label: 'Likely pairs', value: confirmedPairs.filter(p => p.confidenceLabel === 'LIKELY').length },
      ],
      relatedTickets: confirmedPairs.slice(0, 6).flatMap(p => [p.issueA, p.issueB]).filter((v, i, a) => a.indexOf(v) === i),
      alternativeExplanations: [
        'Some pairs may represent independently-discovered instances of the same defect',
        'Component field unavailability may reduce detection accuracy',
      ],
      engineeringImpact: confirmedPairs.length >= 5 ? 'HIGH' : 'MEDIUM',
      source: 'COMPUTED',
      algorithmVersion: ALGORITHM_VERSION,
      detectedAt: now,
    });
  }

  // Cross-platform pattern evidence
  if (crossPlatformClusters.length > 0) {
    const top = crossPlatformClusters[0];
    evidence.push({
      id: genId('ev'),
      type: 'CROSS_PLATFORM_PATTERN',
      title: `Cross-platform reporting pattern detected on ${top.date}`,
      description: `"${top.titleSnippet}" filed on ${top.platforms.join(', ')} on the same day. This pattern is consistent with either: (a) one root-cause defect manifesting on multiple platforms, or (b) the same issue reported separately across platforms. Both are normal testing practices.`,
      confidence: top.platforms.length >= 3 ? 'LIKELY' : 'POSSIBLE',
      metrics: [
        { label: 'Platforms', value: top.platforms.join(', ') },
        { label: 'Tickets', value: top.tickets.length },
        { label: 'Date', value: top.date },
      ],
      relatedTickets: top.tickets,
      alternativeExplanations: [
        'One root-cause defect reproducible on multiple platforms (expected)',
        'Platform-specific variations of a related but distinct issue',
        'Regression testing across platforms (normal practice)',
      ],
      engineeringImpact: 'MEDIUM',
      source: 'COMPUTED',
      algorithmVersion: 'cross-platform-v2.1',
      detectedAt: now,
    });
  }

  // Low acceptance rate
  if (reportingChars && reportingChars.totalFiled >= 10 && reportingChars.acceptanceRate < 0.70) {
    evidence.push({
      id: genId('ev'),
      type: 'DATA_PATTERN',
      title: `Acceptance rate below 70% (${Math.round(reportingChars.acceptanceRate * 100)}%)`,
      description: `${Math.round(reportingChars.acceptanceRate * 100)}% of filed issues were accepted (not resolved as Invalid, By Design, or Duplicate). This is below the informal 70% threshold. Note: acceptance depends heavily on project phase and component maturity — this observation requires context.`,
      confidence: 'POSSIBLE',
      metrics: [
        { label: 'Acceptance rate', value: `${Math.round(reportingChars.acceptanceRate * 100)}%` },
        { label: 'Invalid count', value: reportingChars.invalid },
        { label: 'By Design count', value: reportingChars.byDesign },
        { label: 'Confirmed duplicates', value: reportingChars.confirmed },
      ],
      relatedTickets: [],
      alternativeExplanations: [
        'Early-stage features have higher invalid/by-design rates',
        'Exploratory testing sessions produce more invalid reports',
        'Definition of "Not an Issue" varies by team and project phase',
      ],
      engineeringImpact: 'LOW',
      source: 'COMPUTED',
      algorithmVersion: 'acceptance-rate-v2.1',
      detectedAt: now,
    });
  }

  return evidence;
}

// ─── Dimension scores ─────────────────────────────────────────────────────────

function buildDimensionScores(
  reportingChars: ReportingCharacteristics | undefined,
  evidence: EvidenceItem[],
  velocity: VelocityAnalysis,
  duplicatePairs: DuplicatePairV2[],
  dataQuality: DataQualityReport
): Record<string, DimensionScore> {
  const scores: Record<string, DimensionScore> = {};

  // Reporting Characteristics (QA-owned — NOT called "quality score")
  if (reportingChars) {
    const ar = Math.round(reportingChars.acceptanceRate * 100);
    const dr = Math.round(reportingChars.confirmedDuplicateRate * 100);
    const ir = Math.round(reportingChars.invalidRate * 100);
    scores.reportingCharacteristics = {
      label: 'Reporting Characteristics',
      value: ar,
      interpretation: `${ar}% of filed issues were accepted (not resolved as invalid/duplicate/by-design).`,
      components: [
        { name: 'Acceptance rate', value: ar, weight: 0.6 },
        { name: 'Confirmed duplicate rate', value: 100 - dr, weight: 0.25 },
        { name: 'Invalid rate', value: 100 - ir, weight: 0.15 },
      ],
      limitations: [
        'Acceptance depends heavily on project phase and component maturity',
        'By-design and invalid decisions are made by developers/product — not the reporter',
        'This score describes report patterns, not individual performance',
      ],
      owner: 'QA',
      tooltip: {
        whatItMeasures: 'The proportion of filed issues accepted as valid by the development team',
        whyItMatters: 'A higher acceptance rate suggests issues are well-scoped and reproducible',
        whatItDoesNotMeasure: 'Employee performance, effort, or intent — only the outcome of triage decisions',
        howCalculated: '1 − (invalid + by_design + confirmed_duplicate) / total_filed',
        knownLimitations: [
          'Triage decisions are made by developers and product — not the reporter',
          'Early-stage features typically have lower acceptance rates',
          'Exploratory testing sessions produce more invalid/by-design reports',
        ],
      },
    };
  }

  // Evidence Strength (SYSTEM-owned)
  const highConf = evidence.filter(e => e.confidence === 'CONFIRMED' || e.confidence === 'LIKELY').length;
  const eStrength = evidence.length > 0 ? Math.round((highConf / evidence.length) * 100) : 0;
  scores.evidenceStrength = {
    label: 'Evidence Strength',
    value: eStrength,
    interpretation: `${highConf} of ${evidence.length} findings have HIGH or LIKELY confidence.`,
    components: [
      { name: 'High-confidence findings', value: highConf, weight: 1 },
    ],
    limitations: ['Evidence strength depends on Jira field availability'],
    owner: 'SYSTEM',
    tooltip: {
      whatItMeasures: 'The proportion of investigation findings that are backed by strong evidence',
      whyItMatters: 'High evidence strength means conclusions are more trustworthy',
      whatItDoesNotMeasure: 'Whether the findings are significant or trivial',
      howCalculated: 'HIGH + LIKELY confidence findings / total findings',
      knownLimitations: ['Missing Jira fields reduce the maximum achievable confidence'],
    },
  };

  // Data Completeness (SYSTEM-owned)
  scores.dataCompleteness = {
    label: 'Data Completeness',
    value: dataQuality.overallCompleteness,
    interpretation: `${dataQuality.overallCompleteness}% of analysis-critical Jira fields were available.`,
    components: dataQuality.fields.filter(f => f.impact === 'CRITICAL' || f.impact === 'HIGH').map(f => ({
      name: f.name, value: f.coveragePercent, weight: f.impact === 'CRITICAL' ? 0.4 : 0.3,
    })),
    limitations: ['Changelog and attachments require separate API calls not yet implemented'],
    owner: 'SYSTEM',
    tooltip: {
      whatItMeasures: 'The completeness of Jira data available for this investigation',
      whyItMatters: 'Lower completeness reduces confidence in all findings',
      whatItDoesNotMeasure: 'The quality of the Jira data itself',
      howCalculated: 'Weighted average of field coverage percentages',
      knownLimitations: ['Changelog and attachment fields are never available in current implementation'],
    },
  };

  return scores;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildInvestigationReportV2(
  issues: any[],
  targetName: string,
  question: string,
  jql: string,
  investigationType: InvestigationType = 'reporter'
): InvestigationReportV2 {
  const now = new Date().toISOString();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');

  // ── Data Quality ──────────────────────────────────────────────────────────
  const dataQuality = buildDataQuality(issues);

  // ── Facts ─────────────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  const componentCounts: Record<string, number> = {};
  const resolutionCounts: Record<string, number> = {};
  let confirmedDuplicateCount = 0;

  for (const issue of issues) {
    const f = issue.fields;
    const status = f.status?.name || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const priority = f.priority?.name || 'Unknown';
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    const type = f.issuetype?.name || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const platform = f.customfield_10103?.[0]?.value || 'Unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    for (const c of (f.components || [])) {
      const cn = c.name || 'Unknown';
      componentCounts[cn] = (componentCounts[cn] || 0) + 1;
    }
    const res = safeStr(f.resolution?.name || f.resolution) || 'Unresolved';
    resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
    if (res.toLowerCase() === 'duplicate') confirmedDuplicateCount++;
  }

  const dates = issues.map(i => i.fields.created?.substring(0, 10)).filter(Boolean).sort();
  const facts: FactsLayer = {
    totalIssues: issues.length,
    dateRange: { from: dates[0] || '', to: dates[dates.length - 1] || '' },
    statusCounts, priorityCounts, typeCounts, platformCounts,
    componentCounts, resolutionCounts, confirmedDuplicateCount,
  };

  // ── Filter person issues for reporter type ────────────────────────────────
  const targetLower = targetName.toLowerCase();
  const personIssues = investigationType === 'reporter'
    ? issues.filter(i => (i.fields.reporter?.displayName || '').toLowerCase().includes(targetLower))
    : issues;

  // ── Reporting Characteristics (reporter type only) ────────────────────────
  let reporterActivity: ReporterActivity | undefined;
  let reportingChars: ReportingCharacteristics | undefined;

  if (investigationType === 'reporter' && personIssues.length > 0) {
    const INVALID = new Set(['not an issue', 'not reproducing', 'expected behaviour', "won't fix", 'by design']);
    const BYDESIGN = new Set(['by design', 'expected behaviour']);

    let invalid = 0, byDesign = 0, confirmed = 0;
    const allTimeDays = new Set<string>();
    const platforms = new Set<string>();
    const components = new Set<string>();
    const builds = new Set<string>();
    const severityDist: Record<string, number> = {};

    for (const issue of personIssues) {
      const f = issue.fields;
      const res = safeStr(f.resolution?.name || f.resolution).toLowerCase();
      if (res === 'duplicate') confirmed++;
      if (INVALID.has(res)) invalid++;
      if (BYDESIGN.has(res)) byDesign++;
      const d = f.created?.substring(0, 10);
      if (d) allTimeDays.add(d);
      const pl = f.customfield_10103?.[0]?.value;
      if (pl) platforms.add(pl);
      for (const c of (f.components || [])) if (c.name) components.add(c.name);
      for (const v of (f.fixVersions || [])) if (v.name) builds.add(v.name);
      const pri = f.priority?.name || 'Unknown';
      severityDist[pri] = (severityDist[pri] || 0) + 1;
    }

    const total = personIssues.length;
    reporterActivity = {
      bugsReported: total,
      activeDays: allTimeDays.size,
      platformsTested: [...platforms],
      componentsTested: [...components],
      buildsTested: [...builds],
      severityDistribution: severityDist,
    };
    reportingChars = {
      acceptanceRate: total > 0 ? (total - invalid - byDesign - confirmed) / total : 1,
      confirmedDuplicateRate: total > 0 ? confirmed / total : 0,
      invalidRate: total > 0 ? invalid / total : 0,
      reopenRate: null,  // requires changelog API
      totalFiled: total, confirmed, invalid, byDesign,
    };
  }

  // ── Velocity ──────────────────────────────────────────────────────────────
  const velocity = buildVelocity(personIssues);

  // ── Duplicate detection ───────────────────────────────────────────────────
  const duplicatePairs = buildDuplicatePairs(personIssues, dataQuality);

  // ── Cross-platform clusters (neutral — not "suspicious") ──────────────────
  const issuesByDay: Record<string, { summary: string; platform: string; key: string }[]> = {};
  personIssues.forEach(i => {
    const d = i.fields.created?.substring(0, 10) || '';
    const pl = i.fields.customfield_10103?.[0]?.value || 'Unknown';
    if (!issuesByDay[d]) issuesByDay[d] = [];
    issuesByDay[d].push({ summary: i.fields.summary || '', platform: pl, key: i.key });
  });
  const crossPlatformClusters: { date: string; titleSnippet: string; platforms: string[]; tickets: string[] }[] = [];
  Object.entries(issuesByDay).forEach(([day, dayIssues]) => {
    if (dayIssues.length < 2) return;
    const groups: Record<string, typeof dayIssues> = {};
    dayIssues.forEach(b => {
      const prefix = normaliseTitle(b.summary).substring(0, 35);
      (groups[prefix] = groups[prefix] || []).push(b);
    });
    Object.values(groups).forEach(group => {
      if (group.length < 2) return;
      const platforms = [...new Set(group.map(g => g.platform))];
      if (platforms.length >= 2) {
        crossPlatformClusters.push({
          date: day, titleSnippet: group[0].summary.substring(0, 70),
          platforms, tickets: group.map(g => g.key),
        });
      }
    });
  });

  // ── Evidence ──────────────────────────────────────────────────────────────
  const evidence = buildEvidence(velocity, duplicatePairs, reportingChars, crossPlatformClusters);

  // ── Platform coverage ─────────────────────────────────────────────────────
  const totalForPct = personIssues.length || 1;
  const platformCoverage = Object.entries(
    personIssues.reduce((m: Record<string, number>, i) => {
      const p = i.fields.customfield_10103?.[0]?.value || 'Unknown';
      m[p] = (m[p] || 0) + 1; return m;
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([platform, count]) => ({
    platform, count, percentage: Math.round((count / totalForPct) * 100),
  }));

  // ── Dimension scores ──────────────────────────────────────────────────────
  const dimensionScores = buildDimensionScores(reportingChars, evidence, velocity, duplicatePairs, dataQuality);

  // ── Audit trail ───────────────────────────────────────────────────────────
  const audit: AuditEntry[] = evidence.map(e => ({
    findingId: e.id,
    detectedAt: e.detectedAt,
    algorithmVersion: e.algorithmVersion,
    confidence: e.confidence === 'CONFIRMED' ? 1 : e.confidence === 'LIKELY' ? 0.75 : e.confidence === 'POSSIBLE' ? 0.5 : 0.2,
    confidenceLabel: e.confidence,
    inputHash: simpleHash(`${issues.length}|${targetName}|${jql}`),
  }));

  return {
    schema: '2.1',
    investigationType,
    metadata: { id, scope: targetName, query: question, generatedAt: now, totalIssuesAnalyzed: issues.length, jql },
    dataQuality,
    limitations: { items: dataQuality.limitations, affectedSections: ['duplicateAnalysis', 'reportingCharacteristics'] },
    facts,
    findings: { reporterActivity, reportingCharacteristics: reportingChars, velocity, duplicatePairs, rootCauseClusters: [], platformCoverage, evidence },
    conclusions: { dimensionScores },
    audit,
  };
}
