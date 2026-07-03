# Implementation Plan: AI Test Case Generator

## Overview

This implementation plan builds the AI Test Case Generator feature incrementally — starting with types and core logic, then the API route, Firestore persistence, review UI, and export service. Each task builds on the previous, with property-based tests validating correctness properties from the design and integration wiring at the end.

## Tasks

- [x] 1. Set up types and core interfaces
  - [x] 1.1 Create test case type definitions
    - Create `src/types/test-cases.ts` with all TypeScript interfaces and types: `TestCaseCategory`, `ReviewStatus`, `Priority`, `GeneratedTestCase`, `StoredTestCase`, `GenerationMetadata`, `TestCaseReviewUpdate`, `GenerateTestsRequest`, `GenerateTestsResponse`, `TestCaseSummary`, `GenerationConfig`
    - _Requirements: 3.1, 3.2, 3.4, 3.8_

- [x] 2. Implement AI generation service
  - [x] 2.1 Create the test case generator service
    - Create `src/lib/ai/testCaseGenerator.ts` implementing:
      - `extractHeadings(plainText: string): string[]` — extracts markdown headings from plain text
      - `parseTestCaseResponse(raw: string): GeneratedTestCase[]` — parses AI JSON response with validation, discarding malformed entries
      - `assignTestCaseIds(testCases: GeneratedTestCase[], pass: string): GeneratedTestCase[]` — assigns IDs with pattern TC_{PREFIX}_{NNN}
      - `generateTestCasesForPass(...)` — orchestrates a single generation pass with prompt construction, AI call, parsing, and ID assignment
    - Use existing `extractPlainText` and `truncateForContext` utilities
    - Implement structured system prompts for each pass type (functional, negative, exploratory)
    - Implement exponential backoff retry logic (baseDelay * 2^N, max 3 retries)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.3, 8.1, 8.2, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.2 Write property test for parseTestCaseResponse
    - **Property 1: Test Case Parsing Resilience**
    - **Validates: Requirements 2.3, 2.6**
    - Use fast-check to generate arbitrary JSON strings (valid, partial, malformed) and verify that only valid GeneratedTestCase objects are returned

  - [ ]* 2.3 Write property test for structural validity
    - **Property 2: Structural Validity of Generated Test Cases**
    - **Validates: Requirements 3.1, 3.4, 3.6, 3.8**
    - Use fast-check to verify all parsed test cases have non-empty required fields with correct types and valid enum values

  - [ ]* 2.4 Write property test for test case ID format
    - **Property 3: Test Case ID Format Invariant**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate test cases across all categories and verify IDs match `TC_{PREFIX}_{NNN}` pattern

  - [ ]* 2.5 Write property test for heading extraction
    - **Property 5: Heading Extraction Completeness**
    - **Validates: Requirements 8.1**
    - Use fast-check to generate plain text with markdown headings and verify all headings are extracted without `#` prefixes

  - [ ]* 2.6 Write property test for exponential backoff
    - **Property 12: Exponential Backoff on Rate Limit**
    - **Validates: Requirements 9.5**
    - Use fast-check to verify retry delays follow `baseDelay * 2^N` pattern for consecutive 429 errors with max 3 attempts

- [x] 3. Implement Firestore persistence layer
  - [x] 3.1 Create test case store service
    - Create `src/lib/ai/testCaseStore.ts` implementing:
      - `saveGenerationResult(pageId, testCases, metadata)` — persists all test cases to Firestore `testCaseGenerations/{pageId}/testCases/{id}` with metadata doc
      - `loadTestCases(pageId)` — loads existing test cases for a page
      - `updateTestCaseReview(pageId, testcaseId, update)` — updates review status for individual test case
      - `hasExistingGeneration(pageId)` — checks if generation exists
      - `deleteGeneration(pageId)` — deletes existing generation for regeneration
    - Implement `sourceVerified` field logic: validate module matches extracted PRD headings
    - Handle Firestore write failures with single retry and 1s delay
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.4, 8.5_

  - [ ]* 3.2 Write property test for module traceability validation
    - **Property 4: Module Traceability Validation**
    - **Validates: Requirements 3.3, 8.4, 8.5**
    - Use fast-check to generate test cases and heading sets, verifying `sourceVerified` is true iff module matches a heading

- [x] 4. Implement API route for generation
  - [x] 4.1 Create the generate-tests API route
    - Create `src/app/api/ai/generate-tests/route.ts` implementing POST handler:
      - Accepts `GenerateTestsRequest` body (pageId, pass, existingTestCases)
      - Fetches Confluence page content via existing API pattern
      - Extracts plain text via `extractPlainText`
      - Truncates for context with 16000 char budget
      - Calls `generateTestCasesForPass` for the specified pass
      - Returns `GenerateTestsResponse` with test cases, pass number, total count, model used
    - Handle errors: empty content (400), AI failures (502), rate limits (429 with retry-after header)
    - _Requirements: 1.2, 1.4, 2.1, 2.2, 9.1, 9.2, 9.3_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement progress indicator component
  - [x] 6.1 Create TestGenProgress component
    - Create `src/components/TestGenProgress.tsx` implementing:
      - Props: `currentPass`, `passName`, `totalGenerated`, `isComplete`
      - Visual progress bar or stepper showing pass 1/2/3 with pass names (Functional, Negative, Exploratory)
      - Running count of generated test cases
      - Completion state transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Implement review panel and filtering
  - [x] 7.1 Create TestCaseReviewPanel component
    - Create `src/components/TestCaseReviewPanel.tsx` implementing:
      - Category tabs (Functional, Negative, Exploratory, Sanity, Edge Case)
      - Sortable, filterable table per tab with columns: Testcase ID, Module, Priority, Test Scenario, Test Steps, Expected Result, Review Status
      - Accept/Edit/Reject action buttons per row
      - Inline edit form for modifying Module, Priority, Test Scenario, Test Steps, Expected Result
      - Filter controls for priority and review status
      - Sort by any column (stable sort)
      - Summary bar showing counts of accepted/edited/rejected/pending
      - Module click handler to scroll to PRD heading
      - "Source unverified" indicator for unmatched modules
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 8.3, 8.5_

  - [ ]* 7.2 Write property test for filter correctness
    - **Property 6: Filter Correctness**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate test case arrays with random priorities and statuses, apply filter, verify result contains exactly matching items

  - [ ]* 7.3 Write property test for sort stability
    - **Property 7: Sort Stability and Correctness**
    - **Validates: Requirements 5.6**
    - Use fast-check to generate test case arrays, sort by each column, verify ordering correctness and stability for equal values

  - [ ]* 7.4 Write property test for review summary counts
    - **Property 8: Review Summary Count Accuracy**
    - **Validates: Requirements 5.7**
    - Use fast-check to generate test cases with random review statuses, verify sum of all status counts equals total

- [x] 8. Implement export service
  - [x] 8.1 Create test case export service
    - Create `src/lib/ai/testCaseExport.ts` implementing:
      - `generateExcelExport(testCases, prdTitle): Blob` — creates XLSX workbook with separate sheets per category using `xlsx` (SheetJS) library
      - `generateCsvExport(testCases, prdTitle): string` — creates CSV with Category column
      - `filterForExport(testCases): StoredTestCase[]` — excludes rejected test cases
      - `formatTestStepsForExport(steps: string[]): string` — formats steps as "1. step\n2. step\n..."
      - `generateExportFilename(prdTitle, extension): string` — sanitizes title, applies pattern `{sanitized}_test_cases.{ext}`
      - `downloadBlob(blob, filename): void` — triggers browser download
    - Include only non-rejected test cases in exports
    - Excel: separate sheets per category with standard columns
    - CSV: single file with additional Category column
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 8.2 Write property test for export excluding rejected
    - **Property 9: Export Excludes Rejected Test Cases**
    - **Validates: Requirements 7.3**
    - Use fast-check to generate test cases with mixed statuses, verify export contains zero rejected and all non-rejected

  - [ ]* 8.3 Write property test for test steps formatting
    - **Property 10: Test Steps Formatting for Export**
    - **Validates: Requirements 7.5**
    - Use fast-check to generate step arrays of varying lengths, verify formatted output has correct "N. step" pattern with newlines

  - [ ]* 8.4 Write property test for export filename pattern
    - **Property 11: Export Filename Pattern**
    - **Validates: Requirements 7.7**
    - Use fast-check to generate arbitrary PRD titles with special characters, verify filename matches `{sanitized}_test_cases.{ext}` pattern

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate generation flow into Confluence page
  - [x] 10.1 Wire generation UI into Confluence page view
    - Modify the existing Confluence page detail component to:
      - Add "Generate Test Cases" button in page header area
      - Integrate TestGenProgress component for generation progress display
      - Implement multi-pass orchestration: sequentially call API for functional → negative → exploratory passes, passing existing cases for dedup
      - On completion, persist results via `saveGenerationResult` and show ReviewPanel
      - On page load, check for existing generation via `hasExistingGeneration` and load test cases if present
      - Add regeneration flow with confirmation dialog before overwriting
      - Disable generate button during active generation
      - Show error message for empty/unextractable content
    - Integrate ExportButtons (Excel + CSV) into the ReviewPanel header
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 6.3, 6.5, 7.1_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The existing AI provider infrastructure (Groq/Gemini), `extractPlainText`, `truncateForContext`, and Firestore config are reused — no new infrastructure setup needed
- All generation is client-orchestrated with sequential API calls (no server-side job queue)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "3.2", "4.1"] },
    { "id": 3, "tasks": ["6.1", "8.1"] },
    { "id": 4, "tasks": ["7.1", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["10.1"] }
  ]
}
```
