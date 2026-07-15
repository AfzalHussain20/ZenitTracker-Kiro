/**
 * Duplicate Detection Signal Definitions — v2.1
 *
 * Each signal contributes to a confidence score for a duplicate candidate pair.
 * Hard rule: title similarity alone never produces CONFIRMED or LIKELY.
 */

export interface DuplicateSignalResult {
  name: string;
  fired: boolean;
  value: number;          // 0–1
  weight: number;
  explanation: string;
  available: boolean;     // false if the required Jira field was missing
}

export type ConfidenceLabel =
  | 'CONFIRMED'           // ≥0.80 — strong evidence, Jira-confirmed
  | 'LIKELY'              // ≥0.55 — multiple signals agree
  | 'POSSIBLE'            // ≥0.35 — weak or partial evidence
  | 'INSUFFICIENT_EVIDENCE'; // <0.35 — do not surface as duplicate

export interface DuplicatePairV2 {
  issueA: string;
  issueB: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  signals: DuplicateSignalResult[];
  alternativeExplanations: string[];
  algorithmVersion: string;
  detectedAt: string;
}

/** Signal weights as defined in PRODUCT_SPEC.md §7.2.4 */
export const SIGNAL_WEIGHTS: Record<string, number> = {
  resolutionIsDuplicate: 0.40,
  linkedAsDuplicate:     0.35,
  titleSimilarity:       0.15,
  descriptionSimilarity: 0.15,
  sameComponent:         0.15,
  samePlatform:          0.10,
  sameBuildVersion:      0.10,
  createdProximity7d:    0.05,
  sameAssignee:          0.05,
};

/** Max possible score (sum of all weights) — used for normalisation */
export const MAX_SIGNAL_SCORE = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Compute confidence from a set of fired signals.
 * Returns normalised score 0–1.
 */
export function computeConfidence(signals: DuplicateSignalResult[]): number {
  const weightedSum = signals
    .filter(s => s.available)
    .reduce((sum, s) => sum + s.weight * s.value, 0);
  const availableWeight = signals
    .filter(s => s.available)
    .reduce((sum, s) => sum + s.weight, 0);
  return availableWeight > 0 ? weightedSum / availableWeight : 0;
}

/**
 * Determine confidence label from score + fired signals.
 * Enforces the hard rule: title similarity alone never produces CONFIRMED/LIKELY.
 */
export function computeConfidenceLabel(
  score: number,
  signals: DuplicateSignalResult[]
): ConfidenceLabel {
  const resolutionFired = signals.find(s => s.name === 'resolutionIsDuplicate')?.fired;
  const linkedFired = signals.find(s => s.name === 'linkedAsDuplicate')?.fired;
  const nonTitleStrongSignals = signals.filter(s =>
    s.name !== 'titleSimilarity' && s.name !== 'descriptionSimilarity' &&
    s.available && s.value >= 0.5
  );

  // CONFIRMED: Jira itself confirmed the duplicate
  if ((resolutionFired || linkedFired) && score >= 0.80) return 'CONFIRMED';

  // LIKELY: 3+ non-title signals agree, score ≥ 0.55
  if (nonTitleStrongSignals.length >= 3 && score >= 0.55) return 'LIKELY';

  // POSSIBLE: 2+ non-title signals, score ≥ 0.35
  if (nonTitleStrongSignals.length >= 2 && score >= 0.35) return 'POSSIBLE';

  return 'INSUFFICIENT_EVIDENCE';
}

/**
 * Generate alternative explanations for a duplicate pair.
 * These are shown in the explainability panel.
 */
export function generateAlternativeExplanations(
  signals: DuplicateSignalResult[],
  confidenceLabel: ConfidenceLabel
): string[] {
  const explanations: string[] = [];

  if (confidenceLabel !== 'CONFIRMED') {
    explanations.push('Could be independently discovered during separate testing sessions');
  }

  const compSignal = signals.find(s => s.name === 'sameComponent');
  if (compSignal && !compSignal.available) {
    explanations.push('Component field unavailable — cross-component analysis not possible');
  }

  const platformSignal = signals.find(s => s.name === 'samePlatform');
  if (platformSignal?.fired) {
    explanations.push('Same platform may indicate platform-specific issues, not duplicates');
  }

  const proximity = signals.find(s => s.name === 'createdProximity7d');
  if (proximity?.fired) {
    explanations.push('Close creation dates could reflect a testing sprint or release cycle');
  }

  if (explanations.length === 0) {
    explanations.push('Insufficient context to suggest alternative explanations');
  }

  return explanations;
}

export const ALGORITHM_VERSION = 'duplicate-detector-v2.1';
