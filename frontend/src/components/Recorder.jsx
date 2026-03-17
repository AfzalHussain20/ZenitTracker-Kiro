import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Play,
    Save,
    CircleDot,
    MousePointer2,
    Type,
    AlignLeft,
    Clock,
    ArrowDownCircle,
    GripVertical,
    Smartphone,
    Zap,
    Layers
} from 'lucide-react';

const ACTION_TYPES = [
    { value: 'tap', icon: <MousePointer2 size={12} />, label: 'TAP / CLICK' },
    { value: 'type', icon: <Type size={12} />, label: 'SEND KEYS' },
    { value: 'wait', icon: <Clock size={12} />, label: 'WAIT SECONDS' },
    { value: 'assert_visible', icon: <Zap size={12} />, label: 'ASSERT VISIBLE' },
    { value: 'assert_text', icon: <AlignLeft size={12} />, label: 'ASSERT TEXT' },
    { value: 'scroll', icon: <ArrowDownCircle size={12} />, label: 'SCROLL VIEW' },
];

export default function Recorder() {
    const [suites, setSuites] = useState([]);
    const [cases, setCases] = useState([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState('');
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [steps, setSteps] = useState([]);
    const [recording, setRecording] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const r = await api.getTestSuites();
            setSuites(r.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const loadCases = async (suiteId) => {
        const r = await api.getTestCases(suiteId);
        setCases(r.data);
        setSelectedCaseId('');
        setSteps([]);
    };

    const loadCaseSteps = async (caseId) => {
        const r = await api.getTestCase(caseId);
        setSteps(r.data.steps || []);
    };

    const handleAddStep = () => {
        const newStep = {
            id: crypto.randomUUID(),
            action: 'tap',
            target_type: 'accessibilityId',
            target_value: '',
            input_value: '',
            expected_result: '',
            order: steps.length + 1
        };
        setSteps([...steps, newStep]);
    };

    const updateStep = (id, field, value) => {
        setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        if (!selectedCaseId) { toast.error('Select a test case'); return; }
        try {
            await api.updateTestCase(selectedCaseId, { steps });
            toast.success('Sequence saved to registry');
        } catch { toast.error('Failed to save'); }
    };

    const handleDeleteStep = (id) => {
        setSteps(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
    };

    if (loading) return <div className="p-8 text-zinc-500 font-barlow tracking-widest uppercase italic font-black">Initializing Visual Bus...</div>;

    return (
        <div className="p-6 md:p-8 animate-fade-in h-full flex flex-col" data-testid="recorder-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Visual <span className="text-pink-500">Flow</span> Recorder
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">Design UI Interaction Chains for Sun NXT</p>
                </div>
                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setRecording(!recording)}
                        className={`font-barlow border-zinc-700 uppercase italic px-6 ${recording ? 'text-red-500 bg-red-500/10 border-red-500/40' : 'text-zinc-300 hover:text-white'}`}
                    >
                        {recording ? (
                            <><CircleDot size={18} className="mr-2 animate-pulse" /> Stop Rec</>
                        ) : (
                            <><CircleDot size={18} className="mr-2" /> Start Rec</>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] font-barlow tracking-widest uppercase italic px-6"
                    >
                        <Save size={18} className="mr-2" /> Commit Flow
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
                {/* Left Control Panel */}
                <div className="lg:col-span-3 space-y-4 flex flex-col min-h-0">
                    <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 shadow-xl">
                        <h3 className="text-[10px] font-barlow font-bold tracking-widest uppercase text-zinc-500 mb-4 px-1 flex items-center gap-2">
                            <Layers size={12} className="text-pink-500" /> Registry Target
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-mono text-zinc-600 uppercase border-l border-zinc-800 pl-2 ml-1">Test Suite</p>
                                <Select value={selectedSuiteId} onValueChange={(v) => { setSelectedSuiteId(v); loadCases(v); }}>
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-10 tracking-widest uppercase font-barlow focus:ring-1 focus:ring-pink-500/20">
                                        <SelectValue placeholder="Target Suite..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-700">
                                        {suites.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[9px] font-mono text-zinc-600 uppercase border-l border-zinc-800 pl-2 ml-1">Entity node</p>
                                <Select value={selectedCaseId} onValueChange={(v) => { setSelectedCaseId(v); loadCaseSteps(v); }} disabled={!selectedSuiteId}>
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-10 tracking-widest uppercase font-barlow">
                                        <SelectValue placeholder="Target Node..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-700">
                                        {cases.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 shadow-xl flex-1 flex flex-col">
                        <h3 className="text-[10px] font-barlow font-bold tracking-widest uppercase text-zinc-500 mb-4 px-1 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Smartphone size={12} className="text-sky-500" /> Device Telemetry</span>
                            <span className="text-[8px] animate-pulse bg-green-500 text-black px-1 rounded-sm">LIVE</span>
                        </h3>
                        <div className="flex-1 rounded-lg border border-zinc-900 bg-black flex flex-col items-center justify-center p-8 grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all cursor-not-allowed border-dashed">
                            <Zap size={32} className="text-zinc-800 mb-2" />
                            <p className="text-[10px] uppercase font-bold text-zinc-800 tracking-tighter">Awaiting Device Sync</p>
                        </div>
                    </div>
                </div>

                {/* Right Execution Sequence */}
                <Card className="lg:col-span-9 bg-[#121215] border-zinc-800/60 shadow-2xl flex flex-col min-h-0 overflow-hidden relative">
                    <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-900/10">
                        <h3 className="font-barlow text-sm font-bold tracking-widest uppercase text-zinc-400 flex items-center gap-2 italic">
                            Sequence Blueprint <span className="text-zinc-700 ml-2 font-mono text-[10px] font-normal not-italic tracking-tighter">[Revision: {steps.length > 0 ? '7.2' : '--'}]</span>
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[9px] font-barlow tracking-widest uppercase text-zinc-600">Active Instructions</p>
                                <p className="text-sm font-black font-barlow text-zinc-400 tracking-tighter uppercase italic">{steps.length} Nodes</p>
                            </div>
                            <button
                                onClick={handleAddStep}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white transition-all shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 pb-20 space-y-3">
                            {steps.length > 0 ? steps.map((s, i) => (
                                <div key={s.id} className="group relative flex gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 hover:bg-zinc-900/60 transition-all duration-300">
                                    <div className="flex flex-col items-center gap-2 mt-2">
                                        <div className="text-[9px] font-mono text-zinc-700 italic group-hover:text-pink-500/60 transition-colors">#{i + 1}</div>
                                        <GripVertical size={14} className="text-zinc-800 cursor-grab active:cursor-grabbing hover:text-zinc-600" />
                                    </div>

                                    <div className="flex-1 grid grid-cols-12 gap-3 min-w-0">
                                        <div className="col-span-3">
                                            <Select value={s.action} onValueChange={v => updateStep(s.id, 'action', v)}>
                                                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-[11px] h-10 tracking-widest uppercase font-barlow italic">
                                                    {ACTION_TYPES.find(a => a.value === s.action)?.icon}
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value} className="text-[10px] font-barlow">{a.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="col-span-4 lg:col-span-5">
                                            <Input
                                                placeholder="Element Locator (AccessibilityId, XPath...)"
                                                value={s.target_value}
                                                onChange={e => updateStep(s.id, 'target_value', e.target.value)}
                                                className="bg-zinc-950 border-zinc-800 h-10 text-[11px] font-mono"
                                            />
                                        </div>

                                        <div className="col-span-2 lg:col-span-2">
                                            <Input
                                                placeholder="Input Data"
                                                value={s.input_value}
                                                onChange={e => updateStep(s.id, 'input_value', e.target.value)}
                                                className="bg-zinc-950 border-zinc-800 h-10 text-[11px] font-mono"
                                            />
                                        </div>

                                        <div className="col-span-3 lg:col-span-2 flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteStep(s.id)}
                                                className="text-zinc-700 hover:text-red-400 transition-colors h-10 w-10 p-0"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="h-[300px] flex flex-col items-center justify-center text-zinc-800">
                                    <Plus size={48} className="opacity-10 mb-4" />
                                    <p className="font-barlow text-sm font-bold tracking-[0.3em] uppercase opacity-30 italic">Initialize Interaction Feed</p>
                                    <p className="text-[10px] font-mono opacity-20 uppercase mt-2">Append your first instruction node to begin recording</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full flex items-center gap-6 shadow-2xl animate-slide-in">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest whitespace-nowrap">Rec System: STANDBY</p>
                        </div>
                        <div className="h-4 w-[1px] bg-zinc-800" />
                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest whitespace-nowrap">IO FEED: LOCAL_DEVICE_01</p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
