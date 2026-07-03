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
  web: ['Functional', 'Negative', 'Edge Case'],
  tv: ['Functional', 'Negative', 'Edge Case'],
  mobile: ['Functional', 'Negative', 'Edge Case'],
};

// ─── System Prompt Templates ─────────────────────────────────────────────────

function buildSystemPrompt(
  pass: 'functional' | 'negative' | 'exploratory' | 'web' | 'tv' | 'mobile',
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

  const allTestingTypes = `Cover ALL these testing types:
- Functional Testing: Happy path flows, feature verification
- Negative Testing: Invalid inputs, error handling, boundary values
- UI/UX Testing: Layout, navigation, visual consistency, accessibility
- Integration Testing: Cross-feature interactions, API integrations
- Performance Testing: Load time, responsiveness, memory usage
- Security Testing: Auth bypass, input injection, session handling
- Compatibility Testing: Platform-specific device/OS variations
- Regression Testing: Existing features still work after changes
- Sanity Testing: Basic smoke tests for core flows
- Edge Case Testing: Unusual scenarios, race conditions, extreme data`;

  switch (pass) {
    case 'web':
      return `You are a senior QA engineer generating COMPREHENSIVE test cases for WEB platform from a PRD.
Generate ALL possible test cases for WEB browser testing covering every scenario in the PRD.
Platforms: Chrome, Firefox, Safari, Edge on Desktop and Mobile browsers.

${allTestingTypes}

Web-specific focus areas:
- Responsive design (desktop, tablet, mobile viewports)
- Cross-browser compatibility
- Keyboard navigation and accessibility (WCAG)
- Form validations and submissions
- URL routing and deep linking
- Page load performance
- Cookie/localStorage handling
- Network error states

Reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array (no markdown, no explanation, no code fences):
${jsonStructure}

Rules:
- Set category to one of: "Functional", "Negative", "Edge Case", "Sanity"
- Leave testcaseId as empty string
- Priority P0 = critical/blocker, P1 = major, P2 = minor
- Generate 25-35 test cases covering EVERY feature and scenario in the PRD for web
- Each test case must be unique and specific (not generic)
- Test steps should be actionable (3-6 steps each)${existingSummary}`;

    case 'tv':
      return `You are a senior QA engineer generating COMPREHENSIVE test cases for TV/Smart TV/OTT platform from a PRD.
Generate ALL possible test cases for TV app testing covering every scenario in the PRD.
Platforms: Android TV, Fire TV, Apple TV, Samsung Tizen, LG webOS, Roku.

${allTestingTypes}

TV-specific focus areas:
- D-pad/Remote control navigation (Up/Down/Left/Right/OK/Back)
- Focus management and visual focus indicators
- 10-foot UI readability and layout
- Video/Audio playback controls
- Deep linking from external sources
- App lifecycle (background, resume, cold start)
- Low memory/resource constraints
- HDMI-CEC interactions
- Multiple user profiles
- Parental controls

Reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array (no markdown, no explanation, no code fences):
${jsonStructure}

Rules:
- Set category to one of: "Functional", "Negative", "Edge Case", "Sanity"
- Leave testcaseId as empty string
- Priority P0 = critical/blocker, P1 = major, P2 = minor
- Generate 25-35 test cases covering EVERY feature and scenario in the PRD for TV
- Each test case must be unique and specific (not generic)
- Test steps should be actionable (3-6 steps each)${existingSummary}`;

    case 'mobile':
      return `You are a senior QA engineer generating COMPREHENSIVE test cases for MOBILE platform from a PRD.
Generate ALL possible test cases for iOS and Android app testing covering every scenario in the PRD.
Platforms: iOS (iPhone, iPad), Android (phones, tablets), various OS versions.

${allTestingTypes}

Mobile-specific focus areas:
- Touch gestures (tap, swipe, pinch, long press)
- Screen orientation changes (portrait/landscape)
- Push notifications (foreground, background, killed state)
- Deep links and universal links
- Offline/poor network behavior
- App backgrounding and foregrounding
- Battery and memory optimization
- Permission dialogs (camera, location, notifications)
- Keyboard handling and input methods
- Accessibility (VoiceOver, TalkBack)
- App install, update, and uninstall flows
- Multi-tasking and split screen

Reference the specific PRD section heading in the "module" field.

Available PRD sections:
${headingsList}

Return ONLY a JSON array (no markdown, no explanation, no code fences):
${jsonStructure}

Rules:
- Set category to one of: "Functional", "Negative", "Edge Case", "Sanity"
- Leave testcaseId as empty string
- Priority P0 = critical/blocker, P1 = major, P2 = minor
- Generate 25-35 test cases covering EVERY feature and scenario in the PRD for mobile
- Each test case must be unique and specific (not generic)
- Test steps should be actionable (3-6 steps each)${existingSummary}`;

    case 'functional':
      return `You are a senior QA engineer. Generate FUNCTIONAL test cases from this PRD.
Reference PRD section headings in "module" field.

Sections: ${headingsList}

Return ONLY JSON array: ${jsonStructure}

Rules: category="Functional", empty testcaseId, P0/P1/P2 priority, 8-12 cases, max 5 steps each${existingSummary}`;

    case 'negative':
      return `You are a senior QA engineer. Generate NEGATIVE/BOUNDARY test cases from this PRD.
Focus on: invalid inputs, errors, edge conditions.
Reference PRD section headings in "module" field.

Sections: ${headingsList}

Return ONLY JSON array: ${jsonStructure}

Rules: category="Negative", empty testcaseId, P0/P1/P2 priority, 6-10 cases, max 5 steps each${existingSummary}`;

    case 'exploratory':
      return `You are a senior QA engineer. Generate EXPLORATORY/EDGE CASE test cases from this PRD.
Focus on: unusual workflows, race conditions, stress scenarios.
Reference PRD section headings in "module" field.

Sections: ${headingsList}

Return ONLY JSON array: ${jsonStructure}

Rules: category="Exploratory" or "Edge Case" or "Sanity", empty testcaseId, P0/P1/P2, 6-10 cases, max 5 steps${existingSummary}`;

    default:
      return `You are a senior QA engineer. Generate test cases from this PRD.
Return ONLY JSON array: ${jsonStructure}
Rules: empty testcaseId, P0/P1/P2, 8-12 cases${existingSummary}`;
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
 * Handles: raw JSON, markdown code fences, truncated JSON arrays.
 */
export function parseTestCaseResponse(raw: string): GeneratedTestCase[] {
  if (!raw || typeof raw !== 'string') return [];

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  cleaned = cleaned.trim();

  let parsed: unknown;

  // Attempt 1: Direct JSON parse
  try {
    parsed = JSON.parse(cleaned);
  } catch (directErr) {
    // Attempt 2: JSON might be truncated — try to fix by finding the last complete object
    // Find all complete {...} objects in the array
    const objects: unknown[] = [];
    const objMatches = cleaned.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    for (const m of objMatches) {
      try {
        const obj = JSON.parse(m[0]);
        objects.push(obj);
      } catch {
        // Skip malformed objects
      }
    }

    if (objects.length > 0) {
      parsed = objects;
    } else {
      // Attempt 3: Try wrapping in array brackets if it looks like objects
      try {
        // Maybe the response is just missing the closing bracket (truncated)
        const fixedJson = cleaned.endsWith(']') ? cleaned : cleaned.replace(/,?\s*$/, '') + ']';
        const reParsed = fixedJson.startsWith('[') ? fixedJson : '[' + fixedJson;
        parsed = JSON.parse(reParsed);
      } catch {
        console.error('[parseTestCaseResponse] All parse attempts failed. Length:', cleaned.length, 'First 100:', cleaned.substring(0, 100));
        return [];
      }
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
  pass: 'functional' | 'negative' | 'exploratory' | 'web' | 'tv' | 'mobile',
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
  console.log('[generateTestCasesForPass] Raw AI response length:', result.answer.length, 'chars. First 200:', result.answer.substring(0, 200));
  const parsedCases = parseTestCaseResponse(result.answer);

  // For platform passes (web/tv/mobile), accept ALL valid categories
  // For legacy passes (functional/negative/exploratory), filter to expected categories
  let casesToUse = parsedCases;
  if (['functional', 'negative', 'exploratory'].includes(pass)) {
    const expectedCategories = PASS_CATEGORIES[pass] || [];
    const filteredCases = parsedCases.filter((tc) =>
      expectedCategories.includes(tc.category)
    );
    casesToUse = filteredCases.length > 0 ? filteredCases : parsedCases;
  }

  // Assign proper IDs
  const casesWithIds = assignTestCaseIds(casesToUse, pass);

  return casesWithIds;
}
