import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Layers, Plus, Trash2, Search, Smartphone, ChevronRight, Activity, Clock, ShieldCheck, Tag } from 'lucide-react';

export default function TestSuites() {
    const [suites, setSuites] = useState([]);
    const [cases, setCases] = useState([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newSuite, setNewSuite] = useState({ name: '', description: '', tags: [] });
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const r = await api.getTestSuites();
            setSuites(r.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    const loadCases = useCallback(async (id) => {
        try {
            const r = await api.getTestCases(id);
            setCases(r.data);
        } catch { }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreateSuite = async () => {
        if (!newSuite.name) { toast.error('Suite name is required'); return; }
        try {
            await api.createTestSuite(newSuite);
            toast.success(`Suite "${newSuite.name}" created`);
            setShowCreate(false);
            setNewSuite({ name: '', description: '', tags: [] });
            loadData();
        } catch { toast.error('Failed to create suite'); }
    };

    const handleDeleteSuite = async (id, e) => {
        e.stopPropagation();
        try {
            await api.deleteTestSuite(id);
            toast.success('Suite deleted');
            if (selectedSuiteId === id) setSelectedSuiteId(null);
            loadData();
        } catch { toast.error('Failed to delete suite'); }
    };

    const filteredSuites = suites.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="p-8 text-zinc-500 font-barlow tracking-widest uppercase italic">Accessing Archives...</div>;

    return (
        <div className="p-6 md:p-8 animate-fade-in h-full flex flex-col" data-testid="test-suites-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Registry <span className="text-sky-500">Explorer</span>
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">Centralized Test Asset Repository</p>
                </div>
                <Button
                    onClick={() => setShowCreate(true)}
                    className="bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] font-barlow tracking-widest uppercase italic h-12 px-6"
                >
                    <Plus size={16} className="mr-2" /> New Suite
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
                {/* Left List */}
                <div className="lg:col-span-4 flex flex-col min-h-0 min-w-0">
                    <div className="relative mb-6">
                        <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-600" />
                        <Input
                            placeholder="Filter by name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-[#121215] border-zinc-800 text-zinc-300 pl-10 text-xs h-11 tracking-wider uppercase font-barlow"
                        />
                    </div>

                    <ScrollArea className="flex-1 pr-2">
                        <div className="space-y-3 pb-8">
                            {filteredSuites.map(s => (
                                <div
                                    key={s.id}
                                    data-testid={`suite-card-${s.id}`}
                                    onClick={() => { setSelectedSuiteId(s.id); loadCases(s.id); }}
                                    className={`
                    p-4 rounded-lg border transition-all cursor-pointer group relative overflow-hidden
                    ${selectedSuiteId === s.id ? 'bg-zinc-800/40 border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.05)]' : 'bg-[#121215] border-zinc-800 hover:border-zinc-700/60'}
                  `}
                                >
                                    {selectedSuiteId === s.id && <div className="absolute top-0 left-0 bottom-0 w-1 bg-sky-500" />}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-start justify-between">
                                            <h3 className={`font-barlow text-sm font-bold tracking-widest uppercase transition-colors ${selectedSuiteId === s.id ? 'text-sky-400' : 'text-zinc-400'}`}>
                                                {s.name}
                                            </h3>
                                            <button
                                                data-testid={`delete-suite-${s.id}`}
                                                onClick={(e) => handleDeleteSuite(s.id, e)}
                                                className="text-zinc-700 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 line-clamp-1 font-mono">{s.description || 'No meta-description available.'}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                                <CircleDot size={10} className="text-sky-500" />
                                                <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400">0{s.test_count}</span>
                                            </div>
                                            <div className={`text-[10px] font-mono ${s.pass_rate >= 90 ? 'text-green-500' : 'text-yellow-500'} font-bold`}>
                                                {s.pass_rate}% RELIABILITY
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Detail */}
                <Card className="lg:col-span-8 bg-[#121215] border-zinc-800/60 flex flex-col min-h-0 overflow-hidden relative shadow-2xl">
                    {selectedSuiteId ? (
                        <>
                            <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between">
                                <div>
                                    <h2 className="font-barlow text-lg font-bold tracking-widest uppercase text-zinc-200 italic">
                                        <Layers size={18} className="inline mr-2 text-sky-500" />
                                        {suites.find(s => s.id === selectedSuiteId)?.name}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[9px] font-barlow tracking-widest uppercase text-zinc-500">Suite Health</p>
                                        <p className="text-sm font-black font-barlow text-zinc-400 tracking-tighter uppercase italic">Optimized</p>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {cases.map(tc => (
                                        <Card key={tc.id} className="bg-zinc-950/40 border-zinc-800/60 hover:bg-zinc-950 transition-all group/card overflow-hidden">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <Badge className={`text-[9px] font-mono px-1.5 py-0 uppercase border ${tc.status === 'passed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                            tc.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                                'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                                        }`}>
                                                        {tc.status}
                                                    </Badge>
                                                    <Smartphone size={12} className="text-zinc-700" />
                                                </div>
                                                <h4 className="font-barlow text-sm font-bold text-zinc-300 uppercase leading-snug group-hover/card:text-sky-400 transition-colors">{tc.name}</h4>
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {tc.tags?.map(t => (
                                                        <span key={t} className="text-[8px] font-mono bg-zinc-900 border border-zinc-800 px-1 text-zinc-600 uppercase flex items-center gap-1">
                                                            <Tag size={8} />{t}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between mt-5 pt-3 border-t border-zinc-900/40">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={10} className="text-zinc-700" />
                                                            <span className="text-[10px] font-mono text-zinc-600">8 steps</span>
                                                        </div>
                                                    </div>
                                                    <button className="text-[10px] font-barlow tracking-wider font-bold text-zinc-500 hover:text-sky-400 transition-colors uppercase flex items-center gap-1">
                                                        Explore <Activity size={10} />
                                                    </button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    <Card className="border-dashed border-zinc-800 bg-transparent flex flex-col items-center justify-center py-10 group hover:border-zinc-700 transition-colors cursor-pointer">
                                        <Plus size={24} className="text-zinc-800 group-hover:text-pink-500 transition-colors mb-2" />
                                        <p className="font-barlow text-[10px] font-bold tracking-widest uppercase text-zinc-700 group-hover:text-zinc-500">Append Test Node</p>
                                    </Card>
                                </div>
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-zinc-700">
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
                                <ShieldCheck size={28} className="opacity-20 animate-pulse" />
                            </div>
                            <h3 className="font-barlow text-sm font-bold tracking-widest uppercase italic mb-2">Registry Inactive</h3>
                            <p className="text-[10px] font-mono text-zinc-600 text-center max-w-[200px]">Select a suite from the left terminal to initialize asset review.</p>
                        </div>
                    )}
                </Card>
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-[#121215] border-zinc-800 text-zinc-100 italic">
                    <DialogHeader>
                        <DialogTitle className="font-barlow tracking-widest uppercase text-xl font-bold flex items-center gap-2">
                            <Plus className="text-pink-500" /> New Registry Entity
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold font-barlow uppercase text-zinc-500 tracking-widest px-1">Enity Identifier *</label>
                            <Input
                                placeholder="e.g. AUTHENTICATION_REGRESSION"
                                value={newSuite.name}
                                onChange={e => setNewSuite(p => ({ ...p, name: e.target.value }))}
                                className="bg-zinc-950 border-zinc-800 h-12 uppercase font-barlow tracking-widest focus:ring-pink-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold font-barlow uppercase text-zinc-500 tracking-widest px-1">Description</label>
                            <textarea
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 min-h-[100px] text-zinc-300"
                                placeholder="Technical overview of this repository..."
                                value={newSuite.description}
                                onChange={e => setNewSuite(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-8 border-t border-zinc-900/50 pt-4">
                        <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-zinc-600 font-barlow">TERMINATE</Button>
                        <Button onClick={handleCreateSuite} className="bg-pink-500 hover:bg-pink-600 font-barlow font-bold italic tracking-widest uppercase px-8 flex items-center gap-2">
                            GENERATE <ChevronRight size={14} />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
