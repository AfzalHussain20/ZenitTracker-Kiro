import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Crosshair, Plus, Trash2, Edit2, Copy, Search, Smartphone, Layers, ShieldCheck } from 'lucide-react';

const LOCATOR_TYPES = ['accessibilityId', 'resourceId', 'xpath', 'className', 'text', 'id', 'name'];
const platformColors = { android: 'bg-green-500/10 text-green-400 border-green-500/20', ios: 'bg-zinc-100/10 text-zinc-100 border-zinc-100/20', both: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };

export default function LocatorManager() {
    const [locators, setLocators] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editingLoc, setEditingLoc] = useState(null);
    const [formData, setFormData] = useState({ element_name: '', screen_name: '', platform: 'android', strategies: [{ type: 'accessibilityId', value: '', stability_score: 90 }] });
    const [loading, setLoading] = useState(true);

    const loadLocators = useCallback(async () => {
        try {
            const r = await api.getLocators();
            setLocators(r.data);
            setLoading(false);
        } catch { setLoading(false); }
    }, []);

    useEffect(() => { loadLocators(); }, [loadLocators]);

    const handleCreateOrUpdate = async () => {
        if (!formData.element_name || !formData.screen_name) { toast.error('Fill required fields'); return; }
        try {
            if (editingLoc) {
                await api.updateLocator(editingLoc.id, formData);
                toast.success('Locator updated');
            } else {
                await api.createLocator(formData);
                toast.success('Locator created');
            }
            setShowCreate(false);
            setEditingLoc(null);
            setFormData({ element_name: '', screen_name: '', platform: 'android', strategies: [{ type: 'accessibilityId', value: '', stability_score: 90 }] });
            loadLocators();
        } catch { toast.error('Failed to save'); }
    };

    const handleDelete = async (id) => {
        await api.deleteLocator(id);
        toast.success('Locator deleted');
        loadLocators();
    };

    const handleAddStrategy = () => {
        setFormData(p => ({ ...p, strategies: [...p.strategies, { type: 'xpath', value: '', stability_score: 50 }] }));
    };

    const updateStrategy = (idx, field, value) => {
        setFormData(p => ({ ...p, strategies: p.strategies.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));
    };

    const removeStrategy = (idx) => {
        setFormData(p => ({ ...p, strategies: p.strategies.filter((_, i) => i !== idx) }));
    };

    const filtered = locators.filter(l =>
        l.element_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.screen_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-zinc-500">Loading locators...</div>;

    return (
        <div className="p-6 md:p-8 animate-fade-in" data-testid="locator-manager-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-barlow text-3xl md:text-4xl font-bold tracking-tight text-zinc-100 uppercase">
                        <ShieldCheck size={28} className="inline mr-2 text-green-400" />Locator Store
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Centralized stable element locators for Sun NXT</p>
                </div>
                <Button data-testid="create-locator-btn" onClick={() => setShowCreate(true)} className="bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                    <Plus size={14} className="mr-2" /> Register Locator
                </Button>
            </div>

            <div className="relative mb-6">
                <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-600" />
                <Input
                    data-testid="locator-search"
                    placeholder="Search items by name or screen..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-[#121215] border-zinc-800 pl-10 text-sm h-11"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
                {filtered.map(l => (
                    <Card key={l.id} className="bg-[#121215] border-zinc-800 hover:border-zinc-700 transition-colors group" data-testid={`locator-card-${l.id}`}>
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex flex-col">
                                    <span className="font-barlow text-xs tracking-widest uppercase text-zinc-500">{l.screen_name}</span>
                                    <h3 className="font-barlow text-lg font-bold text-zinc-200 group-hover:text-sky-400 transition-colors uppercase">{l.element_name}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button data-testid={`edit-locator-${l.id}`} onClick={() => { setEditingLoc(l); setFormData(l); setShowCreate(true); }} className="text-zinc-600 hover:text-sky-400 transition-colors"><Edit2 size={12} /></button>
                                    <button data-testid={`delete-locator-${l.id}`} onClick={() => handleDelete(l.id)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <p className="text-[10px] font-barlow tracking-widest uppercase text-zinc-600">Strategies</p>
                                {l.strategies.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-900">
                                        <div className={`w-1 h-6 rounded-full ${s.stability_score >= 90 ? 'bg-green-500' : s.stability_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-mono text-sky-400/60 uppercase">{s.type}</span>
                                                <span className={`text-[9px] font-mono ${s.stability_score >= 90 ? 'text-green-500' : 'text-zinc-600'}`}>{s.stability_score}% reliability</span>
                                            </div>
                                            <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">{s.value}</p>
                                        </div>
                                        <button onClick={() => { navigator.clipboard.writeText(s.value); toast.success('Value copied'); }} className="text-zinc-700 hover:text-zinc-300"><Copy size={10} /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between mt-5 pt-3 border-t border-zinc-800/40">
                                <Badge className={`text-[9px] font-mono px-1.5 py-0 ${platformColors[l.platform] || platformColors.android}`}>
                                    {l.platform.toUpperCase()}
                                </Badge>
                                <div className="flex items-center gap-1.5 text-zinc-600">
                                    <Smartphone size={10} />
                                    <span className="text-[10px] font-mono">Sun NXT Mobile</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-[#121215] border-zinc-800 w-full max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="font-barlow tracking-wider uppercase text-zinc-100 flex items-center gap-2 italic">
                            <Crosshair size={16} /> {editingLoc ? 'Update Locator' : 'Register New Locator'}
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-4">
                        <div className="space-y-5 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500 px-1 font-barlow tracking-wider italic">Element Name *</label>
                                    <Input data-testid="loc-name-input" placeholder="e.g. Play Button" value={formData.element_name} onChange={e => setFormData(p => ({ ...p, element_name: e.target.value }))} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500 px-1 font-barlow tracking-wider italic">Screen Name *</label>
                                    <Input data-testid="loc-screen-input" placeholder="e.g. Content Detail" value={formData.screen_name} onChange={e => setFormData(p => ({ ...p, screen_name: e.target.value }))} className="bg-zinc-950 border-zinc-800 text-zinc-200" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-zinc-500 px-1 font-barlow tracking-wider italic">Platform</label>
                                <Select value={formData.platform} onValueChange={v => setFormData(p => ({ ...p, platform: v }))}>
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-700">
                                        <SelectItem value="android">Android</SelectItem>
                                        <SelectItem value="ios">iOS</SelectItem>
                                        <SelectItem value="both">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-1">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500 px-1 font-barlow tracking-wider italic">Strategies & Stability</label>
                                    <button data-testid="add-strategy-btn" onClick={handleAddStrategy} className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1">
                                        <Plus size={10} /> Add Plan B
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.strategies.map((s, i) => (
                                        <div key={i} className="p-3 rounded bg-zinc-900/40 border border-zinc-800/60 relative">
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="col-span-1">
                                                    <Select value={s.type} onValueChange={v => updateStrategy(i, 'type', v)}>
                                                        <SelectTrigger className="bg-zinc-950 border-zinc-800 text-[11px] h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-zinc-900 border-zinc-700">
                                                            {LOCATOR_TYPES.map(t => <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-2">
                                                    <Input placeholder="Strategy value..." value={s.value} onChange={e => updateStrategy(i, 'value', e.target.value)} className="bg-zinc-950 border-zinc-800 text-[11px] h-8 font-mono" />
                                                </div>
                                                <div className="col-span-1">
                                                    <Input type="number" placeholder="Score %" value={s.stability_score} onChange={e => updateStrategy(i, 'stability_score', e.target.value)} className="bg-zinc-950 border-zinc-800 text-[11px] h-8" />
                                                </div>
                                            </div>
                                            {formData.strategies.length > 1 && (
                                                <button onClick={() => removeStrategy(i)} className="absolute -top-1.5 -right-1.5 bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-full p-0.5 border border-zinc-700 shadow-lg">
                                                    <Plus size={10} className="rotate-45" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                        <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-zinc-500">Cancel</Button>
                        <Button data-testid="confirm-save-locator" onClick={handleCreateOrUpdate} className="bg-sky-500 hover:bg-sky-600 text-white">
                            {editingLoc ? 'Update Record' : 'Save Locator'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
