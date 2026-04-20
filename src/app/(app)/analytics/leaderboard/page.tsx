/**
 * Leaderboard View Page
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

'use client';

import React, { useState } from 'react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, User } from 'lucide-react';
import { TimePreset, LeaderboardTimePeriod } from '@/types/bug-analytics';

const TIME_PERIODS: Array<{ value: TimePreset; label: string }> = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all_time', label: 'All Time' },
];

export default function LeaderboardViewPage() {
  const [timePeriod, setTimePeriod] = useState<TimePreset>('current_month');
  const { leaderboard, loading } = useLeaderboard({
    timePeriod: (timePeriod === 'last_7_days' ? 'current_month' : timePeriod) as LeaderboardTimePeriod,
  });

  const handleTimePeriodChange = (period: TimePreset) => {
    setTimePeriod(period);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <User className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-green-500';
      case 'trivial':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <Select value={timePeriod} onValueChange={value => handleTimePeriodChange(value as TimePreset)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map(period => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No data available for the selected time period
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((entry, index) => (
            <Card
              key={entry.userId}
              className={`${
                entry.rank <= 3 ? 'border-2 border-primary' : ''
              } transition-all hover:shadow-lg`}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  {/* Rank */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    {getRankIcon(entry.rank)}
                    <span className="text-2xl font-bold mt-2">#{entry.rank}</span>
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{entry.userName}</h3>
                    <p className="text-sm text-muted-foreground">User ID: {entry.userId}</p>
                  </div>

                  {/* Bug Count */}
                  <div className="text-center min-w-[100px]">
                    <div className="text-3xl font-bold text-primary">{entry.bugCount}</div>
                    <div className="text-sm text-muted-foreground">Bugs Logged</div>
                  </div>

                  {/* Quality Score */}
                  <div className="text-center min-w-[100px]">
                    <div className="text-3xl font-bold text-green-600">{entry.qualityScore}</div>
                    <div className="text-sm text-muted-foreground">Quality Score</div>
                  </div>
                </div>

                {/* Severity Distribution */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">Severity Distribution</h4>
                  <div className="flex gap-4">
                    {Object.entries(entry.severityDistribution).map(([severity, count]) => (
                      <div key={severity} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(severity)}`} />
                        <span className="text-sm capitalize">{severity}:</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About Quality Score</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Quality Score is calculated based on the severity distribution of bugs logged.
            Higher severity bugs contribute more to the quality score, reflecting the impact
            of the bugs discovered.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
