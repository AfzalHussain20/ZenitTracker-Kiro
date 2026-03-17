import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileCode2, ArrowRight, Smartphone, Tag, Layers } from 'lucide-react';

const categoryColors = {
    Authentication: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    Playback: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Search: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Subscription: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    Downloads: 'bg-green-500/10 text-green-400 border-green-500/20',
    Localization: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Navigation: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export default function Templates() {
    const [templates, setTemplates] = useState([]);
    const [suites, setSuites] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedSuiteId, setSelectedSuiteId] = useState('');
    const [showApply, setShowApply] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [tr, sr] = await Promise.all([api.getTemplates(), api.getTestSuites()]);
            setTemplates(tr.data);
            setSuites(sr.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleApply = async () => {
        if (!selectedSuiteId) { toast.error('Select a suite first'); return; }
        try {
            await api.applyTemplate(selectedTemplate.id, selectedSuiteId);
            toast.success(`Template "${selectedTemplate.name}" applied to suite`);
            setShowApply(false);
        } catch { toast.error('Failed to apply template'); }
    };

    if (loading) return <div className="p-8 text-zinc-500">Loading templates...</div>;

    return (
        <div className="p-6 md:p-8 animate-fade-in" data-testid="templates-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-barlow text-3xl md:text-4xl font-bold tracking-tight text-zinc-100 uppercase">
                        <Layers size={28} className="inline mr-2 text-pink-400" />Templates
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Ready-to-use test case templates for Sun NXT</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
                {templates.map(tmp => (
                    <Card key={tmp.id} className="bg-[#121215] border-zinc-800 hover:border-zinc-700 transition-all group">
                        <CardContent className="p-5 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <Badge className={`text-[10px] uppercase font-bold tracking-wider ${categoryColors[tmp.category] || 'bg-zinc-800 text-zinc-400'}`}>
                                    {tmp.category}
                                </Badge>
                                <div className="flex gap-1">
                                    <Smartphone size={12} className="text-zinc-600" />
                                    <span className="text-[10px] font-mono text-zinc-600 uppercase">{tmp.platform}</span>
                                </div>
                            </div>
                            <h3 className="font-barlow text-lg font-bold text-zinc-200 uppercase tracking-wide group-hover:text-pink-400 transition-colors">{tmp.name}</h3>
                            <p className="text-xs text-zinc-500 mt-2 flex-1 line-clamp-2">{tmp.description}</p>

                            <div className="flex flex-wrap gap-1.5 mt-4 mb-5">
                                {tmp.tags?.map(tag => (
                                    <span key={tag} className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Tag size={8} />{tag}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                                <span className="text-[10px] font-mono text-zinc-600">{tmp.steps?.length || 0} steps</span>
                                <Button
                                    data-testid={`apply-template-${tmp.id}`}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setSelectedTemplate(tmp); setShowApply(true); }}
                                    className="h-8 text-[11px] font-barlow tracking-wider uppercase border-zinc-800 hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/30"
                                >
                                    Apply Template <ArrowRight size={12} className="ml-1.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={showApply} onOpenChange={setShowApply}>
                <DialogContent className="bg-[#121215] border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="font-barlow tracking-wider uppercase text-zinc-100 italic">Apply Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800">
                            <p className="text-[10px] font-barlow tracking-widest uppercase text-zinc-500 mb-1">Template</p>
                            <p className="text-sm font-medium text-sky-400">{selectedTemplate?.name}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-barlow tracking-widest uppercase text-zinc-500">Target Test Suite</p>
                            <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
                                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                    <SelectValue placeholder="Select a suite..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    {suites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="ghost" onClick={() => setShowApply(false)} className="text-zinc-500">Cancel</Button>
                        <Button data-testid="confirm-apply-btn" onClick={handleApply} className="bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                            Create Test Case
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
