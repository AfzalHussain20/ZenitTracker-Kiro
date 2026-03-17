'use client';

import React, { useState, useEffect } from 'react';
import { trackerApi } from '@/lib/tracker-api';
import {
    Layers, Plus, Trash2, Edit2, ChevronRight,
    Search, Filter, MoreVertical, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function TestSuiteManager({ onSelectSuite }: { onSelectSuite: (id: string, name: string) => void }) {
    const [suites, setSuites] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSuites();
    }, []);

    const fetchSuites = async () => {
        try {
            const res = await trackerApi.getSuites();
            setSuites(res.data);
        } catch (error) {
            console.error("Failed to fetch suites", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSuite = async () => {
        const name = prompt("Enter Test Suite Name:");
        if (!name) return;
        try {
            await trackerApi.createSuite({ name, description: "New test suite" });
            fetchSuites();
        } catch (error) {
            console.error("Failed to create suite", error);
        }
    };

    const filteredSuites = suites.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search collections..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 border-none bg-white shadow-sm rounded-xl text-xs font-bold uppercase tracking-widest placeholder:text-slate-300"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" className="h-10 rounded-xl px-4 text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border-none bg-white font-black text-[10px] uppercase">
                        <Filter className="w-4 h-4 mr-2" /> Filter
                    </Button>
                    <Button onClick={handleCreateSuite} className="h-10 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 font-black text-[10px] uppercase flex-1 sm:flex-none">
                        <Plus className="w-4 h-4 mr-2" /> New Suite
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <Card key={i} className="border-none shadow-sm animate-pulse bg-white/50 h-[140px] rounded-2xl" />
                    ))
                ) : filteredSuites.length > 0 ? (
                    filteredSuites.map((s, i) => (
                        <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all duration-500 group overflow-hidden bg-white/50 backdrop-blur-sm rounded-2xl border-l-[6px] border-indigo-500/10 hover:border-indigo-500 cursor-pointer" onClick={() => onSelectSuite(s.id, s.name)}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-500 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <button className="text-slate-300 hover:text-slate-600 transition-colors cursor-default">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-4">
                                    <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate uppercase tracking-tight">{s.name}</h3>
                                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 h-4">{s.description || "No description provided"}</p>
                                </div>
                                <div className="mt-5 flex items-center justify-between border-t border-slate-100/50 pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-slate-300" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase">{s.test_count || 0} Cases</span>
                                        </div>
                                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                        <Layers className="w-12 h-12 mb-4 text-slate-400" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">No suites found</span>
                    </div>
                )}
            </div>
        </div>
    );
}
