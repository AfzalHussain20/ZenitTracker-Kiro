'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/apps/AppShell';
import {
    Layers, Wand2, Activity, Play,
    ChevronRight, Zap, Target, History,
    Settings, Globe, Plus, Search, Filter
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrackerDashboard } from '@/components/automation/TrackerDashboard';
import { TestSuiteManager } from '@/components/automation/TestSuiteManager';
import { TestCaseManager } from '@/components/automation/TestCaseManager';
import { TestCaseDetails } from '@/components/automation/TestCaseDetails';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
    { label: 'Automation Hub', href: '/automation', icon: <Layers className="w-4 h-4" /> },
    { label: 'Zenit Vision Studio', href: '/dashboard/vision', icon: <Target className="w-4 h-4" /> },
    { label: 'Execution Tracker', href: '/automation/tracker', icon: <Activity className="w-4 h-4" /> },
    { label: 'Reports', href: '/automation/reports', icon: <History className="w-4 h-4" /> },
];

export default function AutomationTrackerPage() {
    const [view, setView] = useState('suites'); // suites, cases, details
    const [selectedSuite, setSelectedSuite] = useState<any>(null);
    const [selectedCase, setSelectedCase] = useState<any>(null);

    const renderContent = () => {
        switch (view) {
            case 'suites':
                return <TestSuiteManager onSelectSuite={(id: string, name: string) => {
                    setSelectedSuite({ id, name });
                    setView('cases');
                }} />;
            case 'cases':
                return <TestCaseManager
                    suiteId={selectedSuite.id}
                    suiteName={selectedSuite.name}
                    onBack={() => setView('suites')}
                    onSelectCase={(id: string, name: string) => {
                        setSelectedCase({ id, name });
                        setView('details');
                    }}
                />;
            case 'details':
                return <TestCaseDetails
                    caseId={selectedCase.id}
                    caseTitle={selectedCase.name}
                    onBack={() => setView('cases')}
                />;
            default:
                return null;
        }
    };

    return (
        <AppShell
            appName="Zenit Tracker"
            appIcon={<Wand2 className="w-5 h-5 text-indigo-500" />}
            accentColor="#6366f1"
            navItems={NAV_ITEMS}
            subtitle="Quantum Execution Dashboard"
        >
            <div className="space-y-8 pb-20 font-sans max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                {/* Master Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border/50 pb-8 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-500 rounded-full" />
                        <h1 className="text-4xl font-extrabold tracking-tighter text-slate-900 group">
                            QUANTUM <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent group-hover:from-indigo-400 group-hover:to-purple-500 transition-all duration-700 font-black">TRACKER</span>
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm font-black uppercase tracking-[0.2em] opacity-60">High-Performance Automation Management Matrix</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest flex items-center gap-1.5 mb-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                ADB STREAM ACTIVE
                            </span>
                            <span className="text-[13px] font-black text-slate-900 uppercase">GALAXY S24 ULTRA</span>
                        </div>
                        <Settings className="w-5 h-5 text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-8">
                    <TabsList className="bg-white/40 backdrop-blur-md p-1.5 rounded-2xl shadow-xl shadow-indigo-100/20 border border-white/50 w-full md:w-auto h-14 gap-1">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl h-11 px-8 text-[11px] font-black uppercase tracking-widest">
                            <Activity className="w-4 h-4 mr-2" /> Overview
                        </TabsTrigger>
                        <TabsTrigger value="repository" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl h-11 px-8 text-[11px] font-black uppercase tracking-widest">
                            <Layers className="w-4 h-4 mr-2" /> Collection Repository
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-xl h-11 px-8 text-[11px] font-black uppercase tracking-widest">
                            <History className="w-4 h-4 mr-2" /> History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <TrackerDashboard />
                    </TabsContent>

                    <TabsContent value="repository" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {renderContent()}
                    </TabsContent>

                    <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="py-20 text-center opacity-30">
                            <Activity className="w-16 h-16 mx-auto mb-6 text-slate-300" />
                            <h2 className="text-2xl font-black uppercase tracking-[0.2em]">Data Stream Pending</h2>
                            <p className="text-sm font-bold mt-2">Historical execution logs are being indexed into the quantum database</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            <Toaster />
        </AppShell>
    );
}
