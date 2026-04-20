# Firebase Collections Setup

This directory contains type-safe utilities for working with Firebase Firestore collections in the Advanced KPI Dashboard System.

## Files

- **`collections.ts`**: Type-safe collection references and metadata
- **`operations.ts`**: CRUD operations with full TypeScript type safety
- **`README.md`**: This file

## Quick Start

### 1. Import Collection References

```typescript
import { getUsersCollection, getTasksCollection } from '@/lib/firebase/collections';

// Get type-safe collection references
const usersRef = getUsersCollection();
const tasksRef = getTasksCollection();
```

### 2. Use Type-Safe Operations

```typescript
import { createUser, getUserByAlias, updateUser } from '@/lib/firebase/operations';

// Create a new user
const userId = await createUser({
  uid: 'user-123',
  alias: 'john.doe',
  fullName: 'John Doe',
  email: 'john.doe@example.com',
  jiraAccountId: 'jira-account-id',
  team: 'team-dev-001',
  role: 'Developer',
  contactDetails: {
    email: 'john.doe@example.com',
  },
});

// Get user by alias
const user = await getUserByAlias('john.doe');

// Update user
await updateUser('user-123', {
  role: 'Senior Developer',
});
```

### 3. Work with Tasks

```typescript
import { 
  createTask, 
  getTasksByAssignee, 
  updateTask 
} from '@/lib/firebase/operations';

// Create a task
const taskId = await createTask({
  title: 'Implement feature X',
  description: 'Detailed description',
  priority: 'High',
  estimatedEffort: 8,
  assignees: ['user-123'],
  team: 'team-dev-001',
  status: 'todo',
  createdBy: 'manager-uid',
});

// Get tasks for a user
const tasks = await getTasksByAssignee('user-123');

// Update task status
await updateTask(taskId, {
  status: 'in_progress',
});
```

### 4. Track Worklogs

```typescript
import { 
  createWorklog, 
  getWorklogsByMember,
  getTotalTimeLoggedForTask 
} from '@/lib/firebase/operations';
import { Timestamp } from 'firebase/firestore';

// Create a worklog
const worklogId = await createWorklog({
  taskId: 'task-123',
  memberId: 'user-123',
  date: Timestamp.fromDate(new Date()),
  timeSpent: 4.5,
  description: 'Implemented authentication logic',
});

// Get worklogs for a member
const worklogs = await getWorklogsByMember('user-123');

// Calculate total time logged
const totalTime = await getTotalTimeLoggedForTask('task-123');
console.log(`Total time: ${totalTime} hours`);
```

### 5. Use Team Metrics Cache

```typescript
import { 
  getCachedTeamMetrics, 
  setCachedTeamMetrics,
  clearExpiredCache 
} from '@/lib/firebase/operations';
import { Timestamp } from 'firebase/firestore';

// Check for cached metrics
const cached = await getCachedTeamMetrics('team-dev-001');

if (cached) {
  console.log('Using cached metrics:', cached.metrics);
} else {
  // Calculate fresh metrics
  const metrics = calculateTeamMetrics(/* ... */);
  
  // Cache for 30 minutes
  await setCachedTeamMetrics({
    teamId: 'team-dev-001',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    metrics,
  });
}

// Clean up expired cache entries
const deletedCount = await clearExpiredCache();
console.log(`Deleted ${deletedCount} expired cache entries`);
```

## Collection Schemas

### Users Collection

```typescript
interface UserDocument {
  uid: string;
  alias: string;              // Unique
  fullName: string;
  email: string;
  jiraAccountId: string;      // Unique
  team: string;
  role: string;
  contactDetails: {
    email: string;
    phone?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Tasks Collection

```typescript
interface TaskDocument {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: number;
  assignees: string[];        // User UIDs
  team?: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  dueDate?: Timestamp;
  jiraIssueKey?: string;      // For future Jira integration
  jiraProjectKey?: string;
  jiraIssueType?: string;
}
```

### Worklogs Collection

```typescript
interface WorklogDocument {
  id: string;
  taskId: string;
  memberId: string;
  date: Timestamp;
  timeSpent: number;          // Hours
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Team Metrics Cache Collection

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
  ttl: Timestamp;             // 30 minutes from calculatedAt
}
```

## Required Indexes

Before using these collections in production, you must create the following Firestore indexes:

### Users Collection
- `alias` (unique)
- `jiraAccountId` (unique)
- `team`

### Tasks Collection
- `assignees` (array-contains) + `status`
- `team` + `status`
- `createdAt` (desc)

### Worklogs Collection
- `memberId` + `date` (desc)
- `taskId` + `date` (desc)
- `date` (desc)

### Team Metrics Cache Collection
- `teamId` + `ttl` (desc)

See `docs/firebase-schema.md` for detailed index creation instructions.

## Type Safety

All operations are fully type-safe:

```typescript
// ✅ TypeScript will catch errors
await createUser({
  uid: 'user-123',
  alias: 'john.doe',
  // Error: Missing required field 'fullName'
});

// ✅ TypeScript will validate types
await updateTask('task-123', {
  status: 'invalid-status', // Error: Invalid status value
});

// ✅ TypeScript will infer return types
const user = await getUserByAlias('john.doe');
// user is typed as UserDocument | null
```

## Error Handling

All operations may throw errors. Always wrap them in try-catch blocks:

```typescript
try {
  const userId = await createUser(userData);
  console.log('User created:', userId);
} catch (error) {
  console.error('Failed to create user:', error);
  // Handle error appropriately
}
```

## Best Practices

### 1. Use Batch Operations for Multiple Documents

```typescript
// ❌ Bad: Multiple individual operations
for (const taskData of tasksData) {
  await createTask(taskData);
}

// ✅ Good: Batch operation
await createTasksBatch(tasksData);
```

### 2. Check Cache Before Expensive Calculations

```typescript
// ✅ Always check cache first
const cached = await getCachedTeamMetrics(teamId);
if (cached) {
  return cached.metrics;
}

// Only calculate if cache miss
const metrics = await calculateTeamMetrics(teamId);
await setCachedTeamMetrics({ teamId, metrics, /* ... */ });
```

### 3. Use Date Ranges for Worklog Queries

```typescript
// ✅ Limit query scope with date ranges
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');
const worklogs = await getWorklogsByMember('user-123', startDate, endDate);
```

### 4. Validate Alias Availability Before Creation

```typescript
// ✅ Check alias availability
const isAvailable = await isAliasAvailable('john.doe');
if (!isAvailable) {
  throw new Error('Alias already in use');
}

await createUser({ alias: 'john.doe', /* ... */ });
```

### 5. Clean Up Expired Cache Regularly

```typescript
// ✅ Run cache cleanup periodically (e.g., daily cron job)
const deletedCount = await clearExpiredCache();
console.log(`Cleaned up ${deletedCount} expired cache entries`);
```

## Testing

### Unit Tests

```typescript
import { createUser, getUserByAlias } from '@/lib/firebase/operations';

describe('User Operations', () => {
  it('creates and retrieves user', async () => {
    const userData = {
      uid: 'test-user',
      alias: 'test.user',
      // ... other fields
    };
    
    await createUser(userData);
    const user = await getUserByAlias('test.user');
    
    expect(user).toBeDefined();
    expect(user?.alias).toBe('test.user');
  });
});
```

### Integration Tests

```typescript
import { createTask, createWorklog, getTotalTimeLoggedForTask } from '@/lib/firebase/operations';

describe('Worklog Integration', () => {
  it('calculates total time for task', async () => {
    const taskId = await createTask(taskData);
    
    await createWorklog({ taskId, timeSpent: 4, /* ... */ });
    await createWorklog({ taskId, timeSpent: 3.5, /* ... */ });
    
    const total = await getTotalTimeLoggedForTask(taskId);
    expect(total).toBe(7.5);
  });
});
```

## Migration Guide

If you're migrating from an existing system:

### 1. Export Existing Data

```typescript
// Export from old system
const existingUsers = await fetchExistingUsers();
```

### 2. Transform to New Schema

```typescript
const transformedUsers = existingUsers.map(oldUser => ({
  uid: oldUser.id,
  alias: oldUser.username,
  fullName: oldUser.name,
  email: oldUser.email,
  jiraAccountId: oldUser.jiraId,
  team: oldUser.teamId,
  role: oldUser.position,
  contactDetails: {
    email: oldUser.email,
    phone: oldUser.phone,
  },
}));
```

### 3. Import to Firebase

```typescript
for (const userData of transformedUsers) {
  await createUser(userData);
}
```

## Troubleshooting

### "Missing or insufficient permissions" Error

**Solution**: Check your Firestore security rules. Ensure the user is authenticated and has the necessary permissions.

### "Index not found" Error

**Solution**: Create the required indexes. Firebase will provide a link to create the index automatically when you run the query.

### "Document already exists" Error

**Solution**: Check for duplicate aliases or IDs before creating documents. Use `isAliasAvailable()` to check alias uniqueness.

### Cache Not Working

**Solution**: Verify that the TTL is set correctly and that the query includes the `where('ttl', '>', now)` condition.

## Additional Resources

- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [TypeScript with Firestore](https://firebase.google.com/docs/firestore/manage-data/add-data#web-version-9_2)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Complete Schema Documentation](../../../docs/firebase-schema.md)
