# Design Document: Advanced KPI Dashboard System

## Overview

The Advanced KPI Dashboard System is a comprehensive upgrade to the existing performance tracking platform that transforms it from a static, hardcoded system into a dynamic, intelligent team performance monitoring solution. The system will automatically discover all teams from Jira, display only relevant metrics based on actual work performed, provide detailed member profiles with team-contextualized data, and include work allocation capabilities with worklog tracking.

### Key Design Principles

1. **Dynamic Discovery**: No hardcoded team names - all teams fetched from Jira API
2. **Intelligent Relevance**: Display only meaningful metrics based on actual work items
3. **Team Contextualization**: Filter and organize data by team work type
4. **Scalability**: Designed for Vercel serverless architecture with caching strategies
5. **Data Accuracy**: Server-side filtering and calculation for reliable metrics
6. **User Experience**: Professional, responsive interface with clear visual hierarchy

### System Scope

The system encompasses:
- Dynamic multi-team KPI dashboard with automatic team discovery
- Intelligent metric mapping based on team work types and actual Jira data
- Individual member tracking with unique alias system
- Member profile modal with team-contextualized metrics
- Work allocation system with Jira integration preparation
- Worklog tracking with missing worklog detection
- Day-wise work and worklog tracking
- Comprehensive reporting and export capabilities

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Next.js UI Components]
        State[React State Management]
        Cache[Client Cache]
    end
    
    subgraph "API Layer - Vercel Serverless"
        TeamAPI[/api/jira/teams]
        IssueAPI[/api/jira/issues]
        WorklogAPI[/api/worklogs]
        TaskAPI[/api/tasks]
        AnalyticsAPI[/api/analytics]
    end
    
    subgraph "Data Layer"
        Firebase[(Firebase)]
        JiraCache[In-Memory Cache]
    end
    
    subgraph "External Services"
        Jira[Atlassian Jira API]
    end
    
    UI --> State
    State --> Cache
    UI --> TeamAPI
    UI --> IssueAPI
    UI --> WorklogAPI
    UI --> TaskAPI
    UI --> AnalyticsAPI
    
    TeamAPI --> JiraCache
    TeamAPI --> Jira
    IssueAPI --> Jira
    WorklogAPI --> Firebase
    TaskAPI --> Firebase
    AnalyticsAPI --> IssueAPI
    AnalyticsAPI --> WorklogAPI
    
    JiraCache -.30min TTL.-> Jira
```

### Architecture Layers

#### 1. Client Layer (Next.js Frontend)
- **UI Components**: React components using shadcn/ui library
- **State Management**: React hooks (useState, useEffect, custom hooks)
- **Client Cache**: 30-minute TTL for team data to reduce API calls
- **Routing**: Next.js App Router for page navigation

#### 2. API Layer (Vercel Serverless Functions)
- **Team API** (`/api/jira/teams`): Fetches all teams from Jira with member details
- **Issue API** (`/api/jira/issues`): Cursor-based pagination for Jira issues
- **Worklog API** (`/api/worklogs`): CRUD operations for worklog entries
- **Task API** (`/api/tasks`): Work allocation system endpoints
- **Analytics API** (`/api/analytics`): Aggregated metrics and calculations

#### 3. Data Layer
- **Firebase Firestore**: Persistent storage for worklogs, tasks, user profiles
- **In-Memory Cache**: Server-side caching for Jira API responses (30-minute TTL)
- **Cache Strategy**: Reduce Jira API calls while maintaining data freshness

#### 4. External Services
- **Atlassian Jira API**: Source of truth for teams, members, and work items
- **Jira Teams API**: Dynamic team discovery
- **Jira Issues API**: Work item data with JQL filtering

### Data Flow

1. **Team Discovery Flow**:
   - Client requests teams → API checks cache → If expired, fetch from Jira → Cache for 30 min → Return to client
   
2. **Metrics Calculation Flow**:
   - Client selects team → Fetch team's Jira issues → Analyze work item types → Calculate relevant metrics → Display filtered results

3. **Member Profile Flow**:
   - Click member → Fetch member's team → Load team-relevant metrics → Query worklogs → Display contextualized profile

4. **Work Allocation Flow**:
   - Create task → Store in Firebase → Notify assignee → Track in dashboard → Log worklogs → Update metrics

## Components and Interfaces

### Core Components

#### 1. KPI Dashboard Component (`/app/(app)/kpi/page.tsx`)

```typescript
interface KPIDashboardProps {
  initialTeams?: JiraTeam[];
}

interface KPIDashboardState {
  teams: JiraTeam[];
  selectedTeam: JiraTeam | null;
  loading: boolean;
  lastRefresh: Date;
  error: Error | null;
}
```

**Responsibilities**:
- Fetch and display all teams dynamically
- Show team-level aggregate metrics
- Filter members by selected team
- Provide team selection interface
- Display refresh timestamp and team count

#### 2. Team Section Component

```typescript
interface TeamSectionProps {
  team: JiraTeam;
  metrics: TeamMetrics;
  members: TeamMember[];
  onMemberClick: (member: TeamMember) => void;
}

interface TeamMetrics {
  totalMembers: number;
  activeTasks: number;
  completionRate: number;
  workDistribution: WorkDistribution;
  relevantMetrics: MetricValue[];
}

interface WorkDistribution {
  stories: number;
  bugs: number;
  tasks: number;
  epics: number;
  subtasks: number;
}
```

**Responsibilities**:
- Display team name and member count
- Show work distribution breakdown
- Calculate and display only relevant metrics
- Provide "Work Focus" indicator
- List team members with quick stats

#### 3. Member Profile Modal Component

```typescript
interface MemberProfileModalProps {
  member: TeamMember;
  team: JiraTeam;
  isOpen: boolean;
  onClose: () => void;
}

interface MemberProfile {
  alias: string;
  fullName: string;
  team: string;
  role: string;
  contactDetails: ContactInfo;
  metrics: TeamContextualizedMetrics;
  worklogHistory: Worklog[];
  missingWorklogs: MissingWorklog[];
  dayWiseBreakdown: DayWiseData[];
  trendCharts: TrendData[];
}

interface TeamContextualizedMetrics {
  // Only metrics relevant to member's team
  [metricKey: string]: number;
}
```

**Responsibilities**:
- Display complete member profile
- Show only team-relevant metrics
- Highlight missing worklogs
- Provide day-wise work breakdown
- Display trend charts
- Export functionality (CSV/PDF)

#### 4. Metric Mapping Service

```typescript
interface MetricMappingService {
  getRelevantMetrics(teamType: TeamType): MetricDefinition[];
  calculateMetrics(issues: JiraIssue[], teamType: TeamType): MetricValue[];
  isMetricRelevant(metric: string, teamType: TeamType): boolean;
}

interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  applicableTeamTypes: TeamType[];
  calculation: (issues: JiraIssue[]) => number;
}

type TeamType = 
  | 'dev' 
  | 'qa' 
  | 'ui_ux' 
  | 'database' 
  | 'api' 
  | 'sms' 
  | 'analytics' 
  | 'generic';
```

**Responsibilities**:
- Map team types to relevant metrics
- Filter out irrelevant metrics
- Calculate metric values from Jira data
- Provide metric definitions and descriptions

#### 5. Work Allocation Component

```typescript
interface WorkAllocationProps {
  teams: JiraTeam[];
  members: TeamMember[];
}

interface TaskCreationForm {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: number; // hours
  assignees: string[]; // member IDs
  team?: string; // team ID
  dueDate?: Date;
  // Jira integration placeholders
  jiraIssueKey?: string;
  jiraProjectKey?: string;
}

interface AllocatedTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  estimatedEffort: number;
  assignees: TeamMember[];
  team?: JiraTeam;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: Date;
  createdBy: string;
  worklogs: Worklog[];
  totalTimeLogged: number;
}
```

**Responsibilities**:
- Create and assign tasks
- Validate task data
- Notify assignees
- Display task list with filters
- Support bulk assignment

#### 6. Worklog Tracking Component

```typescript
interface WorklogFormProps {
  task: AllocatedTask;
  member: TeamMember;
  onSubmit: (worklog: WorklogEntry) => Promise<void>;
}

interface WorklogEntry {
  id: string;
  taskId: string;
  memberId: string;
  date: Date;
  timeSpent: number; // hours
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MissingWorklog {
  taskId: string;
  taskTitle: string;
  memberId: string;
  assignedDate: Date;
  daysMissing: number;
  alertLevel: 'warning' | 'critical';
}
```

**Responsibilities**:
- Add/edit/delete worklog entries
- Validate worklog data
- Calculate total time logged
- Detect missing worklogs
- Generate alerts for missing entries

#### 7. Day-Wise Tracking Component

```typescript
interface DayWiseTrackingProps {
  member: TeamMember;
  dateRange: DateRange;
}

interface DayWiseData {
  date: Date;
  tasksWorkedOn: AllocatedTask[];
  worklogsSubmitted: WorklogEntry[];
  totalTimeLogged: number;
  tasksCompleted: number;
  storyPointsDelivered: number;
  hasMissingWorklogs: boolean;
}

interface CalendarView {
  month: number;
  year: number;
  days: DayWiseData[];
}
```

**Responsibilities**:
- Display calendar view of work activities
- Show daily totals and summaries
- Highlight days with missing worklogs
- Provide week/month comparisons
- Generate day-wise reports

### API Interfaces

#### Team API

```typescript
// GET /api/jira/teams
interface TeamsResponse {
  teams: JiraTeam[];
  fromCache: boolean;
  count: number;
  lastRefresh?: Date;
}

interface JiraTeam {
  id: string;
  name: string;
  members: TeamMember[];
}

interface TeamMember {
  accountId: string;
  displayName: string;
  avatarUrl?: string;
}

// POST /api/jira/teams (force refresh)
// Clears cache and fetches fresh data
```

#### Issue API

```typescript
// POST /api/jira/issues
interface IssueQueryRequest {
  jql?: string;
  nextPageToken?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  assigneeAccountId?: string;
  reporterAccountId?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
}

interface IssueQueryResponse {
  issues: JiraIssue[];
  nextPageToken: string | null;
  isLast: boolean;
  total: number | null;
  hasMore: boolean;
}

interface JiraIssue {
  id: string;
  key: string;
  url: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: TeamMember | null;
  reporter: TeamMember | null;
  labels: string[];
  platform: string | null;
  environment: string | null;
  created: string;
  updated: string;
  resolutionDate: string | null;
}
```

#### Worklog API

```typescript
// POST /api/worklogs
interface CreateWorklogRequest {
  taskId: string;
  memberId: string;
  date: string; // ISO date
  timeSpent: number;
  description: string;
}

// GET /api/worklogs?memberId=xxx&startDate=xxx&endDate=xxx
interface WorklogQueryResponse {
  worklogs: WorklogEntry[];
  totalTime: number;
  missingWorklogs: MissingWorklog[];
}

// PUT /api/worklogs/:id
interface UpdateWorklogRequest {
  date?: string;
  timeSpent?: number;
  description?: string;
}

// DELETE /api/worklogs/:id
```

#### Task API

```typescript
// POST /api/tasks
interface CreateTaskRequest {
  title: string;
  description: string;
  priority: string;
  estimatedEffort: number;
  assignees: string[];
  team?: string;
  dueDate?: string;
}

// GET /api/tasks?team=xxx&member=xxx&status=xxx
interface TaskQueryResponse {
  tasks: AllocatedTask[];
  total: number;
}

// PUT /api/tasks/:id
interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  assignees?: string[];
}

// DELETE /api/tasks/:id
```

#### Analytics API

```typescript
// POST /api/analytics/team
interface TeamAnalyticsRequest {
  teamId: string;
  startDate: string;
  endDate: string;
}

interface TeamAnalyticsResponse {
  team: JiraTeam;
  metrics: TeamMetrics;
  workDistribution: WorkDistribution;
  relevantMetrics: MetricValue[];
  memberStats: MemberStats[];
}

// POST /api/analytics/member
interface MemberAnalyticsRequest {
  memberId: string;
  teamId: string;
  startDate: string;
  endDate: string;
}

interface MemberAnalyticsResponse {
  member: TeamMember;
  team: JiraTeam;
  metrics: TeamContextualizedMetrics;
  worklogSummary: WorklogSummary;
  dayWiseData: DayWiseData[];
  trends: TrendData[];
}
```

## Data Models

### Firebase Collections

#### 1. Users Collection (`users`)

```typescript
interface UserDocument {
  uid: string;
  alias: string; // unique
  fullName: string;
  email: string;
  jiraAccountId: string;
  team: string; // team ID
  role: string;
  contactDetails: {
    email: string;
    phone?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Indexes:
// - alias (unique)
// - jiraAccountId (unique)
// - team
```

#### 2. Tasks Collection (`tasks`)

```typescript
interface TaskDocument {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: number;
  assignees: string[]; // user UIDs
  team?: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: Timestamp;
  createdBy: string; // user UID
  updatedAt: Timestamp;
  dueDate?: Timestamp;
  // Jira integration placeholders
  jiraIssueKey?: string;
  jiraProjectKey?: string;
  jiraIssueType?: string;
}

// Indexes:
// - assignees (array-contains)
// - team
// - status
// - createdAt (desc)
```

#### 3. Worklogs Collection (`worklogs`)

```typescript
interface WorklogDocument {
  id: string;
  taskId: string;
  memberId: string; // user UID
  date: Timestamp;
  timeSpent: number; // hours
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Indexes:
// - memberId + date (composite)
// - taskId
// - date (desc)
```

#### 4. Team Metrics Cache Collection (`team_metrics_cache`)

```typescript
interface TeamMetricsCacheDocument {
  teamId: string;
  calculatedAt: Timestamp;
  startDate: Timestamp;
  endDate: Timestamp;
  metrics: {
    totalMembers: number;
    activeTasks: number;
    completionRate: number;
    workDistribution: WorkDistribution;
    relevantMetrics: Record<string, number>;
  };
  ttl: Timestamp; // 30 minutes
}

// Indexes:
// - teamId + ttl (composite)
```

### In-Memory Cache Structures

#### Team Cache

```typescript
interface TeamCacheEntry {
  data: JiraTeam[];
  ts: number; // timestamp
  ttl: number; // 30 minutes in ms
}

// Global cache map
const teamCache: Map<string, TeamCacheEntry> = new Map();
```

#### Issue Cache

```typescript
interface IssueCacheEntry {
  data: JiraIssue[];
  ts: number;
  ttl: number; // 3 minutes in ms
}

// Cache key: JSON.stringify(query params)
const issueCache: Map<string, IssueCacheEntry> = new Map();
```

### Metric Mapping Configuration

```typescript
interface MetricConfig {
  dev: MetricDefinition[];
  qa: MetricDefinition[];
  ui_ux: MetricDefinition[];
  database: MetricDefinition[];
  api: MetricDefinition[];
  sms: MetricDefinition[];
  analytics: MetricDefinition[];
  generic: MetricDefinition[];
}

const METRIC_CONFIG: MetricConfig = {
  dev: [
    {
      key: 'stories_completed',
      label: 'Stories Completed',
      description: 'Number of Story-type issues completed',
      applicableTeamTypes: ['dev'],
      calculation: (issues) => issues.filter(i => 
        i.issueType === 'Story' && 
        i.statusCategory === 'Done'
      ).length
    },
    {
      key: 'story_points',
      label: 'Story Points Delivered',
      description: 'Total story points completed',
      applicableTeamTypes: ['dev'],
      calculation: (issues) => issues
        .filter(i => i.issueType === 'Story' && i.statusCategory === 'Done')
        .reduce((sum, i) => sum + (i.storyPoints || 0), 0)
    },
    // ... more dev metrics
  ],
  qa: [
    {
      key: 'bugs_found',
      label: 'Bugs Found',
      description: 'Number of Bug-type issues reported',
      applicableTeamTypes: ['qa'],
      calculation: (issues) => issues.filter(i => 
        i.issueType === 'Bug'
      ).length
    },
    // ... more QA metrics
  ],
  // ... other team types
};
```


## Error Handling

### Error Categories

#### 1. Network Errors
- **Jira API Failures**: Connection timeout, rate limiting, authentication errors
- **Firebase Connection Issues**: Network interruption, quota exceeded
- **Handling Strategy**:
  - Retry with exponential backoff (3 attempts)
  - Display user-friendly error messages
  - Fallback to cached data when available
  - Log errors for monitoring

#### 2. Data Validation Errors
- **Invalid Input**: Empty required fields, invalid date ranges, negative numbers
- **Handling Strategy**:
  - Client-side validation before submission
  - Server-side validation as final check
  - Display inline error messages
  - Prevent form submission until valid

#### 3. Authorization Errors
- **Insufficient Permissions**: User lacks access to specific teams or data
- **Session Expiration**: Authentication token expired
- **Handling Strategy**:
  - Redirect to login page
  - Display permission denied message
  - Log security events

#### 4. Cache Errors
- **Cache Corruption**: Invalid cached data structure
- **Cache Expiration**: Stale data detection
- **Handling Strategy**:
  - Clear corrupted cache entries
  - Fetch fresh data from source
  - Validate cache data before use

#### 5. Calculation Errors
- **Division by Zero**: Empty datasets for percentage calculations
- **Missing Data**: Required fields not present in API response
- **Handling Strategy**:
  - Defensive programming with null checks
  - Default values for missing data
  - Graceful degradation (show partial data)

### Error Handling Patterns

#### API Route Error Handling

```typescript
export async function GET(req: NextRequest) {
  try {
    // Validate request
    const params = validateParams(req);
    
    // Fetch data with retry
    const data = await fetchWithRetry(
      () => fetchJiraData(params),
      { maxRetries: 3, backoff: 'exponential' }
    );
    
    // Validate response
    if (!isValidResponse(data)) {
      throw new ValidationError('Invalid response structure');
    }
    
    return NextResponse.json({ success: true, data });
    
  } catch (error) {
    // Log error
    console.error('[API Error]', error);
    
    // Return appropriate error response
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Client-Side Error Handling

```typescript
async function fetchTeams() {
  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch('/api/jira/teams');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    setTeams(data.teams);
    
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to fetch teams';
    
    setError(message);
    
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
    
    // Fallback to cached data if available
    const cached = getCachedTeams();
    if (cached) {
      setTeams(cached);
      toast({
        title: 'Using Cached Data',
        description: 'Showing previously loaded teams',
      });
    }
    
  } finally {
    setLoading(false);
  }
}
```

### Error Recovery Strategies

1. **Automatic Retry**: Network errors retry with exponential backoff
2. **Cache Fallback**: Use cached data when fresh data unavailable
3. **Partial Success**: Display available data even if some requests fail
4. **User Notification**: Clear error messages with actionable guidance
5. **Graceful Degradation**: Core functionality works even if optional features fail

### Error Monitoring

- Log all errors to console with context
- Track error rates and patterns
- Monitor API failure rates
- Alert on critical errors (authentication, data corruption)

## Testing Strategy

### Testing Approach

This feature is **NOT suitable for property-based testing** because:
1. It's primarily UI rendering and layout (React components)
2. It involves external service integration (Jira API, Firebase)
3. Most functionality is CRUD operations and data display
4. The "correctness" is about UI behavior and integration, not pure algorithmic properties

Instead, we will use:
- **Unit Tests**: Component logic, utility functions, data transformations
- **Integration Tests**: API routes, database operations, external service mocking
- **End-to-End Tests**: Critical user flows through the UI
- **Manual Testing**: UI/UX validation, accessibility compliance

### Unit Testing

#### Component Tests

Test individual React components in isolation:

```typescript
// Example: TeamSection.test.tsx
describe('TeamSection', () => {
  it('displays team name and member count', () => {
    const team = {
      id: 'team-1',
      name: 'Dev Team',
      members: [
        { accountId: 'user-1', displayName: 'John Doe' },
        { accountId: 'user-2', displayName: 'Jane Smith' },
      ],
    };
    
    render(<TeamSection team={team} metrics={mockMetrics} />);
    
    expect(screen.getByText('Dev Team')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });
  
  it('displays only relevant metrics for team type', () => {
    const devTeam = { ...mockTeam, name: 'Dev Team' };
    const qaTeam = { ...mockTeam, name: 'QA Team' };
    
    const { rerender } = render(
      <TeamSection team={devTeam} metrics={devMetrics} />
    );
    
    expect(screen.getByText('Stories Completed')).toBeInTheDocument();
    expect(screen.queryByText('Bugs Found')).not.toBeInTheDocument();
    
    rerender(<TeamSection team={qaTeam} metrics={qaMetrics} />);
    
    expect(screen.getByText('Bugs Found')).toBeInTheDocument();
    expect(screen.queryByText('Stories Completed')).not.toBeInTheDocument();
  });
  
  it('handles empty member list gracefully', () => {
    const emptyTeam = { ...mockTeam, members: [] };
    
    render(<TeamSection team={emptyTeam} metrics={mockMetrics} />);
    
    expect(screen.getByText('No members')).toBeInTheDocument();
  });
});
```

#### Utility Function Tests

Test data transformation and calculation functions:

```typescript
// Example: metricCalculations.test.ts
describe('calculateRelevantMetrics', () => {
  it('calculates dev team metrics correctly', () => {
    const issues = [
      { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
      { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
      { issueType: 'Bug', statusCategory: 'Done' },
    ];
    
    const metrics = calculateRelevantMetrics(issues, 'dev');
    
    expect(metrics.stories_completed).toBe(2);
    expect(metrics.story_points).toBe(8);
    expect(metrics.bugs_found).toBeUndefined(); // Not relevant for dev
  });
  
  it('excludes zero-value metrics', () => {
    const issues = [
      { issueType: 'Story', statusCategory: 'Done' },
    ];
    
    const metrics = calculateRelevantMetrics(issues, 'dev');
    
    expect(Object.keys(metrics)).not.toContain('bugs_found');
  });
  
  it('handles empty issue list', () => {
    const metrics = calculateRelevantMetrics([], 'dev');
    
    expect(metrics).toEqual({});
  });
});
```

#### Metric Mapping Tests

```typescript
describe('MetricMappingService', () => {
  it('returns correct metrics for dev team', () => {
    const metrics = metricService.getRelevantMetrics('dev');
    
    expect(metrics).toContainEqual(
      expect.objectContaining({ key: 'stories_completed' })
    );
    expect(metrics).toContainEqual(
      expect.objectContaining({ key: 'story_points' })
    );
  });
  
  it('returns correct metrics for QA team', () => {
    const metrics = metricService.getRelevantMetrics('qa');
    
    expect(metrics).toContainEqual(
      expect.objectContaining({ key: 'bugs_found' })
    );
    expect(metrics).toContainEqual(
      expect.objectContaining({ key: 'test_cases_executed' })
    );
  });
  
  it('filters metrics based on team type', () => {
    expect(metricService.isMetricRelevant('bugs_found', 'dev')).toBe(false);
    expect(metricService.isMetricRelevant('bugs_found', 'qa')).toBe(true);
  });
});
```

### Integration Testing

#### API Route Tests

Test API endpoints with mocked external services:

```typescript
// Example: teams.route.test.ts
describe('GET /api/jira/teams', () => {
  beforeEach(() => {
    // Mock Jira API
    mockJiraAPI.mockTeamList([
      { teamId: 'team-1', displayName: 'Dev Team' },
      { teamId: 'team-2', displayName: 'QA Team' },
    ]);
  });
  
  it('fetches teams from Jira and returns formatted response', async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(data.teams).toHaveLength(2);
    expect(data.teams[0]).toMatchObject({
      id: 'team-1',
      name: 'Dev Team',
      members: expect.any(Array),
    });
  });
  
  it('uses cache on subsequent requests', async () => {
    await GET(); // First request
    const response = await GET(); // Second request
    const data = await response.json();
    
    expect(data.fromCache).toBe(true);
    expect(mockJiraAPI.callCount).toBe(1); // Only called once
  });
  
  it('handles Jira API errors gracefully', async () => {
    mockJiraAPI.mockError(new Error('Jira API unavailable'));
    
    const response = await GET();
    
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
```

#### Database Operation Tests

```typescript
describe('Worklog Operations', () => {
  it('creates worklog entry in Firebase', async () => {
    const worklog = {
      taskId: 'task-1',
      memberId: 'user-1',
      date: new Date(),
      timeSpent: 4,
      description: 'Implemented feature X',
    };
    
    const result = await createWorklog(worklog);
    
    expect(result.id).toBeDefined();
    
    // Verify in database
    const doc = await getDoc(doc(db, 'worklogs', result.id));
    expect(doc.exists()).toBe(true);
    expect(doc.data()).toMatchObject(worklog);
  });
  
  it('detects missing worklogs', async () => {
    const task = await createTask({
      title: 'Test Task',
      assignees: ['user-1'],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });
    
    const missing = await detectMissingWorklogs('user-1');
    
    expect(missing).toContainEqual(
      expect.objectContaining({
        taskId: task.id,
        daysMissing: 2,
      })
    );
  });
});
```

### End-to-End Testing

Test critical user flows:

```typescript
describe('KPI Dashboard E2E', () => {
  it('displays all teams and allows team selection', async () => {
    await page.goto('/kpi');
    
    // Wait for teams to load
    await page.waitForSelector('[data-testid="team-section"]');
    
    const teams = await page.$$('[data-testid="team-section"]');
    expect(teams.length).toBeGreaterThan(0);
    
    // Click first team
    await teams[0].click();
    
    // Verify team members displayed
    await page.waitForSelector('[data-testid="member-card"]');
    const members = await page.$$('[data-testid="member-card"]');
    expect(members.length).toBeGreaterThan(0);
  });
  
  it('opens member profile modal with contextualized metrics', async () => {
    await page.goto('/kpi');
    
    // Click member
    await page.click('[data-testid="member-card"]:first-child');
    
    // Wait for modal
    await page.waitForSelector('[data-testid="member-profile-modal"]');
    
    // Verify relevant metrics displayed
    const metrics = await page.$$('[data-testid="metric-card"]');
    expect(metrics.length).toBeGreaterThan(0);
    
    // Verify no zero-value irrelevant metrics
    const metricValues = await page.$$eval(
      '[data-testid="metric-value"]',
      els => els.map(el => el.textContent)
    );
    expect(metricValues.every(v => v !== '0')).toBe(true);
  });
  
  it('creates task and logs worklog', async () => {
    await page.goto('/work-allocation');
    
    // Create task
    await page.click('[data-testid="create-task-button"]');
    await page.fill('[name="title"]', 'Test Task');
    await page.fill('[name="description"]', 'Test Description');
    await page.selectOption('[name="priority"]', 'High');
    await page.click('[data-testid="submit-task"]');
    
    // Wait for task to appear
    await page.waitForSelector('[data-testid="task-item"]');
    
    // Add worklog
    await page.click('[data-testid="task-item"]:first-child');
    await page.click('[data-testid="add-worklog-button"]');
    await page.fill('[name="timeSpent"]', '4');
    await page.fill('[name="description"]', 'Completed implementation');
    await page.click('[data-testid="submit-worklog"]');
    
    // Verify worklog appears
    await page.waitForSelector('[data-testid="worklog-entry"]');
  });
});
```

### Manual Testing Checklist

#### UI/UX Validation
- [ ] All teams display correctly with dynamic discovery
- [ ] Team sections show only relevant metrics
- [ ] Member profile modal displays team-contextualized data
- [ ] No irrelevant zero-value metrics displayed
- [ ] Loading states display during data fetching
- [ ] Error messages are clear and actionable
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Dark mode and light mode both functional

#### Accessibility Testing
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader announces all important information
- [ ] Color contrast meets WCAG 2.1 Level AA
- [ ] Focus indicators visible on all focusable elements
- [ ] Form labels properly associated with inputs
- [ ] Error messages announced to screen readers

#### Performance Testing
- [ ] Dashboard loads within 2 seconds
- [ ] Team data cached for 30 minutes
- [ ] API responses within 1 second
- [ ] No memory leaks during extended use
- [ ] Smooth scrolling with large datasets

#### Integration Testing
- [ ] Jira API integration works correctly
- [ ] Firebase operations succeed
- [ ] Cache invalidation works as expected
- [ ] Error handling displays appropriate messages
- [ ] Retry logic functions correctly

### Test Coverage Goals

- **Unit Tests**: 80% code coverage
- **Integration Tests**: All API routes and database operations
- **E2E Tests**: All critical user flows
- **Manual Tests**: Complete checklist before deployment

### Continuous Testing

- Run unit tests on every commit
- Run integration tests on pull requests
- Run E2E tests before deployment
- Monitor production errors and create regression tests


## Implementation Plan

### Phase 1: Foundation and Dynamic Team Discovery

**Goal**: Establish core infrastructure and dynamic team fetching

**Tasks**:
1. Enhance `/api/jira/teams` route with improved caching
2. Create team type detection logic
3. Build metric mapping configuration
4. Implement team classification service
5. Create KPI dashboard page structure
6. Add team selection interface
7. Implement cache management utilities

**Deliverables**:
- Dynamic team discovery working
- Team data cached for 30 minutes
- Basic dashboard UI displaying all teams

### Phase 2: Intelligent Metric Display

**Goal**: Display only relevant metrics based on team work type

**Tasks**:
1. Implement metric mapping service
2. Create work distribution analyzer
3. Build metric calculation engine
4. Develop team section component
5. Add work focus indicator
6. Implement metric filtering logic
7. Create metric relevance indicator UI

**Deliverables**:
- Teams display only relevant metrics
- No zero-value irrelevant metrics shown
- Work distribution breakdown visible

### Phase 3: Member Profile and Alias Tracking

**Goal**: Individual member tracking with team-contextualized profiles

**Tasks**:
1. Create user alias system in Firebase
2. Build member profile modal component
3. Implement team-contextualized metric filtering
4. Add worklog history display
5. Create day-wise breakdown view
6. Implement trend charts
7. Add export functionality (CSV/PDF)

**Deliverables**:
- Member profile modal functional
- Alias tracking operational
- Team-contextualized metrics displayed

### Phase 4: Work Allocation System

**Goal**: Task creation and assignment with Jira integration preparation

**Tasks**:
1. Design task schema compatible with Jira
2. Create task API routes
3. Build task creation form
4. Implement task assignment logic
5. Add task list view with filters
6. Create notification system
7. Add Jira integration placeholders

**Deliverables**:
- Task creation and assignment working
- Task list with filtering
- Jira-compatible data structure

### Phase 5: Worklog Tracking

**Goal**: Time tracking with missing worklog detection

**Tasks**:
1. Create worklog API routes
2. Build worklog entry form
3. Implement worklog validation
4. Add missing worklog detection
5. Create alert system
6. Build worklog history view
7. Implement compliance scoring

**Deliverables**:
- Worklog tracking functional
- Missing worklog alerts working
- Compliance percentage calculated

### Phase 6: Day-Wise Tracking and Analytics

**Goal**: Granular daily tracking and reporting

**Tasks**:
1. Create day-wise tracking component
2. Build calendar view
3. Implement daily summaries
4. Add week/month comparisons
5. Create analytics API
6. Build reporting system
7. Add export capabilities

**Deliverables**:
- Day-wise tracking operational
- Calendar view functional
- Reports exportable

### Phase 7: Bug Fixes and Quality Assurance

**Goal**: Identify and fix all existing bugs

**Tasks**:
1. Comprehensive testing of existing features
2. Document all identified bugs
3. Fix critical and high-priority bugs
4. Fix medium-priority bugs
5. Regression testing
6. Performance optimization
7. Accessibility audit

**Deliverables**:
- All critical bugs fixed
- Test coverage at 80%
- Performance benchmarks met

### Phase 8: Vercel Deployment and Production Readiness

**Goal**: Deploy successfully to Vercel

**Tasks**:
1. Configure environment variables
2. Optimize bundle size
3. Implement serverless optimizations
4. Add error monitoring
5. Configure caching strategies
6. Production testing
7. Documentation updates

**Deliverables**:
- Successful Vercel deployment
- All features working in production
- Monitoring and logging operational

## Deployment Considerations

### Vercel-Specific Optimizations

#### 1. Serverless Function Optimization

```typescript
// Optimize cold starts
export const config = {
  runtime: 'edge', // Use Edge Runtime for faster cold starts
  regions: ['iad1'], // Deploy to specific region
};

// Keep functions small and focused
export async function GET(req: NextRequest) {
  // Minimal imports
  // Quick execution
  // Return fast
}
```

#### 2. Bundle Size Management

- Use dynamic imports for large components
- Implement code splitting by route
- Lazy load non-critical features
- Optimize images with Next.js Image component

```typescript
// Dynamic import example
const MemberProfileModal = dynamic(
  () => import('@/components/MemberProfileModal'),
  { loading: () => <LoadingSpinner /> }
);
```

#### 3. Caching Strategy

```typescript
// API route caching
export async function GET(req: NextRequest) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
}

// Static page caching
export const revalidate = 1800; // 30 minutes
```

#### 4. Environment Variables

Required environment variables for Vercel:

```bash
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_ORG_ID=your-org-id
JIRA_PROJECT_KEY=SUN

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-client-email
FIREBASE_ADMIN_PRIVATE_KEY=your-private-key
```

### Performance Targets

- **Initial Page Load**: < 2 seconds
- **API Response Time**: < 1 second
- **Time to Interactive**: < 3 seconds
- **Lighthouse Score**: > 90
- **Bundle Size**: < 500KB (gzipped)

### Monitoring and Logging

```typescript
// Error tracking
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
  tracesSampleRate: 0.1,
});

// Performance monitoring
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label === 'web-vital') {
    console.log(metric);
    // Send to analytics service
  }
}
```

## Security Considerations

### Authentication and Authorization

```typescript
// Middleware for protected routes
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('auth-token');
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  try {
    const user = await verifyToken(token.value);
    
    // Check permissions
    if (!hasPermission(user, req.nextUrl.pathname)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}
```

### Input Validation

```typescript
// Zod schema for validation
import { z } from 'zod';

const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  estimatedEffort: z.number().positive().max(1000),
  assignees: z.array(z.string()).min(1),
  dueDate: z.date().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  // Validate input
  const result = TaskSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error },
      { status: 400 }
    );
  }
  
  // Process valid data
  const task = await createTask(result.data);
  return NextResponse.json(task);
}
```

### Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function POST(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // Process request
}
```

### Data Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

// Use in API routes
const sanitizedTitle = sanitizeInput(body.title);
const sanitizedDescription = sanitizeInput(body.description);
```

## Maintenance and Support

### Documentation Requirements

1. **API Documentation**: OpenAPI/Swagger spec for all endpoints
2. **Component Documentation**: Storybook for UI components
3. **User Guide**: End-user documentation for dashboard features
4. **Developer Guide**: Setup and contribution guidelines
5. **Deployment Guide**: Vercel deployment instructions

### Monitoring Dashboards

1. **Performance Dashboard**: Track page load times, API response times
2. **Error Dashboard**: Monitor error rates and types
3. **Usage Dashboard**: Track feature adoption and user engagement
4. **Cost Dashboard**: Monitor Vercel and Firebase usage costs

### Support Procedures

1. **Bug Reports**: GitHub issues with template
2. **Feature Requests**: Prioritized backlog
3. **Incident Response**: On-call rotation for critical issues
4. **Regular Updates**: Monthly releases with changelog

## Future Enhancements

### Phase 9: Full Jira Integration (Future)

- Sync tasks to Jira issues
- Bidirectional worklog sync
- Real-time status updates
- Jira webhook integration

### Phase 10: Advanced Analytics (Future)

- Predictive analytics for workload
- Team performance trends
- Burndown charts
- Velocity tracking

### Phase 11: Mobile App (Future)

- React Native mobile app
- Push notifications
- Offline support
- Mobile-optimized UI

### Phase 12: AI-Powered Insights (Future)

- Automated worklog suggestions
- Anomaly detection
- Performance recommendations
- Smart task allocation

## Conclusion

This design document provides a comprehensive blueprint for upgrading the KPI Dashboard system to a professional-grade team performance tracking platform. The architecture is designed for scalability, maintainability, and optimal performance on Vercel's serverless infrastructure.

Key success factors:
1. Dynamic team discovery eliminates hardcoded limitations
2. Intelligent metric display shows only relevant data
3. Team contextualization provides meaningful insights
4. Robust error handling ensures reliability
5. Comprehensive testing strategy ensures quality
6. Vercel-optimized deployment ensures performance

The phased implementation approach allows for incremental delivery of value while maintaining system stability. Each phase builds upon the previous one, ensuring a solid foundation for future enhancements.

