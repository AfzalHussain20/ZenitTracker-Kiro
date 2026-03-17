'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trackerApi } from '@/lib/tracker-api';
import {
    FileText, Plus, Trash2, Edit2, Play,
    ArrowLeft, Terminal, ShieldCheck, Zap,
    FileCode, FileDown, BookOpen, Clock,
    MousePointer2, AlertCircle, Save, CheckCircle2,
    Layout, Box, ChevronDown, ChevronRight,
    Search as SearchIcon, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export function TestCaseDetails({ caseId, caseTitle, onBack }: any) {
    const router = useRouter();
    const [testCase, setTestCase] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [script, setScript] = useState<string>('');
    const [doc, setDoc] = useState<string>('');
    const [lang, setLang] = useState('PYTHON');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (caseId) fetchCaseDetails();
    }, [caseId]);

    const fetchCaseDetails = async () => {
        setLoading(true);
        try {
            const res = await trackerApi.getCase(caseId);
            setTestCase(res.data);
            generateScript(res.data.id, lang);
            generateDoc(res.data.id);
        } catch (error) {
            console.error("Failed to fetch case details", error);
        } finally {
            setLoading(false);
        }
    };

    const generateScript = async (id: string, language: string) => {
        try {
            const res = await trackerApi.generateScript(id, language);
            setScript(res.data.script);
        } catch (error) {
            console.error("Failed to generate script", error);
        }
    };

    const generateDoc = async (id: string) => {
        try {
            const res = await trackerApi.generateDoc(id);
            setDoc(res.data.markdown);
        } catch (error) {
            console.error("Failed to generate documentation", error);
        }
    };

    const handleAddStep = () => {
        const newStep = {
            id: Math.random().toString(36).substr(2, 9),
            action: 'CLICK',
            target_type: 'id',
            target_value: '',
            input_value: '',
            expected_result: '',
            order: testCase.steps.length
        };
        const updatedSteps = [...testCase.steps, newStep];
        setTestCase({ ...testCase, steps: updatedSteps });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await trackerApi.updateCase(caseId, testCase);
            alert("Test case saved successfully!");
            generateScript(caseId, lang);
            generateDoc(caseId);
        } catch (error) {
            console.error("Failed to save case", error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateStep = (index: number, field: string, value: any) => {
        const updatedSteps = [...testCase.steps];
        updatedSteps[index] = { ...updatedSteps[index], [field]: value };
        setTestCase({ ...testCase, steps: updatedSteps });
    };

    const removeStep = (index: number) => {
        const updatedSteps = testCase.steps.filter((_: any, i: number) => i !== index);
        setTestCase({ ...testCase, steps: updatedSteps });
    };

    if (loading) return <div>Loading scenario details...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl hover:bg-white shadow-sm border-none bg-white">
                        <ArrowLeft className="w-4 h-4 text-slate-400" />
                    </Button>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                            {testCase?.name}
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase">Active Scenario</Badge>
                        </h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{testCase?.description || "No description provided"}</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <Button variant="ghost" className="h-10 rounded-xl px-4 text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border-none bg-white font-black text-[10px] uppercase">
                        <FileDown className="w-4 h-4 mr-2" /> Export
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="h-10 rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 font-black text-[10px] uppercase flex-1 lg:flex-none">
                        <Save className="w-4 h-4 mr-2" /> Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 space-y-6">
                    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-slate-100/50 pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-indigo-500" /> Instruction Set
                                </CardTitle>
                                <Button size="sm" onClick={handleAddStep} className="h-8 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-all font-black text-[9px] uppercase shadow-inner border-none group">
                                    <Plus className="w-3.5 h-3.5 mr-2" /> Insert Step
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[calc(100vh-420px)] p-6">
                                <div className="space-y-4">
                                    {testCase.steps.map((step: any, idx: number) => (
                                        <div key={step.id} className="relative flex gap-4 animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[11px] font-black z-10 shadow-lg">
                                                    {idx + 1}
                                                </div>
                                                {idx < testCase.steps.length - 1 && (
                                                    <div className="w-[2px] h-full bg-slate-100 mt-2 mb-2" />
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-3 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="space-y-1.5 col-span-1">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Action</label>
                                                        <select value={step.action} onChange={(e) => updateStep(idx, 'action', e.target.value)} className="w-full h-10 px-3 rounded-xl bg-white border-none shadow-sm text-[11px] font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500/20 outline-none">
                                                            <option value="CLICK">CLICK</option>
                                                            <option value="TYPE">TYPE</option>
                                                            <option value="WAIT">WAIT</option>
                                                            <option value="ASSERT_VISIBLE">ASSERT VISIBLE</option>
                                                            <option value="SCROLL">SCROLL</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5 col-span-1">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Strategy</label>
                                                        <select value={step.target_type} onChange={(e) => updateStep(idx, 'target_type', e.target.value)} className="w-full h-10 px-3 rounded-xl bg-white border-none shadow-sm text-[11px] font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500/20 outline-none">
                                                            <option value="id">ID</option>
                                                            <option value="xpath">XPATH</option>
                                                            <option value="text">TEXT</option>
                                                            <option value="css">CSS</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5 col-span-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Locator</label>
                                                        <div className="relative group">
                                                            <Input value={step.target_value} onChange={(e) => updateStep(idx, 'target_value', e.target.value)} className="h-10 pr-10 border-none bg-white shadow-sm rounded-xl text-[11px] font-black placeholder:text-slate-300" placeholder="com.app:id/button_proceed" />
                                                            <MousePointer2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                                {step.action === 'TYPE' && (
                                                    <div className="space-y-1.5 animate-in fade-in duration-300">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Input Data</label>
                                                        <div className="relative">
                                                            <Input value={step.input_value} onChange={(e) => updateStep(idx, 'input_value', e.target.value)} className="h-10 pr-10 border-none bg-white shadow-sm rounded-xl text-[11px] font-black placeholder:text-slate-300" placeholder="admin@zenit.qa" />
                                                            <Box className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-end pt-1">
                                                    <Button variant="ghost" size="sm" onClick={() => removeStep(idx)} className="h-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[9px] font-black uppercase">
                                                        <Trash2 className="w-3 h-3 mr-1.5" /> Remove Step
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {testCase.steps.length === 0 && (
                                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
                                            <Zap className="w-12 h-12 mb-4 text-slate-300" />
                                            <p className="text-[11px] font-black uppercase tracking-widest">Awaiting sequence initialization</p>
                                            <p className="text-[9px] font-bold mt-1">Insert your first command to begin automation</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <Tabs defaultValue="output" className="w-full">
                        <TabsList className="w-full h-11 bg-white/50 backdrop-blur-md p-1 rounded-2xl shadow-sm gap-1 border border-slate-100/50">
                            <TabsTrigger value="output" className="flex-1 rounded-xl h-9 text-[10px] font-black uppercase data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Quantum Code</TabsTrigger>
                            <TabsTrigger value="docs" className="flex-1 rounded-xl h-9 text-[10px] font-black uppercase data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Spec Docs</TabsTrigger>
                        </TabsList>

                        <TabsContent value="output" className="mt-4 animate-in zoom-in-95 duration-300">
                            <Card className="border-none shadow-sm bg-slate-950 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                                <CardHeader className="border-b border-white/5 pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                                        </div>
                                        <div className="flex gap-3">
                                            <select value={lang} onChange={(e) => { setLang(e.target.value); generateScript(caseId, e.target.value); }} className="bg-transparent text-[10px] font-black text-slate-400 uppercase border-none outline-none focus:text-indigo-400 transition-colors">
                                                <option value="PYTHON">Python</option>
                                                <option value="JAVA">Java</option>
                                                <option value="JAVASCRIPT">JavaScript</option>
                                            </select>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        <pre className="p-6 text-[12px] font-mono leading-relaxed text-indigo-100 selection:bg-indigo-500/30">
                                            <code>{script || "// Synchronizing quantum cores..."}</code>
                                        </pre>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="docs" className="mt-4 animate-in zoom-in-95 duration-300">
                            <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden shadow-xl">
                                <CardHeader className="border-b border-slate-100 pb-3">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Functional Specification</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        <div className="p-6 prose prose-slate prose-sm max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight font-serif text-slate-800">
                                            {doc ? (
                                                <div dangerouslySetInnerHTML={{ __html: doc.replace(/\n/g, '<br/>') }} />
                                            ) : "Generating report..."}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    <Card className="border-none shadow-sm bg-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-white/20">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest">Active Verification</span>
                            </div>
                            <h3 className="text-xl font-black mb-2 uppercase leading-none">Automated Inspector</h3>
                            <p className="text-[11px] text-indigo-100 font-medium mb-6 leading-relaxed opacity-80">Sync with ADB to capture live elements and map them directly to this scenario.</p>
                            <Button
                                onClick={() => router.push(`/dashboard/vision?caseId=${caseId}`)}
                                className="w-full h-11 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all hover:scale-105 active:scale-95"
                            >
                                <Play className="w-4 h-4 mr-2" fill="currentColor" /> Launch Vision Stream
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
