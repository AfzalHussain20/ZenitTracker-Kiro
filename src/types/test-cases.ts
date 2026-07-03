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

export interface GenerateTestsRequest {
  pageId: string;
  pass: 'functional' | 'negative' | 'exploratory' | 'web' | 'tv' | 'mobile';
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
