import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
    Play,
    Terminal,
    Smartphone,
    CheckCircle2,
    XCircle,
    Info,
    Zap,
    Clock,
    Activity,
    Box,
    Cpu,
    History,
    Maximize2,
    ChevronRight,
    Search,
    Trash2,
    FileText
} from 'lucide-react';

export default function TestRunner() {
    const [cases, setCases] = useState([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [executions, setExecutions] = useState([]);
    const [activeExec, setActiveExec] = useState(null);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [cr, er] = await Promise.all([api.getTestCases(), api.getExecutions()]);
            setCases(cr.data);
            setExecutions(er.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeExec?.logs]);

    const handleRun = async () => {
        if (!selectedCaseId) { toast.error('Select a test case to execute'); return; }
        setRunning(true);
        setProgress(10);
        setActiveExec({ logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'Initializing automation engine...' }] });

        try {
            const r = await api.runExecution({ test_case_id: selectedCaseId, device: 'Samsung Galaxy S24', platform: 'android' });
            setProgress(100);
            setActiveExec(r.data);
            loadData();
            toast.success(`Execution completed: ${r.data.status.toUpperCase()}`);
        } catch {
            toast.error('Execution failed to start');
        }
        setRunning(false);
    };

    const getLogIcon = (level) => {
        if (level === 'success') return <CheckCircle2 size={12} className="text-green-500" />;
        if (level === 'error') return <XCircle size={12} className="text-red-500" />;
        return <Info size={12} className="text-zinc-600" />;
    };

    if (loading) return <div className="p-8 text-zinc-500 font-barlow tracking-widest uppercase italic font-black">Connecting Runner Bus...</div>;

    return (
        <div className="p-6 md:p-8 animate-fade-in h-full flex flex-col" data-testid="test-runner-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Infrastructure <span className="text-sky-500">Runner</span>
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">Real-time Automation Orchestration Unit</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="font-barlow border-zinc-700 text-zinc-300 uppercase italic h-12 px-6">
                        <History size={16} className="mr-2" /> View History
                    </Button>
                    <Button
                        data-testid="run-test-btn"
                        onClick={handleRun}
                        disabled={running}
                        className="bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_25px_rgba(14,165,233,0.3)] font-barlow tracking-widest uppercase italic h-12 px-8 flex items-center gap-2"
                    >
                        {running ? 'Executing...' : <><Play size={18} /> Run Module</>}
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
                {/* Run Controls */}
                <div className="lg:col-span-4 flex flex-col gap-6 min-h-0 min-w-0 font-barlow">
                    <Card className="bg-[#121215] border-zinc-800 p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-3xl pointer-events-none" />
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 mb-6 flex items-center gap-2 italic px-1">
                            <Cpu size={14} className="text-sky-500" /> Module Configuration
                        </h3>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <p className="text-[9px] font-mono text-zinc-600 uppercase border-l border-zinc-800 pl-2 ml-1">Target Module</p>
                                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                                    <SelectTrigger data-testid="runner-case-select" className="bg-zinc-950 border-zinc-800 h-12 uppercase italic tracking-widest font-bold">
                                        <SelectValue placeholder="Select test node..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        {cases.map(tc => <SelectItem key={tc.id} value={tc.id} className="text-[11px] uppercase">{tc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[9px] font-mono text-zinc-600 uppercase border-l border-zinc-800 pl-2 ml-1">Hardware Interface</p>
                                <Select defaultValue="s24">
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 h-12 uppercase italic tracking-widest font-bold opacity-60">
                                        <SelectValue placeholder="Target Device..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        <SelectItem value="s24" className="text-[11px] uppercase">SAMSUNG S24 ULTRA (LOCAL)</SelectItem>
                                        <SelectItem value="p8" className="text-[11px] uppercase">PIXEL 8 PRO (REMOTE)</SelectItem>
                                        <SelectItem value="i15" className="text-[11px] uppercase">IPHONE 15 PRO (CLOUD)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg border border-zinc-900 bg-black/40">
                                    <p className="text-[8px] text-zinc-700 tracking-tighter uppercase mb-1">Estimated Load</p>
                                    <p className="text-xs font-black text-zinc-500 italic">LOW_IMPACT</p>
                                </div>
                                <div className="p-3 rounded-lg border border-zinc-900 bg-black/40">
                                    <p className="text-[8px] text-zinc-700 tracking-tighter uppercase mb-1">Engine Vers</p>
                                    <p className="text-xs font-black text-sky-500 italic uppercase">Appium-2.11</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="flex-1 bg-[#121215] border-zinc-800 p-6 shadow-xl flex flex-col overflow-hidden group">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 mb-6 flex items-center justify-between italic px-1">
                            <span className="flex items-center gap-2"><History size={14} className="text-zinc-600" /> Audit Registry</span>
                            <Search size={12} className="text-zinc-800 group-hover:text-zinc-500 transition-colors" />
                        </h3>

                        <ScrollArea className="flex-1">
                            <div className="space-y-3 pb-4 pr-3">
                                {executions.map(ex => (
                                    <div key={ex.id} className="p-3 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900/60 transition-all cursor-pointer border-transparent hover:border-zinc-800/40 group/item">
                                        <div className="flex items-start justify-between">
                                            <p className="text-[10px] font-bold text-zinc-400 group-hover/item:text-sky-500 transition-colors uppercase leading-tight line-clamp-1">{ex.test_case_name}</p>
                                            <span className={`text-[8px] font-mono px-1 rounded uppercase flex items-center gap-1 ${ex.status === 'passed' ? 'text-green-500' : 'text-red-500'}`}>
                                                {ex.status === 'passed' ? <CheckCircle2 size={8} /> : <XCircle size={8} />} {ex.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[9px] font-mono text-zinc-700 uppercase">{ex.device.split(' ')[0]} {ex.device.split(' ')[1]}</span>
                                            <span className="text-[9px] font-mono text-zinc-800">{new Date(ex.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Real-time Console Output */}
                <Card className="lg:col-span-8 bg-[#09090b] border-zinc-800/80 shadow-2xl flex flex-col min-h-0 overflow-hidden relative font-mono group">
                    {/* Scanline Effect */}
                    <div className="absolute inset-x-0 h-[1px] bg-sky-500/10 -top-full animate-scanline pointer-events-none z-10" />

                    <div className="p-4 border-b border-zinc-900 bg-zinc-950/80 flex items-center justify-between backdrop-blur-3xl z-20">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <Terminal size={14} className="text-sky-500" />
                                <h3 className="text-[11px] font-bold tracking-widest uppercase text-zinc-400">Terminal Output Buffer</h3>
                            </div>
                            <div className="h-4 w-[1px] bg-zinc-900" />
                            <div className="flex gap-4">
                                <p className="text-[9px] text-zinc-700 tracking-tighter uppercase italic">State: <span className={running ? 'text-pink-500 animate-pulse font-bold' : 'text-green-500 font-bold'}>{running ? 'STREAMING' : 'IDLE'}</span></p>
                                <p className="text-[9px] text-zinc-700 tracking-tighter uppercase italic">Buffer: <span className="text-zinc-500">{(activeExec?.logs?.length || 0) * 128} bytes</span></p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-center">
                            <Maximize2 size={12} className="text-zinc-800 hover:text-zinc-500 cursor-pointer transition-colors" />
                            <Trash2 size={12} className="text-zinc-800 hover:text-red-500 cursor-pointer transition-colors" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col p-4 relative">
                        {running && (
                            <div className="absolute top-0 inset-x-0 px-4 pt-2 z-10 group-hover:opacity-10 transition-opacity">
                                <Progress value={progress} className="h-[2px] bg-zinc-900" />
                            </div>
                        )}

                        <ScrollArea ref={scrollRef} className="flex-1 pr-4">
                            <div className="space-y-1.5 pb-20">
                                {activeExec ? activeExec.logs.map((log, i) => (
                                    <div key={i} className="flex gap-4 group/log animate-fade-in hover:bg-zinc-900/40 p-1 rounded-sm transition-colors border-l border-transparent hover:border-zinc-800/40">
                                        <span className="w-16 flex-shrink-0 text-[10px] text-zinc-800 select-none group-hover/log:text-zinc-700 transition-colors uppercase italic font-black">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <div className="mt-1 flex-shrink-0">{getLogIcon(log.level)}</div>
                                        <p className={`text-[11px] leading-relaxed break-words tracking-tight 
                            ${log.level === 'error' ? 'text-red-400/90' : log.level === 'success' ? 'text-green-400/90' : 'text-zinc-400'}
                         `}>
                                            {log.message}
                                        </p>
                                    </div>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center p-20 grayscale opacity-10">
                                        <Box size={80} className="mb-6 animate-pulse" />
                                        <p className="text-[10px] uppercase font-black tracking-[0.5em]">Awaiting Output Feed</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="absolute bottom-6 right-6">
                            {activeExec && (
                                <div className="bg-[#121215]/80 backdrop-blur-xl border border-zinc-800 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-8 animate-slide-in">
                                    <div className="text-center">
                                        <p className="text-[8px] font-mono text-zinc-600 uppercase mb-1">Pass Ratio</p>
                                        <p className="text-xl font-black font-barlow italic text-zinc-100 uppercase tracking-tighter">{activeExec.steps_passed}/{activeExec.total_steps}</p>
                                    </div>
                                    <div className="h-8 w-[1px] bg-zinc-900" />
                                    <div className="text-center">
                                        <p className="text-[8px] font-mono text-zinc-600 uppercase mb-1">Compute Time</p>
                                        <p className="text-xl font-black font-barlow italic text-zinc-100 uppercase tracking-tighter">{activeExec.duration}s</p>
                                    </div>
                                    <div className="h-8 w-[1px] bg-zinc-900" />
                                    <div className={`p-2 rounded-lg border ${activeExec.status === 'passed' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        <p className="text-[10px] font-black font-barlow italic uppercase tracking-widest">{activeExec.status}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-3 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
                        <span>Sun NXT Infrastructure v1.0.4-LTS</span>
                        <div className="flex gap-4">
                            <span className="text-zinc-800">MEM: 242MB</span>
                            <span className="text-zinc-800">CPU: 4.2%</span>
                            <span className="text-zinc-600 animate-pulse">CONNECTION: STABLE_SSL</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
