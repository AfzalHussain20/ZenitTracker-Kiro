# KPI Dashboard Components

This directory contains reusable components for the Advanced KPI Dashboard System.

## Components

### TeamSection

A comprehensive team information display component that shows:

- Team name and member count
- Work distribution breakdown (Stories, Bugs, Tasks, Epics, Subtasks)
- Relevant metrics filtered by the intelligent metric service
- Work focus indicator showing primary work type
- Team member list with avatars and quick stats

#### Props

```typescript
interface TeamSectionProps {
  team: JiraTeam;                    // Team information from Jira
  metrics: MetricValue[];            // Filtered relevant metrics
  workDistribution: WorkDistribution; // Work item type breakdown
  workFocus: {                       // Primary work focus
    primary: string;
    percentage: number;
    description: string;
  };
  members: TeamMember[];             // Team members list
  onMemberClick?: (member: TeamMember) => void; // Optional click handler
}
```

#### Usage

```tsx
import { TeamSection } from '@/components/kpi';
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

function MyDashboard() {
  const team = { /* team data */ };
  const issues = [ /* Jira issues */ ];
  
  // Get intelligent metrics
  const result = intelligentMetricFilterService.getIntelligentMetrics(
    issues,
    team.teamType
  );
  
  return (
    <TeamSection
      team={team}
      metrics={result.metrics}
      workDistribution={result.workDistribution}
      workFocus={result.workFocus}
      members={team.members}
      onMemberClick={(member) => console.log('Clicked:', member)}
    />
  );
}
```

#### Features

1. **Dynamic Work Distribution**: Automatically calculates and displays work item type percentages
2. **Intelligent Metrics**: Only shows metrics relevant to the team's actual work
3. **Work Focus Indicator**: Highlights the team's primary work type
4. **Responsive Design**: Works on desktop, tablet, and mobile devices
5. **Interactive Members**: Click on members to view detailed profiles
6. **Empty States**: Gracefully handles teams with no members or work items

#### Requirements Satisfied

- **1.5**: Display team name and member count
- **1.6**: Show work distribution breakdown
- **2.2.7**: Render only relevant metrics based on actual work
- **2.2.9**: Add work focus indicator
- **2.2.10**: List team members with quick stats

#### Testing

Run tests with:

```bash
npm test src/components/kpi/__tests__/TeamSection.test.tsx
```

Test coverage includes:
- Team name and member count display
- Work focus indicator
- Work distribution breakdown
- Relevant metrics display
- Team members list
- Empty state handling
- Member click interactions

#### Styling

The component uses:
- shadcn/ui components (Card, Badge, Avatar, Progress)
- Tailwind CSS for styling
- Lucide React icons
- Responsive grid layouts

#### Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly

## Integration with Services

### Intelligent Metric Filter Service

The TeamSection component is designed to work with the `intelligentMetricFilterService`:

```typescript
import { intelligentMetricFilterService } from '@/lib/kpi/intelligent-metric-filter.service';

const result = intelligentMetricFilterService.getIntelligentMetrics(
  issues,
  teamType
);

// result contains:
// - metrics: Filtered relevant metrics
// - workDistribution: Work item breakdown
// - workFocus: Primary work type
// - filteredCount: Number of metrics filtered out
// - totalAvailableMetrics: Total metrics available
```

### Work Distribution Service

The work distribution data comes from the `workDistributionService`:

```typescript
import { workDistributionService } from '@/lib/kpi/work-distribution.service';

const analysis = workDistributionService.analyzeWorkDistribution(issues);

// analysis contains:
// - distribution: Work item counts
// - total: Total work items
// - workFocus: Primary work type
// - hasWork: Boolean indicating if team has work
```

## Future Enhancements

- [ ] Add sorting options for members
- [ ] Add filtering by work type
- [ ] Add export functionality
- [ ] Add comparison with other teams
- [ ] Add historical trend indicators
- [ ] Add team performance score

## Related Components

- `MemberProfileModal` (coming in Task 5.3)
- `WorkAllocationForm` (coming in Task 5.4)
- `WorklogTracker` (coming in Task 5.5)

## API Integration

The component expects data from:

- `/api/jira/teams` - Team and member information
- `/api/jira/issues` - Work items for metric calculation

See the API documentation for request/response formats.
