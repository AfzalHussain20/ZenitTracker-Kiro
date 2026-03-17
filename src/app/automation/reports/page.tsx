'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '@/components/apps/AppShell';
import {
    Activity, Clock, CheckCircle2, XCircle,
    ChevronDown, ChevronUp, Download, Eye,
    Trash2, Search, Filter, Calendar, BarChart3,
    ArrowUpRight, AlertTriangle, Hash, Shield,
    FileText, User, Globe, Layers, Zap, ExternalLink, RefreshCw, Copy, GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunSession } from '@/lib/automation-sessions';

const ACCENT = '#7C3AED';

const NAV_ITEMS = [
    { label: 'Automation Hub', href: '/automation', icon: <Layers className="w-4 h-4" /> },
    { label: 'Reports', href: '/automation/reports', icon: <Activity className="w-4 h-4" /> },
    { label: 'Zenit Academy', href: '/nexus', icon: <GraduationCap className="w-4 h-4" /> },
];

export default function ReportsPage() {
    const [sessions, setSessions] = useState<RunSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/automation/run?action=list_reports');
            const data = await res.json();
            setSessions(data.reports || []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteSession = async (id: string) => {
        if (!confirm('Permanently delete this session record?')) return;
        try {
            await fetch(`/api/automation/sessions?id=${id}`, { method: 'DELETE' });
            fetchSessions();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const stats = {
        total: sessions.length,
        passed: sessions.filter(s => s.status === 'PASSED').length,
        failed: sessions.filter(s => s.status === 'FAILED').length,
        accounts: sessions.reduce((acc, s) => acc + (s.accountsCreated || 0), 0)
    };

    const filteredSessions = sessions.filter(s =>
        s.testCase.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.plan.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppShell
            appName="Automation Hub"
            appIcon={<Activity className="w-4 h-4" style={{ color: ACCENT }} />}
            accentColor={ACCENT}
            navItems={NAV_ITEMS}
            subtitle="Analytics & Logs"
        >
            <div className="space-y-10">

                {/* ─── KPI Dashboard ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Cycles', value: stats.total, icon: <Layers className="w-5 h-5 text-indigo-600" />, trend: 'System Cumulative', bg: 'bg-indigo-50 border-indigo-100' },
                        { label: 'Success Ops', value: stats.passed, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, trend: 'Execution Verified', bg: 'bg-emerald-50 border-emerald-100' },
                        { label: 'Anomalies', value: stats.failed, icon: <XCircle className="w-5 h-5 text-rose-600" />, trend: 'Manual Review Req', bg: 'bg-rose-50 border-rose-100' },
                        { label: 'Provisioned', value: stats.accounts, icon: <User className="w-5 h-5 text-amber-600" />, trend: 'Cloud Accounts', bg: 'bg-amber-50 border-amber-100' },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn("p-6 rounded-[2rem] border shadow-sm", stat.bg)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-2xl bg-white shadow-sm border border-black/5">{stat.icon}</div>
                                <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.2em]">{stat.trend}</span>
                            </div>
                            <h3 className="text-3xl font-black text-slate-950 tracking-tighter">{stat.value}</h3>
                            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ─── Control Bar ─────────────────────────────────────────── */}
                <div className="bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter session logs..."
                            className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchSessions} className="p-3 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900 transition-all border border-slate-100">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-all">
                            <Download className="w-4 h-4" /> Export DB
                        </button>
                    </div>
                </div>

                {/* ─── Sessions List ────────────────────────────────────────── */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Accessing Logs...</p>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-100">
                            <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400">No execution cycles found.</p>
                        </div>
                    ) : (
                        filteredSessions.map((session, i) => (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                            >
                                <div className="p-6 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-6 min-w-0 flex-1">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center border",
                                            session.status === 'PASSED' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                                        )}>
                                            {session.status === 'PASSED' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="text-sm font-black text-slate-950 tracking-tight truncate">{session.testCase}</h4>
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                    session.status === 'PASSED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
                                                )}>
                                                    {session.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(session.timestamp).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1.5"><Hash className="w-3 h-3" /> {session.plan}</span>
                                                <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {session.region}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="hidden xl:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <Shield className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{session.headless ? 'Headless' : 'Windowed'}</span>
                                        </div>
                                        <button
                                            onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                                            className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all border border-slate-100"
                                        >
                                            {expandedId === session.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => deleteSession(session.id)} className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all border border-slate-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expandedId === session.id && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden border-t border-slate-50"
                                        >
                                            <div className="p-8 bg-[#FAFAFA]">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Full Execution Traces</h5>
                                                    <div className="flex gap-3">
                                                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50">
                                                            <Copy className="w-3 h-3" /> Copy Logs
                                                        </button>
                                                        <a
                                                            href={`/reports/${session.id}.html`}
                                                            target="_blank"
                                                            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-all"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> HTML Report
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-[1.5rem] border border-slate-200 p-6 font-mono text-[11px] leading-relaxed shadow-inner max-h-[400px] overflow-y-auto custom-scroll">
                                                    {session.logs.map((log, li) => (
                                                        <div key={li} className={cn(
                                                            "py-1 border-b border-slate-50 last:border-0",
                                                            log.includes('[PASSED]') ? "text-emerald-600 font-bold" :
                                                                log.includes('[FAILED]') ? "text-rose-600 font-bold" : "text-slate-500"
                                                        )}>
                                                            <span className="text-slate-200 mr-4 select-none">{li + 1}</span>
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </AppShell>
    );
}
