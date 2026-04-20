# Alias Management Service

This service provides comprehensive functionality for managing user aliases in the Advanced KPI Dashboard System.

## Overview

The Alias Management Service handles:
- **Alias Validation**: Ensures aliases meet format requirements
- **Uniqueness Checks**: Prevents duplicate aliases across all users
- **Alias Generation**: Creates valid aliases from full names
- **Alias Updates**: Updates user aliases with validation
- **Historical Data Migration**: Maintains data consistency when aliases change

## Requirements

This service implements requirements:
- **2.1.3**: Ensure alias uniqueness across all teams
- **2.1.4**: Update all historical data references when alias changes
- **2.1.7**: Validate alias format to prevent duplicates and invalid characters

## Alias Format Rules

Aliases must follow these rules:
- **Length**: 3-50 characters
- **Case**: Lowercase only
- **Start**: Must start with a letter
- **End**: Must end with a letter or number
- **Characters**: Can contain letters, numbers, dots (.), hyphens (-), underscores (_)
- **Restrictions**: No consecutive special characters, no special characters at the end

### Valid Examples
```
john.doe
jane-smith
bob_jones
alice123
user.name-123
```

### Invalid Examples
```
JohnDoe          // Uppercase not allowed
ab               // Too short (< 3 characters)
123john          // Must start with a letter
john.            // Cannot end with special character
john..doe        // No consecutive special characters
john@doe         // Invalid character (@)
```

## API Reference

### `validateAliasFormat(alias: string): AliasValidationResult`

Validates an alias against format rules.

**Parameters:**
- `alias` (string): The alias to validate

**Returns:**
- `AliasValidationResult`: Object with `valid` boolean and optional `error` message

**Example:**
```typescript
import { validateAliasFormat } from '@/lib/alias/alias-management.service';

const result = validateAliasFormat('john.doe');
if (!result.valid) {
  console.error(result.error);
}
```

### `isAliasUnique(alias: string, excludeUid?: string): Promise<boolean>`

Checks if an alias is available (not already in use).

**Parameters:**
- `alias` (string): The alias to check
- `excludeUid` (string, optional): UID to exclude from check (for updates)

**Returns:**
- `Promise<boolean>`: True if alias is available, false otherwise

**Example:**
```typescript
import { isAliasUnique } from '@/lib/alias/alias-management.service';

const isAvailable = await isAliasUnique('john.doe');
if (!isAvailable) {
  console.log('Alias already taken');
}

// When updating a user's alias
const canUpdate = await isAliasUnique('new.alias', 'user123');
```

### `generateAliasFromName(fullName: string): string`

Generates a valid alias suggestion from a full name.

**Parameters:**
- `fullName` (string): The full name to generate alias from

**Returns:**
- `string`: Generated alias

**Algorithm:**
1. Convert to lowercase
2. Replace spaces with dots
3. Remove invalid characters
4. Remove consecutive special characters
5. Ensure starts with letter and ends with alphanumeric
6. Pad or truncate to meet length requirements

**Example:**
```typescript
import { generateAliasFromName } from '@/lib/alias/alias-management.service';

const alias = generateAliasFromName('John Doe');
console.log(alias); // 'john.doe'

const alias2 = generateAliasFromName('Mary-Jane Watson');
console.log(alias2); // 'mary.jane.watson'
```

### `updateUserAlias(uid: string, newAlias: string): Promise<void>`

Updates a user's alias with validation and historical data migration.

**Parameters:**
- `uid` (string): The user's UID
- `newAlias` (string): The new alias to set

**Throws:**
- Error if validation fails
- Error if alias is not unique
- Error if user not found

**Process:**
1. Validates new alias format
2. Checks alias uniqueness
3. Updates user document
4. Migrates historical data references

**Example:**
```typescript
import { updateUserAlias } from '@/lib/alias/alias-management.service';

try {
  await updateUserAlias('user123', 'john.doe');
  console.log('Alias updated successfully');
} catch (error) {
  console.error('Failed to update alias:', error.message);
}
```

### `migrateHistoricalData(oldAlias: string, newAlias: string): Promise<void>`

Migrates historical data references from old alias to new alias.

**Parameters:**
- `oldAlias` (string): The old alias to replace
- `newAlias` (string): The new alias to use

**Updates:**
- All tasks where user is assignee
- All worklogs created by user
- Creates audit trail entry

**Note:** In the current schema, tasks and worklogs use UIDs rather than aliases, so this function primarily serves as an audit trail. It's prepared for future schema changes where aliases might be used directly.

**Example:**
```typescript
import { migrateHistoricalData } from '@/lib/alias/alias-management.service';

await migrateHistoricalData('old.alias', 'new.alias');
```

### `getUserByAlias(alias: string): Promise<UserDocument | null>`

Retrieves a user document by alias.

**Parameters:**
- `alias` (string): The alias to search for

**Returns:**
- `Promise<UserDocument | null>`: User document or null if not found

**Example:**
```typescript
import { getUserByAlias } from '@/lib/alias/alias-management.service';

const user = await getUserByAlias('john.doe');
if (user) {
  console.log('User found:', user.fullName);
}
```

### `getAvailableAlias(suggestedAlias: string): Promise<string>`

Finds an available alias by appending numbers if needed.

**Parameters:**
- `suggestedAlias` (string): The initially suggested alias

**Returns:**
- `Promise<string>`: An available alias

**Algorithm:**
- If suggested alias is available, returns it
- Otherwise, appends numbers (2, 3, 4, ...) until an available alias is found
- Handles truncation for long aliases

**Example:**
```typescript
import { getAvailableAlias } from '@/lib/alias/alias-management.service';

const alias = await getAvailableAlias('john.doe');
// Returns 'john.doe' if available
// Returns 'john.doe2' if 'john.doe' is taken
// Returns 'john.doe3' if 'john.doe2' is also taken, etc.
```

## Usage Examples

### Creating a New User with Alias

```typescript
import { generateAliasFromName, getAvailableAlias } from '@/lib/alias/alias-management.service';
import { createUser } from '@/lib/firebase/operations';

async function createNewUser(fullName: string, email: string) {
  // Generate alias from name
  const suggestedAlias = generateAliasFromName(fullName);
  
  // Ensure it's available
  const alias = await getAvailableAlias(suggestedAlias);
  
  // Create user
  await createUser({
    uid: 'generated-uid',
    alias,
    fullName,
    email,
    jiraAccountId: 'jira-id',
    team: 'team-id',
    role: 'Developer',
    contactDetails: { email },
  });
  
  console.log(`User created with alias: ${alias}`);
}
```

### Updating User Alias

```typescript
import { updateUserAlias } from '@/lib/alias/alias-management.service';

async function changeUserAlias(uid: string, newAlias: string) {
  try {
    await updateUserAlias(uid, newAlias);
    console.log('Alias updated successfully');
  } catch (error) {
    if (error.message.includes('already in use')) {
      console.error('That alias is taken. Please choose another.');
    } else if (error.message.includes('lowercase')) {
      console.error('Alias must be lowercase');
    } else {
      console.error('Failed to update alias:', error.message);
    }
  }
}
```

### Validating User Input

```typescript
import { validateAliasFormat, isAliasUnique } from '@/lib/alias/alias-management.service';

async function validateUserInput(alias: string, currentUid?: string) {
  // Check format
  const formatResult = validateAliasFormat(alias);
  if (!formatResult.valid) {
    return { valid: false, error: formatResult.error };
  }
  
  // Check uniqueness
  const isUnique = await isAliasUnique(alias, currentUid);
  if (!isUnique) {
    return { valid: false, error: 'Alias is already in use' };
  }
  
  return { valid: true };
}
```

## Testing

The service includes comprehensive unit tests covering:
- ✅ Alias format validation (20 tests)
- ✅ Alias uniqueness checks (5 tests)
- ✅ Alias generation from names (15 tests)
- ✅ Alias updates with validation (4 tests)
- ✅ Historical data migration (3 tests)
- ✅ Utility functions (10 tests)

**Total: 57 tests, all passing**

Run tests:
```bash
npm test -- src/lib/alias/__tests__/alias-management.service.test.ts
```

## Error Handling

The service provides clear error messages for common issues:

| Error | Cause | Solution |
|-------|-------|----------|
| "Alias is required" | Empty alias provided | Provide a non-empty alias |
| "Alias must be at least 3 characters long" | Alias too short | Use at least 3 characters |
| "Alias must not exceed 50 characters" | Alias too long | Use 50 characters or fewer |
| "Alias must be lowercase" | Contains uppercase letters | Convert to lowercase |
| "Alias must start with a letter" | Starts with number or special char | Start with a letter |
| "Alias must end with a letter or number" | Ends with special character | End with letter or number |
| "Alias cannot contain consecutive special characters" | Has .., --, __, etc. | Remove consecutive special chars |
| "Alias is already in use" | Duplicate alias | Choose a different alias |
| "User not found" | Invalid UID | Verify user exists |
| "Failed to check alias availability" | Database error | Retry or check connection |

## Firebase Schema

The service interacts with the `users` collection:

```typescript
interface UserDocument {
  uid: string;
  alias: string;              // Unique alias
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

**Required Indexes:**
- `alias` (unique)
- `jiraAccountId` (unique)
- `team`

## Performance Considerations

- **Uniqueness checks**: Single query with index lookup (O(1))
- **Alias generation**: Pure function, no database calls
- **Alias updates**: 2-3 queries (uniqueness check, user fetch, update)
- **Historical migration**: Queries tasks and worklogs (currently for audit only)

## Future Enhancements

1. **Bulk Alias Updates**: Support updating multiple users at once
2. **Alias History**: Track all alias changes over time
3. **Alias Suggestions**: Provide multiple suggestions when alias is taken
4. **Custom Validation Rules**: Allow teams to define custom alias rules
5. **Alias Reservations**: Reserve aliases for future use

## Related Files

- `src/types/firebase-schema.ts` - Type definitions
- `src/lib/firebase/collections.ts` - Collection references
- `src/lib/firebase/operations.ts` - Database operations
- `.kiro/specs/advanced-kpi-dashboard-system/requirements.md` - Requirements
- `.kiro/specs/advanced-kpi-dashboard-system/design.md` - Design document

## Support

For issues or questions about the Alias Management Service, please refer to:
- Requirements document: `.kiro/specs/advanced-kpi-dashboard-system/requirements.md`
- Design document: `.kiro/specs/advanced-kpi-dashboard-system/design.md`
- Task list: `.kiro/specs/advanced-kpi-dashboard-system/tasks.md`
