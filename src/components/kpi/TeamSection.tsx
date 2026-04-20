/**
 * TeamSection Component
 * 
 * Displays comprehensive team information including:
 * - Team name and member count
 * - Work distribution breakdown
 * - Relevant metrics filtered by intelligent metric service
 * - Work focus indicator
 * - Team member list with quick stats
 * 
 * Requirements: 1.5, 1.6, 2.2.7, 2.2.9, 2.2.10
 */

'use client';

import { JiraTeam, TeamMember, MetricValue, WorkDistribution } from '@/types/kpi-dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Activity } from 'lucide-react';

interface TeamSectionProps {
  team: JiraTeam;
  metrics: MetricValue[];
  workDistribution: WorkDistribution;
  workFocus: {
    primary: string;
    percentage: number;
    description: string;
  };
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
}

export function TeamSection({
  team,
  metrics,
  workDistribution,
  workFocus,
  members,
  onMemberClick,
}: TeamSectionProps) {
  // Calculate total work items
  const totalWorkItems = Object.values(workDistribution).reduce((sum, count) => sum + count, 0);

  // Generate work distribution breakdown
  const workBreakdown = Object.entries(workDistribution)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      type: formatWorkType(type),
      count,
      percentage: totalWorkItems > 0 ? (count / totalWorkItems) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="w-full" data-testid="team-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{team.name}</CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            {totalWorkItems} work items
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Work Focus Indicator */}
        {totalWorkItems > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Work Focus
              </span>
              <span className="text-muted-foreground">
                {workFocus.primary} ({workFocus.percentage.toFixed(1)}%)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{workFocus.description}</p>
          </div>
        )}

        {/* Work Distribution Breakdown */}
        {workBreakdown.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Work Distribution</h4>
            <div className="space-y-2">
              {workBreakdown.map((item) => (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.type}</span>
                    <span className="font-medium">
                      {item.count} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relevant Metrics */}
        {metrics.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Key Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="text-2xl font-bold text-primary">{metric.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members List */}
        {members.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Team Members</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {members.map((member) => (
                <div
                  key={member.accountId}
                  className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onMemberClick?.(member)}
                  data-testid="member-card"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl} alt={member.displayName} />
                    <AvatarFallback>
                      {getInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {members.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No members in this team</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Format work type key to display name
 */
function formatWorkType(type: string): string {
  const formatMap: Record<string, string> = {
    stories: 'Stories',
    bugs: 'Bugs',
    tasks: 'Tasks',
    epics: 'Epics',
    subtasks: 'Subtasks',
  };
  return formatMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Get initials from display name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
