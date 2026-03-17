"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trophy, Target, TrendingUp, Lock, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const { user, userRole } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [teamData, setTeamData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchTeamData = async () => {
      setIsLoading(true);
      try {
        const sessionsQuery = query(
          collection(db, 'testSessions'), 
          orderBy('createdAt', 'desc'), 
          limit(500)
        );
        const snapshot = await getDocs(sessionsQuery);

        const statsMap = new Map();

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const uid = data.userId;
          const name = data.userName || 'Unknown';

          if (!statsMap.has(uid)) {
            statsMap.set(uid, {
              name,
              tests: 0,
              xp: 0,
              passes: 0
            });
          }

          const entry = statsMap.get(uid);
          entry.tests += 1;

          if (data.summary) {
            const sessionXP = (data.summary.pass * 10) + (data.summary.fail * 2) + 50;
            entry.xp += sessionXP;
            entry.passes += data.summary.pass;
          }
        });

        const aggregatedData = Array.from(statsMap.values()).map(stat => ({
          ...stat,
          avatar: stat.name.substring(0, 2).toUpperCase()
        }));

        if (aggregatedData.length === 0 && user) {
          aggregatedData.push({
            name: user.displayName || 'You',
            tests: 0,
            xp: 0,
            passes: 0,
            avatar: 'ME'
          });
        }

        setTeamData(aggregatedData);
      } catch (err) {
        console.error("Team data fetch failed", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== 'lead') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Restricted Access</h2>
        <p className="text-muted-foreground text-center max-w-md">
          This page is only available to team leads
        </p>
        <Button onClick={() => router.push('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const topPerformer = teamData.length > 0
    ? teamData.reduce((prev, current) => (prev.tests > current.tests) ? prev : current)
    : { name: 'N/A', tests: 0 };

  const totalTests = teamData.reduce((acc, curr) => acc + curr.tests, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Performance</h1>
        <p className="text-muted-foreground mt-1">
          Track team activity and performance metrics
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Trophy className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Performer</p>
                <p className="text-lg font-bold">{topPerformer.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tests</p>
                <p className="text-lg font-bold">{totalTests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-lg font-bold">{teamData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Leaderboard */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Ranked by contribution points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No team activity yet
                </p>
              ) : (
                teamData
                  .sort((a, b) => b.xp - a.xp)
                  .map((agent, index) => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{agent.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.xp} XP • {agent.tests} tests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">
                          {agent.passes}
                        </p>
                        <p className="text-xs text-muted-foreground">passes</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Chart</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {teamData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamData}>
                  <XAxis 
                    dataKey="avatar" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))', 
                      borderRadius: '8px' 
                    }}
                  />
                  <Bar 
                    dataKey="tests" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
