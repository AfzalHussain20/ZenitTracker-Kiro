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
  GenerationPass,
  AnalyticsTestCase,
  AnalyticsPlatform,
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
  pass: GenerationPass,
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
    case 'all':
      return `You are an expert senior QA engineer generating a COMPREHENSIVE test suite from a PRD.

Generate test cases covering ALL 3 platforms with MANDATORY category distribution:

PLATFORMS (include ALL three):
• WEB — Chrome, Firefox, Safari, Edge (desktop + mobile browsers)
• TV — Android TV, Fire TV, Apple TV, Samsung Tizen, LG webOS, Roku (D-pad/remote)
• MOBILE — iOS (iPhone/iPad), Android (phones/tablets) — touch, gestures, offline

MANDATORY CATEGORY COUNTS (you MUST hit these minimums):
• "Functional" — 20 test cases (happy path flows, core feature verification)
• "Negative" — 15 test cases (invalid inputs, errors, boundary values, permission denied)
• "Edge Case" — 10 test cases (race conditions, extreme data, unusual workflows, device quirks)
• "Sanity" — 10 test cases (basic smoke tests that verify app doesn't crash on core actions)
• "Exploratory" — 5 test cases (creative scenarios, unusual user journeys)

TOTAL: At least 60 test cases. Distribute across all 3 platforms evenly (20+ per platform).

Each module MUST start with platform prefix: "[Web] Feature", "[TV] Feature", or "[Mobile] Feature"

Available PRD sections:
${headingsList}

Return ONLY a valid JSON array (NO markdown, NO code fences, NO explanation):
${jsonStructure}

CRITICAL RULES:
- MINIMUM 60 test cases total
- MUST have at least: 20 Functional, 15 Negative, 10 Edge Case, 10 Sanity, 5 Exploratory
- testcaseId = empty string always
- Priority: P0 = critical/blocker, P1 = major, P2 = minor
- Test steps: 3-6 actionable steps each
- Each test case unique, specific, and platform-aware
- Output ONLY the JSON array${existingSummary}`;

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

    case 'functional_sanity':
      return `You are a QA engineer. Generate test cases for Web, TV, and Mobile from this PRD.

IMPORTANT: You MUST distribute test cases across these categories:
- 10 test cases with category "Functional" (happy path, normal flows)
- 5 test cases with category "Sanity" (basic smoke tests)
- 5 test cases with category "Negative" (error handling, invalid inputs)

For EACH test case, set the module field to include the platform: "[Web] Feature", "[TV] Feature", or "[Mobile] Feature"

PRD Sections: ${headingsList}

Return ONLY a JSON array (no markdown, no backticks):
${jsonStructure}

Rules:
- You MUST have exactly these category counts: 10 Functional, 5 Sanity, 5 Negative
- testcaseId must be empty string
- Priority: P0=critical, P1=major, P2=minor
- Test steps: 3-5 clear actions${existingSummary}`;

    case 'negative_edge':
      return `You are a QA engineer. Generate NEGATIVE and EDGE CASE test cases for Web, TV, and Mobile from this PRD.

IMPORTANT: You MUST use these categories:
- 10 test cases with category "Negative" (invalid inputs, error handling, boundary values, permission issues)
- 10 test cases with category "Edge Case" (race conditions, extreme data, unusual workflows, device-specific quirks)

For EACH test case, set the module field to include the platform: "[Web] Feature", "[TV] Feature", or "[Mobile] Feature"

PRD Sections: ${headingsList}

Return ONLY a JSON array (no markdown, no backticks):
${jsonStructure}

Rules:
- You MUST have exactly: 10 Negative, 10 Edge Case
- testcaseId must be empty string  
- Priority: P0=critical, P1=major, P2=minor
- Test steps: 3-5 clear actions
- Focus on what can go WRONG, not happy paths${existingSummary}`;

    case 'exploratory_more':
      return `You are a QA engineer. Generate EXPLORATORY test cases for Web, TV, and Mobile from this PRD.

IMPORTANT: You MUST use these categories:
- 10 test cases with category "Exploratory" (creative testing, unusual user journeys, stress scenarios)
- 5 test cases with category "Sanity" (additional smoke tests for untested areas)
- 5 test cases with category "Edge Case" (additional boundary and compatibility tests)

For EACH test case, set the module field to include the platform: "[Web] Feature", "[TV] Feature", or "[Mobile] Feature"

PRD Sections: ${headingsList}

Return ONLY a JSON array (no markdown, no backticks):
${jsonStructure}

Rules:
- You MUST have exactly: 10 Exploratory, 5 Sanity, 5 Edge Case
- testcaseId must be empty string
- Priority: P0=critical, P1=major, P2=minor
- Test steps: 3-5 clear actions
- Think creatively about unusual scenarios${existingSummary}`;

    case 'analytics':
      return `You are a senior QA engineer specializing in analytics event validation. Extract ALL analytics/tracking events from this PRD and generate validation test cases.

Your job is to identify every analytics event mentioned or implied in the PRD, including:
- Explicit event names (fire_event, track_action, logEvent, trackEvent, sendEvent patterns)
- Screen view events (page_view, screen_view)
- User action events (button clicks, form submissions, navigation)
- Conversion/funnel events (sign_up, purchase, subscription)
- Error/state events (error_shown, timeout, retry)

For EACH event, generate a test case with:
- eventName: The exact event name as it should fire (snake_case format)
- platform: Which platform this applies to (Android, iOS, Web, Android TV, Fire TV, Apple TV, Samsung TV, LG TV, Roku, or All)
- triggerAction: Step-by-step how to trigger this event (user actions)
- fields: Array of required fields with name, expectedValue, and required (boolean)
- openSearchQuery: A ready-to-use OpenSearch/DQL query to validate this event fired
- priority: P0 (critical conversion/revenue events), P1 (core user flow events), P2 (nice-to-have tracking)
- module: The PRD section this event belongs to

OpenSearch query format example:
event_name: "event_name_here" AND platform: "android" AND timestamp > now-1h

Return ONLY a valid JSON array (NO markdown, NO code fences, NO explanation):
[{"eventName": "...", "platform": "...", "triggerAction": "...", "fields": [{"name": "...", "expectedValue": "...", "required": true}], "openSearchQuery": "...", "priority": "P0|P1|P2", "module": "...", "notes": "..."}]

RULES:
- Extract EVERY event from the PRD — don't miss any
- If the PRD mentions a flow (e.g., "user subscribes"), infer the analytics events that SHOULD exist
- Include platform-specific events (e.g., deep_link_opened on mobile, page_view on web)
- For each event, include at minimum: event_name, user_id, platform, timestamp as required fields
- Add flow-specific fields (e.g., plan_name for subscription events, content_id for playback events)
- Generate 15-40 event test cases depending on PRD complexity
- Group by module/feature area${existingSummary}`;

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
 * Normalizes any non-empty category string to the nearest valid TestCaseCategory.
 * Instead of rejecting unknown categories, maps them to the closest match.
 * Performance, Security, Compatibility, Integration, Regression → Edge Case
 * (since these are specialized testing types that map best to edge-case coverage)
 */
function normalizeCategory(raw: string): TestCaseCategory {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('negative') || lower.includes('boundary') || lower.includes('error')) return 'Negative';
  if (lower.includes('edge') || lower.includes('corner')) return 'Edge Case';
  if (lower.includes('explor')) return 'Exploratory';
  if (lower.includes('sanity') || lower.includes('smoke') || lower.includes('basic')) return 'Sanity';
  if (lower.includes('functional') || lower.includes('happy') || lower.includes('positive')) return 'Functional';
  // Specialized testing types → Edge Case (performance, security, compatibility, etc.)
  if (lower.includes('performance') || lower.includes('security') || lower.includes('compatibility')
    || lower.includes('integration') || lower.includes('regression') || lower.includes('stress')
    || lower.includes('load') || lower.includes('ui') || lower.includes('ux')
    || lower.includes('accessibility')) return 'Edge Case';
  // Check exact match against valid set (handles already-correct values)
  if (VALID_CATEGORIES.has(raw.trim())) return raw.trim() as TestCaseCategory;
  // Default to Functional rather than rejecting
  return 'Functional';
}

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

  // Validate category — accept any non-empty string, then normalize
  if (typeof obj.category !== 'string' || obj.category.trim() === '') return null;
  const normalizedCategory = normalizeCategory(obj.category);

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
    category: normalizedCategory,
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
 * Numbers are sequential per category.
 * @param startCounters - Optional starting counters per prefix to avoid
 *   duplicate IDs across batches. Keys are prefixes (FUNC, NEG, etc.),
 *   values are the last used number for that prefix.
 * @returns Object with the assigned test cases and the updated counters.
 */
export function assignTestCaseIds(
  testCases: GeneratedTestCase[],
  pass: string,
  startCounters?: Record<string, number>
): GeneratedTestCase[] {
  const counters: Record<string, number> = startCounters ? { ...startCounters } : {};

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

/**
 * Computes the current ID counters from a set of existing test cases.
 * Used to continue numbering from where previous batches left off.
 */
export function getIdCountersFromCases(testCases: GeneratedTestCase[]): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const tc of testCases) {
    // Extract the number from IDs like TC_FUNC_003
    const match = tc.testcaseId.match(/^TC_([A-Z]+)_(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      counters[prefix] = Math.max(counters[prefix] || 0, num);
    }
  }
  return counters;
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
 * @param startCounters - Optional ID counters from previous batches to continue numbering
 */
export async function generateTestCasesForPass(
  prdText: string,
  prdHeadings: string[],
  pass: GenerationPass,
  existingCases: TestCaseSummary[] = [],
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  provider?: AIProvider,
  startCounters?: Record<string, number>
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

  // Assign proper IDs (using startCounters to continue numbering from previous batches)
  const casesWithIds = assignTestCaseIds(casesToUse, pass, startCounters);

  return casesWithIds;
}

// ─── Analytics Events Generation ─────────────────────────────────────────────

const VALID_ANALYTICS_PLATFORMS: Set<string> = new Set([
  'Android', 'iOS', 'Web', 'Android TV', 'Fire TV',
  'Apple TV', 'Samsung TV', 'LG TV', 'Roku', 'All',
]);

/**
 * Parses AI response for analytics event test cases.
 * Validates each entry against the AnalyticsTestCase schema.
 */
export function parseAnalyticsResponse(raw: string): AnalyticsTestCase[] {
  if (!raw || typeof raw !== 'string') return [];

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  cleaned = cleaned.trim();

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract individual JSON objects
    const objects: unknown[] = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*(?:\[[^\[\]]*(?:\{[^{}]*\}[^\[\]]*)*\][^{}]*)*\}/g;
    const matches = cleaned.matchAll(objRegex);
    for (const m of matches) {
      try {
        objects.push(JSON.parse(m[0]));
      } catch {
        // Try a more lenient extraction — find objects with eventName field
        try {
          const fixed = m[0].replace(/,\s*$/, '');
          objects.push(JSON.parse(fixed));
        } catch { /* skip */ }
      }
    }
    if (objects.length > 0) {
      parsed = objects;
    } else {
      // Try wrapping/fixing truncated array
      try {
        const fixedJson = cleaned.endsWith(']') ? cleaned : cleaned.replace(/,?\s*$/, '') + ']';
        const reParsed = fixedJson.startsWith('[') ? fixedJson : '[' + fixedJson;
        parsed = JSON.parse(reParsed);
      } catch {
        console.error('[parseAnalyticsResponse] All parse attempts failed');
        return [];
      }
    }
  }

  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const arrKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
      if (arrKey) parsed = obj[arrKey];
      else return [];
    } else {
      return [];
    }
  }

  const validCases: AnalyticsTestCase[] = [];
  let counter = 0;

  for (const entry of parsed as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;

    // Validate required fields
    if (typeof obj.eventName !== 'string' || obj.eventName.trim() === '') continue;
    if (typeof obj.triggerAction !== 'string' || obj.triggerAction.trim() === '') continue;
    if (typeof obj.priority !== 'string' || !VALID_PRIORITIES.has(obj.priority)) continue;

    // Normalize platform
    let platform: AnalyticsPlatform = 'All';
    if (typeof obj.platform === 'string') {
      const platLower = obj.platform.trim().toLowerCase();
      if (platLower.includes('android tv')) platform = 'Android TV';
      else if (platLower.includes('fire tv')) platform = 'Fire TV';
      else if (platLower.includes('apple tv')) platform = 'Apple TV';
      else if (platLower.includes('samsung')) platform = 'Samsung TV';
      else if (platLower.includes('lg')) platform = 'LG TV';
      else if (platLower.includes('roku')) platform = 'Roku';
      else if (platLower.includes('android')) platform = 'Android';
      else if (platLower.includes('ios') || platLower.includes('iphone') || platLower.includes('ipad')) platform = 'iOS';
      else if (platLower.includes('web') || platLower.includes('browser')) platform = 'Web';
      else if (VALID_ANALYTICS_PLATFORMS.has(obj.platform.trim())) platform = obj.platform.trim() as AnalyticsPlatform;
    }

    // Parse fields array
    let fields: AnalyticsTestCase['fields'] = [];
    if (Array.isArray(obj.fields)) {
      fields = (obj.fields as unknown[])
        .filter((f): f is Record<string, unknown> => f !== null && typeof f === 'object')
        .map((f) => ({
          name: typeof f.name === 'string' ? f.name.trim() : 'unknown',
          expectedValue: typeof f.expectedValue === 'string' ? f.expectedValue.trim() : '',
          required: f.required === true || f.required === 'true',
        }))
        .filter((f) => f.name !== 'unknown');
    }

    // Generate OpenSearch query if not provided
    let openSearchQuery = '';
    if (typeof obj.openSearchQuery === 'string' && obj.openSearchQuery.trim()) {
      openSearchQuery = obj.openSearchQuery.trim();
    } else {
      openSearchQuery = `event_name: "${obj.eventName.trim()}" AND platform: "${platform.toLowerCase()}" AND timestamp > now-1h`;
    }

    counter++;
    validCases.push({
      id: `AE_${String(counter).padStart(3, '0')}`,
      eventName: obj.eventName.trim(),
      platform,
      triggerAction: obj.triggerAction.trim(),
      fields,
      openSearchQuery,
      priority: obj.priority as AnalyticsTestCase['priority'],
      module: typeof obj.module === 'string' ? obj.module.trim() : 'General',
      notes: typeof obj.notes === 'string' ? obj.notes.trim() : undefined,
    });
  }

  return validCases;
}

/**
 * Generates analytics event test cases from a PRD.
 * Uses the 'analytics' pass prompt to extract all trackable events.
 */
export async function generateAnalyticsTestCases(
  prdText: string,
  prdHeadings: string[],
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  provider?: AIProvider,
): Promise<AnalyticsTestCase[]> {
  if (!prdText || prdText.trim() === '') {
    throw new Error('No extractable content from PRD');
  }

  const aiProvider = provider || getAIProvider();
  const truncatedText = truncateForContext(prdText, config.contextTokenBudget);
  const systemPrompt = buildSystemPrompt('analytics', prdHeadings, []);
  const question = `Here is the PRD document to extract analytics events from:\n\n${truncatedText}`;

  const result = await retryWithBackoff(
    () => aiProvider.askAI({ systemPrompt, history: [], question }),
    config.maxRetries,
    1000
  );

  return parseAnalyticsResponse(result.answer);
}
