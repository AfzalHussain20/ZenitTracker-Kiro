import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Plus,
    PlayCircle,
    CheckCircle2,
    XCircle,
    Clock,
    Smartphone,
    Layers,
    CircleDot,
    ShieldCheck,
    Zap,
    BarChart3,
    Activity,
    TrendingUp,
    ArrowUpRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

const statsIcons = {
    total_suites: <Layers className="text-pink-500" size={20} />,
    total_cases: <CircleDot className="text-sky-500" size={20} />,
    total_executions: <Activity className="text-indigo-500" size={20} />,
    pass_rate: <ShieldCheck className="text-green-500" size={20} />,
    total_locators: <ShieldCheck className="text-green-500" size={20} />,
    total_templates: <Zap className="text-orange-500" size={20} />,
};

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadStats = useCallback(async () => {
        try {
            const r = await api.getStats();
            setStats(r.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    if (loading) return <div className="p-8 text-zinc-500 font-barlow tracking-widest uppercase italic">Initializing System...</div>;

    const assetData = [
        { name: 'Suites', count: stats?.total_suites || 0, color: '#ec4899' },
        { name: 'Cases', count: stats?.total_cases || 0, color: '#0ea5e9' },
        { name: 'Locators', count: stats?.total_locators || 0, color: '#22c55e' },
        { name: 'Templates', count: stats?.total_templates || 0, color: '#f59e0b' },
    ];

    return (
        <div className="p-6 md:p-8 animate-fade-in" data-testid="dashboard-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Infrastructure <span className="text-pink-500">Command</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">STAGING_UAT_1 // LIVE FEED</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-barlow tracking-widest uppercase text-zinc-500">Global Efficiency</p>
                        <p className="text-xl font-bold font-barlow text-zinc-200 tracking-tighter">98.2% <ArrowUpRight size={14} className="inline text-green-500" /></p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 stagger-children">
                <StatCard title="Test Suites" value={stats?.total_suites} icon={statsIcons.total_suites} trend="+2 new" color="pink" />
                <StatCard title="Cases" value={stats?.total_cases} icon={statsIcons.total_cases} trend="+12 this month" color="sky" />
                <StatCard title="Executions" value={stats?.total_executions} icon={statsIcons.total_executions} trend="-5% vs last week" color="indigo" />
                <StatCard title="Pass Rate" value={`${stats?.pass_rate}%`} icon={statsIcons.pass_rate} trend="+1.2% reliability" color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-[#121215] border-zinc-800/60 overflow-hidden shadow-2xl relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl pointer-events-none" />
                    <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between">
                        <h3 className="font-barlow text-sm font-bold tracking-widest uppercase text-zinc-400 flex items-center gap-2 italic">
                            <TrendingUp size={16} className="text-sky-500" /> Asset Distribution
                        </h3>
                        <Badge className="bg-zinc-900 text-zinc-500 text-[10px] font-mono border-zinc-800">实时数据</Badge>
                    </div>
                    <CardContent className="h-[340px] pt-8 px-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={assetData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-[#121212] border border-zinc-800 p-3 shadow-2xl rounded-sm">
                                                    <p className="text-[10px] font-bold text-zinc-500 uppercase font-barlow tracking-widest">{payload[0].payload.name}</p>
                                                    <p className="text-xl font-bold font-barlow text-white">{payload[0].value}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={50}>
                                    {assetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-[#121215] border-zinc-800/60 shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between">
                        <h3 className="font-barlow text-sm font-bold tracking-widest uppercase text-zinc-400 flex items-center gap-2 italic">
                            <History size={16} className="text-indigo-400" /> Recent Activity
                        </h3>
                        <PlayCircle size={14} className="text-zinc-700 hover:text-pink-500 cursor-pointer transition-colors" />
                    </div>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full max-h-[400px]">
                            <div className="p-4 space-y-4">
                                {stats?.recent_executions.length > 0 ? stats.recent_executions.map((ex, i) => (
                                    <div key={ex.id} className="flex gap-4 p-3 rounded-lg hover:bg-zinc-900/40 transition-all group border border-transparent hover:border-zinc-800/40">
                                        <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center
                      ${ex.status === 'passed' ? 'border-green-500/10 bg-green-500/5 text-green-500' : 'border-red-500/10 bg-red-500/5 text-red-500'}
                    `}>
                                            {ex.status === 'passed' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-barlow text-xs font-bold text-zinc-300 truncate tracking-wide group-hover:text-pink-400 transition-colors uppercase">{ex.test_case_name}</span>
                                                <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap">{new Date(ex.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Smartphone size={10} className="text-zinc-600" />
                                                <span className="text-[10px] text-zinc-500 tracking-tighter uppercase font-mono">{ex.device}</span>
                                                <span className="text-[9px] text-zinc-700 font-mono italic">• {Math.round(ex.duration)}s</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center py-12 text-zinc-700">
                                        <Zap size={32} className="opacity-20 mb-2" />
                                        <p className="text-[10px] uppercase font-barlow tracking-widest">No Activity Records</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <div className="p-3 border-t border-zinc-900/50 bg-[#0c0c0e] flex items-center justify-center">
                        <button className="text-[8px] font-barlow tracking-widest uppercase text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 group">
                            Audit Logs <Layers size={10} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, trend, color }) {
    const accentColor = {
        pink: 'text-pink-500 bg-pink-500/10 border-pink-500/20 shadow-pink-500/10',
        sky: 'text-sky-500 bg-sky-500/10 border-sky-500/20 shadow-sky-500/10',
        indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/10',
        green: 'text-green-500 bg-green-500/10 border-green-500/20 shadow-green-500/10',
    }[color];

    return (
        <Card className="bg-[#121215] border-zinc-800/60 overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-xl">
            <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl border ${accentColor}`}>
                        {icon}
                    </div>
                    <p className="text-[10px] font-mono text-zinc-600 font-bold uppercase py-1 border-b border-zinc-800 tracking-tighter">{trend}</p>
                </div>
                <div className="mt-6">
                    <p className="text-[10px] font-barlow font-bold tracking-[0.2em] uppercase text-zinc-500 mb-1">{title}</p>
                    <h2 className="text-3xl font-black font-barlow tracking-tighter text-white group-hover:text-pink-400 transition-colors">
                        {value}
                    </h2>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            </CardContent>
        </Card>
    );
}
