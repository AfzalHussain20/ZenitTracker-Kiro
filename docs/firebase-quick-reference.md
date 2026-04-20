# Firebase Collections Quick Reference

Quick reference guide for working with Firebase collections in the Advanced KPI Dashboard System.

## Import Statements

```typescript
// Collection references
import { 
  getUsersCollection, 
  getTasksCollection, 
  getWorklogsCollection,
  getTeamMetricsCacheCollection 
} from '@/lib/firebase/collections';

// Operations
import { 
  createUser, 
  getUserByAlias,
  createTask,
  getTasksByAssignee,
  createWorklog,
  getWorklogsByMember,
  getCachedTeamMetrics,
  setCachedTeamMetrics
} from '@/lib/firebase/operations';

// Types
import type {
  UserDocument,
  TaskDocument,
  WorklogDocument,
  TeamMetricsCacheDocument
} from '@/types/firebase-schema';

// Firestore utilities
import { Timestamp } from 'firebase/firestore';
```

## Common Operations

### Users

```typescript
// Create user
const userId = await createUser({
  uid: 'user-123',
  alias: 'john.doe',
  fullName: 'John Doe',
  email: 'john@example.com',
  jiraAccountId: 'jira-123',
  team: 'team-dev',
  role: 'Developer',
  contactDetails: { email: 'john@example.com' }
});

// Get user by alias
const user = await getUserByAlias('john.doe');

// Get team members
const members = await getUsersByTeam('team-dev');

// Update user
await updateUser('user-123', { role: 'Senior Developer' });

// Check alias availability
const available = await isAliasAvailable('jane.doe');
```

### Tasks

```typescript
// Create task
const taskId = await createTask({
  title: 'Implement feature',
  description: 'Details...',
  priority: 'High',
  estimatedEffort: 8,
  assignees: ['user-123'],
  team: 'team-dev',
  status: 'todo',
  createdBy: 'manager-uid'
});

// Get user's tasks
const tasks = await getTasksByAssignee('user-123');

// Get team's tasks
const teamTasks = await getTasksByTeam('team-dev');

// Update task
await updateTask(taskId, { status: 'in_progress' });

// Delete task
await deleteTask(taskId);
```

### Worklogs

```typescript
// Create worklog
const worklogId = await createWorklog({
  taskId: 'task-123',
  memberId: 'user-123',
  date: Timestamp.now(),
  timeSpent: 4.5,
  description: 'Implemented authentication'
});

// Get member's worklogs
const worklogs = await getWorklogsByMember('user-123');

// Get worklogs with date range
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');
const monthWorklogs = await getWorklogsByMember('user-123', startDate, endDate);

// Get task's worklogs
const taskWorklogs = await getWorklogsByTask('task-123');

// Calculate total time
const totalTime = await getTotalTimeLoggedForTask('task-123');

// Update worklog
await updateWorklog(worklogId, { timeSpent: 5 });

// Delete worklog
await deleteWorklog(worklogId);
```

### Team Metrics Cache

```typescript
// Check cache
const cached = await getCachedTeamMetrics('team-dev');

if (cached) {
  // Use cached data
  console.log(cached.metrics);
} else {
  // Calculate and cache
  await setCachedTeamMetrics({
    teamId: 'team-dev',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    metrics: {
      totalMembers: 8,
      activeTasks: 12,
      completionRate: 75,
      workDistribution: { stories: 45, bugs: 12, tasks: 23, epics: 3, subtasks: 18 },
      relevantMetrics: { stories_completed: 34, story_points: 89 }
    }
  });
}

// Clear expired cache
await clearExpiredCache();

// Clear team cache
await clearTeamCache('team-dev');
```

## Type Definitions

### UserDocument

```typescript
{
  uid: string;
  alias: string;              // Unique
  fullName: string;
  email: string;
  jiraAccountId: string;
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

### TaskDocument

```typescript
{
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: number;
  assignees: string[];
  team?: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  dueDate?: Timestamp;
  jiraIssueKey?: string;
  jiraProjectKey?: string;
  jiraIssueType?: string;
}
```

### WorklogDocument

```typescript
{
  id: string;
  taskId: string;
  memberId: string;
  date: Timestamp;
  timeSpent: number;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## API Route Examples

### Create Task Endpoint

```typescript
// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createTask } from '@/lib/firebase/operations';
import { Timestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const taskId = await createTask({
      title: body.title,
      description: body.description,
      priority: body.priority,
      estimatedEffort: body.estimatedEffort,
      assignees: body.assignees,
      team: body.team,
      status: 'todo',
      createdBy: body.userId,
      dueDate: body.dueDate ? Timestamp.fromDate(new Date(body.dueDate)) : undefined,
    });
    
    return NextResponse.json({ success: true, taskId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
```

### Get Worklogs Endpoint

```typescript
// app/api/worklogs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getWorklogsByMember } from '@/lib/firebase/operations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId is required' },
        { status: 400 }
      );
    }
    
    const worklogs = await getWorklogsByMember(
      memberId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    
    return NextResponse.json({ worklogs });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch worklogs' },
      { status: 500 }
    );
  }
}
```

## React Component Examples

### Create Task Form

```typescript
'use client';

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';

export function CreateTaskForm() {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          priority: formData.get('priority'),
          estimatedEffort: Number(formData.get('estimatedEffort')),
          assignees: [formData.get('assignee')],
          userId: 'current-user-id',
        }),
      });
      
      if (response.ok) {
        alert('Task created successfully!');
      }
    } catch (error) {
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Task title" required />
      <textarea name="description" placeholder="Description" />
      <select name="priority">
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
      <input name="estimatedEffort" type="number" placeholder="Hours" />
      <input name="assignee" placeholder="Assignee UID" />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
```

### Worklog List

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { WorklogDocument } from '@/types/firebase-schema';

export function WorklogList({ memberId }: { memberId: string }) {
  const [worklogs, setWorklogs] = useState<WorklogDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchWorklogs() {
      try {
        const response = await fetch(`/api/worklogs?memberId=${memberId}`);
        const data = await response.json();
        setWorklogs(data.worklogs);
      } catch (error) {
        console.error('Failed to fetch worklogs:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchWorklogs();
  }, [memberId]);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Worklogs</h2>
      {worklogs.map(worklog => (
        <div key={worklog.id}>
          <p>{worklog.description}</p>
          <p>Time: {worklog.timeSpent} hours</p>
          <p>Date: {worklog.date.toDate().toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
```

## Validation Examples

### Zod Schemas

```typescript
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  estimatedEffort: z.number().positive().max(1000),
  assignees: z.array(z.string()).min(1),
  team: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export const CreateWorklogSchema = z.object({
  taskId: z.string(),
  memberId: z.string(),
  date: z.string().datetime(),
  timeSpent: z.number().positive().max(24),
  description: z.string().min(1).max(1000),
});
```

## Error Handling

```typescript
try {
  const taskId = await createTask(taskData);
  return { success: true, taskId };
} catch (error) {
  if (error instanceof Error) {
    console.error('Task creation failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: false, error: 'Unknown error' };
}
```

## Testing

```typescript
import { createTask, getTaskById } from '@/lib/firebase/operations';

describe('Task Operations', () => {
  it('creates and retrieves task', async () => {
    const taskId = await createTask({
      title: 'Test Task',
      description: 'Test',
      priority: 'Medium',
      estimatedEffort: 4,
      assignees: ['user-123'],
      status: 'todo',
      createdBy: 'test-user',
    });
    
    const task = await getTaskById(taskId);
    expect(task).toBeDefined();
    expect(task?.title).toBe('Test Task');
  });
});
```

## Best Practices

1. **Always use type-safe operations** from `@/lib/firebase/operations`
2. **Check cache before expensive calculations** using `getCachedTeamMetrics`
3. **Use date ranges** for worklog queries to limit data
4. **Validate input** before creating documents
5. **Handle errors gracefully** with try-catch blocks
6. **Clean up expired cache** regularly
7. **Use batch operations** for multiple documents
8. **Check alias availability** before creating users

## Resources

- [Complete Schema Documentation](./firebase-schema.md)
- [Firebase Setup Guide](../src/lib/firebase/README.md)
- [Type Definitions](../src/types/firebase-schema.ts)
