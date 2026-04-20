# Requirements Document

## Introduction

The CleverTap Analytics QA Validator is a professional analytics validation system for the SunNxt app that validates incoming JSON event logs against a Master MIS Excel sheet with strict data integrity rules. The system provides comprehensive validation reports with attribute casing checks, data integrity verification, geo-location logic validation, and mandatory attribute matrix compliance.

## Glossary

- **Validator**: The analytics validation system that processes JSON event logs
- **MIS_Sheet**: Master MIS Excel sheet containing event schema definitions
- **Event_Log**: JSON payload containing analytics event data from CleverTap
- **Attribute**: Key-value pair within an event log (e.g., user_id, content_type)
- **Validation_Report**: Structured output document showing validation results
- **Geo_Sync**: Geographic location validation logic for international builds
- **Journey_ID**: Session sequencing identifier (parent and child variants)
- **Playback_Timestamp**: Time measurement attributes for app performance metrics

## Requirements

### Requirement 1: Attribute Casing Validation

**User Story:** As a QA engineer, I want to validate attribute name casing in event logs, so that I can ensure consistent snake_case formatting across all analytics events.

#### Acceptance Criteria

1. WHEN an event log contains an attribute key, THE Validator SHALL verify the key is strictly lowercase
2. WHEN an attribute key contains uppercase letters, THE Validator SHALL flag it as a casing violation
3. THE Validator SHALL accept mixed case or uppercase values for all attributes
4. WHEN validating attribute keys, THE Validator SHALL check for snake_case format (lowercase with underscores)
5. THE Validator SHALL report all casing violations with the attribute name and actual casing found

### Requirement 2: Data Integrity Checks

**User Story:** As a QA engineer, I want to detect invalid or missing data in event logs, so that I can identify data quality issues before they affect analytics.

#### Acceptance Criteria

1. WHEN an attribute value is null, THE Validator SHALL flag it as a data integrity violation
2. WHEN an attribute value is an empty string, THE Validator SHALL flag it as a data integrity violation
3. WHEN an attribute value contains only whitespace, THE Validator SHALL flag it as a data integrity violation
4. WHEN an attribute value is uppercase "NA", THE Validator SHALL flag it as invalid
5. WHEN an attribute value is lowercase "na", THE Validator SHALL accept it as valid
6. THE Validator SHALL report all data integrity violations with attribute name and actual value

### Requirement 3: International Build and VPN Geo-Sync Logic

**User Story:** As a QA engineer, I want to validate geographic location data consistency for international builds, so that I can ensure accurate location tracking when VPN is detected.

#### Acceptance Criteria

1. WHEN app_id indicates an international build, THE Validator SHALL monitor geographic attributes
2. WHEN vpn_detected is true AND city is identified, THE Validator SHALL verify country_code is not "na"
3. WHEN vpn_detected is true AND city is identified, THE Validator SHALL verify currency_code is not "na"
4. WHEN city has a valid value, THE Validator SHALL flag country_code as "na" as a geo-sync violation
5. WHEN city has a valid value, THE Validator SHALL flag currency_code as "na" as a geo-sync violation
6. THE Validator SHALL report geo-sync violations with affected attributes and their values

### Requirement 4: Mandatory Attribute Matrix Validation

**User Story:** As a QA engineer, I want to verify that all mandatory attributes from the MIS specification are present and valid, so that I can ensure complete event data capture.

#### Acceptance Criteria

1. THE Validator SHALL verify presence of user_child_journey_id in all event logs
2. THE Validator SHALL verify presence of user_parent_journey_id in all event logs
3. THE Validator SHALL verify presence of country_code in all event logs
4. THE Validator SHALL verify presence of currency_code in all event logs
5. WHEN playback events are detected, THE Validator SHALL verify presence of time_to_app_config_ms
6. WHEN playback events are detected, THE Validator SHALL verify presence of time_to_app_start_ms
7. WHEN playback events are detected, THE Validator SHALL verify presence of time_to_storefront_ms
8. WHEN playback events are detected, THE Validator SHALL verify presence of time_since_load_ms
9. WHEN a mandatory attribute is missing or has value "na", THE Validator SHALL report it in the MIS Gap Analysis section
10. THE Validator SHALL generate a table of all mandatory attributes that are missing or "na"

### Requirement 5: Validation Report Generation

**User Story:** As a QA engineer, I want to receive a comprehensive validation report for each event log, so that I can quickly identify and address analytics issues.

#### Acceptance Criteria

1. THE Validator SHALL generate a validation status of PASS, FAIL, or NEEDS IMPROVEMENT for each event log
2. THE Validator SHALL include a Casing & Integrity Summary section listing all violations
3. THE Validator SHALL include a Geo-Location Audit section with VPN and location consistency results
4. THE Validator SHALL include a MIS Gap Analysis section with a table of missing mandatory attributes
5. THE Validator SHALL include a Business Logic Review section with overall assessment
6. THE Validator SHALL include an Auditor's Conclusion section with final verdict and recommendations
7. THE Validator SHALL format the report in a structured, readable format
8. THE Validator SHALL include attribute names, expected values, and actual values for all violations

### Requirement 6: Export Function Implementation

**User Story:** As a developer, I want the validator to be implemented as an exportable function, so that I can reuse it across different parts of the dashboard.

#### Acceptance Criteria

1. THE Validator SHALL be implemented as an exported TypeScript function
2. THE Validator SHALL accept a JSON event log as input parameter
3. THE Validator SHALL accept an optional MIS schema configuration as input parameter
4. THE Validator SHALL return a structured validation report object
5. THE Validator SHALL be importable from other TypeScript modules
6. THE Validator SHALL include TypeScript type definitions for all inputs and outputs
7. THE Validator SHALL handle invalid JSON input gracefully with error messages

### Requirement 7: Integration with CleverTap Tracker Page

**User Story:** As a QA engineer, I want to access the validator from the existing CleverTap tracker page, so that I can validate events within my current workflow.

#### Acceptance Criteria

1. THE Validator SHALL be accessible from the CleverTap tracker page at src/app/(app)/dashboard/clevertap-tracker/page.tsx
2. THE Validator SHALL integrate with the existing validation workflow
3. THE Validator SHALL display validation reports in the existing UI components
4. THE Validator SHALL support batch validation of multiple events
5. THE Validator SHALL preserve existing tracker functionality
6. WHEN validation is triggered, THE Validator SHALL display results without page reload

### Requirement 8: MIS Schema Parser

**User Story:** As a developer, I want to parse the Master MIS Excel sheet into a validation schema, so that the validator can check events against the latest specifications.

#### Acceptance Criteria

1. THE Parser SHALL read the Master MIS Excel sheet from the file system
2. THE Parser SHALL extract event names from the sheet headers
3. THE Parser SHALL extract attribute names and their mandatory/optional status
4. THE Parser SHALL build a schema object mapping events to their required attributes
5. THE Parser SHALL handle missing or malformed Excel data gracefully
6. THE Parser SHALL cache the parsed schema to avoid repeated file reads
7. THE Parser SHALL support schema refresh when the Excel file is updated

### Requirement 9: Validation Rule Engine

**User Story:** As a developer, I want a rule engine that applies all validation rules systematically, so that validation is consistent and maintainable.

#### Acceptance Criteria

1. THE Rule_Engine SHALL apply casing validation rules to all attribute keys
2. THE Rule_Engine SHALL apply data integrity rules to all attribute values
3. THE Rule_Engine SHALL apply geo-sync rules when international build is detected
4. THE Rule_Engine SHALL apply mandatory attribute rules based on event type
5. THE Rule_Engine SHALL collect all violations during a single validation pass
6. THE Rule_Engine SHALL assign severity levels to violations (error, warning, info)
7. THE Rule_Engine SHALL support adding new validation rules without modifying existing rules

### Requirement 10: Professional Report Formatting

**User Story:** As a QA engineer, I want validation reports to be professionally formatted and easy to read, so that I can quickly understand validation results and share them with stakeholders.

#### Acceptance Criteria

1. THE Report_Formatter SHALL use clear section headers for each report section
2. THE Report_Formatter SHALL use tables for structured data like MIS Gap Analysis
3. THE Report_Formatter SHALL use color coding or badges for validation status
4. THE Report_Formatter SHALL include summary statistics (total attributes, violations, pass rate)
5. THE Report_Formatter SHALL format attribute names in monospace font for clarity
6. THE Report_Formatter SHALL support both HTML and plain text output formats
7. THE Report_Formatter SHALL include timestamps in all generated reports

