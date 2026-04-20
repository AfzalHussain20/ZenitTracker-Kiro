# Firebase Schema Documentation

## Overview

This document describes the Firebase Firestore collections used in the Advanced KPI Dashboard System. The schema is designed to support dynamic team discovery, work allocation, worklog tracking, and performance metrics caching.

## Collections

### 1. Users Collection (`users`)

Stores user profiles with unique alias tracking for accurate performance attribution.

#### Schema

```typescript
interface UserDocument {
  uid: string;                    // Firebase Auth UID
  alias: string;                  // Unique alias (e.g., "john.doe")
  fullName: string;               // Full name (e.g., "John Doe")
  email: string;                  // Primary email
  jiraAccountId: string;          // Jira account ID for integration
  team: string;                   // Team ID
  role: string;                   // User role (e.g., "Developer")
  contactDetails: {
    email: string;
    phone?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Required Indexes

| Field | Type | Description |
|-------|------|-------------|
| `alias` | Single field (unique) | Ensures alias uniqueness across all users |
| `jiraAccountId` | Single field (unique) | Ensures one-to-one mapping with Jira accounts |
| `team` | Single field | Enables efficient team member queries |

#### Index Creation Commands

**Firebase Console:**
1. Go to Firestore Database → Indexes
2. Create composite index:
   - Collection: `users`
   - Fields: `alias` (Ascending)
   - Query scope: Collection
   - Enable "Unique" constraint

**Firebase CLI:**
```bash
# Create firestore.indexes.json with:
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "alias", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "jiraAccountId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "team", "order": "ASCENDING" }
      ]
    }
  ]
}

# Deploy indexes
firebase deploy --only firestore:indexes
```

#### Example Document

```json
{
  "uid": "abc123xyz",
  "alias": "john.doe",
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "jiraAccountId": "5f8a9b1c2d3e4f5g6h7i8j9k",
  "team": "team-dev-001",
  "role": "Senior Developer",
  "contactDetails": {
    "email": "john.doe@example.com",
    "phone": "+1-555-0123"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

### 2. Tasks Collection (`tasks`)

Stores work allocation tasks with Jira-compatible schema for future integration.

#### Schema

```typescript
interface TaskDocument {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: number;        // Hours
  assignees: string[];            // Array of user UIDs
  team?: string;                  // Optional team ID
  status: 'todo' | 'in_progress' | 'done';
  createdAt: Timestamp;
  createdBy: string;              // User UID
  updatedAt: Timestamp;
  dueDate?: Timestamp;
  
  // Jira integration placeholders (for future use)
  jiraIssueKey?: string;          // e.g., "SUN-123"
  jiraProjectKey?: string;        // e.g., "SUN"
  jiraIssueType?: string;         // e.g., "Story", "Bug"
}
```

#### Required Indexes

| Field | Type | Description |
|-------|------|-------------|
| `assignees` | Array-contains | Enables queries for tasks assigned to specific users |
| `team` | Single field | Enables team-level task queries |
| `status` | Single field | Enables filtering by task status |
| `createdAt` | Single field (desc) | Enables chronological sorting |

#### Index Creation Commands

**Firebase Console:**
Create the following composite indexes:

1. **Assignee + Status Query**
   - Collection: `tasks`
   - Fields: `assignees` (Array-contains), `status` (Ascending)

2. **Team + Status Query**
   - Collection: `tasks`
   - Fields: `team` (Ascending), `status` (Ascending)

3. **Created Date Sorting**
   - Collection: `tasks`
   - Fields: `createdAt` (Descending)

**Firebase CLI:**
```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignees", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "team", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

#### Example Document

```json
{
  "id": "task-001",
  "title": "Implement user authentication",
  "description": "Add Firebase authentication with email/password",
  "priority": "High",
  "estimatedEffort": 8,
  "assignees": ["abc123xyz", "def456uvw"],
  "team": "team-dev-001",
  "status": "in_progress",
  "createdAt": "2024-01-15T09:00:00Z",
  "createdBy": "manager-uid-123",
  "updatedAt": "2024-01-16T14:30:00Z",
  "dueDate": "2024-01-20T17:00:00Z",
  "jiraIssueKey": null,
  "jiraProjectKey": null,
  "jiraIssueType": null
}
```

---

### 3. Worklogs Collection (`worklogs`)

Stores time tracking entries for tasks with efficient querying by member and date.

#### Schema

```typescript
interface WorklogDocument {
  id: string;
  taskId: string;                 // Reference to task
  memberId: string;               // User UID
  date: Timestamp;                // Date work was performed
  timeSpent: number;              // Hours
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Required Indexes

| Field | Type | Description |
|-------|------|-------------|
| `memberId` + `date` | Composite | Enables efficient member worklog queries by date range |
| `taskId` | Single field | Enables task-level worklog queries |
| `date` | Single field (desc) | Enables chronological sorting |

#### Index Creation Commands

**Firebase Console:**
Create the following composite indexes:

1. **Member + Date Query**
   - Collection: `worklogs`
   - Fields: `memberId` (Ascending), `date` (Descending)

2. **Task Worklogs**
   - Collection: `worklogs`
   - Fields: `taskId` (Ascending), `date` (Descending)

**Firebase CLI:**
```json
{
  "indexes": [
    {
      "collectionGroup": "worklogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "memberId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "worklogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "taskId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "worklogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

#### Example Document

```json
{
  "id": "worklog-001",
  "taskId": "task-001",
  "memberId": "abc123xyz",
  "date": "2024-01-16T00:00:00Z",
  "timeSpent": 4.5,
  "description": "Implemented Firebase authentication setup and email/password provider",
  "createdAt": "2024-01-16T18:00:00Z",
  "updatedAt": "2024-01-16T18:00:00Z"
}
```

---

### 4. Team Metrics Cache Collection (`team_metrics_cache`)

Stores cached team performance metrics with 30-minute TTL to optimize performance.

#### Schema

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
    workDistribution: {
      stories: number;
      bugs: number;
      tasks: number;
      epics: number;
      subtasks: number;
    };
    relevantMetrics: Record<string, number>;
  };
  ttl: Timestamp;                 // 30 minutes from calculatedAt
}
```

#### Required Indexes

| Field | Type | Description |
|-------|------|-------------|
| `teamId` + `ttl` | Composite | Enables efficient cache lookup and expiration queries |

#### Index Creation Commands

**Firebase Console:**
Create composite index:
- Collection: `team_metrics_cache`
- Fields: `teamId` (Ascending), `ttl` (Descending)

**Firebase CLI:**
```json
{
  "indexes": [
    {
      "collectionGroup": "team_metrics_cache",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "teamId", "order": "ASCENDING" },
        { "fieldPath": "ttl", "order": "DESCENDING" }
      ]
    }
  ]
}
```

#### Example Document

```json
{
  "teamId": "team-dev-001",
  "calculatedAt": "2024-01-16T15:00:00Z",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-16T23:59:59Z",
  "metrics": {
    "totalMembers": 8,
    "activeTasks": 12,
    "completionRate": 75.5,
    "workDistribution": {
      "stories": 45,
      "bugs": 12,
      "tasks": 23,
      "epics": 3,
      "subtasks": 18
    },
    "relevantMetrics": {
      "stories_completed": 34,
      "story_points": 89,
      "commits": 156,
      "pull_requests": 42
    }
  },
  "ttl": "2024-01-16T15:30:00Z"
}
```

---

## Collection Creation

Firebase Firestore collections are created automatically when the first document is written to them. However, indexes must be created manually.

### Automatic Collection Creation

Collections will be created automatically when you first write data:

```typescript
import { addDoc } from 'firebase/firestore';
import { getUsersCollection } from '@/lib/firebase/collections';

// This will create the 'users' collection if it doesn't exist
await addDoc(getUsersCollection(), {
  uid: 'user-123',
  alias: 'john.doe',
  // ... other fields
});
```

### Manual Index Creation

**Option 1: Firebase Console**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database → Indexes
4. Click "Create Index"
5. Follow the index specifications above

**Option 2: Firebase CLI**
1. Create `firestore.indexes.json` in your project root
2. Add all index definitions (see examples above)
3. Run: `firebase deploy --only firestore:indexes`

**Option 3: Automatic Index Creation**
When you run a query that requires an index, Firebase will provide a link to create it automatically. Click the link and Firebase will create the index for you.

---

## Security Rules

Add these security rules to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isOwner(userId);
      allow delete: if false; // Prevent deletion
    }
    
    // Tasks collection
    match /tasks/{taskId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }
    
    // Worklogs collection
    match /worklogs/{worklogId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                      resource.data.memberId == request.auth.uid;
      allow delete: if isAuthenticated() && 
                      resource.data.memberId == request.auth.uid;
    }
    
    // Team metrics cache collection
    match /team_metrics_cache/{cacheId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only server-side writes
    }
  }
}
```

---

## Data Migration

If you need to migrate existing data or update the schema:

### Adding New Fields

```typescript
import { updateDoc, doc } from 'firebase/firestore';
import { getUsersCollection } from '@/lib/firebase/collections';

// Add new field to existing documents
const usersRef = getUsersCollection();
const snapshot = await getDocs(usersRef);

for (const docSnapshot of snapshot.docs) {
  await updateDoc(doc(usersRef, docSnapshot.id), {
    newField: defaultValue,
    updatedAt: Timestamp.now(),
  });
}
```

### Updating Alias System

```typescript
// Migrate from old identifier to alias system
async function migrateToAliasSystem() {
  const usersRef = getUsersCollection();
  const snapshot = await getDocs(usersRef);
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    
    // Generate alias from email or name
    const alias = data.email.split('@')[0].toLowerCase();
    
    await updateDoc(doc(usersRef, docSnapshot.id), {
      alias,
      updatedAt: Timestamp.now(),
    });
  }
}
```

---

## Performance Considerations

### Cache TTL Strategy

- **Team Metrics Cache**: 30-minute TTL balances freshness with performance
- **Client-side Cache**: Additional 5-minute cache in browser for frequently accessed data
- **Jira API Cache**: 30-minute server-side cache to reduce external API calls

### Query Optimization

1. **Use Indexes**: All queries should use the defined indexes
2. **Limit Results**: Use `.limit()` for large collections
3. **Pagination**: Implement cursor-based pagination for task and worklog lists
4. **Batch Operations**: Use batch writes for multiple document updates

### Cost Optimization

- **Read Optimization**: Cache frequently accessed data
- **Write Optimization**: Batch related writes together
- **Index Optimization**: Only create necessary indexes (each index adds write cost)

---

## Monitoring and Maintenance

### Regular Tasks

1. **Cache Cleanup**: Remove expired cache entries weekly
2. **Index Performance**: Monitor query performance in Firebase Console
3. **Storage Usage**: Track collection sizes and optimize as needed
4. **Security Audit**: Review security rules quarterly

### Monitoring Queries

```typescript
// Find expired cache entries
const expiredCache = await getDocs(
  query(
    getTeamMetricsCacheCollection(),
    where('ttl', '<', Timestamp.now())
  )
);

// Clean up expired entries
for (const doc of expiredCache.docs) {
  await deleteDoc(doc.ref);
}
```

---

## References

- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
