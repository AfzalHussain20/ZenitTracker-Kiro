# Requirements Document

## Introduction

AI Test Case Generator is Phase 2 of the Confluence PRD intelligence suite in the Zenit Tracker app. Building on the existing PRD Q&A chatbot (Phase 1), this feature enables QA engineers and product managers to automatically generate structured, reviewable test cases from any PRD document. The system uses multi-pass AI generation (functional → negative → exploratory) to produce comprehensive test coverage, with full traceability back to the source PRD sections. Generated test cases can be reviewed (accept/edit/reject), stored in Firestore, and exported to Excel/CSV.

## Glossary

- **Test_Case_Generator**: The AI-powered service that reads PRD content and produces structured test cases through multi-pass generation
- **Test_Case**: A structured row containing Testcase ID, Module, Priority, Test Scenario, Test Steps, and Expected Result
- **Review_Panel**: The UI component that displays generated test cases in categorized tabs and allows users to accept, edit, or reject each case
- **Generation_Job**: A background process that orchestrates the multi-pass AI generation pipeline and reports progress to the UI
- **PRD_Content**: The plain-text representation of a Confluence PRD page, extracted from storage-format HTML
- **Test_Case_Store**: The Firestore collection that persists generated and reviewed test cases
- **Module**: The PRD section or feature area from which a test case was derived, used for traceability
- **Source_Section**: A reference to the specific PRD heading or section from which a test case was derived (maps to the Module field)
- **Export_Service**: The module responsible for converting test case data into Excel (with category sheets) or CSV file format for download
- **Category**: The classification of a test case into Functional, Negative, Exploratory, Sanity, or Edge Case groupings

## Requirements

### Requirement 1: Trigger Test Case Generation

**User Story:** As a QA engineer, I want to trigger test case generation from a PRD page, so that I can quickly produce test coverage from requirements.

#### Acceptance Criteria

1. WHEN a user views a Confluence PRD page detail, THE Test_Case_Generator SHALL display a "Generate Test Cases" button in the page header area
2. WHEN the user clicks the "Generate Test Cases" button, THE Test_Case_Generator SHALL initiate a Generation_Job using the current PRD_Content
3. WHILE a Generation_Job is in progress for the current page, THE Test_Case_Generator SHALL disable the "Generate Test Cases" button and display a loading indicator
4. IF the PRD_Content is empty or cannot be extracted, THEN THE Test_Case_Generator SHALL display an error message indicating that the document has no extractable content

### Requirement 2: Multi-Pass AI Generation

**User Story:** As a QA engineer, I want the AI to generate test cases in structured passes, so that I get comprehensive coverage across functional, negative, and exploratory scenarios.

#### Acceptance Criteria

1. WHEN a Generation_Job starts, THE Test_Case_Generator SHALL execute generation in three sequential passes: functional/happy-path first, negative/boundary second, and exploratory/edge-case third
2. THE Test_Case_Generator SHALL send structured prompts to the Groq AI provider for each pass, including the PRD_Content as context and the pass type as instruction
3. WHEN a pass completes, THE Test_Case_Generator SHALL parse the AI response into structured Test_Case objects before proceeding to the next pass
4. THE Test_Case_Generator SHALL include previously generated test cases as context in subsequent passes to avoid duplication
5. IF the AI provider returns an error during any pass, THEN THE Test_Case_Generator SHALL retry the failed pass once before reporting the error to the user
6. IF the AI response cannot be parsed into valid Test_Case objects, THEN THE Test_Case_Generator SHALL discard the malformed entries and log a warning

### Requirement 3: Test Case Structure

**User Story:** As a QA engineer, I want each test case to follow a consistent columnar structure, so that I can easily understand and execute them in standard test management format.

#### Acceptance Criteria

1. THE Test_Case_Generator SHALL produce each Test_Case with exactly the following columns in order: Testcase ID, Module, Priority, Test Scenario, Test Steps, Expected Result
2. THE Test_Case_Generator SHALL assign a Testcase ID using an auto-incrementing pattern per category (e.g., TC_FUNC_001, TC_NEG_001, TC_EDGE_001)
3. THE Test_Case_Generator SHALL derive the Module value from the Source_Section heading in the PRD (the feature area or section the test case relates to)
4. THE Test_Case_Generator SHALL assign a Priority value from the set: P0, P1, or P2
5. THE Test_Case_Generator SHALL populate the Test Scenario field with a concise description of what is being tested
6. THE Test_Case_Generator SHALL populate the Test Steps field with ordered numbered steps to execute the test
7. THE Test_Case_Generator SHALL populate the Expected Result field with the verifiable outcome of executing the test steps
8. THE Test_Case_Generator SHALL categorize each test case into one of: Functional, Negative, Exploratory, Sanity, or Edge Case categories for grouping purposes

### Requirement 4: Background Job with Progress

**User Story:** As a user, I want test case generation to run in the background with progress updates, so that I can continue browsing without the UI being blocked.

#### Acceptance Criteria

1. WHEN a Generation_Job is initiated, THE Test_Case_Generator SHALL execute the generation asynchronously without blocking the page UI
2. WHILE a Generation_Job is running, THE Test_Case_Generator SHALL display a progress indicator showing the current pass (1 of 3, 2 of 3, 3 of 3) and pass name
3. WHEN a Generation_Job pass completes, THE Test_Case_Generator SHALL update the progress indicator to reflect the new pass count and intermediate test case total
4. WHEN the Generation_Job completes all passes, THE Test_Case_Generator SHALL display the total number of generated test cases and transition to the Review_Panel

### Requirement 5: Review Interface

**User Story:** As a QA engineer, I want to review each generated test case individually, so that I can accept valid cases, edit incomplete ones, and reject irrelevant ones.

#### Acceptance Criteria

1. WHEN a Generation_Job completes, THE Review_Panel SHALL display generated test cases organized in separate tabs per category (Functional, Negative, Exploratory, Sanity, Edge Case)
2. THE Review_Panel SHALL display each category tab as a table with columns: Testcase ID, Module, Priority, Test Scenario, Test Steps, Expected Result, and a review status action column
3. THE Review_Panel SHALL allow the user to set each test case status to one of: accepted, edited, or rejected
4. WHEN the user selects "edit" on a test case, THE Review_Panel SHALL open an inline editing form allowing modification of Module, Priority, Test Scenario, Test Steps, and Expected Result
5. THE Review_Panel SHALL allow the user to filter test cases by priority and review status within each category tab
6. THE Review_Panel SHALL allow the user to sort test cases by any column within each category tab
7. THE Review_Panel SHALL display a summary bar showing counts of accepted, edited, rejected, and pending test cases across all categories

### Requirement 6: Persist Generated Test Cases

**User Story:** As a QA engineer, I want generated test cases to be saved, so that I can return to review them later without re-generating.

#### Acceptance Criteria

1. WHEN a Generation_Job completes, THE Test_Case_Store SHALL persist all generated test cases to a Firestore collection associated with the PRD page ID
2. WHEN the user changes a test case review status (accept, edit, reject), THE Test_Case_Store SHALL update the corresponding document in Firestore within 2 seconds
3. WHEN a user navigates to a PRD page that has previously generated test cases, THE Test_Case_Generator SHALL load the existing test cases from the Test_Case_Store instead of showing the generation button
4. THE Test_Case_Store SHALL store a generation metadata record containing: generation timestamp, PRD page ID, total test case count, and model version used
5. WHEN the user requests regeneration on a page with existing test cases, THE Test_Case_Generator SHALL prompt for confirmation before overwriting the previous results

### Requirement 7: Export to Excel/CSV

**User Story:** As a QA engineer, I want to export generated test cases to Excel or CSV, so that I can share them with stakeholders and import them into test management tools.

#### Acceptance Criteria

1. WHEN test cases exist for a PRD page, THE Export_Service SHALL display export buttons for both Excel (.xlsx) and CSV (.csv) formats
2. WHEN the user clicks the Excel export button, THE Export_Service SHALL generate a workbook with separate sheets per test category (Functional, Negative, Exploratory, Sanity, Edge Case)
3. THE Export_Service SHALL include only test cases that have not been rejected in the export
4. THE Export_Service SHALL use the following columns in each sheet: Testcase ID, Module, Priority, Test Scenario, Test Steps, Expected Result
5. THE Export_Service SHALL format the Test Steps field as a numbered list within a single cell in the exported file
6. WHEN the user clicks the CSV export button, THE Export_Service SHALL generate a single CSV file with all non-rejected test cases and an additional "Category" column to indicate the test type
7. WHEN the export file is generated, THE Export_Service SHALL trigger a browser download with a filename pattern of "{PRD_title}_test_cases.{extension}"

### Requirement 8: Source Traceability

**User Story:** As a QA engineer, I want every test case to trace back to a specific PRD section via the Module field, so that I can verify coverage and understand the requirement context.

#### Acceptance Criteria

1. THE Test_Case_Generator SHALL extract section headings from the PRD_Content before initiating generation
2. THE Test_Case_Generator SHALL instruct the AI to reference a specific Source_Section for each generated Test_Case, populating the Module field
3. WHEN the user clicks a Module value in the Review_Panel, THE Review_Panel SHALL scroll the document view to the corresponding heading in the PRD
4. THE Test_Case_Generator SHALL validate that each Module value matches an actual heading in the PRD_Content
5. IF a Module value does not match any PRD heading, THEN THE Test_Case_Generator SHALL flag the test case with a "source unverified" indicator

### Requirement 9: Integration with Existing AI Infrastructure

**User Story:** As a developer, I want the test case generator to use the existing AI provider infrastructure, so that the implementation is consistent and maintainable.

#### Acceptance Criteria

1. THE Test_Case_Generator SHALL use the existing AIProvider interface and Groq provider from src/lib/ai/providers/ for all AI interactions
2. THE Test_Case_Generator SHALL use the existing extractPlainText function from src/lib/ai/extractText.ts to convert PRD HTML to plain text
3. THE Test_Case_Generator SHALL use the existing truncateForContext function to manage PRD text within the token budget
4. THE Test_Case_Generator SHALL use a structured system prompt that instructs the model to return JSON-formatted test cases
5. IF the Groq API rate limit is exceeded, THEN THE Test_Case_Generator SHALL implement exponential backoff with a maximum of 3 retries per pass
