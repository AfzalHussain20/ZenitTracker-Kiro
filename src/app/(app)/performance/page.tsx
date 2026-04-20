"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Activity, Smartphone, Globe, Monitor, Cpu, Zap, TrendingUp, TrendingDown,
    Play, StopCircle, Download, Clock, MemoryStick, Wifi, Battery, Signal,
    AlertCircle, CheckCircle2, XCircle, Gauge, BarChart3, LineChart,
    Settings, Layers, Server, RefreshCw, Target, Sparkles, Usb, Network,
    Timer, ChevronRight, ArrowLeft, Info, AlertTriangle, ThumbsUp, ThumbsDown,
    FileText, Save, Database, Share2, Printer, History, RotateCcw, Box, Eye, Flame, Thermometer,
    Copy, Trash2, Clipboard, BatteryCharging
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar, ComposedChart, Line, Scatter, ScatterChart } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- TYPES & CONSTANTS ---
type Platform = 'web' | 'android';
type TestStatus = 'idle' | 'running' | 'completed';
type Scenario = 'general' | 'launch' | 'feed_scroll' | 'playback' | 'downloads';

interface Metric {
    timestamp: number;
    cpu: number;
    threads: number;
    memTotal: number;
    memJava: number;
    memNative: number;
    memGfx: number;
    netRx: number; // KB/s (Speed)
    netTx: number; // KB/s (Speed)
    fps: number;
    jank: number;
    battLevel: number;
    battVolt: number;
    battTemp: number;
    devTemp: number;
}

interface Report {
    id: string;
    date: string;
    scenario: Scenario;
    duration: number;
    metrics: Metric[];
    score: number;
    avgCpu: number;
    peakMem: number;
    totalNet: number;
    avgThreads: number;
    maxTemp: number;
    improvements: string[];
}

const SCENARIOS = [
    { id: 'general', label: 'Health Check', icon: Activity, desc: 'Baseline stability' },
    { id: 'launch', label: 'App Launch', icon: Zap, desc: 'Cold start time' },
    { id: 'feed_scroll', label: 'Feed Scroll', icon: Smartphone, desc: 'List smoothness' },
    { id: 'playback', label: 'Playback', icon: Play, desc: 'Video efficiency' },
    { id: 'downloads', label: 'Downloads', icon: Download, desc: 'Network stress' },
];

export default function PerformanceTestPage() {
    const { toast } = useToast();
    const [status, setStatus] = useState<TestStatus>('idle');
    const [mode, setMode] = useState<Platform>('android');
    const [scenario, setScenario] = useState<Scenario>('general');

    // Config
    const [autoStop, setAutoStop] = useState(true);
    const [duration, setDuration] = useState(30);
    const [elapsed, setElapsed] = useState(0);
    const [deviceId, setDeviceId] = useState('');
    const [pkg, setPkg] = useState('');
    const [devices, setDevices] = useState<{ id: string, name: string }[]>([]);
    const [pkgs, setPkgs] = useState<string[]>([]);

    // Data
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [curr, setCurr] = useState<Metric | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);

    // Refs
    const refInterval = useRef<NodeJS.Timeout | null>(null);
    const refRx = useRef(0);
    const refTx = useRef(0);
    const refInitialRx = useRef(0); // Baseline for Total Data
    const refInitialTx = useRef(0);
    const metricsRef = useRef<Metric[]>([]); // Fix stale closure bug
    const lastAlertRef = useRef(0); // Fix toast spam

    // --- INIT ---
    // Load Persisted Reports
    useEffect(() => {
        const saved = localStorage.getItem('zenit_perf_reports_v1');
        if (saved) {
            try { setReports(JSON.parse(saved)); } catch (e) { console.error("Failed to load reports", e); }
        }

        // Fetch Devices
        fetch('/api/devices').then(r => r.json()).then(d => {
            if (d.devices) setDevices(d.devices.map((x: any) => ({ id: x.id, name: x.model || 'Android Device' })));
            if (d.devices?.length) setDeviceId(d.devices[0].id);
        }).catch(() => { });

        // Cleanup interval on unmount
        return () => {
            if (refInterval.current) clearInterval(refInterval.current);
        };
    }, []);

    // Save Reports on Change
    useEffect(() => {
        if (reports.length > 0) {
            localStorage.setItem('zenit_perf_reports_v1', JSON.stringify(reports));
        }
    }, [reports]);

    useEffect(() => {
        if (mode === 'android' && deviceId) {
            fetch(`/api/adb?action=list-packages&deviceId=${deviceId}`)
                .then(r => r.json())
                .then(d => setPkgs(d.packages || []))
                .catch(() => { });
        }
    }, [mode, deviceId]);

    // --- LOGIC ---
    const fetchMetric = async () => {
        if (mode === 'android') {
            if (!pkg) return null;
            try {
                const res = await fetch(`/api/adb?action=monitor&deviceId=${deviceId}&packageId=${pkg}`);
                const d = await res.json();

                // Diff Calc (KB)
                const rx = d.network?.rx || 0;
                const tx = d.network?.tx || 0;

                // If refs are 0 (first run), set valid baseline
                if (refRx.current === 0) refRx.current = rx;
                if (refTx.current === 0) refTx.current = tx;

                const rxDiff = (rx - refRx.current) / 1024; // KB
                const txDiff = (tx - refTx.current) / 1024; // KB

                refRx.current = rx;
                refTx.current = tx;

                const toMB = (n: number) => n > 0 ? n / 1024 : 0;

                return {
                    cpu: d.cpu || 0,
                    threads: d.threads || 0,
                    memTotal: toMB(d.memory?.total || 0),
                    memJava: toMB(d.memory?.java || 0),
                    memNative: toMB(d.memory?.native || 0),
                    memGfx: toMB(d.memory?.graphics || 0),
                    netRx: Math.max(0, rxDiff),
                    netTx: Math.max(0, txDiff),
                    fps: 60, jank: d.jank || 0,
                    battLevel: d.battery?.level || 0,
                    battVolt: d.battery?.voltage || 0,
                    battTemp: (d.battery?.temp || 0),
                    devTemp: d.temperature || 0
                } as Metric;
            } catch { return null; }
        } else {
            return {
                timestamp: Date.now(), cpu: 10 + Math.random() * 20, threads: 4, memTotal: 100 + Math.random() * 20, memJava: 50, memNative: 20, memGfx: 30, netRx: Math.random() * 200, netTx: 10, fps: 60, jank: 0, battVolt: 4000, battLevel: 90, battTemp: 35, devTemp: 38
            } as Metric;
        }
    };

    const start = async () => {
        if (mode === 'android' && !pkg) { toast({ title: "Select App Package" }); return; }

        setStatus('running');
        setMetrics([]);
        setElapsed(0);

        // Reset Network Refs to force a baseline update on first tick
        refRx.current = 0;
        refTx.current = 0;

        // Prime the network baseline
        try {
            const res = await fetch(`/api/adb?action=monitor&deviceId=${deviceId}&packageId=${pkg}`);
            const d = await res.json();
            refRx.current = d.network?.rx || 0;
            refTx.current = d.network?.tx || 0;
        } catch { }

        if (mode === 'android' && scenario === 'launch') {
            await fetch(`/api/adb?action=launch&deviceId=${deviceId}&packageId=${pkg}`);
        }

        refInterval.current = setInterval(async () => {
            setElapsed(p => p + 1);
            const m = await fetchMetric();
            if (m) {
                const pt = { ...m, timestamp: Date.now() };
                const updatedMetrics = [...metricsRef.current, pt].slice(-300);
                setMetrics(updatedMetrics);
                metricsRef.current = updatedMetrics; // Keep ref in sync
                setCurr(pt);
                
                // --- CI/CD Automated Alerts Logic (with throttling) ---
                if (m.cpu > 70 && Date.now() - lastAlertRef.current > 10000) {
                    lastAlertRef.current = Date.now();
                    toast({ title: "⚠️ CRITICAL ALERT", description: `CPU usage exceeded threshold! Current: ${m.cpu.toFixed(1)}%`, variant: "destructive", duration: 2000 });
                }
                // ------------------------------------

                if (autoStop && (Date.now() - pt.timestamp) / 1000 > duration) stop();
            }
        }, 1000);
    };

    useEffect(() => { if (status === 'running' && autoStop && elapsed >= duration) stop(); }, [elapsed, autoStop, duration, status]);

    const stop = () => {
        if (refInterval.current) clearInterval(refInterval.current);
        setStatus('completed');
        const m = metricsRef.current; // Use ref to avoid stale closure
        if (m.length === 0) return;

        // Analysis Engine
        const avgCpu = m.reduce((a, b) => a + b.cpu, 0) / m.length;
        const peakMem = Math.max(...m.map(x => x.memTotal));
        const improvements = [];
        if (avgCpu > 50) improvements.push("CPU Load High: Check for Main Thread blocking operations.");
        if (peakMem > 512) improvements.push("Memory Warning: Peak usage > 512MB. Inspect bitmap allocations.");
        if (m.some(x => x.jank > 5)) improvements.push("Jank Detected: Frames dropped. Profile Looper messages.");
        
        // CI/CD Checks
        const hasViolations = avgCpu > 70 || peakMem > 800;
        if (hasViolations) {
            improvements.push("🔥 CI/CD PIPELINE VIOLATION: Metrics severely breached required thresholds. Test failed.");
        }

        if (improvements.length === 0) improvements.push("Performance Clean: metrics within optimal ranges.");

        const r: Report = {
            id: `RP-${Date.now().toString().slice(-4)}`, date: new Date().toLocaleTimeString(), scenario, duration: elapsed, metrics: [...m],
            score: Math.max(0, 100 - (avgCpu * 0.4) - (peakMem * 0.05)),
            avgCpu, peakMem,
            totalNet: m.reduce((a, b) => a + b.netRx + b.netTx, 0) / 1024, avgThreads: m.reduce((a, b) => a + b.threads, 0) / m.length,
            maxTemp: Math.max(...m.map(x => x.devTemp)),
            improvements
        };
        setReports(p => [r, ...p]);
        setSelectedReport(r);
    };

    const reset = () => {
        if (refInterval.current) clearInterval(refInterval.current);
        setStatus('idle'); setElapsed(0); setMetrics([]); metricsRef.current = []; setCurr(null);
    };

    const clearHistory = () => {
        setReports([]);
        localStorage.removeItem('zenit_perf_reports_v1');
        toast({ title: "History Cleared" });
    };

    const copyReportText = (r: Report) => {
        const text = `
ZENIT PERFORMANCE AUDIT REPORT (v3.1)
=====================================
ID: ${r.id} | Date: ${r.date} | Score: ${r.score.toFixed(0)}
Scenario: ${r.scenario.toUpperCase()} | Duration: ${r.duration}s
Pkg: ${pkg || 'Web'}

SUMMARY METRICS
---------------
- Avg CPU Load:    ${r.avgCpu.toFixed(1)}%
- Peak Memory:     ${r.peakMem.toFixed(0)} MB
- Avg Threads:     ${r.avgThreads.toFixed(0)}
- Data Transfer:   ${r.totalNet.toFixed(1)} MB
- Max Device Temp: ${r.maxTemp.toFixed(1)} °C

AREAS TO IMPROVE
----------------
${r.improvements.map(i => `[ ] ${i}`).join('\n')}

RAW DATA PEAKS
--------------
- Max CPU: ${Math.max(...r.metrics.map(x => x.cpu)).toFixed(1)}%
- Max Net: ${Math.max(...r.metrics.map(x => x.netRx + x.netTx)).toFixed(0)} KB/s
- MaxThreads: ${Math.max(...r.metrics.map(x => x.threads))}

Generated by Zenit Performance Suite
`.trim();
        navigator.clipboard.writeText(text);
        toast({ title: "Report Copied", description: "Audit data copied to clipboard" });
    };

    // --- UI COMPONENTS ---
    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-500">

            {/* TOP NAVBAR */}
            <header className="h-16 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 text-white animate-in zoom-in spin-in-3 duration-500">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold tracking-tight text-lg leading-none">Zenit<span className="text-indigo-600">Perf</span></h1>
                        <Badge variant="secondary" className="text-[9px] h-4 mt-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">PRO SUITE v3.1</Badge>
                    </div>
                </div>

                {/* CENTRAL CONTROL ISLAND */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2 px-4 border-r border-slate-300 dark:border-slate-600">
                        <span className="text-xs font-bold uppercase text-slate-400">Timer</span>
                        <Switch checked={autoStop} onCheckedChange={setAutoStop} className="scale-75 data-[state=checked]:bg-indigo-600" />
                    </div>
                    <div className="px-4 font-mono text-xl font-bold tabular-nums min-w-[100px] text-center text-slate-700 dark:text-slate-200">
                        {new Date(elapsed * 1000).toISOString().substr(14, 5)}
                        {autoStop && <span className="text-xs text-slate-400 ml-1">/ {new Date(duration * 1000).toISOString().substr(14, 5)}</span>}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="rounded-full h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all hover:rotate-180 duration-500" onClick={reset}>
                        <RotateCcw className="w-5 h-5" />
                    </Button>
                    <Button
                        className={`rounded-full h-10 px-6 font-bold shadow-lg transition-all duration-300 transform active:scale-95 ${status === 'running' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                        onClick={status === 'running' ? stop : start}
                    >
                        {status === 'running' ? <StopCircle className="w-5 h-5 mr-2 animate-pulse" /> : <Play className="w-5 h-5 mr-2" />}
                        {status === 'running' ? "STOP" : "START TEST"}
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* GLASS SIDEBAR */}
                <aside className="w-72 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-r flex flex-col p-6 gap-8 shrink-0 overflow-y-auto">

                    {/* DEVICE SELECTOR */}
                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Device Target</Label>
                        <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full">
                            <TabsList className="w-full grid grid-cols-2 bg-slate-200 dark:bg-slate-800"><TabsTrigger value="android">Android</TabsTrigger><TabsTrigger value="web">Web</TabsTrigger></TabsList>
                        </Tabs>
                        {mode === 'android' && (
                            <div className="relative">
                                <Monitor className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <Select value={pkg} onValueChange={setPkg}>
                                    <SelectTrigger className="pl-9 bg-white dark:bg-slate-950 text-xs h-9 overflow-hidden text-ellipsis whitespace-nowrap"><SelectValue placeholder="Select App..." /></SelectTrigger>
                                    <SelectContent>{pkgs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* DURATION SLIDER */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Duration Limit</Label>
                            <Badge variant="outline" className="font-mono">{duration}s</Badge>
                        </div>
                        <Slider value={[duration]} onValueChange={v => setDuration(v[0])} min={10} max={300} step={10} disabled={!autoStop} className="cursor-pointer" />
                    </div>

                    {/* SCENARIO GRID */}
                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Test Scenario</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {SCENARIOS.map(s => (
                                <button key={s.id} onClick={() => setScenario(s.id as any)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${scenario === s.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 ring-1 ring-indigo-600 translate-x-1' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'}`}
                                >
                                    <div className={`p-2 rounded-lg ${scenario === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                        <s.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold">{s.label}</div>
                                        <div className="text-[10px] text-slate-400">{s.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* REPORTS LIST (Persistence Enabled) */}
                    <div className="mt-auto space-y-4 pt-6 border-t flex flex-col">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Saved Reports</Label>
                            {reports.length > 0 && <Button variant="ghost" size="icon" className="h-4 w-4 text-slate-400 hover:text-red-500" onClick={clearHistory} title="Clear Database"><Trash2 className="w-3 h-3" /></Button>}
                        </div>
                        <ScrollArea className="h-32">
                            {reports.map((r, i) => (
                                <div key={i} onClick={() => setSelectedReport(r)} className="text-xs p-2 mb-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer flex justify-between items-center group transition-colors">
                                    <span className="font-mono text-slate-500 text-[10px]">{r.id}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold ${r.score > 80 ? 'text-green-500' : 'text-orange-500'}`}>{r.score.toFixed(0)}</span>
                                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                                    </div>
                                </div>
                            ))}
                            {reports.length === 0 && <div className="text-[10px] text-slate-400 italic">No saved reports.</div>}
                        </ScrollArea>
                    </div>
                </aside>

                {/* MAIN DASHBOARD */}
                <main className="flex-1 p-6 relative bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden flex flex-col gap-6">

                    {/* BENTO GRID ROW 1: KPI CARDS */}
                    <div className="grid grid-cols-4 gap-4 shrink-0">
                        <BentoCard title="Processor" icon={Cpu} val={curr?.cpu.toFixed(1) || '0'} unit="%" sub={`Threads: ${curr?.threads || 0}`}
                            chart={<TinyArea data={metrics} dKey="cpu" color="#3b82f6" />} />
                        <BentoCard title="Memory" icon={MemoryStick} val={curr?.memTotal.toFixed(0) || '0'} unit="MB" sub={`Peak: ${Math.max(...metrics.map(x => x.memTotal), 0).toFixed(0)}`}
                            chart={<TinyArea data={metrics} dKey="memTotal" color="#a855f7" />} />
                        <BentoCard title="Network" icon={Wifi} val={((curr?.netRx || 0) + (curr?.netTx || 0)).toFixed(0)} unit="KB/s" sub={`Total: ${(metrics.reduce((a, b) => a + b.netRx + b.netTx, 0) / 1024).toFixed(1)} MB`}
                            chart={<TinyArea data={metrics} dKey="netRx" color="#10b981" />} />
                        <BentoCard title="Thermals" icon={Thermometer} val={curr?.devTemp.toFixed(1) || '0'} unit="°C" sub={`Batt: ${curr?.battLevel || 0}%`}
                            chart={<TinyArea data={metrics} dKey="devTemp" color="#f59e0b" />} />
                    </div>

                    {/* BENTO GRID ROW 2: MAIN CHARTS */}
                    <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
                        {/* MAIN CHART */}
                        <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> System Resources</h3>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] font-mono"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1" />CPU</Badge>
                                    <Badge variant="outline" className="text-[10px] font-mono"><span className="w-2 h-2 rounded-full bg-purple-500 mr-1" />RAM</Badge>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={metrics}>
                                        <defs>
                                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                            <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.1} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="url(#colorCpu)" strokeWidth={2} isAnimationActive={true} />
                                        <Area type="monotone" dataKey="memTotal" stroke="#a855f7" fill="url(#colorMem)" strokeWidth={2} isAnimationActive={true} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* SECONDARY & TABLE */}
                        <div className="col-span-1 grid grid-rows-2 gap-6 min-h-0">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
                                <div className="p-4 border-b"><h3 className="font-bold text-sm">Heap Breakdown</h3></div>
                                <div className="flex-1 min-h-0 p-2">
                                    <ResponsiveContainer>
                                        <BarChart data={metrics.slice(-30)}>
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="memJava" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} isAnimationActive={true} />
                                            <Bar dataKey="memNative" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} isAnimationActive={true} />
                                            <Bar dataKey="memGfx" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={true} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
                                <div className="p-4 border-b"><h3 className="font-bold text-sm">Live Logs</h3></div>
                                <div className="flex-1 overflow-y-auto p-0">
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="text-xs text-slate-500 py-2">FPS</TableCell>
                                                <TableCell className="text-xs font-mono font-bold text-right py-2">{curr?.fps || 60}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="text-xs text-slate-500 py-2">Battery %</TableCell>
                                                <TableCell className="text-xs font-mono font-bold text-right py-2">{curr?.battLevel || 0}%</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="text-xs text-slate-500 py-2">Net Upload</TableCell>
                                                <TableCell className="text-xs font-mono font-bold text-right py-2">{curr?.netTx.toFixed(1)} KB/s</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* --- REPORT MODAL --- */}
            <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
                <DialogContent className="max-w-[90vw] h-[90vh] p-0 overflow-hidden flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 dark:border-slate-800 shadow-2xl rounded-xl">
                    {selectedReport && (
                        <>
                            {/* REPORT HEADER */}
                            <div className="h-20 border-b flex items-center justify-between px-8 bg-slate-50 dark:bg-slate-900 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">PERFORMANCE AUDIT</h2>
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
                                        <span>{selectedReport.id}</span>
                                        <span>•</span>
                                        <span className="text-indigo-500 font-bold">{selectedReport.scenario}</span>
                                        <span>•</span>
                                        <span>{selectedReport.duration}s</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button variant="outline" className="gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => copyReportText(selectedReport)}>
                                        <Clipboard className="w-4 h-4" /> Copy Text
                                    </Button>
                                    <Separator orientation="vertical" className="h-8" />
                                    <div className="text-right">
                                        <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{selectedReport.score.toFixed(0)}</div>
                                        <div className="text-[10px] font-bold uppercase text-slate-400">Zenit Index</div>
                                    </div>
                                    <Separator orientation="vertical" className="h-8" />
                                    <Button onClick={() => setSelectedReport(null)} className="rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold hover:scale-105 transition-transform">Close</Button>
                                </div>
                            </div>

                            {/* REPORT CONTENT */}
                            <div className="flex-1 overflow-y-auto bg-slate-100/50 dark:bg-slate-950/50 p-8">
                                <div className="grid grid-cols-3 gap-8 max-w-7xl mx-auto">
                                    {/* LEFT: SUMMARY */}
                                    <Card className="col-span-1 h-fit border-0 shadow-lg bg-white dark:bg-slate-900">
                                        <CardHeader><CardTitle>Session Summary</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <DetailRow label="Avg CPU Load" val={`${selectedReport.avgCpu.toFixed(1)}%`} />
                                            <DetailRow label="Avg Threads" val={selectedReport.avgThreads.toFixed(0)} />
                                            <DetailRow label="Peak Memory" val={`${selectedReport.peakMem.toFixed(0)} MB`} />
                                            <DetailRow label="Data Transferred" val={`${selectedReport.totalNet.toFixed(1)} MB`} />
                                            <DetailRow label="Max Temp" val={`${selectedReport.maxTemp.toFixed(1)}°C`} />
                                            <Separator />
                                            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                <strong>AI Analysis:</strong>
                                                <ul className="list-disc pl-4 mt-1 space-y-1">
                                                    {selectedReport.improvements.map((i, idx) => <li key={idx}>{i}</li>)}
                                                </ul>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* RIGHT: DETAILED CHARTS */}
                                    <div className="col-span-2 space-y-6">
                                        <Card className="border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
                                            <div className="p-4 border-b font-bold text-sm">Timeline Analysis</div>
                                            <div className="h-80 p-4">
                                                <ResponsiveContainer>
                                                    <AreaChart data={selectedReport.metrics}>
                                                        <defs>
                                                            <linearGradient id="rptCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                        <XAxis dataKey="timestamp" hide />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="url(#rptCpu)" strokeWidth={2} name="CPU %" />
                                                        <Area type="monotone" dataKey="memTotal" stroke="#a855f7" fillOpacity={0} strokeWidth={2} name="Memory MB" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- SUB COMPONENTS ---
const BentoCard = ({ title, val, unit, icon: Icon, sub, chart }: any) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                <Icon className="w-5 h-5" />
            </div>
            {chart && <div className="h-10 w-24 opacity-50 group-hover:opacity-100 transition-opacity">{chart}</div>}
        </div>
        <div>
            <div className="flex items-baseline gap-1">
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{val}</div>
                <div className="text-xs font-bold text-slate-400">{unit}</div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{title}</div>
            <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
        </div>
    </div>
);

const TinyArea = ({ data, dKey, color }: any) => (
    <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.slice(-20)}>
            <Area type="monotone" dataKey={dKey} stroke={color} strokeWidth={2} fill="none" isAnimationActive={false} />
        </AreaChart>
    </ResponsiveContainer>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl text-xs">
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-slate-500 capitalize">{p.name}:</span>
                        <span className="font-mono font-bold">{Number(p.value).toFixed(1)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const DetailRow = ({ label, val }: any) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{val}</span>
    </div>
);
