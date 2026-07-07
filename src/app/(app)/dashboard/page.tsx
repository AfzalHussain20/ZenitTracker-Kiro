"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { TestSession } from '@/types';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PlusCircle, Loader2, ArrowRight, Activity, TrendingUp, CheckCircle2, XCircle, Eye, Zap, Target, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ParticleBackground } from '@/components/three/ParticleBackground';
import { ActivityTrendVisualization } from '@/components/three/ActivityTrendVisualization';
import { TestResultsVisualization } from '@/components/three/TestResultsVisualization';
import { SessionActivity3D } from '@/components/three/SessionActivity3D';
import { AnimatedLineChart3D } from '@/components/three/AnimatedLineChart3D';

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  if (typeof d === 'string' || typeof d === 'number') {
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const SessionCard = ({ session }: { session: TestSession }) => {
  const summary = session.summary || { pass: 0, fail: 0, na: 0, failKnown: 0, total: 0 };
  const completedCount = summary.pass + summary.fail + summary.na + summary.failKnown;
  const completion = summary.total > 0 ? Math.round((completedCount / summary.total) * 100) : 0;
  const createdAt = getValidDate(session.createdAt);
  const canContinue = session.status === 'In Progress' || session.status === 'Aborted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">
                {session.platformDetails.platformName}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {createdAt ? format(createdAt, "MMM dd, yyyy") : 'No date'}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-primary">{completion}%</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-green-600">{summary.pass}</div>
              <div className="text-xs text-muted-foreground">Pass</div>
            </div>
            <div>
              <div className="text-sm font-bold text-red-600">{summary.fail}</div>
              <div className="text-xs text-muted-foreground">Fail</div>
            </div>
            <div>
              <div className="text-sm font-bold text-orange-600">{summary.failKnown}</div>
              <div className="text-xs text-muted-foreground">Known</div>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-600">{summary.na}</div>
              <div className="text-xs text-muted-foreground">N/A</div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/dashboard/session/${canContinue ? session.id : `${session.id}/results`}`}>
              {canContinue ? 'Continue' : 'View Results'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function DashboardPage() {
  const { user, loading: authLoading, displayName } = useAuth();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { 
      setSessionsLoading(false); 
      return; 
    }
    
    setSessionsLoading(true);

    // Listen to both collections and merge
    let sessions1: TestSession[] = [];
    let sessions2: TestSession[] = [];
    let loaded1 = false, loaded2 = false;

    const merge = () => {
      if (!loaded1 || !loaded2) return;
      const merged = new Map<string, TestSession>();
      [...sessions1, ...sessions2].forEach(s => merged.set(s.id, s));
      const sorted = Array.from(merged.values()).sort((a, b) => {
        const da = getValidDate(a.createdAt)?.getTime() || 0;
        const db2 = getValidDate(b.createdAt)?.getTime() || 0;
        return db2 - da;
      });
      setSessions(sorted);
      setSessionsLoading(false);
    };

    const q1 = query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const q2 = query(collection(db, 'testSessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsub1 = onSnapshot(q1, (snap) => {
      sessions1 = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: getValidDate(doc.data().createdAt), updatedAt: getValidDate(doc.data().updatedAt) } as TestSession));
      loaded1 = true; merge();
    }, () => { loaded1 = true; merge(); });

    const unsub2 = onSnapshot(q2, (snap) => {
      sessions2 = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: getValidDate(doc.data().createdAt), updatedAt: getValidDate(doc.data().updatedAt) } as TestSession));
      loaded2 = true; merge();
    }, () => { loaded2 = true; merge(); });
    
    return () => { unsub1(); unsub2(); };
  }, [user, authLoading]);

  const { activeSessions, completedSessions, stats } = useMemo(() => {
    const active = sessions.filter(s => s.status === 'In Progress' || s.status === 'Aborted');
    const completed = sessions.filter(s => s.status === 'Completed');
    
    let totalTests = 0, totalPass = 0, totalFail = 0;
    sessions.forEach(s => {
      if (s.summary) {
        totalTests += s.summary.total;
        totalPass += s.summary.pass;
        totalFail += s.summary.fail + s.summary.failKnown;
      }
    });
    
    return { 
      activeSessions: active, 
      completedSessions: completed,
      stats: { totalTests, totalPass, totalFail, totalSessions: sessions.length }
    };
  }, [sessions]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const tests = Math.floor(Math.random() * 50) + 20;
      const passed = Math.floor(tests * (0.7 + Math.random() * 0.2));
      const failed = tests - passed;
      return {
        date: format(date, 'EEE'),
        tests,
        passed,
        failed,
      };
    });
    return last7Days;
  }, []);

  const pieData = [
    { name: 'Pass', value: stats.totalPass, color: '#10b981' },
    { name: 'Fail', value: stats.totalFail, color: '#ef4444' },
  ];

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <ParticleBackground />
      <div className="space-y-6 animate-fade-in relative">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 p-8">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  System Online
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
                  Welcome back, <span className="text-gradient">{displayName || 'Tester'}</span>
                </h1>
                <p className="text-muted-foreground text-lg">
                  Your testing command center • {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild variant="outline" size="lg">
                  <Link href="/apps">
                    <Eye className="h-5 w-5 mr-2" />
                    Apps
                  </Link>
                </Button>
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  <Link href="/dashboard/new-session">
                    <PlusCircle className="h-5 w-5 mr-2" />
                    New Session
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        {/* Quick Resume Banner */}
        {activeSessions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Link href={`/dashboard/session/${activeSessions[0].id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Continue: {activeSessions[0].platformDetails?.platformName}</p>
                <p className="text-xs text-muted-foreground">
                  {activeSessions[0].summary ? `${activeSessions[0].summary.pass + activeSessions[0].summary.fail + activeSessions[0].summary.na}/${activeSessions[0].summary.total} done` : 'In progress'}
                  {activeSessions.length > 1 && ` · ${activeSessions.length - 1} more active`}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                    <h3 className="text-3xl font-bold mt-2">{stats.totalSessions}</h3>
                    <p className="text-xs text-muted-foreground mt-1">All time</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Tests</p>
                    <h3 className="text-3xl font-bold mt-2">{stats.totalTests}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Executed</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Passed</p>
                    <h3 className="text-3xl font-bold mt-2 text-green-600">{stats.totalPass}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.totalTests > 0 ? Math.round((stats.totalPass / stats.totalTests) * 100) : 0}% success rate
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/10">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed</p>
                    <h3 className="text-3xl font-bold mt-2 text-red-600">{stats.totalFail}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Advanced 3D Analytics */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 3D Activity Trend */}
          <Card className="lg:col-span-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Activity Trend Analytics
                  </CardTitle>
                  <CardDescription>3D visualization of test execution over 7 days</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium">Passed</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs font-medium">Failed</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] relative">
                <ActivityTrendVisualization data={chartData} />
                <div className="absolute bottom-4 left-4 right-4 grid grid-cols-7 gap-2">
                  {chartData.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="text-center p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50"
                    >
                      <div className="text-xs font-medium text-muted-foreground">{point.date}</div>
                      <div className="text-sm font-bold text-primary">{point.tests}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3D Test Results */}
          <Card className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Test Results Distribution
              </CardTitle>
              <CardDescription>3D interactive donut visualization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex flex-col">
                {stats.totalTests > 0 ? (
                  <>
                    <div className="flex-1 relative">
                      <TestResultsVisualization 
                        passed={stats.totalPass} 
                        failed={stats.totalFail} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20"
                      >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">Passed</span>
                          </div>
                          <div className="text-2xl font-bold text-green-600">{stats.totalPass}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {stats.totalTests > 0 ? Math.round((stats.totalPass / stats.totalTests) * 100) : 0}% success rate
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20"
                      >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs font-medium text-red-700 dark:text-red-400">Failed</span>
                          </div>
                          <div className="text-2xl font-bold text-red-600">{stats.totalFail}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {stats.totalTests > 0 ? Math.round((stats.totalFail / stats.totalTests) * 100) : 0}% failure rate
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <BarChart3 className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">No test data available</p>
                        <p className="text-sm text-muted-foreground mt-1">Start testing to see analytics</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-2xl font-semibold">Active Sessions</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/sessions">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeSessions.slice(0, 4).map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold">Recently Completed</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/sessions">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {completedSessions.slice(0, 4).map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {sessions.length === 0 && (
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5" />
            <CardContent className="p-12 relative">
              <div className="text-center space-y-4 max-w-md mx-auto">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Ready to start testing?</h3>
                  <p className="text-muted-foreground mt-2">
                    Create your first testing session and begin tracking your QA workflow
                  </p>
                </div>
                <Button asChild size="lg" className="mt-4">
                  <Link href="/dashboard/new-session">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create Your First Session
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
