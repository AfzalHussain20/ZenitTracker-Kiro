"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Terminal, Activity, Users, Globe, Lock, Unlock, Sliders, Layers,
    Wifi, Server, ArrowRight, StopCircle, CheckCircle2, AlertCircle, Monitor,
    Copy, LogIn, UserPlus, Zap, FlaskConical, Clock, TrendingUp, Settings,
    Search, ChevronRight, Camera, Crown, ShieldCheck, Rocket, Eye, Smartphone,
    BarChart3, FolderOpen, FileText, Target, History, Code2, BookOpen, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { trackerApi } from '@/lib/tracker-api';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { ParticleBackground } from '@/components/three/ParticleBackground';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════
const MODES = [
    { id: 'login_only', label: 'Login Integration', icon: <LogIn className="w-4 h-4" />, desc: 'Validate core auth flows', gradient: 'from-blue-500 to-cyan-600' },
    { id: 'signup_only', label: 'Bulk Registration', icon: <UserPlus className="w-4 h-4" />, desc: 'Generate test accounts', gradient: 'from-emerald-500 to-green-600' },
    { id: 'subscribe', label: 'Single Subscription', icon: <Crown className="w-4 h-4" />, desc: 'Checkout existing / new', gradient: 'from-amber-500 to-orange-600' },
    { id: 'combine', label: 'Combinations', icon: <Zap className="w-4 h-4" />, desc: 'Upgrade & Upcoming flows', gradient: 'from-purple-500 to-violet-600' },
];

const PLANS = [
    { id: '1', label: 'Premium', icon: <Crown className="w-4 h-4" />, gradient: 'from-amber-500 to-orange-600' },
    { id: '2', label: 'Saver', icon: <ShieldCheck className="w-4 h-4" />, gradient: 'from-blue-500 to-cyan-600' },
    { id: '3', label: 'Lite', icon: <Zap className="w-4 h-4" />, gradient: 'from-emerald-500 to-green-600' },
];

const ACTIONS = [
    { id: 'upgrade', label: 'Upgrade Plan', icon: <Rocket className="w-3.5 h-3.5" /> },
    { id: 'upcoming', label: 'Upcoming Plan', icon: <Clock className="w-3.5 h-3.5" /> }
];

const TABS = [
    { v: 'execute', l: 'Execute', ic: <Play className="w-4 h-4" /> },
    { v: 'tracker', l: 'Tracker', ic: <FolderOpen className="w-4 h-4" /> },
    { v: 'vision', l: 'Vision Studio', ic: <Smartphone className="w-4 h-4" /> },
];

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function AutomationPage() {
    const { toast } = useToast();
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Execution state
    const [mode, setMode] = useState('signup_only');
    const [accountCount, setAccountCount] = useState(1);
    const [accountCountInput, setAccountCountInput] = useState('1');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('A1234567');
    const [primaryPlan, setPrimaryPlan] = useState('2');
    const [secondaryPlan, setSecondaryPlan] = useState('1');
    const [combineAction, setCombineAction] = useState('upgrade');
    const [headless, setHeadless] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

    // Dashboard state
    const [activeTab, setActiveTab] = useState('execute');

    // Tracker state
    const [suites, setSuites] = useState<any[]>([]);
    const [cases, setCases] = useState<any[]>([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState('');
    const [selectedCase, setSelectedCase] = useState<any>(null);
    const [view, setView] = useState<'suites' | 'cases' | 'details'>('suites');
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    useEffect(() => {
        trackerApi.getStats().then(r => setStats(r.data)).catch(() => { });
        trackerApi.getSuites().then(r => setSuites(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (selectedSuiteId) trackerApi.getCases(selectedSuiteId).then(r => setCases(r.data)).catch(() => { });
    }, [selectedSuiteId]);

    // ─── EXECUTE ───
    const handleStart = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setStatus('running');
        setLogs([`> INITIALIZING ZENIT ENGINE`, `> TARGET MODE: ${mode.toUpperCase()}`]);

        let pPlan = primaryPlan;
        let sPlan = '0';
        let execMode = mode;
        if (mode === 'combine') {
            pPlan = primaryPlan;
            sPlan = combineAction === 'upcoming' ? primaryPlan : secondaryPlan;
            execMode = combineAction;
            setLogs(prev => [...prev, `> COMBINATION: ${combineAction.toUpperCase()}`]);
        } else if (mode === 'subscribe') {
            setLogs(prev => [...prev, `> PLAN: ${PLANS.find(p => p.id === primaryPlan)?.label}`]);
        }

        const params = new URLSearchParams({
            mode: execMode, count: accountCount.toString(),
            primaryPlan: pPlan, secondaryPlan: sPlan,
            headless: headless.toString(), loginEmail, loginPass
        });

        const eventSource = new EventSource(`/api/automation/run?${params.toString()}`);
        eventSource.onmessage = (event) => setLogs(prev => [...prev, event.data]);
        eventSource.onerror = () => {
            setLogs(prev => [...prev, `> END OF EXECUTION.`]);
            setStatus('completed');
            setIsRunning(false);
            eventSource.close();
        };
    };

    const totalEvents = logs.filter(l => l.includes('SUCCESS')).length;

    return (
        <>
            <div className="space-y-6 animate-fade-in relative max-w-7xl mx-auto">

                {/* ── Header ── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-purple-500/10 border border-blue-500/20 p-8">
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium mb-3">
                                <Cpu className="w-3 h-3" /> Execution Platform
                            </div>
                            <h1 className="text-4xl font-bold tracking-tight"><span className="text-gradient">Automation Hub</span></h1>
                            <p className="text-muted-foreground text-lg mt-1">Configure · Execute · Analyze test pipelines</p>
                        </div>
                        {/* Tab switcher */}
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
                            {TABS.map(t => (
                                <button key={t.v}
                                    onClick={() => t.v === 'vision' ? router.push('/dashboard/vision') : setActiveTab(t.v)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.v ? 'bg-blue-500 text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {t.ic}{t.l}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ADB Active
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
                </div>

                {/* ── Stats Row ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Test Suites', value: suites.length, gradient: 'from-blue-500 to-cyan-600', icon: FolderOpen },
                        { label: 'Status', value: status.toUpperCase(), gradient: 'from-purple-500 to-violet-600', icon: Activity },
                        { label: 'Log Lines', value: logs.length, gradient: 'from-amber-500 to-orange-600', icon: Terminal },
                        { label: 'Successes', value: totalEvents, gradient: 'from-emerald-500 to-green-600', icon: CheckCircle2 },
                    ].map((s, i) => (
                        <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                <CardContent className="p-5 flex items-center gap-3">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${s.gradient}`}>
                                        <s.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold">{s.value}</div>
                                        <div className="text-xs text-muted-foreground">{s.label}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <AnimatePresence mode="wait">

                {/* ════════ EXECUTE TAB ════════ */}
                {activeTab === 'execute' && (
                    <motion.div key="execute" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <div className="grid lg:grid-cols-5 gap-6">
                            {/* Left: Controls */}
                            <Card className="lg:col-span-2">
                                <CardContent className="p-6 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                                            <Sliders className="w-5 h-5 text-white" />
                                        </div>
                                        <h2 className="font-bold text-lg">Pipeline Config</h2>
                                    </div>

                                    {/* Mode Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Target Pipeline</Label>
                                        <div className="space-y-2">
                                            {MODES.map(m => (
                                                <button key={m.id} onClick={() => setMode(m.id)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${mode === m.id ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-blue-500/40'}`}
                                                >
                                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${m.gradient}`}>{m.icon}</div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold">{m.label}</p>
                                                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                                                    </div>
                                                    {mode === m.id && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Test Variables */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Test Variables</Label>

                                        {(mode === 'signup_only' || mode === 'subscribe' || mode === 'combine') && (
                                            <div>
                                                <Label className="text-xs font-semibold mb-1 block">Number of Accounts</Label>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Input type="text" inputMode="numeric" value={accountCountInput}
                                                        onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setAccountCountInput(raw); const v = parseInt(raw); if (!isNaN(v) && v >= 0) setAccountCount(v); }}
                                                        onBlur={() => { if (!accountCountInput || parseInt(accountCountInput) < 1) { setAccountCount(1); setAccountCountInput('1'); } }}
                                                        className="h-9 w-20 text-center font-bold" placeholder="Qty"
                                                    />
                                                    <div className="flex gap-1">
                                                        {[1, 5, 10, 25].map(n => (
                                                            <button key={n} onClick={() => { setAccountCount(n); setAccountCountInput(String(n)); }}
                                                                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${accountCount === n ? 'bg-blue-500 text-white border-blue-500' : 'border-border hover:border-blue-500/50'}`}>{n}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {mode === 'login_only' && (
                                            <div className="space-y-2">
                                                <div><Label className="text-xs font-semibold mb-1 block">Email</Label>
                                                    <Input type="email" placeholder="user@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="h-9" /></div>
                                                <div><Label className="text-xs font-semibold mb-1 block">Password</Label>
                                                    <Input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="h-9" /></div>
                                            </div>
                                        )}

                                        {(mode === 'subscribe' || mode === 'combine') && (
                                            <div>
                                                <Label className="text-xs font-semibold mb-2 block">{mode === 'combine' ? 'Base Plan' : 'Target Plan'}</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {PLANS.map(p => (
                                                        <button key={`p1-${p.id}`} onClick={() => setPrimaryPlan(p.id)}
                                                            className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${primaryPlan === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-blue-500/40'}`}>
                                                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${p.gradient} mb-1`}>{p.icon}</div>
                                                            <span className="text-xs font-bold">{p.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {mode === 'combine' && (
                                            <div className="space-y-2 pt-2 border-t border-border">
                                                <Label className="text-xs font-semibold">Action</Label>
                                                <div className="flex gap-2">
                                                    {ACTIONS.map(a => (
                                                        <button key={a.id} onClick={() => setCombineAction(a.id)}
                                                            className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 text-xs font-bold transition-all ${combineAction === a.id ? 'bg-purple-500 text-white border-purple-500' : 'border-border hover:border-purple-500/40'}`}>
                                                            {a.icon}{a.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <Label className="text-xs font-semibold block mt-2">Secondary Plan</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {PLANS.map(p => {
                                                        const isUpcoming = combineAction === 'upcoming';
                                                        const isSel = isUpcoming ? primaryPlan === p.id : secondaryPlan === p.id;
                                                        return (
                                                            <button key={`p2-${p.id}`} disabled={isUpcoming} onClick={() => setSecondaryPlan(p.id)}
                                                                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${isSel ? 'border-purple-500 bg-purple-500/10' : 'border-border'} ${isUpcoming ? 'opacity-40 cursor-not-allowed' : 'hover:border-purple-500/40'}`}>
                                                                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${p.gradient} mb-1`}>{p.icon}</div>
                                                                <span className="text-xs font-bold">{p.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Background mode toggle */}
                                    <label className="flex items-center justify-between p-3 rounded-xl border border-border cursor-pointer hover:border-blue-500/40 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-muted"><Monitor className="w-4 h-4 text-muted-foreground" /></div>
                                            <div>
                                                <p className="text-sm font-bold">Background Mode</p>
                                                <p className="text-xs text-muted-foreground">Run browser headless</p>
                                            </div>
                                        </div>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={headless} onChange={e => setHeadless(e.target.checked)} />
                                            <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 after:shadow-sm" />
                                        </div>
                                    </label>

                                    <Button onClick={handleStart} disabled={isRunning} className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold text-sm">
                                        {isRunning ? (
                                            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />Executing...</>
                                        ) : (
                                            <><Play className="w-4 h-4 mr-2" fill="white" />Launch Pipeline</>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Right: Terminal */}
                            <Card className="lg:col-span-3 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-b border-[#3c3c3c]">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-[#999]" />
                                        <span className="text-sm font-semibold text-[#ccc]">Output Terminal</span>
                                        {isRunning && <Badge className="bg-red-500 text-white border-none text-xs animate-pulse">RUNNING</Badge>}
                                        {status === 'completed' && <Badge className="bg-emerald-500 text-white border-none text-xs">COMPLETED</Badge>}
                                    </div>
                                    <button onClick={() => setLogs([])} className="text-[#999] hover:text-white text-xs font-semibold">Clear</button>
                                </div>
                                <div ref={scrollRef} className="h-[520px] p-4 overflow-auto font-mono text-xs leading-relaxed bg-[#1e1e1e]">
                                    {logs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full opacity-20">
                                            <Server className="w-10 h-10 text-white mb-3" />
                                            <p className="text-sm text-white font-semibold">Ready. Configure and launch the pipeline.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            {logs.map((log, i) => (
                                                <p key={i} className={`${log.includes('[ERROR]') || log.includes('FAILED') ? 'text-[#f48771]' : log.includes('SUCCESS') ? 'text-[#89d185]' : log.includes('WARN') ? 'text-[#cca700]' : log.includes('>') ? 'text-[#569cd6]' : 'text-[#d4d4d4]'}`}>
                                                    <span className="text-[#555] mr-2">{String(i + 1).padStart(3, ' ')}</span>{log}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {/* ════════ TRACKER TAB ════════ */}
                {activeTab === 'tracker' && (
                    <motion.div key="tracker" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Suite/Case List */}
                            <Card className="lg:col-span-1">
                                <CardContent className="p-0">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                        <div className="flex items-center gap-2">
                                            {view !== 'suites' && (
                                                <button onClick={() => { setView(view === 'details' ? 'cases' : 'suites'); setSelectedCase(null); }} className="p-1 hover:bg-muted rounded-lg">
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
                                                </button>
                                            )}
                                            <span className="text-sm font-bold">{view === 'suites' ? 'Test Suites' : view === 'cases' ? 'Test Cases' : 'Case Details'}</span>
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[500px]">
                                        {view === 'suites' && suites.map(s => (
                                            <button key={s.id} onClick={() => { setSelectedSuiteId(s.id); setView('cases'); }}
                                                className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-xl bg-blue-500/10"><FolderOpen className="w-4 h-4 text-blue-500" /></div>
                                                    <div>
                                                        <p className="text-sm font-bold">{s.name}</p>
                                                        <p className="text-xs text-muted-foreground">{s.test_count || 0} cases</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        ))}
                                        {view === 'cases' && cases.map(c => (
                                            <button key={c.id} onClick={() => { setSelectedCase(c); setView('details'); }}
                                                className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${c.status === 'passed' ? 'bg-emerald-500/10' : c.status === 'failed' ? 'bg-red-500/10' : 'bg-muted'}`}>
                                                        {c.status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : c.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{c.name}</p>
                                                        <p className="text-xs text-muted-foreground">{c.steps?.length || 0} steps · {c.priority || 'medium'}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        ))}
                                        {view === 'details' && selectedCase && (
                                            <div className="p-4 space-y-4">
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Test Case</p>
                                                    <p className="text-base font-bold">{selectedCase.name}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="p-3 rounded-xl bg-muted/50">
                                                        <p className="text-xs text-muted-foreground uppercase font-bold">Priority</p>
                                                        <p className="text-sm font-bold">{selectedCase.priority || 'Medium'}</p>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-muted/50">
                                                        <p className="text-xs text-muted-foreground uppercase font-bold">Status</p>
                                                        <p className="text-sm font-bold">{selectedCase.status || 'Pending'}</p>
                                                    </div>
                                                </div>
                                                <Separator />
                                                <p className="text-xs text-muted-foreground font-bold uppercase">Steps ({selectedCase.steps?.length || 0})</p>
                                                {selectedCase.steps?.map((step: any, i: number) => (
                                                    <div key={step.id || i} className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-xl">
                                                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                                                        <div>
                                                            <Badge variant="outline" className="text-xs mb-1">{step.action}</Badge>
                                                            <p className="text-xs text-muted-foreground">{step.expected_result || step.target_value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                <Button size="sm" className="w-full bg-gradient-to-r from-violet-500 to-purple-600" onClick={() => router.push('/dashboard/vision')}>
                                                    <Smartphone className="w-3 h-3 mr-1.5" />Open in Vision Studio
                                                </Button>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            {/* Dashboard Stats */}
                            <div className="lg:col-span-2 space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold mb-1">Tracker Dashboard</h2>
                                    <p className="text-sm text-muted-foreground">Test suite management and execution overview</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Test Suites', value: stats?.total_suites || suites.length, gradient: 'from-blue-500 to-cyan-600', icon: FolderOpen },
                                        { label: 'Test Cases', value: stats?.total_cases || 0, gradient: 'from-purple-500 to-violet-600', icon: FileText },
                                        { label: 'Locators', value: stats?.total_locators || 0, gradient: 'from-emerald-500 to-green-600', icon: Target },
                                        { label: 'Executions', value: stats?.total_executions || 0, gradient: 'from-amber-500 to-orange-600', icon: Activity },
                                    ].map((s, i) => (
                                        <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                                            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                                <CardContent className="p-5 flex items-center gap-3">
                                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${s.gradient}`}><s.icon className="w-5 h-5 text-white" /></div>
                                                    <div>
                                                        <div className="text-2xl font-bold">{s.value}</div>
                                                        <div className="text-xs text-muted-foreground">{s.label}</div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                                <Card>
                                    <CardContent className="p-5">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Recent Suites</h3>
                                        <div className="space-y-1">
                                            {suites.slice(0, 5).map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-xl transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <FolderOpen className="w-4 h-4 text-blue-500" />
                                                        <span className="text-sm font-semibold">{s.name}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs">{s.test_count || 0} cases</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                )}

                </AnimatePresence>
            </div>
            <Toaster />
        </>
    );
}
