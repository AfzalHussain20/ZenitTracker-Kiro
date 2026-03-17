'use client';

import React, { useState, useEffect } from 'react';
import { trackerApi } from '@/lib/tracker-api';
import {
    FileText, Plus, Trash2, Edit2, Play,
    ChevronRight, CheckCircle2, Clock, AlertCircle,
    ArrowLeft, Search, Filter, Terminal, ShieldCheck, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function TestCaseManager({ suiteId, suiteName, onBack, onSelectCase }: any) {
    const [cases, setCases] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (suiteId) fetchCases();
    }, [suiteId]);

    const fetchCases = async () => {
        setLoading(true);
        try {
            const res = await trackerApi.getCases(suiteId);
            setCases(res.data);
        } catch (error) {
            console.error("Failed to fetch cases", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCase = async () => {
        const title = prompt("Enter Test Case Title:");
        if (!title) return;
        try {
            await trackerApi.createCase({ title, suite_id: suiteId, description: "New test case", priority: "MEDIUM", steps: [] });
            fetchCases();
        } catch (error) {
            console.error("Failed to create case", error);
        }
    };

    const handleRunCase = async (id: string) => {
        try {
            await trackerApi.runExecution(id);
            alert("Execution started!");
        } catch (error) {
            console.error("Failed to run execution", error);
        }
    };

    const filteredCases = cases.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'HIGH': return 'border-rose-500 text-rose-500 bg-rose-50';
            case 'MEDIUM': return 'border-amber-500 text-amber-500 bg-amber-50';
            case 'LOW': return 'border-emerald-500 text-emerald-500 bg-emerald-50';
            default: return 'border-slate-500 text-slate-500 bg-slate-50';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2 animate-in slide-in-from-left-4 duration-300">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl hover:bg-white shadow-sm border-none bg-white">
                    <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </Button>
                <div>
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
                        {suiteName}
                        <Badge variant="outline" className="h-5 px-2 bg-indigo-50 border-indigo-100 text-indigo-600 text-[9px] font-black uppercase">Collection</Badge>
                    </h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Managing {cases.length} targeted test scenarios</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Filter cases..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 border-none bg-white shadow-sm rounded-xl text-xs font-bold uppercase tracking-widest placeholder:text-slate-300"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={handleCreateCase} className="h-10 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 font-black text-[10px] uppercase flex-1 sm:flex-none">
                        <Plus className="w-4 h-4 mr-2" /> New Case
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <Card key={i} className="border-none shadow-sm animate-pulse bg-white/50 h-[80px] rounded-2xl" />
                    ))
                ) : filteredCases.length > 0 ? (
                    filteredCases.map((c, i) => (
                        <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden bg-white/50 backdrop-blur-sm rounded-2xl border-l-[6px] border-transparent hover:border-indigo-500 cursor-pointer" onClick={() => onSelectCase(c.id, c.name)}>
                            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="p-3 rounded-2xl bg-white shadow-sm text-indigo-500 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h3 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate uppercase tracking-tight">{c.name}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <Badge variant="outline" className={`h-4 px-1.5 text-[8px] font-black uppercase ${getPriorityColor(c.priority)}`}>
                                                {c.priority}
                                            </Badge>
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Terminal className="w-3 h-3" />
                                                {c.steps?.length || 0} Steps
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                    <div className="hidden lg:flex items-center gap-4 mr-4 text-[10px] font-black text-slate-300 uppercase">
                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> PASS: 92%</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 " /> 2.4s</span>
                                    </div>
                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRunCase(c.id); }} className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white transition-all font-black text-[9px] uppercase shadow-sm border-none group/play">
                                        <Play className="w-3 h-3 mr-2 group-hover/play:fill-white" fill="currentColor" /> Run Case
                                    </Button>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="py-20 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                        <FileText className="w-12 h-12 mb-4 text-slate-400" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">No scenarios found</span>
                    </div>
                )}
            </div>
        </div>
    );
}
