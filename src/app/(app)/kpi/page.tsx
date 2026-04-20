"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, RefreshCw, Clock, TrendingUp, Activity, 
  ChevronRight, Loader2, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { JiraTeam, TeamMember } from '@/types/kpi-dashboard';
import { MemberProfileModal } from '@/components/kpi/MemberProfileModal';

interface TeamsResponse {
  teams: JiraTeam[];
  fromCache: boolean;
  count: number;
  lastRefresh?: string;
}

export default function KPIDashboardPage() {
  const { toast } = useToast();
  
  // State
  const [teams, setTeams] = useState<JiraTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<JiraTeam | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const endpoint = forceRefresh ? '/api/jira/teams' : '/api/jira/teams';
      const options = forceRefresh ? { method: 'POST' } : { method: 'GET' };
      
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.statusText}`);
      }

      const data: TeamsResponse = await response.json();
      
      setTeams(data.teams);
      setFromCache(data.fromCache);
      
      if (data.lastRefresh) {
        setLastRefresh(new Date(data.lastRefresh));
      } else {
        setLastRefresh(new Date());
      }

      if (forceRefresh) {
        toast({
          title: 'Teams Refreshed',
          description: `Loaded ${data.count} teams from Jira`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch teams';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchTeams(true);
  };

  const handleTeamSelect = (team: JiraTeam) => {
    setSelectedTeam(team);
  };

  const handleMemberClick = (member: TeamMember, team: JiraTeam) => {
    setSelectedMember(member);
    setSelectedTeam(team);
    setMemberModalOpen(true);
  };

  const handleModalClose = () => {
    setMemberModalOpen(false);
    // Don't clear selectedMember/selectedTeam immediately to avoid flash
    setTimeout(() => {
      setSelectedMember(null);
    }, 200);
  };

  const formatLastRefresh = () => {
    if (!lastRefresh) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastRefresh.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return lastRefresh.toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading teams...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && teams.length === 0) {
    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <CardTitle>Error Loading Teams</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => fetchTeams()} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg leading-none">
              KPI <span className="text-indigo-600">Dashboard</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Team Performance Tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-6 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Teams</p>
                <p className="text-sm font-bold">{teams.length}</p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Last Refresh</p>
                <p className="text-sm font-bold">{formatLastRefresh()}</p>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Cache Indicator */}
          {fromCache && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Showing cached data (refreshes every 30 minutes)
              </p>
            </div>
          )}

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700"
                onClick={() => handleTeamSelect(team)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                      </CardDescription>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {team.teamType || 'generic'}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <TrendingUp className="w-3 h-3" />
                      <span>View Metrics</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {teams.length === 0 && !loading && (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center gap-4">
                <Users className="w-12 h-12 text-slate-300" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                    No Teams Found
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    No teams were discovered from Jira. Try refreshing or check your configuration.
                  </p>
                </div>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Teams
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Selected Team Panel (Placeholder for future implementation) */}
      {selectedTeam && !memberModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedTeam.name}</CardTitle>
                  <CardDescription>
                    {selectedTeam.members.length} team members
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTeam(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Team Members</h4>
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.accountId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        onClick={() => handleMemberClick(member, selectedTeam)}
                        data-testid="member-card"
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              {member.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{member.displayName}</p>
                          <p className="text-xs text-slate-500">{member.accountId}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div className="text-sm text-slate-500 text-center py-4">
                  <p>Team metrics and detailed analytics coming soon...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member Profile Modal */}
      {selectedMember && selectedTeam && (
        <MemberProfileModal
          member={selectedMember}
          team={selectedTeam}
          isOpen={memberModalOpen}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
