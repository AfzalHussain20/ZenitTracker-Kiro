# Design Document: Zenit Apps Complete Restoration

## Overview

This design document outlines the technical architecture and implementation approach for restoring complete functionality to all 7 Zenit Tracker applications while maintaining the modern UI with Three.js 3D visualizations, particle backgrounds, and smooth animations.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  Vision  │  Keepr   │  Wrklog  │Repository│ Locator  │  │
│  │          │          │          │          │   Lab    │  │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘  │
│       │          │          │          │          │         │
└───────┼──────────┼──────────┼──────────┼──────────┼─────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Component Layer                          │
│  ┌──────────────┬──────────────┬──────────────────────┐    │
│  │  Three.js    │   UI         │   State Management   │    │
│  │  Components  │  Components  │   (React Context)    │    │
│  └──────────────┴──────────────┴──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services                           │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Firebase │ WebSocket│  Python  │  Puppeteer│  Excel   │  │
│  │ Firestore│  Server  │  Backend │  Service  │  Parser  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+ with TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **3D Graphics**: Three.js + @react-three/fiber + @react-three/drei
- **Database**: Firebase Firestore (real-time NoSQL)
- **Authentication**: Firebase Auth
- **Real-time Communication**: WebSocket (for Vision)
- **State Management**: React Context API + Custom Hooks
- **Form Handling**: React Hook Form + Zod validation
- **Data Fetching**: Firebase SDK + SWR for caching
- **File Processing**: xlsx (Excel), Puppeteer (web scraping)
- **Backend**: Python Flask (for device automation server)

## Data Models

### Firestore Collections Schema

#### 1. Vision - Device Connections

```typescript
// Collection: vision_devices
interface VisionDevice {
  id: string;
  name: string;
  platform: 'android' | 'ios' | 'tv';
  udid: string;
  status: 'available' | 'connected' | 'offline';
  lastConnected: Timestamp;
  capabilities: {
    screenSize: { width: number; height: number };
    osVersion: string;
    appiumVersion: string;
  };
}

// Collection: vision_sessions
interface VisionSession {
  id: string;
  deviceId: string;
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  status: 'active' | 'completed' | 'failed';
  wsConnectionId: string;
  recordingEnabled: boolean;
}

// Collection: vision_recordings
interface VisionRecording {
  id: string;
  sessionId: string;
  deviceId: string;
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  actions: RecordedAction[];
  screenshots: string[]; // Storage URLs
  metadata: {
    totalActions: number;
    duration: number;
    platform: string;
  };
}

interface RecordedAction {
  timestamp: number;
  type: 'tap' | 'swipe' | 'input' | 'navigate' | 'assertion';
  element?: ElementInfo;
  coordinates?: { x: number; y: number };
  value?: string;
  screenshot?: string;
}

interface ElementInfo {
  id?: string;
  className?: string;
  text?: string;
  bounds: { x: number; y: number; width: number; height: number };
  xpath: string;
  accessibilityId?: string;
  attributes: Record<string, string>;
}
```

#### 2. Keepr - Device Management

```typescript
// Collection: keepr_devices
interface KeeprDevice {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'laptop' | 'tv' | 'monitor' | 'other';
  status: 'available' | 'checked-out' | 'maintenance';
  location: string;
  checkedOutBy?: {
    uid: string;
    name: string;
    email: string;
  };
  checkedOutAt?: Timestamp;
  expectedReturnDate?: Timestamp;
  accessories: DeviceAccessory[];
  healthMetrics: {
    batteryCycles?: number;
    storageUsed?: number;
    lastMaintenance?: Timestamp;
    nextMaintenance?: Timestamp;
  };
  tags: string[];
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface DeviceAccessory {
  id: string;
  name: string;
  type: 'charger' | 'cable' | 'case' | 'remote' | 'other';
  condition: 'working' | 'damaged' | 'missing';
  serialNumber?: string;
}

// Collection: keepr_audit_logs
interface KeeprAuditLog {
  id: string;
  date: Timestamp;
  auditor: string;
  auditorUid: string;
  device: string;
  deviceId: string;
  location: string;
  status: 'verified' | 'missing';
  notes?: string;
  auditSessionId: string;
}

// Collection: keepr_audit_sessions
interface KeeprAuditSession {
  id: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  auditor: string;
  auditorUid: string;
  totalDevices: number;
  verifiedCount: number;
  missingCount: number;
  status: 'in-progress' | 'completed';
  locationFilter?: string;
}

// Collection: keepr_team_members
interface KeeprTeamMember {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'member' | 'lead' | 'admin';
  currentDevices: string[]; // device IDs
  deviceCheckoutLimit: number;
  totalCheckouts: number;
  averageCheckoutDuration: number; // in hours
  joinedAt: Timestamp;
}

// Collection: keepr_checkout_history
interface KeeprCheckoutHistory {
  id: string;
  deviceId: string;
  deviceName: string;
  userId: string;
  userName: string;
  checkoutTime: Timestamp;
  checkinTime?: Timestamp;
  duration?: number; // in hours
  accessories: string[];
  accessoriesReturned: boolean;
  notes?: string;
}
```

#### 3. Wrklog - Time Tracking

```typescript
// Collection: wrklog_projects
interface WrklogProject {
  id: string;
  name: string;
  description: string;
  color: string;
  client?: string;
  status: 'active' | 'archived' | 'completed';
  budget?: number; // in hours
  totalLogged: number; // in hours
  startDate?: Timestamp;
  endDate?: Timestamp;
  tags: string[];
  teamMembers: string[]; // user IDs
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Collection: wrklog_entries
interface WrklogEntry {
  id: string;
  userId: string;
  userName: string;
  projectId?: string;
  projectName?: string;
  description: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration: number; // in seconds
  isRunning: boolean;
  date: string; // YYYY-MM-DD for calendar queries
  tags: string[];
  billable: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Collection: wrklog_running_timers
interface WrklogRunningTimer {
  id: string; // same as userId for singleton
  userId: string;
  entryId: string;
  projectId?: string;
  startTime: Timestamp;
  lastHeartbeat: Timestamp;
}
```

#### 4. Repository - Test Cases

```typescript
// Collection: repository_test_beds
interface RepositoryTestBed {
  id: string;
  name: string;
  description: string;
  platform: string;
  status: 'active' | 'archived';
  totalTests: number;
  passRate?: number;
  lastRunDate?: Timestamp;
  version: number;
  tags: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Collection: repository_test_cases
interface RepositoryTestCase {
  id: string;
  testBedId: string;
  title: string;
  description: string;
  steps: TestStep[];
  expectedResult: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'deprecated' | 'under-review';
  tags: string[];
  attachments: string[]; // Storage URLs
  dependencies: string[]; // test case IDs
  author: string;
  version: number;
  changeHistory: ChangeHistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  data?: string;
}

interface ChangeHistoryEntry {
  version: number;
  changedBy: string;
  changedAt: Timestamp;
  changes: string;
}

// Collection: repository_extraction_logs
interface RepositoryExtractionLog {
  id: string;
  source: 'excel' | 'jira' | 'testrail';
  sourceDetails: Record<string, any>;
  extractedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  extractedBy: string;
  extractedAt: Timestamp;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}
```

#### 5. Locator Lab - Selector Analysis

```typescript
// Collection: locator_scans
interface LocatorScan {
  id: string;
  url: string;
  userId: string;
  scannedAt: Timestamp;
  elementCount: number;
  status: 'completed' | 'failed';
  error?: string;
}

// Collection: locator_elements
interface LocatorElement {
  id: string;
  scanId: string;
  tagName: string;
  elementType: string; // button, input, link, etc.
  text?: string;
  attributes: Record<string, string>;
  selectors: LocatorSelector[];
  position: { x: number; y: number; width: number; height: number };
  depth: number;
  parentPath: string;
}

interface LocatorSelector {
  strategy: 'id' | 'xpath' | 'css' | 'accessibility' | 'className' | 'tagName' | 'linkText';
  value: string;
  score: number; // 0-100
  scoreBreakdown: {
    uniqueness: number;
    stability: number;
    performance: number;
    maintainability: number;
  };
  recommended: boolean;
  warnings?: string[];
}

// Collection: locator_batch_jobs
interface LocatorBatchJob {
  id: string;
  urls: string[];
  userId: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedCount: number;
  totalCount: number;
  results: { url: string; scanId?: string; error?: string }[];
}
```

#### 6. CleverTap Tracker - Analytics Events

```typescript
// Collection: clevertap_sessions
interface CleverTapSession {
  id: string;
  userId: string;
  platformName: string;
  testEnvironment: 'Production' | 'Pre-Production';
  appVersion: string;
  createdAt: Timestamp;
  status: 'active' | 'completed';
}

// Collection: clevertap_events
interface CleverTapEvent {
  id: string;
  sessionId: string;
  eventName: string;
  contentType?: string;
  instance?: number;
  params: Record<string, string>;
  capturedAt: Timestamp;
  eventType: 'standard' | 'custom' | 'in-house';
}

// Collection: clevertap_inhouse_plans
interface CleverTapInHousePlan {
  id: string;
  sessionId: string;
  sheetName: string;
  titles: InHouseTitle[];
  createdAt: Timestamp;
}

interface InHouseTitle {
  id: string;
  name: string;
  events: InHouseEvent[];
}

interface InHouseEvent {
  eventName: string;
  json: string;
  params: Record<string, string>;
  expectedValues?: Record<string, string>;
  validationStatus?: 'pass' | 'fail' | 'na';
}
```

## Component Architecture

### Three.js Visualization Components

All Three.js components follow a consistent pattern:

```typescript
// Base structure for all 3D components
interface Base3DComponentProps {
  // Data props specific to visualization
  // Animation controls
  autoRotate?: boolean;
  rotationSpeed?: number;
  // Interaction
  interactive?: boolean;
  onElementClick?: (data: any) => void;
}

// Example: DeviceInspector3D
export function DeviceInspector3D({
  isConnected,
  isRecording,
  deviceType = 'phone',
  batteryLevel,
  temperature,
  memoryUsage
}: DeviceInspector3DProps) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <OrbitControls enableZoom enablePan={false} />
      <DeviceModel
        type={deviceType}
        connected={isConnected}
        recording={isRecording}
      />
      {isConnected && <ScanningParticles />}
      {isRecording && <RecordingIndicator />}
      <DeviceMetrics
        battery={batteryLevel}
        temp={temperature}
        memory={memoryUsage}
      />
    </Canvas>
  );
}
```

### State Management Pattern

Using React Context for global state with custom hooks:

```typescript
// contexts/VisionContext.tsx
interface VisionContextType {
  // Connection state
  connectedDevice: VisionDevice | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Element hierarchy
  elementTree: ElementNode | null;
  selectedElement: ElementNode | null;
  selectElement: (element: ElementNode) => void;
  
  // Recording
  isRecording: boolean;
  recordedActions: RecordedAction[];
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  
  // Script generation
  generateScript: (language: ScriptLanguage, options: ScriptOptions) => string;
}

export function VisionProvider({ children }: { children: React.ReactNode }) {
  // Implementation with useState, useEffect, etc.
  return (
    <VisionContext.Provider value={contextValue}>
      {children}
    </VisionContext.Provider>
  );
}

export function useVision() {
  const context = useContext(VisionContext);
  if (!context) throw new Error('useVision must be used within VisionProvider');
  return context;
}
```

## WebSocket Communication (Vision)

### WebSocket Protocol Design

```typescript
// Client -> Server Messages
type ClientMessage =
  | { type: 'connect'; deviceId: string; userId: string }
  | { type: 'disconnect' }
  | { type: 'get_hierarchy' }
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; from: Point; to: Point }
  | { type: 'input'; elementId: string; text: string }
  | { type: 'screenshot' }
  | { type: 'start_recording' }
  | { type: 'stop_recording' };

// Server -> Client Messages
type ServerMessage =
  | { type: 'connected'; device: VisionDevice }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'hierarchy'; tree: ElementNode }
  | { type: 'screenshot'; data: string } // base64
  | { type: 'action_recorded'; action: RecordedAction }
  | { type: 'heartbeat'; timestamp: number };

// WebSocket Hook
export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const send = useCallback((message: ClientMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, [ws]);
  
  useEffect(() => {
    const socket = new WebSocket(url);
    
    socket.onopen = () => setStatus('connected');
    socket.onclose = () => setStatus('disconnected');
    socket.onerror = () => setStatus('disconnected');
    
    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      // Handle message based on type
    };
    
    setWs(socket);
    
    return () => socket.close();
  }, [url]);
  
  return { send, status };
}
```

### Python Backend Server (Vision)

```python
# backend/vision_server.py
from flask import Flask
from flask_socketio import SocketIO, emit
from appium import webdriver
import base64

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Active device connections
active_sessions = {}

@socketio.on('connect')
def handle_connect(data):
    device_id = data['deviceId']
    user_id = data['userId']
    
    # Initialize Appium driver
    driver = initialize_appium_driver(device_id)
    
    session_id = request.sid
    active_sessions[session_id] = {
        'driver': driver,
        'device_id': device_id,
        'user_id': user_id,
        'recording': False,
        'actions': []
    }
    
    emit('connected', {'device': get_device_info(driver)})

@socketio.on('get_hierarchy')
def handle_get_hierarchy():
    session = active_sessions[request.sid]
    driver = session['driver']
    
    # Get page source and parse to hierarchy
    source = driver.page_source
    hierarchy = parse_hierarchy(source)
    
    emit('hierarchy', {'tree': hierarchy})

@socketio.on('tap')
def handle_tap(data):
    session = active_sessions[request.sid]
    driver = session['driver']
    
    driver.tap([(data['x'], data['y'])])
    
    if session['recording']:
        action = {
            'type': 'tap',
            'timestamp': time.time(),
            'coordinates': {'x': data['x'], 'y': data['y']}
        }
        session['actions'].append(action)
        emit('action_recorded', {'action': action})

# Additional handlers for swipe, input, screenshot, etc.
```

## UI/UX Flow Diagrams

### Vision - Device Connection Flow

```
User Opens Vision
       │
       ▼
Display Device List
       │
       ├─► User Selects Device
       │         │
       │         ▼
       │   Initiate WebSocket Connection
       │         │
       │         ├─► Success
       │         │     │
       │         │     ▼
       │         │   Update Status: CONNECTED
       │         │     │
       │         │     ▼
       │         │   Display Device Screen
       │         │     │
       │         │     ▼
       │         │   Fetch Element Hierarchy
       │         │     │
       │         │     ▼
       │         │   Enable Recording Controls
       │         │
       │         └─► Failure
       │               │
       │               ▼
       │         Show Error Message
       │               │
       │               ▼
       │         Offer Retry Option
       │
       └─► User Clicks Back
             │
             ▼
       Return to Apps Hub
```

### Keepr - Daily Audit Flow

```
User Clicks "Start Daily Audit"
       │
       ▼
Create Audit Session
       │
       ▼
Display Device Checklist (Grouped by Location)
       │
       ├─► For Each Device:
       │     │
       │     ├─► User Marks "Verified"
       │     │     │
       │     │     ▼
       │     │   Save to audit_logs (status: verified)
       │     │     │
       │     │     ▼
       │     │   Update Progress Counter
       │     │
       │     └─► User Marks "Missing"
       │           │
       │           ▼
       │         Prompt for Notes
       │           │
       │           ▼
       │         Save to audit_logs (status: missing)
       │           │
       │           ▼
       │         Flag Device in System
       │           │
       │           ▼
       │         Send Notification to Team Lead
       │
       ▼
All Devices Processed
       │
       ▼
Generate Audit Report
       │
       ├─► Total Devices
       ├─► Verified Count
       ├─► Missing Count
       └─► Discrepancies
       │
       ▼
Save Audit Session (status: completed)
       │
       ▼
Display Summary with 3D Visualization
```

### Wrklog - Timer Workflow

```
User Opens Wrklog
       │
       ▼
Check for Running Timer in Firestore
       │
       ├─► Timer Found
       │     │
       │     ▼
       │   Resume Timer Display
       │     │
       │     ▼
       │   Calculate Elapsed Time
       │     │
       │     ▼
       │   Animate 3D Clock
       │
       └─► No Timer
             │
             ▼
       Display Idle State
       │
       ▼
User Clicks "Start Timer"
       │
       ├─► Select Project (Optional)
       │
       ▼
Create wrklog_entry (isRunning: true)
       │
       ▼
Create wrklog_running_timer
       │
       ▼
Start Local Timer
       │
       ▼
Animate 3D Clock (Running State)
       │
       ▼
Heartbeat Every 30s
       │
       ▼
User Clicks "Stop Timer"
       │
       ▼
Calculate Duration
       │
       ▼
Update wrklog_entry (isRunning: false, endTime, duration)
       │
       ▼
Delete wrklog_running_timer
       │
       ▼
Show Completion Animation
       │
       ▼
Prompt for Description/Tags
```

## Implementation Phases

### Phase 1: Vision - Core Features (Requirements 1-6)
- WebSocket connection infrastructure
- Element hierarchy tree component
- Recording system with action capture
- Script generation engine
- Element inspection panel
- Enhanced 3D device model

### Phase 2: Keepr - Complete Workflows (Requirements 7-12)
- Daily audit workflow
- Team management features
- Device accessories tracking
- My Devices detailed view
- Comprehensive reporting
- Enhanced 3D fleet visualization

### Phase 3: Wrklog - Full Functionality (Requirements 13-17)
- Project management system
- Calendar integration
- Detailed analytics dashboard
- Time tracking persistence
- Enhanced 3D clock visualization

### Phase 4: Repository - Test Management (Requirements 18-23)
- Test bed management
- UBS extraction engine
- Import/export functionality
- Batch operations
- Test case organization
- Enhanced 3D book visualization

### Phase 5: Locator Lab - Advanced Features (Requirements 24-27)
- Advanced selector strategies
- Batch URL processing
- Selector scoring system
- Enhanced 3D grid visualization

### Phase 6: CleverTap & Team Performance
- Complete in-house validation workflow
- Multi-sheet Excel support
- Team Performance enhancements

## Technical Considerations

### Performance Optimization
- Use React.memo for expensive 3D components
- Implement virtual scrolling for large lists (test cases, devices)
- Lazy load Three.js components
- Optimize Firestore queries with indexes
- Use SWR for client-side caching

### Security
- Validate all user inputs
- Sanitize HTML/JSON parsing
- Implement rate limiting for WebSocket connections
- Use Firebase Security Rules for data access control
- Encrypt sensitive data in transit

### Error Handling
- Graceful degradation for WebSocket failures
- Retry logic with exponential backoff
- User-friendly error messages
- Logging and monitoring integration
- Offline support where applicable

### Testing Strategy
- Unit tests for utility functions
- Integration tests for Firestore operations
- E2E tests for critical workflows
- Visual regression tests for 3D components
- WebSocket connection testing

## API Integrations

### External Services
- **JIRA API**: For test case extraction
- **TestRail API**: For test case import
- **Puppeteer**: For web scraping (Locator Lab)
- **Appium**: For device automation (Vision)
- **Firebase Storage**: For screenshots and attachments

### Internal APIs
- **Python Backend**: WebSocket server for Vision
- **Excel Parser**: Server-side Excel processing
- **Script Generator**: Template-based code generation

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Vercel (Next.js App)            │
│  - Static pages                         │
│  - API routes                           │
│  - Server components                    │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      Firebase Services                  │
│  - Firestore (Database)                 │
│  - Authentication                       │
│  - Storage (Files)                      │
│  - Hosting (Backup)                     │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Python Backend (Vision Server)       │
│  - WebSocket server                     │
│  - Appium integration                   │
│  - Device management                    │
└─────────────────────────────────────────┘
```

This design provides a comprehensive foundation for implementing all 27 requirements while maintaining code quality, performance, and user experience.
