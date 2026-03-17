'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, Play, Pause, Timer, TrendingUp, Target, Zap, CheckCircle2, FolderKanban, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import Link from 'next/link';

const recentEntries = [
    { id: 1, project: 'Zenit Platform', task: 'Regression Testing', duration: '2h 45m' },
    { id: 2, project: 'Mobile App', task: 'API Testing', duration: '1h 30m' },
];

const projects = [
    { name: 'Zenit Platform', progress: 78, color: '#6366F1', hours: 24 },
    { name: 'Mobile App', progress: 45, color: '#10B981', hours: 12 },
    { name: 'Dashboard', progress: 92, color: '#F59E0B', hours: 8 },
];

export default function WrklogPage() {
    const [isTracking, setIsTracking] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentTask, setCurrentTask] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTracking) {
            interval = setInterval(() => setCurrentTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isTracking]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 p-8">
                    <div className="relative z-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
                            <Link href="/apps">
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium mb-3">
                                    <Clock className="w-3 h-3" />
                                    Time Tracker
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight">
                                    <span className="text-gradient">Wrklog</span>
                                </h1>
                                <p className="text-muted-foreground text-lg mt-2">
                                    Track your testing time efficiently
                                </p>
                            </div>
                        </motion.div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
                </div>

                {/* Timer Card */}
                <div className="grid lg:grid-cols-2 gap-6">
                    <Card className="relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600" />
                        <CardContent className="p-8 relative">
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-full">
                                    <Input
                                        placeholder="What are you working on?"
                                        value={currentTask}
                                        onChange={e => setCurrentTask(e.target.value)}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-lg"
                                    />
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-4xl font-mono font-bold text-white">{formatTime(currentTime)}</div>
                                        <div className="text-xs text-white/60 mt-1">Duration</div>
                                    </div>
                                    <Button
                                        onClick={() => setIsTracking(!isTracking)}
                                        size="lg"
                                        className={`w-16 h-16 rounded-full ${isTracking ? 'bg-white text-indigo-600 hover:bg-white/90' : 'bg-white/20 text-white border-2 border-white/30 hover:bg-white/30'}`}
                                    >
                                        {isTracking ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Clock Visual */}
                    <Card className="relative overflow-hidden">
                        <CardContent className="p-8 flex flex-col items-center justify-center h-full gap-4">
                            <div className="relative w-32 h-32">
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30" />
                                <div className={`absolute inset-2 rounded-full border-4 border-t-indigo-500 transition-all ${isTracking ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Timer className="w-10 h-10 text-indigo-500" />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">{isTracking ? 'Tracking in progress...' : 'Timer paused'}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Today', value: '4h 32m', icon: Timer, gradient: 'from-indigo-500 to-purple-600' },
                        { label: 'This Week', value: '24h 15m', icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
                        { label: 'Projects', value: '5', icon: Target, gradient: 'from-orange-500 to-red-600' },
                        { label: 'Focus', value: '92%', icon: Zap, gradient: 'from-pink-500 to-rose-600' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                <CardContent className="p-6 relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                                            <stat.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold">{stat.value}</div>
                                            <div className="text-xs text-muted-foreground">{stat.label}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-500" /> Recent Activity
                            </h3>
                            <div className="space-y-3">
                                {recentEntries.map((entry) => (
                                    <div key={entry.id} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <div className="flex-1">
                                            <p className="font-medium">{entry.task}</p>
                                            <p className="text-sm text-muted-foreground">{entry.project}</p>
                                        </div>
                                        <span className="font-mono text-sm font-bold">{entry.duration}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Projects */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <FolderKanban className="w-5 h-5 text-indigo-500" /> Active Projects
                            </h3>
                            <div className="space-y-4">
                                {projects.map((project) => (
                                    <div key={project.name} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{project.name}</span>
                                            <span className="text-sm text-muted-foreground">{project.hours}h</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${project.progress}%` }}
                                                transition={{ duration: 1, delay: 0.2 }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: project.color }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full mt-4">
                                    <Plus className="w-4 h-4 mr-2" /> New Project
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
        </div>
    );
}
