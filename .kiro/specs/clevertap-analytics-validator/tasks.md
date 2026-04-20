# Implementation Plan: CleverTap Analytics QA Validator

## Overview

This implementation plan breaks down the CleverTap Analytics QA Validator into discrete coding tasks. The validator is a TypeScript-based system that validates analytics event logs against a Master MIS Excel schema, performing attribute casing checks, data integrity verification, geo-location logic validation, and mandatory attribute matrix compliance.

The implementation follows a modular architecture with clear separation between schema parsing, validation rules, and report generation. All validation logic is exportable and reusable across the dashboard.

## Tasks

- [ ] 1. Set up project structure and TypeScript types
  - Create directory structure: `src/lib/clevertap-validator/` with subdirectories for `rules/` and `__tests__/`
  - Create `src/lib/clevertap-validator/types.ts` with all TypeScript interfaces and types
  - Define core interfaces: `ValidationViolation`, `ValidationResult`, `ValidationReport`, `SchemaAttribute`, `EventSchema`, `ValidationSchema`, `ValidatorInput`, `ValidatorOutput`
  - Define validation options interface: `ValidationOptions` with platform, isInternationalBuild, strictCasing, allowFlexibleAttributes
  - _Requirements: 6.6, 6.1, 6.2, 6.3, 6.4_

- [ ] 2. Implement schema parser for Master MIS Excel
  - [ ] 2.1 Create schema parser module
    - Create `src/lib/clevertap-validator/schema-parser.ts`
    - Implement `parseExcelSchema` function that reads Excel workbook and extracts event schemas
    - Parse header row to identify event columns (columns with underscore-separated names)
    - Parse attribute rows to build attribute-to-rule mappings with mandatory/optional status
    - Handle "others" group attributes specially (mainAttribute = "others")
    - Implement schema caching to avoid repeated file reads
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [ ]* 2.2 Write property test for schema parser
    - **Property 11: Schema Parser Extracts Events**
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 2.3 Write property test for malformed input handling
    - **Property 12: Schema Parser Handles Malformed Input**
    - **Validates: Requirements 8.5**

  - [ ]* 2.4 Write unit tests for schema parser
    - Test parsing valid Excel file and verify event count
    - Test parsing Excel with missing columns and verify graceful error handling
    - Test parsing Excel with "others" group attributes
    - Test caching behavior (second parse doesn't re-read file)
    - _Requirements: 8.5_

- [ ] 3. Implement input parser for JSON event logs
  - [ ] 3.1 Create input parser module
    - Create `src/lib/clevertap-validator/input-parser.ts`
    - Implement `parseEventJson` function that parses JSON event logs into normalized attribute map
    - Handle multiple JSON formats (Kibana, CleverTap, raw)
    - Flatten nested objects with dot notation (e.g., `_source.message.user_id` → `user_id`)
    - Special handling for `others` object: extract sub-keys as `others(subkey)`
    - Normalize attribute names to lowercase
    - Handle timestamp variants (`event_timestamp_utc`, `event_timestamp_ist` → `event_timestamp`)
    - _Requirements: 6.7_

  - [ ]* 3.2 Write unit tests for input parser
    - Test parsing Kibana JSON format
    - Test parsing CleverTap JSON format
    - Test parsing JSON with nested `others` object
    - Test parsing JSON with timestamp variants
    - Test parsing invalid JSON and verify error response
    - _Requirements: 6.7_

- [ ] 4. Checkpoint - Ensure parsers work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement validation rules
  - [ ] 5.1 Create casing validator rule
    - Create `src/lib/clevertap-validator/rules/casing-validator.ts`
    - Implement `validateCasing` function that checks all attribute keys for uppercase letters
    - Validate snake_case format (lowercase with underscores only)
    - Do NOT validate attribute values (values can be any case)
    - Return array of `ValidationViolation` objects with violationType='CASING'
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [ ]* 5.2 Write property test for casing validator
    - **Property 1: Attribute Keys Must Be Lowercase Snake Case**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [ ]* 5.3 Write property test for value casing acceptance
    - **Property 2: Attribute Values Accept Any Casing**
    - **Validates: Requirements 1.3**

  - [ ]* 5.4 Write unit tests for casing validator
    - Test event with uppercase attribute key and verify CASING violation
    - Test event with snake_case keys and verify no violations
    - Test attribute values with mixed case and verify no violations
    - _Requirements: 1.3_

  - [ ] 5.5 Create data integrity checker rule
    - Create `src/lib/clevertap-validator/rules/data-integrity-checker.ts`
    - Implement `validateDataIntegrity` function that detects invalid values
    - Flag null, undefined, empty string, whitespace-only values as violations
    - Flag uppercase "NA" as invalid
    - Accept lowercase "na" as valid
    - Accept "false" as valid for boolean attributes
    - Return array of `ValidationViolation` objects with violationType='DATA_INTEGRITY'
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.6 Write property test for data integrity checker
    - **Property 3: Invalid Values Are Detected**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [ ]* 5.7 Write unit tests for data integrity checker
    - Test event with null value and verify DATA_INTEGRITY violation
    - Test event with empty string and verify violation
    - Test event with uppercase "NA" and verify violation
    - Test event with lowercase "na" and verify no violation
    - _Requirements: 2.5_

  - [ ] 5.8 Create geo-sync validator rule
    - Create `src/lib/clevertap-validator/rules/geo-sync-validator.ts`
    - Implement `validateGeoSync` function that validates geographic consistency
    - Only run when `isInternationalBuild` option is true
    - Check: if `vpn_detected === true` AND `city` has valid value, then `country_code` and `currency_code` must NOT be "na"
    - Return array of `ValidationViolation` objects with violationType='GEO_SYNC'
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.9 Write property test for geo-sync validator
    - **Property 4: Geo-Sync Validation For International Builds**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [ ]* 5.10 Write property test for geo-sync international build check
    - **Property 15: Geo-Sync Only Runs For International Builds**
    - **Validates: Requirements 3.1**

  - [ ]* 5.11 Write unit tests for geo-sync validator
    - Test international build with VPN and invalid country_code and verify GEO_SYNC violation
    - Test domestic build with same conditions and verify no geo-sync violations
    - Test international build without VPN and verify no violations
    - _Requirements: 3.1_

  - [ ] 5.12 Create mandatory attributes checker rule
    - Create `src/lib/clevertap-validator/rules/mandatory-attributes-checker.ts`
    - Implement `validateMandatoryAttributes` function that verifies presence of required attributes
    - Verify presence of all attributes marked as mandatory in schema
    - Special handling for flexible attributes (journey IDs, experiment IDs)
    - Special handling for playback events (time_to_* attributes)
    - Flag missing or "na" values for mandatory attributes
    - Return array of `ValidationViolation` objects with violationType='MISSING_MANDATORY'
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 5.13 Write property test for mandatory attributes checker
    - **Property 5: Mandatory Attributes Are Enforced**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

  - [ ]* 5.14 Write unit tests for mandatory attributes checker
    - Test event missing mandatory attribute and verify MISSING_MANDATORY violation
    - Test playback event missing time_to_* attributes and verify violations
    - Test event with all mandatory attributes present and verify no violations
    - _Requirements: 4.10_

- [ ] 6. Checkpoint - Ensure all validation rules work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement validation engine
  - [ ] 7.1 Create validation engine module
    - Create `src/lib/clevertap-validator/validation-engine.ts`
    - Implement `validateEvent` function that orchestrates all validation rules
    - Apply casing validation rules to all attribute keys
    - Apply data integrity rules to all attribute values
    - Apply geo-sync rules when international build is detected
    - Apply mandatory attribute rules based on event type
    - Collect all violations during a single validation pass
    - Assign severity levels to violations (ERROR, WARNING, INFO)
    - Calculate validation score based on passed/failed attributes
    - Determine validation status (PASS, FAIL, NEEDS_IMPROVEMENT)
    - Return `ValidationResult` object with all violations and metadata
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 7.2 Write property test for violation context
    - **Property 6: Violations Include Complete Context**
    - **Validates: Requirements 1.5, 2.6, 3.6**

  - [ ]* 7.3 Write property test for validation status
    - **Property 7: Validation Status Is Always Determined**
    - **Validates: Requirements 5.1**

  - [ ]* 7.4 Write property test for single pass execution
    - **Property 16: All Rules Execute In Single Pass**
    - **Validates: Requirements 9.5**

  - [ ]* 7.5 Write property test for severity levels
    - **Property 17: Violations Have Severity Levels**
    - **Validates: Requirements 9.6**

  - [ ]* 7.6 Write unit tests for validation engine
    - Test validation with multiple violation types and verify all are detected
    - Test validation with 100% score and verify PASS status
    - Test validation with errors and verify FAIL status
    - Test validation with warnings only and verify NEEDS_IMPROVEMENT status
    - _Requirements: 9.7_

- [ ] 8. Implement report formatter
  - [ ] 8.1 Create report formatter module
    - Create `src/lib/clevertap-validator/report-formatter.ts`
    - Implement `formatValidationReport` function that generates structured report from validation result
    - Create summary section with status, score, total/passed/failed attributes
    - Create Casing & Integrity Summary section with violation table
    - Create Geo-Location Audit section with VPN and location consistency results
    - Create MIS Gap Analysis section with table of missing mandatory attributes
    - Create Business Logic Review section with overall assessment
    - Create Auditor's Conclusion section with final verdict and recommendations
    - Include metadata: event name, platform, timestamp
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ] 8.2 Implement report rendering functions
    - Implement `renderReportAsMarkdown` function for plain text output
    - Implement `renderReportAsHTML` function for UI display
    - Use clear section headers for each report section
    - Use tables for structured data like MIS Gap Analysis
    - Use color coding or badges for validation status
    - Format attribute names in monospace font for clarity
    - Include timestamps in all generated reports
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7_

  - [ ]* 8.3 Write property test for report statistics
    - **Property 8: Report Contains Required Statistics**
    - **Validates: Requirements 10.4**

  - [ ]* 8.4 Write property test for report timestamp
    - **Property 9: Report Contains Timestamp**
    - **Validates: Requirements 10.7**

  - [ ]* 8.5 Write unit tests for report formatter
    - Test formatting validation result and verify all required sections are present
    - Test formatting result with violations and verify violation table structure
    - Test formatting result with 100% score and verify PASS status
    - Test generating HTML report and verify HTML structure
    - Test generating markdown report and verify markdown structure
    - _Requirements: 10.4_

- [ ] 9. Checkpoint - Ensure report generation works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement main validator function
  - [ ] 10.1 Create main validator module
    - Create `src/lib/clevertap-validator/index.ts`
    - Implement `validateCleverTapEvent` function as the public API
    - Accept `ValidatorInput` with eventJson, eventName, schema, options
    - Parse JSON using input parser
    - Load or use provided schema
    - Run validation engine
    - Format validation report
    - Return `ValidatorOutput` with success, result, report, or error
    - Handle all errors gracefully and return structured error responses
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [ ]* 10.2 Write property test for invalid JSON handling
    - **Property 10: Invalid JSON Returns Error Response**
    - **Validates: Requirements 6.7**

  - [ ]* 10.3 Write property test for structured output
    - **Property 14: Validator Returns Structured Output**
    - **Validates: Requirements 6.4**

  - [ ]* 10.4 Write property test for batch validation
    - **Property 13: Batch Validation Produces Multiple Results**
    - **Validates: Requirements 7.4**

  - [ ]* 10.5 Write integration tests for main validator
    - Test validating real event JSON from production logs
    - Test parsing real Master MIS Excel file and validating against it
    - Test batch validation of multiple events
    - _Requirements: 7.4_

- [ ] 11. Integrate validator with CleverTap tracker page
  - [ ] 11.1 Refactor CleverTap tracker page to use new validator
    - Open `src/app/(app)/dashboard/clevertap-tracker/page.tsx`
    - Fix UTF-8 encoding issue in the file
    - Import `validateCleverTapEvent` from `@/lib/clevertap-validator`
    - Replace inline validation logic with calls to new validator function
    - Update UI components to display new validation report format
    - Preserve existing tracker functionality (Excel upload, export, etc.)
    - Support batch validation of multiple events
    - Display validation results without page reload
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 11.2 Write integration tests for tracker page
    - Test validator integration with existing UI components
    - Test batch validation workflow
    - Test export functionality with new report format
    - _Requirements: 7.4_

- [ ] 12. Final checkpoint - End-to-end validation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify validator can be imported and used from other modules
  - Verify CleverTap tracker page displays validation reports correctly
  - Verify batch validation works for multiple events

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check` library
- Unit tests validate specific examples and edge cases
- The validator is designed as an exportable function for reusability
- All validation logic is modular and testable
- Report formatting supports both console output and UI display
