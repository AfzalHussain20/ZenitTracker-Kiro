/**
 * MemberProfileModal Component
 * 
 * Displays detailed member profile information with team-contextualized metrics.
 * 
 * Features:
 * - Complete profile information (name, alias, team, role, contact)
 * - Team-relevant metrics only (no irrelevant zero values)
 * - Worklog history and missing worklog alerts (placeholder)
 * - Day-wise breakdown and trend charts (placeholder)
 * - Export functionality (placeholder)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.14
 */

'use client';

import { useState, useEffect } from 'react';
import { JiraTeam, TeamMember, MetricValue, WorkDistribution } from '@/types/kpi-dashboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Users, 
  Briefcase, 
  Activity,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { teamClassificationService } from '@/lib/kpi/team-classification.service';
import { metricMappingService } from '@/lib/kpi/metric-mapping.service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useExport } from '@/hooks/useExport';
import { useToast } from '@/hooks/use-toast';

interface MemberProfileModalProps {
  member: TeamMember;
  team: JiraTeam;
  isOpen: boolean;
  onClose: () => void;
}

// Worklog data structures
interface WorklogEntry {
  issueKey: string;
  issueUrl?: string;
  issueSummary?: string;
  timeSpentSeconds: number;
  timeSpent: string;
  started: string;
  comment: string;
}

interface MissingWorklog {
  issueKey: string;
  issueUrl?: string;
  issueSummary: string;
  assignedDate: string;
  daysMissing: number;
}

interface WorklogData {
  worklogs: WorklogEntry[];
  missingWorklogs: MissingWorklog[];
  totalTimeLogged: number;
  completionPercentage: number;
  totalIssues: number;
  issuesWithWorklogs: number;
}

export function MemberProfileModal({
  member,
  team,
  isOpen,
  onClose,
}: MemberProfileModalProps) {
  // State for metrics and loading
  const [metrics, setMetrics] = useState<MetricValue[]>([]);
  const [workDistribution, setWorkDistribution] = useState<WorkDistribution | null>(null);
  const [worklogData, setWorklogData] = useState<WorklogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [worklogLoading, setWorklogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  
  // Export hook
  const { exportData, exporting } = useExport();
  const { toast } = useToast();

  /**
   * Get initials from display name
   */
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Fetch member's issues and calculate team-contextualized metrics
   */
  useEffect(() => {
    if (!isOpen || !member || !team) {
      return;
    }

    const fetchMemberMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Classify team type
        const classification = teamClassificationService.classifyTeam(team);
        const teamType = classification.teamType;

        // Fetch member's Jira issues
        const response = await fetch('/api/jira/issues', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assigneeAccountId: member.accountId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch member issues');
        }

        const data = await response.json();
        const issues = data.issues || [];
        setIssues(issues); // Store issues for export

        // Calculate work distribution
        const distribution: WorkDistribution = {
          stories: issues.filter((i: any) => i.issueType === 'Story').length,
          bugs: issues.filter((i: any) => i.issueType === 'Bug').length,
          tasks: issues.filter((i: any) => i.issueType === 'Task').length,
          epics: issues.filter((i: any) => i.issueType === 'Epic').length,
          subtasks: issues.filter((i: any) => i.issueType === 'Sub-task').length,
        };
        setWorkDistribution(distribution);

        // Calculate team-relevant metrics (excluding zero values)
        const calculatedMetrics = metricMappingService.calculateMetrics(
          issues,
          teamType,
          true // excludeZeroValues
        );
        setMetrics(calculatedMetrics);

      } catch (err) {
        console.error('Error fetching member metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberMetrics();
  }, [isOpen, member, team]);

  /**
   * Handle CSV export
   */
  const handleExportCSV = async () => {
    try {
      const exportRows = [
        // Profile information
        { Section: 'Profile', Field: 'Name', Value: member.displayName },
        { Section: 'Profile', Field: 'Account ID', Value: member.accountId },
        { Section: 'Profile', Field: 'Team', Value: team.name },
        { Section: 'Profile', Field: 'Team Type', Value: team.teamType || 'N/A' },
        { Section: '', Field: '', Value: '' }, // Empty row
        
        // Work distribution
        { Section: 'Work Distribution', Field: 'Stories', Value: workDistribution?.stories || 0 },
        { Section: 'Work Distribution', Field: 'Bugs', Value: workDistribution?.bugs || 0 },
        { Section: 'Work Distribution', Field: 'Tasks', Value: workDistribution?.tasks || 0 },
        { Section: 'Work Distribution', Field: 'Epics', Value: workDistribution?.epics || 0 },
        { Section: 'Work Distribution', Field: 'Subtasks', Value: workDistribution?.subtasks || 0 },
        { Section: '', Field: '', Value: '' }, // Empty row
        
        // Metrics
        ...metrics.map(m => ({
          Section: 'Metrics',
          Field: m.label,
          Value: m.value,
        })),
        { Section: '', Field: '', Value: '' }, // Empty row
        
        // Issues
        { Section: 'Issues', Field: 'Key', Value: 'Summary' },
        ...issues.map(issue => ({
          Section: 'Issues',
          Field: issue.key,
          Value: issue.summary,
        })),
      ];

      await exportData({
        format: 'csv',
        data: exportRows,
        fileName: `member-profile-${member.displayName.replace(/\s+/g, '-')}-${Date.now()}.csv`,
        metadata: {
          exportDate: new Date(),
          exportedBy: 'system',
          filters: {
            member: member.displayName,
            team: team.name,
          },
        },
      });

      toast({
        title: 'Export Successful',
        description: 'Member profile exported to CSV',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  /**
   * Handle PDF export
   */
  const handleExportPDF = async () => {
    try {
      const exportData_pdf = {
        profile: {
          name: member.displayName,
          accountId: member.accountId,
          team: team.name,
          teamType: team.teamType || 'N/A',
        },
        workDistribution: workDistribution || {},
        metrics: metrics.map(m => ({
          label: m.label,
          value: m.value,
          description: m.description || '',
        })),
        issues: issues.map(issue => ({
          key: issue.key,
          summary: issue.summary,
          status: issue.status,
          priority: issue.priority,
        })),
      };

      await exportData({
        format: 'pdf',
        data: [exportData_pdf],
        fileName: `member-profile-${member.displayName.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
        metadata: {
          exportDate: new Date(),
          exportedBy: 'system',
          filters: {
            member: member.displayName,
            team: team.name,
          },
        },
      });

      toast({
        title: 'Export Successful',
        description: 'Member profile exported to PDF',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="member-profile-modal">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={member.avatarUrl} alt={member.displayName} />
              <AvatarFallback className="text-lg">
                {getInitials(member.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-2xl">{member.displayName}</DialogTitle>
              <DialogDescription className="mt-1">
                Member Profile - {team.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Profile Information Section */}
        <div className="space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Full Name</span>
                  </div>
                  <p className="font-medium">{member.displayName}</p>
                </div>

                {/* Account ID (Alias placeholder) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      Alias
                    </Badge>
                  </div>
                  <p className="font-medium text-sm font-mono">{member.accountId}</p>
                </div>

                {/* Team */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Team</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{team.name}</p>
                    {team.teamType && (
                      <Badge variant="secondary" className="text-xs">
                        {team.teamType}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Role (Placeholder) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>Role</span>
                  </div>
                  <p className="font-medium text-muted-foreground">Team Member</p>
                </div>

                {/* Contact Details (Placeholder) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Contact</span>
                  </div>
                  <p className="font-medium text-muted-foreground text-sm">
                    Contact details coming soon
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team-Contextualized Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Performance Metrics
              </CardTitle>
              <CardDescription>
                Team-relevant metrics for {team.name}
                {team.teamType && (
                  <Badge variant="outline" className="ml-2">
                    {team.teamType}
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading metrics...</span>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!loading && !error && (
                <>
                  {/* Work Distribution */}
                  {workDistribution && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Work Distribution
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {workDistribution.stories > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {workDistribution.stories}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Stories</div>
                          </div>
                        )}
                        {workDistribution.bugs > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {workDistribution.bugs}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Bugs</div>
                          </div>
                        )}
                        {workDistribution.tasks > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {workDistribution.tasks}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Tasks</div>
                          </div>
                        )}
                        {workDistribution.epics > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {workDistribution.epics}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Epics</div>
                          </div>
                        )}
                        {workDistribution.subtasks > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {workDistribution.subtasks}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Subtasks</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metrics Grid */}
                  {metrics.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Key Performance Indicators
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {metrics.map((metric) => (
                          <div
                            key={metric.key}
                            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                            data-testid="metric-card"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  {metric.label}
                                </div>
                                <div
                                  className="text-3xl font-bold text-primary"
                                  data-testid="metric-value"
                                >
                                  {metric.value}
                                </div>
                                {metric.description && (
                                  <div className="text-xs text-muted-foreground mt-2">
                                    {metric.description}
                                  </div>
                                )}
                              </div>
                              <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        No relevant metrics available for this member
                      </p>
                      <p className="text-xs mt-1">
                        Metrics will appear once work items are assigned and completed
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Worklog History (Placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Worklog History
              </CardTitle>
              <CardDescription>
                Time tracking and work activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  Worklog history and missing worklog alerts will be displayed here
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Day-Wise Breakdown (Placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Day-Wise Activity
              </CardTitle>
              <CardDescription>
                Daily work breakdown and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  Day-wise breakdown and trend charts will be displayed here
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Export Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={exporting || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              disabled={exporting || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
