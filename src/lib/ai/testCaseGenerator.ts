// src/lib/ai/testCaseGenerator.ts
// AI Test Case Generator service — multi-pass structured generation from PRD content

import type { AIProvider } from './providers/types';
import { getAIProvider } from './providers';
import { truncateForContext } from './extractText';
import type {
  GeneratedTestCase,
  TestCaseCategory,
  TestCaseSummary,
  GenerationConfig,
} from '@/types/test-cases';

// ─── Default Generation Configuration ────────────────────────────────────────

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  maxTokens: 8192,
  temperature: 0.4,
  maxRetries: 3,
  contextTokenBudget: 16000,
};

// ─── Category → ID Prefix Mapping ────────────────────────────────────────────

const CATEGORY_PREFIX_MAP: Record<TestCaseCategory, string> = {
  Functional: 'FUNC',
  Negative: 'NEG',
  Exploratory: 'EXP',
  'Edge Case': 'EDGE',
  Sanity: 'SAN',
};

// ─── Pass → Categories Mapping ───────────────────────────────────────────────

const PASS_CATEGORIES: Record<string, TestCaseCategory[]> = {
  functional: ['Functional'],
  negative: ['Negative'],
  exploratory: ['Exploratory', 'Edge Case', 'Sanity'],
};

// ─── System Prompt Templates ─────────────────────────────────────────────────

function buildSystemPrompt(
  pass: 'functional' | 'negative' | 'exploratory',
  headings: string[],
  existingCases: TestCaseSummary[]
): string {
  const headingsList = headings.length > 0
    ? headings.map((h) => `- ${h}`).join('\n')
    : '- (No specific sections identified)';

  const existingSummary = existingCases.length > 0
    ? `\n\nDo NOT duplicate these existing test scenarios:\n${existingCases.map((c) => `- [${c.category}] ${c.scenario}`).join('\n')}`
    : '';

  const jsonStructure = `[{"testcaseId": "", "module": "...", "priority": "P0|P1|P2", "testScenario": "...", "testSteps": ["1. ...", "2. ..."], "expectedResult": "...", "category": "..."}]`;

  switch (pass) {
    case 'functional':
      return `You are a senior QA engineer generating test cases from a PRD document.
Generate FUNCTIONAL/HAPPY-PATH test cases covering normal user flows and expected behavior.
For each test case, reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
${jsonStructure}

Rules:
- Set category to "Functional" for all test cases in this pass
- Leave testcaseId as empty string (it will be assigned later)
- Priority P0 = critical path, P1 = important, P2 = nice-to-have
- Test steps should be clear, numbered actions
- Expected result should be a verifiable outcome
- Generate 8-15 test cases covering the main flows${existingSummary}`;

    case 'negative':
      return `You are a senior QA engineer generating test cases from a PRD document.
Generate NEGATIVE/BOUNDARY test cases focusing on error conditions and invalid scenarios.
Focus on: invalid inputs, boundary values, error conditions, permission violations, missing data, timeout scenarios.
For each test case, reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
${jsonStructure}

Rules:
- Set category to "Negative" for all test cases in this pass
- Leave testcaseId as empty string (it will be assigned later)
- Priority P0 = security/data-loss risk, P1 = important error handling, P2 = edge-case errors
- Test steps should include the invalid/boundary input being tested
- Expected result should describe the correct error handling behavior
- Generate 6-12 test cases covering error paths${existingSummary}`;

    case 'exploratory':
      return `You are a senior QA engineer generating test cases from a PRD document.
Generate EXPLORATORY, EDGE CASE, and SANITY test cases.
Focus on: unusual workflows, race conditions, data combinations, stress scenarios, and basic smoke tests.
For each test case, reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
${jsonStructure}

Rules:
- Set category to one of: "Exploratory", "Edge Case", or "Sanity"
- "Exploratory" = unusual workflows, creative testing paths
- "Edge Case" = boundary combinations, race conditions, extreme data
- "Sanity" = basic smoke tests confirming core functionality works
- Leave testcaseId as empty string (it will be assigned later)
- Priority P0 = critical smoke test, P1 = important edge case, P2 = exploratory scenario
- Generate 6-12 test cases with a mix of categories${existingSummary}`;
  }
}

// ─── Heading Extraction ──────────────────────────────────────────────────────

/**
 * Extracts markdown headings from plain text.
 * Matches lines starting with #, ##, or ### and returns the heading text
 * without the # prefix characters.
 */
export function extractHeadings(plainText: string): string[] {
  if (!plainText) return [];

  const lines = plainText.split('\n');
  const headings: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      headings.push(match[2].trim());
    }
  }

  return headings;
}

// ─── JSON Response Parsing ───────────────────────────────────────────────────

const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2']);
const VALID_CATEGORIES: Set<string> = new Set([
  'Functional',
  'Negative',
  'Exploratory',
  'Sanity',
  'Edge Case',
]);

/**
 * Validates a single test case entry, returning it if valid or null if malformed.
 */
function validateTestCaseEntry(entry: unknown): GeneratedTestCase | null {
  if (!entry || typeof entry !== 'object') return null;

  const obj = entry as Record<string, unknown>;

  // Validate required string fields
  if (typeof obj.module !== 'string' || obj.module.trim() === '') return null;
  if (typeof obj.testScenario !== 'string' || obj.testScenario.trim() === '') return null;
  if (typeof obj.expectedResult !== 'string' || obj.expectedResult.trim() === '') return null;

  // Validate priority
  if (typeof obj.priority !== 'string' || !VALID_PRIORITIES.has(obj.priority)) return null;

  // Validate category
  if (typeof obj.category !== 'string' || !VALID_CATEGORIES.has(obj.category)) return null;

  // Validate testSteps — must be an array with at least one non-empty string
  if (!Array.isArray(obj.testSteps)) return null;
  const validSteps = obj.testSteps.filter(
    (step: unknown) => typeof step === 'string' && step.trim() !== ''
  );
  if (validSteps.length === 0) return null;

  return {
    testcaseId: typeof obj.testcaseId === 'string' ? obj.testcaseId : '',
    module: obj.module.trim(),
    priority: obj.priority as GeneratedTestCase['priority'],
    testScenario: obj.testScenario.trim(),
    testSteps: validSteps.map((s: string) => s.trim()),
    expectedResult: obj.expectedResult.trim(),
    category: obj.category as TestCaseCategory,
  };
}

/**
 * Parses AI JSON response with validation, discarding malformed entries.
 * Attempts direct JSON.parse first, then falls back to regex extraction
 * of JSON arrays from the response string.
 */
export function parseTestCaseResponse(raw: string): GeneratedTestCase[] {
  if (!raw || typeof raw !== 'string') return [];

  let parsed: unknown;

  // Attempt 1: Direct JSON parse
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    // Attempt 2: Regex extraction of JSON array from response
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        parsed = JSON.parse(arrayMatch[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  // Must be an array
  if (!Array.isArray(parsed)) {
    // If it's an object with a test cases array, try to extract it
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const possibleArrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
      if (possibleArrayKey) {
        parsed = obj[possibleArrayKey];
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  // Validate each entry
  const validCases: GeneratedTestCase[] = [];
  for (const entry of parsed as unknown[]) {
    const validated = validateTestCaseEntry(entry);
    if (validated) {
      validCases.push(validated);
    }
  }

  return validCases;
}

// ─── Test Case ID Assignment ─────────────────────────────────────────────────

/**
 * Assigns IDs with pattern TC_{PREFIX}_{NNN} where PREFIX maps:
 * Functional→FUNC, Negative→NEG, Exploratory→EXP, Edge Case→EDGE, Sanity→SAN
 *
 * Numbers are sequential per category, starting from 001.
 */
export function assignTestCaseIds(
  testCases: GeneratedTestCase[],
  pass: string
): GeneratedTestCase[] {
  const counters: Record<string, number> = {};

  return testCases.map((tc) => {
    const prefix = CATEGORY_PREFIX_MAP[tc.category] || 'FUNC';
    counters[prefix] = (counters[prefix] || 0) + 1;
    const num = String(counters[prefix]).padStart(3, '0');

    return {
      ...tc,
      testcaseId: `TC_${prefix}_${num}`,
    };
  });
}

// ─── Exponential Backoff Retry ───────────────────────────────────────────────

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates exponential backoff delay: baseDelay * 2^attempt
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Executes a function with exponential backoff retry logic.
 * Retries on rate-limit (429) and server errors (5xx).
 * Max retries configurable (default 3).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a retryable error (rate limit or server error)
      const isRateLimit = lastError.message.includes('429');
      const isServerError = /5\d{2}/.test(lastError.message);

      if (attempt >= maxRetries || (!isRateLimit && !isServerError)) {
        throw lastError;
      }

      // Wait with exponential backoff before retrying
      const backoffMs = calculateBackoffDelay(attempt, baseDelay);
      await delay(backoffMs);
    }
  }

  throw lastError || new Error('Retry failed');
}

// ─── Main Generation Orchestrator ────────────────────────────────────────────

/**
 * Orchestrates a single generation pass with:
 * 1. Prompt construction (pass-specific system prompt)
 * 2. AI call with retry logic
 * 3. Response parsing and validation
 * 4. ID assignment
 *
 * @param prdText - Plain text content extracted from the PRD
 * @param prdHeadings - Section headings extracted from the PRD
 * @param pass - Generation pass type (functional, negative, exploratory)
 * @param existingCases - Previously generated test cases for deduplication
 * @param config - Generation configuration
 * @param provider - Optional AI provider (defaults to getAIProvider())
 */
export async function generateTestCasesForPass(
  prdText: string,
  prdHeadings: string[],
  pass: 'functional' | 'negative' | 'exploratory',
  existingCases: TestCaseSummary[] = [],
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  provider?: AIProvider
): Promise<GeneratedTestCase[]> {
  if (!prdText || prdText.trim() === '') {
    throw new Error('No extractable content from PRD');
  }

  const aiProvider = provider || getAIProvider();

  // Truncate PRD text to context budget
  const truncatedText = truncateForContext(prdText, config.contextTokenBudget);

  // Build the system prompt for this pass
  const systemPrompt = buildSystemPrompt(pass, prdHeadings, existingCases);

  // Construct the user message with the PRD content
  const question = `Here is the PRD document to generate test cases from:\n\n${truncatedText}`;

  // Call AI with retry logic
  const result = await retryWithBackoff(
    () =>
      aiProvider.askAI({
        systemPrompt,
        history: [],
        question,
      }),
    config.maxRetries,
    1000
  );

  // Parse and validate the response
  const parsedCases = parseTestCaseResponse(result.answer);

  // Filter to only expected categories for this pass
  const expectedCategories = PASS_CATEGORIES[pass] || [];
  const filteredCases = parsedCases.filter((tc) =>
    expectedCategories.includes(tc.category)
  );

  // Assign proper IDs
  const casesWithIds = assignTestCaseIds(
    filteredCases.length > 0 ? filteredCases : parsedCases,
    pass
  );

  return casesWithIds;
}
