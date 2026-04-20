"use client";

/**
 * Enhanced Bug Analytics Page
 * Integrates the new bug analytics and categorization system
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bug, BarChart3, Users, TrendingUp, Download, Filter,
  Calendar, Target, Award
} from 'lucide-react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { useExport } from '@/hooks/useExport';
import { useBugCategories } from '@/hooks/useBugCategories';

export default function EnhancedBugAnalyticsPage() {
  const [tab, setTab] = useState('overview');
  
  // Hooks
  const { timeRange, setPreset, formatLabel } = useTimeFilter('current_month');
  const { leaderboard, loading: leaderboardLoading } = useLeaderboard({
    timePeriod: 'current_month',
  });
  const { exportData, exporting } = useExport();
  const { categories } = useBugCategories();

  const handleExport = async () => {
    await exportData({
      format: 'excel',
      data: leaderboard,
      fileName: `bug-leaderboard-${Date.now()}.xlsx`,
      metadata: {
        exportDate: new Date(),
        exportedBy: 'current-user',
        filters: { timeRange: formatLabel() },
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="w-8 h-8 text-red-500" />
            Bug Analytics & Categorization
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatLabel()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Time Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Time Period:</span>
            {(['current_month', 'previous_month', 'last_7_days', 'last_30_days'] as const).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => setPreset(preset)}
                className="text-xs"
              >
                {preset.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Award className="w-4 h-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Target className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Bugs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {leaderboard.reduce((sum, entry) => sum + entry.bugCount, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Logger</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {leaderboard[0]?.userName || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {leaderboard[0]?.bugCount || 0} bugs
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Avg Quality Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {leaderboard.length > 0
                    ? Math.round(
                        leaderboard.reduce((sum, e) => sum + e.qualityScore, 0) /
                          leaderboard.length
                      )
                    : 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4 mt-6">
          {leaderboardLoading ? (
            <div className="text-center py-12">Loading leaderboard...</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-muted-foreground w-8">
                          #{entry.rank}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{entry.userName}</div>
                          <div className="text-sm text-muted-foreground">
                            {entry.bugCount} bugs · Quality Score: {entry.qualityScore}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {Object.entries(entry.severityDistribution).map(([severity, count]) => (
                            count > 0 && (
                              <div
                                key={severity}
                                className="text-xs px-2 py-1 rounded bg-muted"
                              >
                                {severity}: {count}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bug Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.types.map((type) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{type}</span>
                      <span className="text-xs text-muted-foreground">
                        {/* Count would come from actual data */}
                        0
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Severities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.severities.map((severity) => (
                    <div key={severity} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{severity}</span>
                      <span className="text-xs text-muted-foreground">0</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.components.map((component) => (
                    <div key={component} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{component}</span>
                      <span className="text-xs text-muted-foreground">0</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bug Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Trend visualization coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
