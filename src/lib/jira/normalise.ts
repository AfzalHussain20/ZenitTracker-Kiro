/**
 * Jira title normalisation — single source of truth.
 *
 * Strips version numbers, platform tokens, and pipe separators
 * so that "V 8.0.63 | LG TV | Micro Drama — Crash" and
 * "V 8.0.64 | Fire TV | Micro Drama — Crash" normalise to the
 * same base string for similarity comparison.
 *
 * Used by:
 *   - investigation-builder.ts (duplicate detection)
 *   - buildInvestigationReportV2 (Step 2)
 */

export function normaliseTitle(s: string, maxLen = 50): string {
  return s.toLowerCase()
    // Strip version numbers: v1.2.3, version 1.2, build 42
    .replace(/\b(v\d+[\.\d]*|version\s*\d+[\.\d]*|build\s*\d+)\b/gi, '')
    // Strip resolution labels: 720p, 1080p, 4k
    .replace(/\b(720p|1080p|4k|hd)\b/gi, '')
    // Strip environment labels: preprod, prod, production, pre-production
    .replace(/\b(preprod|prod|production|pre-production)\b/gi, '')
    // Strip pipe separators (Jira title conventions: "Feature | Platform | Issue")
    .replace(/\|\s*/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLen);
}

/**
 * Token-based similarity score between two normalised strings.
 * Returns 0–1 where 1 = identical token sets.
 * Uses Jaccard similarity on word tokens.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Character-level Levenshtein similarity (1 - normalised edit distance).
 * Used for short strings where token similarity is unreliable.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const dp: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= lb; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return 1 - dp[lb] / Math.max(la, lb);
}

/**
 * Combined similarity: weighted blend of Jaccard tokens and Levenshtein.
 * Jaccard is better for long strings; Levenshtein for short strings.
 */
export function combinedSimilarity(a: string, b: string): number {
  const norm_a = normaliseTitle(a, 80);
  const norm_b = normaliseTitle(b, 80);
  const jaccard = tokenSimilarity(norm_a, norm_b);
  const lev = levenshteinSimilarity(norm_a, norm_b);
  // Weight Jaccard more for longer strings
  const avgLen = (norm_a.length + norm_b.length) / 2;
  const jaccardWeight = Math.min(0.7, avgLen / 100);
  return jaccardWeight * jaccard + (1 - jaccardWeight) * lev;
}
