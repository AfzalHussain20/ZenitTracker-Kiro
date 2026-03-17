'use client';

import React, { useState, useEffect } from 'react';
import { trackerApi } from '@/lib/tracker-api';
import {
    Activity, Layers, MousePointer2, PlayCircle,
    TrendingUp, CheckCircle2, XCircle, Clock,
    Package, Terminal, Wand2, FileText
} from 'lucide-react';
import {
    Card, CardHeader, CardTitle, CardContent
} from '@/components/ui/card';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';

export function TrackerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await trackerApi.getStats();
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch statistics", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div>Loading statistics...</div>;

    const cards = [
        { label: 'Test Suites', value: stats?.suitesCount || 0, icon: <Layers className="w-5 h-5 text-indigo-500" />, color: 'bg-indigo-50' },
        { label: 'Test Cases', value: stats?.casesCount || 0, icon: <FileText className="w-5 h-5 text-emerald-500" />, color: 'bg-emerald-50' },
        { label: 'Locators', value: stats?.locatorsCount || 0, icon: <MousePointer2 className="w-5 h-5 text-amber-500" />, color: 'bg-amber-50' },
        { label: 'Executions', value: stats?.executionsCount || 0, icon: <PlayCircle className="w-5 h-5 text-rose-500" />, color: 'bg-rose-50' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c, i) => (
                    <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{c.label}</p>
                                    <h2 className="text-3xl font-black text-slate-900 tabular-nums">{c.value}</h2>
                                </div>
                                <div className={`p-3 rounded-2xl ${c.color} group-hover:scale-110 transition-transform duration-500`}>
                                    {c.icon}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                                <TrendingUp className="w-3 h-3" />
                                <span>+12.5% INCREMENT</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-sm font-black uppercase text-slate-900 tracking-tight">Execution Trends</CardTitle>
                            <p className="text-[11px] text-slate-400">Weekly performance metrics for Zenit Vision</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                <div className="w-2 h-2 rounded-full bg-indigo-500" /> PASS RATE
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[
                                { name: 'Mon', val: 65 }, { name: 'Tue', val: 72 }, { name: 'Wed', val: 68 },
                                { name: 'Thu', val: 85 }, { name: 'Fri', val: 92 }, { name: 'Sat', val: 88 }, { name: 'Sun', val: 95 }
                            ]}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 800 }}
                                />
                                <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase text-slate-900 tracking-tight">System Status</CardTitle>
                        <p className="text-[11px] text-slate-400">Real-time health of automation nodes</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {[
                            { name: 'ADB Controller', status: 'Optimal', icon: <Terminal className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                            { name: 'Vision Engine', status: 'Running', icon: <Wand2 className="w-4 h-4" />, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                            { name: 'MongoDB', status: 'Connected', icon: <Package className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-50' },
                            { name: 'Execution Node', status: 'Idle', icon: <Activity className="w-4 h-4" />, color: 'text-slate-400', bg: 'bg-slate-50' }
                        ].map((s, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${s.bg} ${s.color}`}>
                                        {s.icon}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{s.name}</span>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${s.color}`}>{s.status}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
