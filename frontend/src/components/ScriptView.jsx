import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    FileCode2,
    Copy,
    Download,
    RefreshCcw,
    Terminal,
    FileJson,
    FileText,
    Github,
    Layers,
    Zap,
    Smartphone,
    CheckCircle2,
    ArrowRight,
    Laptop,
    Code
} from 'lucide-react';

export default function ScriptView() {
    const [cases, setCases] = useState([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [language, setLanguage] = useState('python');
    const [script, setScript] = useState(null);
    const [generating, setGenerating] = useState(false);

    const loadCases = useCallback(async () => {
        try {
            const r = await api.getTestCases();
            setCases(r.data);
        } catch { }
    }, []);

    useEffect(() => { loadCases(); }, [loadCases]);

    const handleGenerate = async () => {
        if (!selectedCaseId) { toast.error('Select a test case'); return; }
        setGenerating(true);
        try {
            const r = await api.generateScript({ test_case_id: selectedCaseId, language });
            setScript(r.data);
            toast.success('Script generated successfully');
        } catch { toast.error('Failed to generate script'); }
        setGenerating(false);
    };

    const handleCopy = () => {
        if (!script) return;
        navigator.clipboard.writeText(script.script);
        toast.success('Script copied to clipboard');
    };

    const handleDownload = () => {
        if (!script) return;
        const ext = language === 'python' ? 'py' : language === 'java' ? 'java' : 'js';
        const blob = new Blob([script.script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sunnxt_test_${script.test_case_name.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download initiated');
    };

    return (
        <div className="p-6 md:p-8 animate-fade-in h-full flex flex-col" data-testid="script-view-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Automation <span className="text-pink-500">Transpiler</span>
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">Generate Native Execution Scripts for Sun NXT</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="font-barlow border-zinc-700 text-zinc-300 uppercase italic h-12 px-6">
                        <Github size={16} className="mr-2" /> Push to Repository
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_25px_rgba(236,72,153,0.3)] font-barlow tracking-widest uppercase italic h-12 px-8 flex items-center gap-2"
                    >
                        {generating ? 'Transpiling...' : <><Zap size={18} /> Generate Engine</>}
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-6 mb-8 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/40">
                <div className="flex-1 flex items-center gap-6">
                    <div className="flex-1 max-w-sm">
                        <p className="text-[9px] font-barlow font-bold tracking-widest uppercase text-zinc-600 mb-1 px-1">Source Node</p>
                        <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-12 font-barlow uppercase tracking-widest italic">
                                <SelectValue placeholder="Select test case..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                {cases.map(tc => <SelectItem key={tc.id} value={tc.id} className="text-xs uppercase">{tc.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-56">
                        <p className="text-[9px] font-barlow font-bold tracking-widest uppercase text-zinc-600 mb-1 px-1">Engine Language</p>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs h-12 font-barlow uppercase tracking-widest italic">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="python" className="text-xs">PYTHON / APPIUM</SelectItem>
                                <SelectItem value="java" className="text-xs">JAVA / TESTNG</SelectItem>
                                <SelectItem value="javascript" className="text-xs">NODEJS / WDIO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-right mr-4 border-r border-zinc-800 pr-4">
                        <p className="text-[9px] font-barlow tracking-widest uppercase text-zinc-600">Compiler Status</p>
                        <p className={`text-xs font-black font-barlow tracking-tighter uppercase italic ${generating ? 'text-pink-500 animate-pulse' : 'text-zinc-500'}`}>{generating ? 'Compiling' : 'Ready'}</p>
                    </div>
                    <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px] uppercase font-mono tracking-widest p-1.5 h-10 flex items-center gap-2 italic shadow-2xl">
                        <Laptop size={14} /> X86 Architecture
                    </Badge>
                </div>
            </div>

            <Card className="flex-1 bg-[#121215] border-zinc-800/60 shadow-2xl flex flex-col min-h-0 overflow-hidden relative">
                {script ? (
                    <>
                        <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-900/10 backdrop-blur-3xl sticky top-0 z-10">
                            <h3 className="font-barlow text-sm font-bold tracking-widest uppercase text-zinc-400 flex items-center gap-2 italic">
                                Native Script Preview <span className="text-[10px] font-mono text-pink-500 not-italic ml-2 uppercase tracking-tighter shadow-[0_0_10px_rgba(236,72,153,0.2)]">[{language.toUpperCase()}_ENGINE]</span>
                            </h3>
                            <div className="flex gap-3">
                                <Button variant="outline" size="sm" onClick={handleCopy} className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 border-zinc-800 h-10 px-4 font-barlow uppercase tracking-widest font-bold">
                                    <Copy size={12} className="mr-2" /> Copy Buffer
                                </Button>
                                <Button size="sm" onClick={handleDownload} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 h-10 px-4 font-barlow uppercase tracking-widest font-bold border border-zinc-700/40">
                                    <Download size={12} className="mr-2" /> Download File
                                </Button>
                            </div>
                        </div>

                        <CardContent className="p-0 flex-1 overflow-hidden relative group">
                            <ScrollArea className="h-full w-full">
                                <div className="p-8 font-mono text-[13px] leading-relaxed relative z-10 animate-fade-in select-all">
                                    <pre className="text-sky-400/90 whitespace-pre-wrap">
                                        {script.script.split('\n').map((line, i) => (
                                            <div key={i} className="flex gap-6 group/line hover:bg-zinc-900/40 transition-colors">
                                                <span className="w-10 text-right text-zinc-800 select-none opacity-40 group-hover/line:opacity-100 italic">{i + 1}</span>
                                                <span className={line.trim().startsWith('#') || line.trim().startsWith('//') ? 'text-zinc-600 italic' : ''}>{line}</span>
                                            </div>
                                        ))}
                                    </pre>
                                </div>
                                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                                    <Code size={180} className="text-zinc-800 translate-x-1/4" />
                                </div>
                            </ScrollArea>
                        </CardContent>

                        <div className="p-3 bg-black border-t border-zinc-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <p className="text-[9px] font-mono text-zinc-600 uppercase">Script Metadata Verified</p>
                            </div>
                            <div className="flex gap-4">
                                <p className="text-[9px] font-mono text-zinc-700 uppercase">Lines: {script.script.split('\n').length}</p>
                                <p className="text-[9px] font-mono text-zinc-700 uppercase">Revision: 1.0.4</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-zinc-700">
                        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6 bg-zinc-950 shadow-inner group-hover:border-zinc-700 transition-colors">
                            <Terminal size={40} className="opacity-10 animate-pulse group-hover:opacity-20 transition-opacity" />
                        </div>
                        <h3 className="font-barlow text-sm font-bold tracking-[0.4em] uppercase italic mb-2 tracking-widest text-zinc-200">Awaiting Transpilation</h3>
                        <p className="text-[10px] font-mono text-zinc-700 text-center max-w-[280px] leading-relaxed">Select a test node and execution target to generate the localized automation script engine.</p>
                        <button onClick={handleGenerate} className="mt-8 text-[11px] font-barlow font-bold tracking-widest uppercase text-pink-500 hover:text-pink-400 underline underline-offset-4 decoration-pink-500/30">
                            Initialize Generation Now
                        </button>
                    </div>
                )}
            </Card>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <div className="p-4 rounded-lg border border-zinc-800 bg-[#121215] flex items-center gap-4 group cursor-help">
                    <div className="p-2 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 group-hover:scale-110 transition-transform">
                        <FileJson size={14} />
                    </div>
                    <div>
                        <p className="text-[10px] font-barlow font-bold uppercase tracking-widest text-zinc-400">Environment Mapping</p>
                        <p className="text-[9px] text-zinc-600 font-mono italic">Appium Desired Caps v2.1</p>
                    </div>
                </div>
                <div className="p-4 rounded-lg border border-zinc-800 bg-[#121215] flex items-center gap-4 group cursor-help">
                    <div className="p-2 rounded bg-pink-500/10 text-pink-500 border border-pink-500/20 group-hover:scale-110 transition-transform">
                        <Layers size={14} />
                    </div>
                    <div>
                        <p className="text-[10px] font-barlow font-bold uppercase tracking-widest text-zinc-400">Locator Integration</p>
                        <p className="text-[9px] text-zinc-600 font-mono italic">Sun NXT Strategy Store v1.0</p>
                    </div>
                </div>
                <div className="p-4 rounded-lg border border-zinc-800 bg-[#121215] flex items-center gap-4 group cursor-help">
                    <div className="p-2 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Laptop size={14} />
                    </div>
                    <div>
                        <p className="text-[10px] font-barlow font-bold uppercase tracking-widest text-zinc-400">Local Validation</p>
                        <p className="text-[9px] text-zinc-600 font-mono italic">OS Native Compatibility Check</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
