"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { TestSession } from '@/types';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, ChevronsRight, FolderClock, FolderCheck, ArchiveX, ArrowLeft, History, Play, CheckCircle2, XCircle, AlertCircle, Clock, Smartphone, Info } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from '@/components/apps/AppShell';
import { Progress } from '@/components/ui/progress';

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
    const isAborted = session.status === 'Aborted';
    const isInProgress = session.status === 'In Progress';
    const canContinue = isInProgress || isAborted;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5 }}
            className="group"
        >
            <Card className="h-full border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-xl hover:shadow-purple-500/10 transition-all overflow-hidden rounded-3xl border-2">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl shadow-sm ${isInProgress ? 'bg-purple-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
                                <Smartphone size={18} />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-sm font-black uppercase tracking-tight truncate text-slate-900">
                                    {session.platformDetails.platformName || 'Standard Device'}
                                </CardTitle>
                                <CardDescription className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase mt-0.5">
                                    <Clock size={10} />
                                    {createdAt ? format(createdAt, "MMM d, yyyy · HH:mm") : 'No date'}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className={`text-[9px] font-black h-5 px-2 rounded-full border-0 ${isInProgress ? 'bg-purple-100 text-purple-600' :
                                isAborted ? 'bg-amber-100 text-amber-600' :
                                    'bg-emerald-100 text-emerald-600'
                            }`}>
                            {session.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Progress</span>
                            <span className="text-xs font-black text-purple-600">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-1.5 bg-slate-100" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Passed</span>
                            <span className="text-xs font-black text-emerald-600">{summary.pass}</span>
                        </div>
                        <div className="p-2 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Failed</span>
                            <span className="text-xs font-black text-rose-600">{summary.fail + summary.failKnown}</span>
                        </div>
                    </div>

                    {isAborted && (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase">
                            <AlertCircle size={12} fill="currentColor" className="text-white" />
                            Session Paused
                        </div>
                    )}
                </CardContent>

                <CardFooter className="pt-0">
                    <Button asChild className={`w-full h-10 font-black text-[10px] uppercase rounded-2xl gap-2 transition-all ${canContinue
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200'
                            : 'bg-slate-900 hover:bg-black text-white'
                        }`}>
                        <Link href={`/dashboard/session/${canContinue ? session.id : `${session.id}/results`}`}>
                            {canContinue ? (
                                <>
                                    <Play size={12} fill="currentColor" /> Resume Session
                                </>
                            ) : (
                                <>
                                    <Info size={12} /> View Results
                                </>
                            )}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

const SessionListPageContent = () => {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [sessions, setSessions] = useState<TestSession[]>([]);
    const [loading, setLoading] = useState(true);
    const defaultTab = searchParams.get('tab') === 'completed' ? 'completed' : 'active';

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const sessionsQuery = query(
            collection(db, 'testSessions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
            const fetchedSessions = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: getValidDate(data.createdAt),
                    updatedAt: getValidDate(data.updatedAt)
                } as TestSession;
            });
            setSessions(fetchedSessions);
            setLoading(false);
        }, (err) => {
            console.error("Failed to fetch sessions:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const { activeSessions, completedSessions } = useMemo(() => {
        const active = sessions.filter(s => s.status === 'In Progress' || s.status === 'Aborted');
        const completed = sessions.filter(s => s.status === 'Completed');
        return { activeSessions: active, completedSessions: completed };
    }, [sessions]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
                <div className="p-4 rounded-3xl bg-purple-50 animate-pulse">
                    <Smartphone className="h-10 w-10 text-purple-600" />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Scanning Cloud History...</p>
            </div>
        );
    }

    const renderEmpty = (message: string) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center opacity-40"
        >
            <History className="h-16 w-16 mb-4 text-purple-600" />
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">{message}</h3>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Start a new run from the dashboard</p>
        </motion.div>
    );

    return (
        <AppShell
            appName="Zenit Session Hub"
            appIcon={<History className="w-6 h-6 text-purple-600" />}
            subtitle="Execution Timeline & History"
            accentColor="#9333ea"
            navItems={[]}
        >
            <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-200">
                                <History size={24} />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Execution Hub</h1>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-widest">
                            Tracking <span className="text-purple-600 font-black">{sessions.length}</span> Automation Cycles Optimized by Antigravity
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="px-4 py-1 border-r border-slate-100 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Active</p>
                            <p className="text-lg font-black text-purple-600 leading-none">{activeSessions.length}</p>
                        </div>
                        <div className="px-4 py-1 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Completed</p>
                            <p className="text-lg font-black text-slate-900 leading-none">{completedSessions.length}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-purple-600 hover:bg-purple-50">
                            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue={defaultTab} className="w-full">
                    <div className="flex justify-center mb-8">
                        <TabsList className="bg-slate-100 p-1.5 h-12 rounded-2xl gap-2">
                            <TabsTrigger value="active" className="h-9 px-8 rounded-xl text-[11px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-lg shadow-purple-200 gap-2">
                                <FolderClock size={14} /> Active Runs
                            </TabsTrigger>
                            <TabsTrigger value="completed" className="h-9 px-8 rounded-xl text-[11px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-lg shadow-emerald-200 gap-2">
                                <FolderCheck size={14} /> Archived Results
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <AnimatePresence mode="wait">
                        <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                            {activeSessions.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {activeSessions.map(session => <SessionCard key={session.id} session={session} />)}
                                </div>
                            ) : renderEmpty("No active sessions found.")}
                        </TabsContent>
                        <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
                            {completedSessions.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {completedSessions.map(session => <SessionCard key={session.id} session={session} />)}
                                </div>
                            ) : renderEmpty("No completed sessions yet.")}
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>
            </div>
        </AppShell>
    );
}

export default function AllSessionsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Warping to Session Hub...</p>
            </div>
        }>
            <SessionListPageContent />
        </Suspense>
    )
}
