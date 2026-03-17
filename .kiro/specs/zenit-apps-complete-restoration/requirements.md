# Requirements Document: Zenit Apps Complete Restoration

## Introduction

This document specifies the complete restoration of functionality for all 7 major applications within the Zenit Tracker platform. Each application was recently redesigned with a modern UI featuring Three.js 3D visualizations, particle backgrounds, and smooth animations, but lost significant functionality during simplification. This restoration will bring back all original features, workflows, and capabilities while maintaining and enhancing the stunning new visual design.

The Zenit Tracker platform is a comprehensive testing and quality assurance suite that includes device management, time tracking, test automation, analytics tracking, and team collaboration tools. The restoration must ensure every route, sub-route, and workflow functions properly with complete data persistence and real-time updates.

## Glossary

- **Vision**: Device Inspector application for real-time mobile device automation and inspection
- **Keepr**: Device Management system for tracking and managing testing devices across teams
- **Wrklog**: Time Tracker application for logging work hours, projects, and productivity analytics
- **Repository**: Test Case Library for managing test cases, test beds, and UBS extraction
- **Locator_Lab**: Locator Studio for generating and validating element locators with strategy recommendations
- **CleverTap_Tracker**: Analytics Tracker for capturing, validating, and exporting analytics events
- **Team_Performance**: Team analytics and performance dashboard with 3D visualizations
- **Three.js**: JavaScript 3D library used for rendering interactive 3D models and visualizations
- **Particle_Background**: Animated particle system providing ambient visual effects
- **WebSocket**: Real-time bidirectional communication protocol for device streaming
- **Element_Hierarchy**: Tree structure representing UI elements on a connected device
- **UBS_Extraction**: Unified Batch System for extracting and processing test cases
- **Selector_Strategy**: Method for locating UI elements (ID, XPath, CSS, Accessibility, etc.)
- **In_House_Validation**: Multi-sheet Excel-based analytics validation workflow
- **Firestore**: Firebase real-time database for data persistence
- **Framer_Motion**: Animation library for smooth UI transitions

## Requirements

### Requirement 1: Vision - WebSocket Device Connection

**User Story:** As a QA engineer, I want to establish real-time WebSocket connections to mobile devices, so that I can inspect and automate device interactions in real-time.

#### Acceptance Criteria

1. WHEN a user navigates to Vision, THE System SHALL display a connection interface with device selection options
2. WHEN a user selects a device and clicks connect, THE System SHALL establish a WebSocket connection to the device
3. WHEN the WebSocket connection is established, THE System SHALL update the device status to "CONNECTED" and display real-time device screen
4. WHEN the connection fails, THE System SHALL display an error message with retry options
5. WHILE connected, THE System SHALL maintain a heartbeat to detect disconnections
6. WHEN the device disconnects, THE System SHALL update status to "DISCONNECTED" and notify the user
7. THE System SHALL support connections to Android, iOS, and TV devices
8. THE System SHALL display connection latency and frame rate metrics

### Requirement 2: Vision - Real-Time Element Hierarchy Tree

**User Story:** As a QA engineer, I want to view the live element hierarchy of a connected device, so that I can inspect UI structure and locate elements for automation.

#### Acceptance Criteria

1. WHILE a device is connected, THE System SHALL fetch and display the element hierarchy tree
2. WHEN the device screen changes, THE System SHALL automatically refresh the element hierarchy
3. WHEN a user clicks an element in the tree, THE System SHALL highlight the corresponding element on the device screen
4. WHEN a user clicks an element on the device screen, THE System SHALL highlight and scroll to the corresponding node in the tree
5. THE System SHALL display element properties including ID, class, text, bounds, and attributes
6. THE System SHALL support expanding and collapsing tree nodes
7. THE System SHALL provide search functionality to filter elements by property values
8. THE System SHALL display element depth and parent-child relationships visually

### Requirement 3: Vision - Advanced Recording Features

**User Story:** As a QA engineer, I want to record device interactions with advanced options, so that I can generate comprehensive automation scripts.

#### Acceptance Criteria

1. WHEN a user clicks "Start Recording", THE System SHALL begin capturing all device interactions
2. WHILE recording, THE System SHALL capture taps, swipes, text input, and navigation actions
3. WHEN a user performs an action, THE System SHALL display the action in a real-time action list with timestamps
4. WHEN a user clicks "Stop Recording", THE System SHALL finalize the recording and enable script generation
5. THE System SHALL support pause and resume functionality during recording
6. THE System SHALL allow users to add assertions and validations during recording
7. THE System SHALL capture screenshots at each action step
8. THE System SHALL support recording multiple test scenarios in a single session

### Requirement 4: Vision - Script Generation Engine

**User Story:** As a QA engineer, I want to generate automation scripts from recorded actions, so that I can quickly create test automation code.

#### Acceptance Criteria

1. WHEN recording is complete, THE System SHALL provide script generation options
2. THE System SHALL support generating scripts in Java (Appium), Python (Appium), JavaScript (WebDriverIO), and Kotlin
3. WHEN a user selects a language, THE System SHALL generate syntactically correct automation code
4. THE System SHALL include proper imports, setup, and teardown code in generated scripts
5. THE System SHALL generate Page Object Model (POM) classes when requested
6. THE System SHALL include wait conditions and error handling in generated code
7. THE System SHALL allow users to customize script templates and naming conventions
8. WHEN script generation completes, THE System SHALL provide download and copy-to-clipboard options

### Requirement 5: Vision - Element Inspection Details Panel

**User Story:** As a QA engineer, I want to view detailed information about selected elements, so that I can choose the best locator strategy for automation.

#### Acceptance Criteria

1. WHEN a user selects an element, THE System SHALL display a details panel with all element properties
2. THE System SHALL display all available locator strategies (ID, XPath, CSS, Accessibility ID, Class Name)
3. THE System SHALL rank locator strategies by reliability and uniqueness
4. WHEN a user clicks a locator, THE System SHALL copy it to clipboard and show confirmation
5. THE System SHALL display element visibility, enabled state, and interaction capabilities
6. THE System SHALL show element coordinates, size, and position on screen
7. THE System SHALL display parent and child element relationships
8. THE System SHALL provide "Find Similar Elements" functionality to locate elements with similar properties

### Requirement 6: Vision - 3D Device Model Enhancement

**User Story:** As a QA engineer, I want an enhanced 3D device visualization, so that I can have an engaging and informative interface.

#### Acceptance Criteria

1. THE System SHALL render a Three.js 3D model of the connected device type (phone, tablet, TV)
2. WHILE connected, THE System SHALL animate the 3D model with pulsing effects
3. WHILE recording, THE System SHALL change the 3D model color to red with recording indicator
4. THE System SHALL display scanning particle effects around the device when connected
5. THE System SHALL allow users to rotate and zoom the 3D model using mouse/touch controls
6. WHEN actions are performed, THE System SHALL animate the 3D model to indicate activity
7. THE System SHALL display device battery level, temperature, and memory usage on the 3D model
8. THE System SHALL support different device models with accurate 3D representations

### Requirement 7: Keepr - Complete Audit Workflow

**User Story:** As a device manager, I want a comprehensive daily audit workflow, so that I can verify device inventory and track discrepancies.

#### Acceptance Criteria

1. THE System SHALL provide a "Start Daily Audit" button on the Keepr dashboard
2. WHEN a user starts an audit, THE System SHALL create an audit session with timestamp and auditor information
3. WHILE auditing, THE System SHALL display a checklist of all registered devices grouped by location
4. WHEN a user verifies a device, THE System SHALL mark it as "verified" with timestamp
5. WHEN a user marks a device as missing, THE System SHALL flag it and require notes
6. WHEN audit is complete, THE System SHALL generate an audit report showing verified, missing, and discrepancy counts
7. THE System SHALL save audit history to Firestore with full audit trail
8. THE System SHALL send notifications for missing devices to team leads
9. THE System SHALL support bulk verification by location or device type
10. THE System SHALL display audit completion percentage in real-time

### Requirement 8: Keepr - Team Management Features

**User Story:** As a team lead, I want to manage team members and their device assignments, so that I can track accountability and usage patterns.

#### Acceptance Criteria

1. WHEN a user navigates to Keepr Team page, THE System SHALL display all team members
2. THE System SHALL show each team member's currently checked-out devices
3. WHEN a user clicks on a team member, THE System SHALL display their device history and usage statistics
4. THE System SHALL allow team leads to assign devices to specific team members
5. THE System SHALL support creating device reservation schedules for team members
6. THE System SHALL display team-wide device utilization metrics with 3D visualizations
7. THE System SHALL allow setting device checkout limits per team member
8. THE System SHALL send reminders to team members with overdue device returns

### Requirement 9: Keepr - Device Accessories Tracking

**User Story:** As a device manager, I want to track device accessories and peripherals, so that I can ensure complete device kits are maintained.

#### Acceptance Criteria

1. WHEN a user views a device, THE System SHALL display associated accessories (chargers, cables, cases, remotes)
2. THE System SHALL allow adding, editing, and removing accessories for each device
3. WHEN a device is checked out, THE System SHALL prompt user to verify accessory checklist
4. WHEN a device is checked in, THE System SHALL require accessory verification before completion
5. THE System SHALL flag devices with missing accessories in the device list
6. THE System SHALL track accessory condition (working, damaged, missing)
7. THE System SHALL generate accessory inventory reports
8. THE System SHALL support bulk accessory assignment to multiple devices

### Requirement 10: Keepr - My Devices Detailed View

**User Story:** As a QA engineer, I want to view my personally checked-out devices with detailed information, so that I can manage my device usage effectively.

#### Acceptance Criteria

1. WHEN a user navigates to My Devices, THE System SHALL display all devices currently checked out by the user
2. THE System SHALL display checkout timestamp, duration, and expected return date for each device
3. THE System SHALL show device usage history including previous checkout sessions
4. THE System SHALL allow users to add notes and tags to their checked-out devices
5. THE System SHALL display device health metrics (battery cycles, storage usage, last maintenance)
6. THE System SHALL provide quick check-in functionality with one-click return
7. THE System SHALL show device location and last known status
8. THE System SHALL allow users to request device checkout extensions with approval workflow

### Requirement 11: Keepr - Comprehensive Reporting

**User Story:** As a device manager, I want comprehensive device reports, so that I can analyze usage patterns and make informed decisions.

#### Acceptance Criteria

1. THE System SHALL provide a Reports section in Keepr with multiple report types
2. THE System SHALL generate Device Utilization Reports showing usage percentage by device and time period
3. THE System SHALL generate Team Usage Reports showing checkout patterns by team member
4. THE System SHALL generate Maintenance Reports showing device health and maintenance schedules
5. THE System SHALL generate Audit History Reports with all audit sessions and findings
6. WHEN a user selects a report type, THE System SHALL display interactive 3D visualizations of the data
7. THE System SHALL allow exporting reports to Excel, PDF, and CSV formats
8. THE System SHALL support custom date ranges and filtering for all reports
9. THE System SHALL display trend analysis with predictive insights for device needs

### Requirement 12: Keepr - 3D Fleet Visualization Enhancement

**User Story:** As a device manager, I want an enhanced 3D fleet visualization, so that I can quickly understand device status at a glance.

#### Acceptance Criteria

1. THE System SHALL render a Three.js 3D visualization of the entire device fleet
2. THE System SHALL represent each device as a 3D object colored by status (green=available, blue=in-use, amber=maintenance)
3. WHEN a user hovers over a device, THE System SHALL display a tooltip with device details
4. WHEN a user clicks a device, THE System SHALL navigate to the device detail view
5. THE System SHALL animate device status changes with smooth transitions
6. THE System SHALL group devices by location in 3D space with labeled sections
7. THE System SHALL support camera controls for rotating, zooming, and panning the fleet view
8. THE System SHALL display real-time updates when device status changes

### Requirement 13: Wrklog - Project Management System

**User Story:** As a QA engineer, I want to manage projects and associate time entries with projects, so that I can track time spent on different initiatives.

#### Acceptance Criteria

1. WHEN a user navigates to Wrklog Projects, THE System SHALL display all active projects
2. THE System SHALL allow creating new projects with name, description, color, and client information
3. WHEN a user starts a timer, THE System SHALL allow selecting a project to associate the time entry
4. THE System SHALL display total time logged per project with visual progress bars
5. THE System SHALL support project budgets and alert when time exceeds allocated hours
6. THE System SHALL allow archiving completed projects
7. THE System SHALL display project timelines with start and end dates
8. THE System SHALL support project tags and categories for organization
9. THE System SHALL provide project-level analytics showing time distribution by team member

### Requirement 14: Wrklog - Calendar Integration

**User Story:** As a QA engineer, I want a calendar view of my time entries, so that I can visualize my work patterns and plan effectively.

#### Acceptance Criteria

1. WHEN a user navigates to Wrklog Calendar, THE System SHALL display a monthly calendar view
2. THE System SHALL show time entries as colored blocks on calendar dates
3. WHEN a user clicks a date, THE System SHALL display all time entries for that day with details
4. THE System SHALL allow creating time entries directly from the calendar by clicking dates
5. THE System SHALL support drag-and-drop to move time entries between dates
6. THE System SHALL display daily total hours on each calendar date
7. THE System SHALL highlight weekends, holidays, and non-working days differently
8. THE System SHALL support switching between month, week, and day views
9. THE System SHALL allow filtering calendar by project or activity type

### Requirement 15: Wrklog - Detailed Analytics Dashboard

**User Story:** As a QA engineer, I want detailed analytics of my time tracking, so that I can understand my productivity patterns and optimize my workflow.

#### Acceptance Criteria

1. WHEN a user navigates to Wrklog Analytics, THE System SHALL display comprehensive productivity metrics
2. THE System SHALL render 3D visualizations for weekly time distribution (replacing bar charts)
3. THE System SHALL display project allocation with animated 3D donut charts
4. THE System SHALL show productivity trends over time with 3D line/curve charts
5. THE System SHALL calculate and display efficiency scores based on time patterns
6. THE System SHALL identify peak productivity hours and suggest optimal work schedules
7. THE System SHALL display support hours separately with weekend/holiday indicators
8. THE System SHALL show streak information (consecutive days logged)
9. THE System SHALL provide AI-powered productivity tips based on usage patterns
10. THE System SHALL allow exporting analytics reports to PDF and Excel

### Requirement 16: Wrklog - Time Tracking Persistence

**User Story:** As a QA engineer, I want my time entries to persist across sessions, so that I can maintain accurate historical records.

#### Acceptance Criteria

1. WHEN a user creates a time entry, THE System SHALL save it to Firestore immediately
2. WHEN a user starts a timer, THE System SHALL persist the running timer state
3. IF the browser closes while timer is running, THEN THE System SHALL resume the timer when user returns
4. THE System SHALL sync time entries across multiple devices in real-time
5. THE System SHALL support editing historical time entries with audit trail
6. THE System SHALL allow deleting time entries with confirmation
7. THE System SHALL support bulk operations (edit, delete, export) on multiple time entries
8. THE System SHALL maintain data integrity with validation rules (no negative time, no future dates)

### Requirement 17: Wrklog - 3D Clock Visualization Enhancement

**User Story:** As a QA engineer, I want an engaging 3D clock visualization, so that I have an aesthetically pleasing timer interface.

#### Acceptance Criteria

1. THE System SHALL render a Three.js 3D clock model on the Wrklog dashboard
2. WHILE timer is running, THE System SHALL animate the clock with rotating elements
3. THE System SHALL display elapsed time on the 3D clock face
4. THE System SHALL change clock color based on timer state (idle, running, paused)
5. THE System SHALL add particle effects around the clock when timer reaches milestones
6. THE System SHALL support different clock themes (analog, digital, futuristic)
7. THE System SHALL animate smooth transitions when starting, pausing, or stopping timer
8. THE System SHALL display project color on the clock when timer is associated with a project

### Requirement 18: Repository - Test Bed Management

**User Story:** As a QA lead, I want to organize test cases into test beds, so that I can group related tests for different testing scenarios.

#### Acceptance Criteria

1. WHEN a user navigates to Repository, THE System SHALL display test beds and test cases
2. THE System SHALL allow creating test beds with name, description, and platform
3. WHEN a user creates a test bed, THE System SHALL allow adding test cases to it
4. THE System SHALL support drag-and-drop to organize test cases within test beds
5. THE System SHALL allow moving test cases between test beds
6. THE System SHALL display test bed statistics (total tests, pass rate, last run date)
7. THE System SHALL support test bed templates for common testing scenarios
8. THE System SHALL allow cloning test beds with all associated test cases
9. THE System SHALL support test bed versioning for tracking changes over time

### Requirement 19: Repository - UBS Extraction Engine

**User Story:** As a QA engineer, I want to extract test cases from various sources using UBS, so that I can quickly import existing test documentation.

#### Acceptance Criteria

1. THE System SHALL provide a UBS Extraction interface in Repository
2. THE System SHALL support extracting test cases from Excel files with configurable column mapping
3. THE System SHALL support extracting test cases from JIRA with JQL queries
4. THE System SHALL support extracting test cases from TestRail via API integration
5. WHEN extraction is initiated, THE System SHALL validate data format and show preview
6. WHEN user confirms extraction, THE System SHALL import test cases with all metadata
7. THE System SHALL handle duplicate detection and provide merge/skip options
8. THE System SHALL log extraction history with source, count, and timestamp
9. THE System SHALL support scheduled automatic extractions from configured sources

### Requirement 20: Repository - Import/Export Functionality

**User Story:** As a QA lead, I want to import and export test cases in multiple formats, so that I can share test documentation with stakeholders.

#### Acceptance Criteria

1. THE System SHALL provide Export functionality with format selection (Excel, CSV, JSON, PDF)
2. WHEN a user exports test cases, THE System SHALL include all test case fields and metadata
3. THE System SHALL allow filtering test cases before export by test bed, status, or tags
4. THE System SHALL provide Import functionality supporting Excel, CSV, and JSON formats
5. WHEN importing, THE System SHALL validate data structure and show validation errors
6. THE System SHALL support bulk import of hundreds of test cases efficiently
7. THE System SHALL provide import templates for each supported format
8. THE System SHALL maintain test case relationships and dependencies during import/export

### Requirement 21: Repository - Batch Operations

**User Story:** As a QA engineer, I want to perform batch operations on test cases, so that I can efficiently manage large test suites.

#### Acceptance Criteria

1. THE System SHALL allow selecting multiple test cases using checkboxes
2. WHEN test cases are selected, THE System SHALL display batch operation toolbar
3. THE System SHALL support batch delete with confirmation dialog
4. THE System SHALL support batch status update (active, deprecated, under review)
5. THE System SHALL support batch tag assignment and removal
6. THE System SHALL support batch move to different test bed
7. THE System SHALL support batch priority update
8. WHEN batch operation completes, THE System SHALL show success count and any errors
9. THE System SHALL support "Select All" and "Select None" for entire test case list

### Requirement 22: Repository - Test Case Organization

**User Story:** As a QA engineer, I want advanced organization features for test cases, so that I can maintain a well-structured test library.

#### Acceptance Criteria

1. THE System SHALL support hierarchical folder structure for organizing test cases
2. THE System SHALL allow creating folders and subfolders with unlimited depth
3. THE System SHALL support tagging test cases with multiple custom tags
4. THE System SHALL provide advanced search with filters (tags, status, priority, author, date)
5. THE System SHALL support saved search queries for frequently used filters
6. THE System SHALL allow sorting test cases by multiple criteria
7. THE System SHALL display test case relationships (depends on, blocks, relates to)
8. THE System SHALL support test case versioning with change history
9. THE System SHALL allow adding attachments (screenshots, videos, documents) to test cases

### Requirement 23: Repository - 3D Book Visualization Enhancement

**User Story:** As a QA engineer, I want an enhanced 3D book visualization, so that I have an engaging interface for browsing test cases.

#### Acceptance Criteria

1. THE System SHALL render Three.js 3D books representing test beds on the Repository page
2. WHEN a user hovers over a book, THE System SHALL animate it with lift and glow effects
3. WHEN a user clicks a book, THE System SHALL open the test bed with smooth transition
4. THE System SHALL color-code books by test bed status or platform
5. THE System SHALL display test bed statistics on book spines (test count, pass rate)
6. THE System SHALL arrange books on a 3D bookshelf with realistic lighting
7. THE System SHALL support camera controls for exploring the bookshelf
8. THE System SHALL animate new books appearing when test beds are created

### Requirement 24: Locator Lab - Advanced Selector Strategies

**User Story:** As a QA engineer, I want advanced selector strategy recommendations, so that I can create robust and maintainable locators.

#### Acceptance Criteria

1. WHEN a user scans a URL, THE System SHALL analyze all elements and generate multiple locator strategies
2. THE System SHALL support ID, XPath, CSS Selector, Accessibility ID, Class Name, Tag Name, and Link Text strategies
3. THE System SHALL rank strategies by reliability score (uniqueness, stability, performance)
4. THE System SHALL detect and warn about fragile locators (absolute XPath, index-based)
5. THE System SHALL suggest best practices for each element type (buttons, inputs, links)
6. THE System SHALL provide "Why this strategy" explanations for recommendations
7. THE System SHALL support custom strategy templates for organization-specific patterns
8. THE System SHALL validate locators against the live page and show match count

### Requirement 25: Locator Lab - Batch URL Processing

**User Story:** As a QA engineer, I want to process multiple URLs in batch, so that I can generate locators for entire application flows efficiently.

#### Acceptance Criteria

1. THE System SHALL provide a batch URL input interface accepting multiple URLs
2. WHEN a user submits batch URLs, THE System SHALL process them sequentially with progress indicator
3. THE System SHALL display results for each URL in a tabbed or accordion interface
4. THE System SHALL allow saving batch results as a locator library
5. THE System SHALL support importing URLs from sitemap.xml files
6. THE System SHALL detect and handle authentication requirements for protected pages
7. THE System SHALL support configuring wait times and page load strategies per URL
8. WHEN batch processing completes, THE System SHALL generate a summary report with statistics

### Requirement 26: Locator Lab - Selector Scoring System

**User Story:** As a QA engineer, I want a detailed scoring system for selectors, so that I can make informed decisions about locator quality.

#### Acceptance Criteria

1. THE System SHALL calculate a reliability score (0-100) for each generated selector
2. THE System SHALL evaluate uniqueness (does selector match exactly one element)
3. THE System SHALL evaluate stability (likelihood of selector breaking with UI changes)
4. THE System SHALL evaluate performance (selector execution speed)
5. THE System SHALL evaluate maintainability (readability and simplicity)
6. WHEN displaying selectors, THE System SHALL show score breakdown with visual indicators
7. THE System SHALL highlight selectors scoring above 80 as "Recommended"
8. THE System SHALL warn about selectors scoring below 50 as "Fragile"
9. THE System SHALL provide improvement suggestions for low-scoring selectors

### Requirement 27: Locator Lab - 3D Grid Visualization Enhancement

**User Story:** As a QA engineer, I want an enhanced 3D grid visualization, so that I can visualize page structure and element relationships.

#### Acceptance Criteria

1. THE System SHALL render a Three.js 3D grid representing the scanned page structure
2. THE System SHALL represent each element as a 3D node positioned by DOM hierarchy
3. WHEN a user hovers over a node, THE System SHALL highlight it and display element details
4. WHEN a user clicks a node, THE System SHALL show all generated locators for that element
5. THE System SHALL color-code nodes by element type (button, input, link, container)
6. THE System SHALL draw connection lines showing parent-child relationships
7. THE System SHALL support filtering nodes by element type or selector quality
8. THE System SHALL animate the grid when new elements are detected


### Requirement 28: CleverTap - Smart Sheet Analysis with Yes/No Logic

**User Story:** As a QA engineer, I want intelligent Excel sheet analysis for in-house validation, so that the system automatically determines expected values based on Yes/No indicators.

#### Acceptance Criteria

1. WHEN a user imports the SunNxt Data Dictionary Excel file, THE System SHALL parse all sheets and identify Yes/No columns
2. WHEN a cell contains "Yes", THE System SHALL expect actual values (not NA, null, or blank)
3. WHEN a cell contains "No", THE System SHALL expect only "NA" as valid value
4. THE System SHALL validate captured events against these rules automatically
5. WHEN validation fails, THE System SHALL highlight discrepancies with clear error messages
6. THE System SHALL support custom Yes/No column mapping for different Excel formats
7. THE System SHALL generate validation reports showing pass/fail status per attribute
8. THE System SHALL calculate validation score as percentage of passing attributes
9. THE System SHALL export validation results with color-coded pass/fail indicators

---

### Requirement 29: CleverTap - Direct Analytics Tool Integration

**User Story:** As a QA engineer, I want direct integration with analytics tools, so that I can capture events without manual copy-pasting of JSON values.

#### Acceptance Criteria

1. THE System SHALL provide browser extension or bookmarklet for CleverTap integration
2. WHEN installed, THE System SHALL intercept CleverTap network requests automatically
3. WHEN an analytics event fires, THE System SHALL capture the event payload in real-time
4. THE System SHALL display captured events in a live feed within the Zenit app
5. THE System SHALL support filtering events by event name, platform, or time range
6. THE System SHALL allow users to save captured events to validation plans
7. THE System SHALL support integration with Kibana/Elasticsearch for event retrieval
8. WHEN connected to Kibana, THE System SHALL query events by date range and filters
9. THE System SHALL parse Kibana JSON responses and extract event parameters automatically
10. THE System SHALL support multiple analytics platforms (CleverTap, Firebase, Mixpanel)

---

### Requirement 30: CleverTap - Advanced In-House Validation Workflow

**User Story:** As a QA engineer, I want a complete in-house validation workflow, so that I can validate analytics implementations against data dictionaries efficiently.

#### Acceptance Criteria

1. THE System SHALL load Excel file from path: `D:\Zenit Antigravity\In-House\public\SunNxt Data Dictionary.xlsx`
2. THE System SHALL parse all sheets and create validation plans automatically
3. WHEN a sheet is selected, THE System SHALL display all titles/content items
4. WHEN a title is selected, THE System SHALL show expected events and attributes
5. THE System SHALL allow capturing actual events via direct integration or manual input
6. WHEN comparing expected vs actual, THE System SHALL apply Yes/No logic validation
7. THE System SHALL highlight missing attributes, extra attributes, and value mismatches
8. THE System SHALL support bulk validation of multiple titles simultaneously
9. THE System SHALL generate comprehensive validation reports with statistics
10. THE System SHALL export validation results to Excel with original format preserved

---

### Requirement 31: Test Suite - Complete Session Workflow

**User Story:** As a QA engineer, I want a complete test session workflow from creation to results, so that I can execute and track test runs efficiently.

#### Acceptance Criteria

1. WHEN a user creates a new test session, THE System SHALL allow selecting test cases from Repository
2. THE System SHALL allow configuring session parameters (platform, environment, build version)
3. WHEN session starts, THE System SHALL display test execution interface with current test
4. THE System SHALL allow marking tests as Pass, Fail, Skip, or Blocked
5. WHEN a test fails, THE System SHALL prompt for failure details and screenshots
6. THE System SHALL track execution time per test and overall session duration
7. WHEN session completes, THE System SHALL navigate to results page automatically
8. THE System SHALL display session summary with pass/fail counts and charts
9. THE System SHALL show detailed results for each test with execution logs
10. THE System SHALL allow filtering and searching results by status or test name

---

### Requirement 32: Test Suite - JIRA Integration for Bug Logging

**User Story:** As a QA engineer, I want to log bugs directly to JIRA from test results, so that I can streamline defect reporting workflow.

#### Acceptance Criteria

1. THE System SHALL provide JIRA configuration interface for API credentials
2. WHEN configured, THE System SHALL validate JIRA connection and fetch projects
3. WHEN a test fails, THE System SHALL display "Log Bug to JIRA" button
4. WHEN clicked, THE System SHALL open bug creation dialog with pre-filled details
5. THE System SHALL auto-populate summary, description, steps to reproduce from test case
6. THE System SHALL attach screenshots and execution logs automatically
7. THE System SHALL allow selecting JIRA project, issue type, priority, and assignee
8. WHEN bug is created, THE System SHALL display JIRA issue key and link
9. THE System SHALL save JIRA issue reference with test result for tracking
10. THE System SHALL support bulk bug creation for multiple failed tests

---

### Requirement 33: Test Suite - Automated Bug Creation Agent

**User Story:** As a QA engineer, I want an AI agent to automatically create JIRA bugs from test failures, so that I can save time on repetitive bug logging.

#### Acceptance Criteria

1. THE System SHALL provide "Enable Auto Bug Creation" toggle in settings
2. WHEN enabled, THE System SHALL automatically analyze failed tests
3. THE System SHALL use AI to generate bug summary and description
4. THE System SHALL extract steps to reproduce from test case steps
5. THE System SHALL identify similar existing bugs in JIRA to avoid duplicates
6. WHEN no duplicate found, THE System SHALL create new JIRA issue automatically
7. THE System SHALL assign appropriate labels, components, and priority based on test metadata
8. THE System SHALL attach all relevant screenshots and logs
9. THE System SHALL notify user of created bugs with JIRA links
10. THE System SHALL allow reviewing and editing auto-created bugs before submission

---

### Requirement 34: Zenit Academy - Learning Management System

**User Story:** As a team member, I want access to a learning platform, so that I can improve my testing skills and learn new tools.

#### Acceptance Criteria

1. WHEN a user navigates to Zenit Academy, THE System SHALL display course catalog
2. THE System SHALL organize courses by category (Automation, Manual Testing, Tools, Best Practices)
3. WHEN a user selects a course, THE System SHALL display course overview and curriculum
4. THE System SHALL support video lessons, text content, code examples, and quizzes
5. THE System SHALL track user progress through courses with completion percentage
6. THE System SHALL award badges and certificates upon course completion
7. THE System SHALL provide interactive coding exercises with instant feedback
8. THE System SHALL support discussion forums for each course
9. THE System SHALL allow instructors to create and manage course content
10. THE System SHALL display leaderboard showing top learners

---

### Requirement 35: Zenit Academy - Interactive Tutorials

**User Story:** As a new user, I want interactive tutorials for each Zenit app, so that I can learn how to use the platform effectively.

#### Acceptance Criteria

1. THE System SHALL provide "Start Tutorial" button on each app's main page
2. WHEN clicked, THE System SHALL launch interactive guided tour
3. THE System SHALL highlight UI elements with tooltips explaining their purpose
4. THE System SHALL guide users through common workflows step-by-step
5. THE System SHALL allow users to practice actions in a sandbox environment
6. THE System SHALL validate user actions and provide hints if incorrect
7. THE System SHALL track tutorial completion and allow resuming from last step
8. THE System SHALL provide "Skip Tutorial" option for experienced users
9. THE System SHALL offer advanced tutorials for power users
10. THE System SHALL integrate tutorials with help documentation

---

### Requirement 36: Zenit Academy - Knowledge Base & Documentation

**User Story:** As a user, I want comprehensive documentation and knowledge base, so that I can find answers to my questions quickly.

#### Acceptance Criteria

1. THE System SHALL provide searchable knowledge base with articles and FAQs
2. THE System SHALL organize documentation by app and feature
3. THE System SHALL include video tutorials, screenshots, and code examples
4. THE System SHALL support full-text search across all documentation
5. THE System SHALL display related articles and suggested content
6. THE System SHALL allow users to rate articles as helpful or not helpful
7. THE System SHALL track most viewed and most helpful articles
8. THE System SHALL provide API documentation for integrations
9. THE System SHALL include troubleshooting guides for common issues
10. THE System SHALL allow users to submit documentation feedback and suggestions

---

### Requirement 37: Enhanced 3D Visualizations Across All Apps

**User Story:** As a user, I want stunning 3D visualizations on every page, so that I have an engaging and modern user experience.

#### Acceptance Criteria

1. THE System SHALL render Three.js 3D visualizations on all main app pages
2. THE System SHALL use particle backgrounds consistently across the platform
3. THE System SHALL animate transitions between pages smoothly
4. THE System SHALL optimize 3D rendering for performance (60 FPS minimum)
5. THE System SHALL support both light and dark themes for all visualizations
6. THE System SHALL provide accessibility options to reduce motion for users who need it
7. THE System SHALL lazy load 3D components to improve initial page load time
8. THE System SHALL use WebGL fallbacks for devices without full 3D support
9. THE System SHALL implement responsive 3D layouts for mobile devices
10. THE System SHALL maintain consistent visual language across all 3D components
