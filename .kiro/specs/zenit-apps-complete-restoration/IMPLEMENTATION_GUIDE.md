# Zenit Apps Complete Restoration - Implementation Guide

## Overview

This spec provides a comprehensive plan to restore full functionality to all 7 Zenit Tracker applications while maintaining the stunning new UI with Three.js 3D visualizations.

## Spec Structure

- **requirements.md**: 27 detailed requirements covering all features across 7 apps
- **design.md**: Technical architecture, data models, component patterns, and workflows
- **tasks.md**: 22 implementation tasks organized in 6 phases

## Applications Covered

1. **Vision** - Device Inspector with WebSocket streaming, element hierarchy, recording, script generation
2. **Keepr** - Device Management with audit workflows, team management, accessories tracking
3. **Wrklog** - Time Tracker with projects, calendar, analytics, persistence
4. **Repository** - Test Case Library with test beds, UBS extraction, import/export
5. **Locator Lab** - Locator Studio with selector strategies, batch processing, scoring
6. **CleverTap Tracker** - Analytics Tracker with smart sheet analysis, direct integration, in-house validation
7. **Test Suite** - Complete session workflow with JIRA integration and AI bug creation
8. **Zenit Academy** - Learning platform with courses, tutorials, and knowledge base
9. **Team Performance** - Team analytics dashboard (already has 3D charts)

## Implementation Phases

### Phase 1: Vision (5 tasks)
Focus on WebSocket infrastructure, element hierarchy, recording, script generation, and 3D enhancements.

**Key Deliverables**:
- Real-time device connection via WebSocket
- Interactive element hierarchy tree
- Recording system with action capture
- Multi-language script generation
- Enhanced 3D device model with metrics

### Phase 2: Keepr (6 tasks)
Complete device management workflows including audits, team features, and reporting.

**Key Deliverables**:
- Daily audit workflow with session management
- Team member management and assignments
- Accessory tracking system
- Enhanced My Devices view
- Comprehensive reporting with 3D visualizations
- Enhanced fleet visualization

### Phase 3: Wrklog (5 tasks)
Full time tracking functionality with projects, calendar, and analytics.

**Key Deliverables**:
- Project management system
- Calendar view with drag-and-drop
- Enhanced analytics dashboard
- Persistent time tracking with sync
- Enhanced 3D clock visualization

### Phase 4: Repository (5 tasks)
Complete test case management with organization and extraction features.

**Key Deliverables**:
- Test bed management
- UBS extraction engine (Excel, JIRA, TestRail)
- Import/export functionality
- Batch operations and organization
- Enhanced 3D book visualization

### Phase 5: Locator Lab (4 tasks)
Advanced locator generation with scoring and batch processing.

**Key Deliverables**:
- Multi-strategy selector generation
- Batch URL processing
- Selector scoring system
- Enhanced 3D grid visualization

### Phase 6: Polish (2 tasks)
Complete CleverTap in-house validation and final testing.

**Key Deliverables**:
- Full in-house validation workflow
- Multi-sheet Excel support
- Comprehensive testing and bug fixes

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **3D Graphics**: Three.js, @react-three/fiber, @react-three/drei
- **Animations**: Framer Motion
- **Database**: Firebase Firestore (real-time)
- **Auth**: Firebase Authentication
- **Real-time**: WebSocket (for Vision)
- **Backend**: Python Flask (Vision server)
- **File Processing**: xlsx, Puppeteer

## Key Technical Patterns

### State Management
Using React Context API with custom hooks for each app:
- `VisionContext` - Device connections, recording, hierarchy
- `KeeprContext` - Device management, audits
- `WrklogContext` - Time tracking, projects
- `RepositoryContext` - Test cases, test beds
- `LocatorContext` - Scans, selectors

### Three.js Components
All 3D components follow consistent patterns:
- Canvas setup with lighting and controls
- Props for data and interaction
- Animation states based on app state
- OrbitControls for user interaction
- Particle effects for visual enhancement

### Firestore Collections
27 collections organized by app:
- `vision_*` - Devices, sessions, recordings
- `keepr_*` - Devices, audits, team, history
- `wrklog_*` - Projects, entries, timers
- `repository_*` - Test beds, test cases, extraction logs
- `locator_*` - Scans, elements, batch jobs
- `clevertap_*` - Sessions, events, in-house plans

### WebSocket Protocol (Vision)
Client-server message types for:
- Connection management
- Element hierarchy fetching
- Action execution (tap, swipe, input)
- Recording control
- Screenshot capture

## Getting Started

1. **Review Requirements**: Read `requirements.md` to understand all 27 requirements
2. **Study Design**: Review `design.md` for technical architecture and data models
3. **Start with Phase 1**: Begin with Vision tasks (WebSocket infrastructure)
4. **Incremental Development**: Complete each task, test, then move to next
5. **Maintain UI Consistency**: Keep Three.js visualizations and particle backgrounds
6. **Test Thoroughly**: Verify each feature works before moving forward

## Success Criteria

- All 27 requirements fully implemented
- All routes and sub-routes functional
- Data persists correctly in Firestore
- Real-time updates work across devices
- Three.js visualizations on every page
- No bar charts (replaced with 3D visualizations)
- Smooth animations and transitions
- Comprehensive error handling
- Mobile responsive design
- Accessibility compliant

## Estimated Timeline

- **Phase 1 (Vision)**: 2-3 weeks
- **Phase 2 (Keepr)**: 2-3 weeks
- **Phase 3 (Wrklog)**: 2 weeks
- **Phase 4 (Repository)**: 2-3 weeks
- **Phase 5 (Locator Lab)**: 1-2 weeks
- **Phase 6 (Polish)**: 1 week
- **Phase 7 (Advanced Features)**: 3-4 weeks
- **Phase 8 (Production Readiness)**: 2 weeks

**Total**: 15-20 weeks for complete restoration with all enhancements

## Notes

- Each task is designed to be independently testable
- Tasks within a phase can be parallelized where dependencies allow
- Maintain consistent code style and patterns across all apps
- Document complex logic and algorithms
- Write unit tests for critical functionality
- Keep performance in mind (optimize Three.js rendering)
- Ensure all features work in both light and dark modes

## Next Steps

1. Set up development environment
2. Review Firebase configuration
3. Install required dependencies
4. Start with Task 1.1 (WebSocket Infrastructure)
5. Follow the task order in `tasks.md`

Good luck with the implementation! 🚀
