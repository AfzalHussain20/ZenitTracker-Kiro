// src/types/test-cases.ts
// Type definitions for AI Test Case Generator feature

export type TestCaseCategory = 'Functional' | 'Negative' | 'Exploratory' | 'Sanity' | 'Edge Case';
export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'rejected';
export type Priority = 'P0' | 'P1' | 'P2';

export interface GeneratedTestCase {
  testcaseId: string;
  module: string;
  priority: Priority;
  testScenario: string;
  testSteps: string[];
  expectedResult: string;
  category: TestCaseCategory;
}

export interface StoredTestCase extends GeneratedTestCase {
  reviewStatus: ReviewStatus;
  editedFields?: Partial<Omit<GeneratedTestCase, 'testcaseId' | 'category'>>;
  sourceVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationMetadata {
  pageId: string;
  pageTitle: string;
  generatedAt: Date;
  totalCount: number;
  modelVersion: string;
  categories: Record<TestCaseCategory, number>;
}

export interface TestCaseReviewUpdate {
  reviewStatus: ReviewStatus;
  editedFields?: Partial<Omit<GeneratedTestCase, 'testcaseId' | 'category'>>;
}

export type GenerationPass = 'functional' | 'negative' | 'exploratory' | 'web' | 'tv' | 'mobile' | 'all' | 'functional_sanity' | 'negative_edge' | 'exploratory_more' | 'analytics';

export interface GenerateTestsRequest {
  pageId: string;
  pass: GenerationPass;
  existingTestCases?: TestCaseSummary[];
}

export interface GenerateTestsResponse {
  testCases: GeneratedTestCase[];
  pass: number;
  totalInPass: number;
  modelUsed: string;
}

export interface TestCaseSummary {
  id: string;
  scenario: string;
  category: string;
}

export interface GenerationConfig {
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  contextTokenBudget: number;
}

// ─── Analytics Events Test Cases ──────────────────────────────────────────────

export type AnalyticsPlatform = 'Android' | 'iOS' | 'Web' | 'Android TV' | 'Fire TV' | 'Apple TV' | 'Samsung TV' | 'LG TV' | 'Roku' | 'All';

export interface AnalyticsEventField {
  name: string;
  expectedValue: string;
  required: boolean;
}

export interface AnalyticsTestCase {
  id: string;
  eventName: string;
  platform: AnalyticsPlatform;
  triggerAction: string;
  fields: AnalyticsEventField[];
  openSearchQuery: string;
  priority: Priority;
  module: string;
  notes?: string;
}

export interface GenerateAnalyticsResponse {
  analyticsTestCases: AnalyticsTestCase[];
  totalEvents: number;
  platforms: AnalyticsPlatform[];
  modelUsed: string;
}
