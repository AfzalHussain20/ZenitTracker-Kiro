"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Smartphone, Search, Play, StopCircle, RefreshCw, Settings,
    ChevronRight, ChevronDown, Layers, MousePointer2, Type,
    Camera, Copy, Trash2, Plus, FileCode, FileText, Terminal,
    Download, CheckCircle2, XCircle, Clock, Activity, Zap,
    Monitor, Eye, Box, Layout, ShieldCheck, Info, Save,
    ArrowLeft, ChevronLeft, Tablet, RotateCw, Home,
    GripVertical, Code2, BookOpen, PlayCircle, MoreHorizontal,
    Wifi, WifiOff, AlertCircle, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trackerApi } from '@/lib/tracker-api';
import { VisionAction } from '@/types/vision';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// ═══════════════════════════════════════════════════
// TREE NODE - Element hierarchy
// ═══════════════════════════════════════════════════
const TreeNode = ({ node, level = 0, selectedId, onSelect, search }: any) => {
    const [open, setOpen] = useState(level < 2);
    const kids = node.children?.length > 0;
    const sel = selectedId === node.id;
    const label = node.name || node.type?.split('.').pop() || 'Element';
    const sub = node.attributes?.text || node.attributes?.resourceId || '';

    const iconForType = (t: string) => {
        const s = t?.toLowerCase() || '';
        if (s.includes('button')) return <MousePointer2 className="w-3.5 h-3.5" />;
        if (s.includes('text') || s.includes('edit')) return <Type className="w-3.5 h-3.5" />;
        if (s.includes('image')) return <Camera className="w-3.5 h-3.5" />;
        if (s.includes('layout') || s.includes('view')) return <Layout className="w-3.5 h-3.5" />;
        return <Layers className="w-3.5 h-3.5" />;
    };

    if (!node) return null;
    return (
        <div>
            <div
                className={`flex items-center gap-1 py-[5px] px-2 cursor-pointer rounded-[4px] text-[12px] transition-colors ${sel ? 'bg-[#0078D4] text-white' : 'hover:bg-[#E8E8E8]'}`}
                style={{ paddingLeft: `${level * 14 + 6}px` }}
                onClick={() => onSelect(node)}
            >
                {kids ? (
                    <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5">
                        {open ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
                    </button>
                ) : <div className="w-4" />}
                <span className={sel ? 'text-white/80' : 'text-[#616161]'}>{iconForType(node.type)}</span>
                <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-semibold truncate text-[12px]">{label}</span>
                    {sub && <span className={`text-[10px] truncate ${sel ? 'text-white/70' : 'text-[#999]'}`}>{sub}</span>}
                </div>
            </div>
            {kids && open && (
                <div>{node.children.map((c: any, i: number) => (
                    <TreeNode key={`${c.id}-${i}`} node={c} level={level + 1} selectedId={selectedId} onSelect={onSelect} search={search} />
                ))}</div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════
// PROPERTY ROW
// ═══════════════════════════════════════════════════
const PropRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-[6px] px-3 border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] group">
        <span className="text-[11px] font-semibold text-[#666] uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1.5 max-w-[55%]">
            <span className="text-[11px] text-[#1A1A1A] font-medium truncate font-mono">{value || '—'}</span>
            {value && (
                <button onClick={() => navigator.clipboard.writeText(value)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#E0E0E0] rounded transition-opacity">
                    <Copy className="w-3 h-3 text-[#999]" />
                </button>
            )}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════
// LOCATOR CHIP
// ═══════════════════════════════════════════════════
const LocatorChip = ({ type, value, score }: any) => (
    <div className="flex items-center justify-between p-2 bg-white border border-[#E5E5E5] rounded-md hover:border-[#0078D4] transition-colors group">
        <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-[#1A1A1A] text-white uppercase tracking-wider">{type}</span>
                <span className={`text-[10px] font-bold ${score >= 90 ? 'text-[#107C10]' : score >= 70 ? 'text-[#C19C00]' : 'text-[#D13438]'}`}>{score}%</span>
            </div>
            <p className="text-[10px] font-mono text-[#666] truncate">{value}</p>
        </div>
        <button onClick={() => navigator.clipboard.writeText(value)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#F0F0F0] rounded">
            <Copy className="w-3 h-3 text-[#999]" />
        </button>
    </div>
);

// ═══════════════════════════════════════════════════
// ELEMENT OVERLAY on device screen
// ═══════════════════════════════════════════════════
const Overlays = ({ node, onSelect, selectedId }: any) => {
    if (!node) return null;
    const b = node.attributes?.bounds;
    const style = b ? {
        left: `${(b.x / 1440) * 100}%`, top: `${(b.y / 2880) * 100}%`,
        width: `${(b.width / 1440) * 100}%`, height: `${(b.height / 2880) * 100}%`
    } : { display: 'none' as const };

    return (
        <>
            {b && (
                <div
                    className={`absolute border cursor-crosshair z-[55] transition-colors ${selectedId === node.id ? 'border-[#0078D4] bg-[#0078D4]/10' : 'border-transparent hover:border-[#0078D4]/50 hover:bg-[#0078D4]/5'}`}
                    style={style}
                    onClick={(e) => { e.stopPropagation(); onSelect(node); }}
                />
            )}
            {node.children?.map((c: any) => <Overlays key={c.id} node={c} onSelect={onSelect} selectedId={selectedId} />)}
        </>
    );
};

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════
export default function ZenitVisionPage() {
    const { toast } = useToast();

    // Device state
    const [deviceState, setDeviceState] = useState<'DISCONNECTED' | 'CONNECTED'>('DISCONNECTED');
    const [deviceId, setDeviceId] = useState('');
    const [availableDevices, setAvailableDevices] = useState<string[]>([]);
    const [deviceModel, setDeviceModel] = useState('');
    const [currentPackage, setCurrentPackage] = useState('');
    const [platform, setPlatform] = useState<'android' | 'ios'>('android');

    // Inspector state
    const [hierarchy, setHierarchy] = useState<any>(null);
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [treeSearch, setTreeSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Panel visibility
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);

    // Recorder
    const [isRecording, setIsRecording] = useState(false);
    const [actions, setActions] = useState<VisionAction[]>([]);

    // Script
    const [scriptLang, setScriptLang] = useState('python');
    const [generatedScript, setGeneratedScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Runner
    const [runLogs, setRunLogs] = useState<string[]>([]);
    const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');

    // Docs
    const [generatedDoc, setGeneratedDoc] = useState('');

    // Suites (for linking)
    const [suites, setSuites] = useState<any[]>([]);
    const [cases, setCases] = useState<any[]>([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState('');
    const [selectedCaseId, setSelectedCaseId] = useState('');

    // Right panel tab
    const [rightTab, setRightTab] = useState('inspector');

    // ─── FETCH DEVICE CAPTURE ───
    const fetchCapture = useCallback(async (specificDeviceId?: string | any) => {
        const idToFetch = typeof specificDeviceId === 'string' ? specificDeviceId : deviceId;
        setIsLoading(true);
        try {
            const url = idToFetch ? `/api/vision/capture?deviceId=${idToFetch}` : '/api/vision/capture';
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                setHierarchy(data.hierarchy);
                setScreenshotUrl(data.screenshotUrl);
                setDeviceId(data.deviceId);
                setAvailableDevices(data.devices || []);
                setDeviceModel(data.deviceModel || 'Unknown Device');
                setCurrentPackage(data.currentPackage || '');
                setDeviceState('CONNECTED');
            } else {
                setDeviceState('DISCONNECTED');
            }
        } catch {
            setDeviceState('DISCONNECTED');
        } finally {
            setIsLoading(false);
        }
    }, [deviceId]);

    useEffect(() => { fetchCapture(); }, [fetchCapture]);

    // ─── FETCH SUITES & CASES ───
    useEffect(() => {
        trackerApi.getSuites().then(r => setSuites(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (selectedSuiteId) {
            trackerApi.getCases(selectedSuiteId).then(r => setCases(r.data)).catch(() => { });
        }
    }, [selectedSuiteId]);

    // ─── RECORD ACTION ───
    const recordAction = (type: string, desc: string) => {
        if (!isRecording) return;
        const a: VisionAction = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            type: type as any,
            locator: selectedElement ? {
                accessibilityId: selectedElement.attributes?.contentDesc,
                resourceId: selectedElement.attributes?.resourceId,
                xpath: selectedElement.type ? `//${selectedElement.type.split('.').pop()}[@resource-id='${selectedElement.attributes?.resourceId}']` : undefined,
                text: selectedElement.attributes?.text
            } : {},
            description: selectedElement ? `${desc} '${selectedElement.name || selectedElement.attributes?.text || 'Element'}'` : desc,
            elementId: selectedElement?.attributes?.resourceId || selectedElement?.id,
            componentName: selectedElement?.name || selectedElement?.type?.split('.').pop() || 'Element',
        };
        setActions(prev => [...prev, a]);
    };

    // ─── GENERATE SCRIPT ───
    const generateScript = async () => {
        if (!selectedCaseId) {
            // Generate from recorded actions
            if (actions.length === 0) return;
            setIsGenerating(true);
            let s = `from appium import webdriver\n`;
            s += `from appium.options.common.base import AppiumOptions\n`;
            s += `from appium.webdriver.common.appiumby import AppiumBy\n\n`;
            s += `# Zenit Vision — Auto-Generated Appium Script\n`;
            s += `options = AppiumOptions()\n`;
            s += `options.load_capabilities({\n`;
            s += `    "platformName": "${platform}",\n`;
            s += `    "appium:deviceName": "${deviceModel || 'Android Device'}",\n`;
            if (deviceId) {
                s += `    "appium:udid": "${deviceId}",\n`;
            }
            s += `    "appium:automationName": "UiAutomator2",\n`;
            s += `    "appium:ensureWebviewsHavePages": True,\n`;
            s += `    "appium:nativeWebScreenshot": True,\n`;
            s += `    "appium:newCommandTimeout": 3600,\n`;
            s += `    "appium:connectHardwareKeyboard": True\n`;
            s += `})\n\n`;
            s += `driver = webdriver.Remote("http://127.0.0.1:4723", options=options)\n\n`;
            s += `try:\n`;

            actions.forEach((a, i) => {
                const loc = a.locator?.resourceId || a.locator?.accessibilityId || a.locator?.text || 'element';
                let byField = "AppiumBy.XPATH";
                let locatorVal = `//*[@text="${loc}"]`;

                if (a.locator?.resourceId) {
                    byField = "AppiumBy.ID";
                    locatorVal = a.locator.resourceId;
                } else if (a.locator?.accessibilityId) {
                    byField = "AppiumBy.ACCESSIBILITY_ID";
                    locatorVal = a.locator.accessibilityId;
                } else if (a.locator?.xpath) {
                    byField = "AppiumBy.XPATH";
                    locatorVal = a.locator.xpath;
                }

                s += `    # Step ${i + 1}: ${a.description}\n`;
                if (a.type === 'CLICK') s += `    driver.find_element(${byField}, '${locatorVal}').click()\n\n`;
                else if (a.type === 'TYPE') s += `    driver.find_element(${byField}, '${locatorVal}').send_keys("${a.value || ''}")\n\n`;
                else s += `    # ${a.type} action on ${loc}\n\n`;
            });
            s += `finally:\n`;
            s += `    driver.quit()\n`;
            setGeneratedScript(s);
            setIsGenerating(false);
            return;
        }
        setIsGenerating(true);
        try {
            const res = await trackerApi.generateScript(selectedCaseId, scriptLang);
            setGeneratedScript(res.data.script);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate script' });
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── RUN EXECUTION ───
    const runExecution = async () => {
        if (!selectedCaseId) {
            toast({ variant: 'destructive', title: 'Select a test case', description: 'Pick a suite and case first.' });
            return;
        }
        setRunStatus('running');
        setRunLogs(['> INITIALIZING EXECUTION ENGINE...', `> Device: ${deviceModel}`, `> Platform: ${platform.toUpperCase()}`]);
        try {
            const res = await trackerApi.runExecution(selectedCaseId);
            const exec = res.data;
            const logs = exec.logs?.map((l: any) => `[${l.level.toUpperCase()}] ${l.message}`) || [];
            setRunLogs(prev => [...prev, ...logs]);
            setRunStatus(exec.status === 'passed' ? 'passed' : 'failed');
            toast({ title: exec.status === 'passed' ? '✅ Passed' : '❌ Failed', description: `${exec.steps_passed}/${exec.total_steps} steps passed` });
        } catch {
            setRunStatus('failed');
            setRunLogs(prev => [...prev, '[ERROR] Execution failed']);
        }
    };

    // ─── GENERATE DOCS ───
    const generateDocs = async () => {
        if (!selectedCaseId) return;
        try {
            const res = await trackerApi.generateDoc(selectedCaseId);
            setGeneratedDoc(res.data.content);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate docs' });
        }
    };

    // ─── SAVE ACTIONS TO CASE ───
    const saveActionsToCase = async () => {
        if (!selectedCaseId || actions.length === 0) return;
        const steps = actions.map((a, i) => ({
            id: a.id,
            action: a.type.toLowerCase(),
            target_type: a.locator?.accessibilityId ? 'accessibilityId' : a.locator?.resourceId ? 'resourceId' : 'xpath',
            target_value: a.locator?.accessibilityId || a.locator?.resourceId || a.locator?.xpath || '',
            input_value: a.value || '',
            expected_result: a.description,
            order: i + 1
        }));
        try {
            await trackerApi.updateCase(selectedCaseId, { steps });
            toast({ title: 'Saved', description: 'Steps synced to test case.' });
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save.' });
        }
    };

    const boundsStyle = (n: any) => {
        if (!n?.attributes?.bounds) return { display: 'none' as const };
        const { x, y, width, height } = n.attributes.bounds;
        return { left: `${(x / 1440) * 100}%`, top: `${(y / 2880) * 100}%`, width: `${(width / 1440) * 100}%`, height: `${(height / 2880) * 100}%` };
    };

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-screen bg-[#F3F3F3] text-[#1A1A1A] font-[system-ui,-apple-system,'Segoe_UI',sans-serif] overflow-hidden select-none">

            {/* ════════ TOOLBAR ════════ */}
            <div className="h-12 shrink-0 flex items-center justify-between px-4 bg-white border-b border-[#E5E5E5]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-[#0078D4] flex items-center justify-center">
                            <Smartphone className="w-4 h-4 text-white" />
                        </div>
                        <div className="leading-tight">
                            <h1 className="text-[13px] font-bold text-[#1A1A1A]">Zenit Vision</h1>
                            <p className="text-[10px] text-[#999]">{currentPackage || 'Not connected'}</p>
                        </div>
                    </div>
                    <Separator orientation="vertical" className="h-6 bg-[#E5E5E5] mx-1" />
                    <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${deviceState === 'CONNECTED' ? 'bg-[#107C10]' : 'bg-[#D13438]'}`} />
                        {availableDevices.length > 1 ? (
                            <Select value={deviceId} onValueChange={(v) => fetchCapture(v)}>
                                <SelectTrigger className="h-6 text-[11px] font-semibold text-[#666] border-none bg-transparent px-1 min-w-[120px]">
                                    <SelectValue placeholder="Select Device" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDevices.map(d => <SelectItem key={d} value={d} className="text-[11px]">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-[11px] font-semibold text-[#666]">{deviceModel || 'No Device'}</span>
                        )}
                    </div>
                    <Separator orientation="vertical" className="h-6 bg-[#E5E5E5] mx-1" />
                    <div className="flex items-center border border-[#E5E5E5] rounded overflow-hidden">
                        <button onClick={() => setPlatform('android')} className={`px-2.5 py-1 text-[10px] font-bold ${platform === 'android' ? 'bg-[#0078D4] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F5]'}`}>Android</button>
                        <button onClick={() => setPlatform('ios')} className={`px-2.5 py-1 text-[10px] font-bold ${platform === 'ios' ? 'bg-[#0078D4] text-white' : 'bg-white text-[#666] hover:bg-[#F5F5F5]'}`}>iOS</button>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Suite selector */}
                    <Select value={selectedSuiteId} onValueChange={(v) => { setSelectedSuiteId(v); setSelectedCaseId(''); }}>
                        <SelectTrigger className="h-7 w-[160px] text-[11px] border-[#E5E5E5] bg-white">
                            <SelectValue placeholder="Select Suite" />
                        </SelectTrigger>
                        <SelectContent>{suites.map(s => <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                        <SelectTrigger className="h-7 w-[160px] text-[11px] border-[#E5E5E5] bg-white">
                            <SelectValue placeholder="Select Case" />
                        </SelectTrigger>
                        <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id} className="text-[11px]">{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6 bg-[#E5E5E5] mx-1" />
                    <Button variant={isRecording ? 'destructive' : 'outline'} size="sm" onClick={() => setIsRecording(!isRecording)} className={`h-7 text-[10px] font-bold gap-1.5 ${!isRecording ? 'border-[#E5E5E5]' : ''}`}>
                        {isRecording ? <StopCircle className="w-3 h-3" /> : <div className="w-2.5 h-2.5 rounded-full bg-[#D13438]" />}
                        {isRecording ? 'Stop' : 'Record'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchCapture} disabled={isLoading} className="h-7 w-7 p-0 border-[#E5E5E5]">
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0078D4]' : 'text-[#666]'}`} />
                    </Button>
                </div>
            </div>

            {/* ════════ MAIN CONTENT ════════ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ──── LEFT: ELEMENT TREE ──── */}
                {leftOpen && (
                    <div className="w-[280px] shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col">
                        <div className="h-8 flex items-center justify-between px-3 bg-[#F8F8F8] border-b border-[#E5E5E5]">
                            <span className="text-[11px] font-bold text-[#666] uppercase tracking-wide">Element Tree</span>
                            <button onClick={() => setLeftOpen(false)} className="p-0.5 hover:bg-[#E0E0E0] rounded"><ChevronLeft className="w-3.5 h-3.5 text-[#999]" /></button>
                        </div>
                        <div className="p-2 border-b border-[#E5E5E5]">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
                                <Input value={treeSearch} onChange={e => setTreeSearch(e.target.value)} placeholder="Filter elements..." className="h-7 pl-7 text-[11px] bg-[#F8F8F8] border-[#E5E5E5]" />
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="py-1">
                                {hierarchy ? (
                                    <TreeNode node={hierarchy} selectedId={selectedElement?.id} onSelect={setSelectedElement} search={treeSearch} />
                                ) : (
                                    <div className="flex flex-col items-center py-16 opacity-30">
                                        <Layers className="w-8 h-8 mb-2" />
                                        <span className="text-[11px] font-semibold">No hierarchy</span>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {!leftOpen && (
                    <button onClick={() => setLeftOpen(true)} className="w-6 shrink-0 bg-white border-r border-[#E5E5E5] flex items-center justify-center hover:bg-[#F5F5F5]">
                        <ChevronRight className="w-3.5 h-3.5 text-[#999]" />
                    </button>
                )}

                {/* ──── CENTER: DEVICE PREVIEW ──── */}
                <div className="flex-1 flex flex-col items-center justify-center bg-[#F3F3F3] relative overflow-hidden">
                    {/* Quick controls */}
                    <div className="absolute top-3 z-50 flex items-center gap-1 p-1 bg-white border border-[#E5E5E5] rounded-md shadow-sm">
                        {[
                            { icon: <Home className="w-3.5 h-3.5" />, label: 'Home', action: () => recordAction('CLICK', 'Press Home') },
                            { icon: <ArrowLeft className="w-3.5 h-3.5" />, label: 'Back', action: () => recordAction('CLICK', 'Press Back') },
                            { icon: <RotateCw className="w-3.5 h-3.5" />, label: 'Rotate', action: undefined },
                            null,
                            { icon: <RefreshCw className="w-3.5 h-3.5" />, label: 'Refresh', action: fetchCapture },
                            { icon: <Camera className="w-3.5 h-3.5" />, label: 'Screenshot', action: undefined },
                        ].map((item, i) => item === null ? (
                            <Separator key={i} orientation="vertical" className="h-4 bg-[#E5E5E5]" />
                        ) : (
                            <button key={i} onClick={item.action} disabled={isLoading} className="p-1.5 hover:bg-[#E8E8E8] rounded text-[#666] hover:text-[#0078D4] transition-colors" title={item.label}>
                                {item.icon}
                            </button>
                        ))}
                    </div>

                    {/* Device frame */}
                    <div className="relative h-full flex items-center justify-center py-12">
                        <div className="relative aspect-[9/19.5] h-full max-h-[780px] bg-[#1A1A1A] rounded-[2.5rem] shadow-xl border-[10px] border-[#2A2A2A] overflow-hidden">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#1A1A1A] rounded-b-xl z-30" />
                            {/* Screen */}
                            <div className="w-full h-full relative bg-black">
                                {screenshotUrl ? (
                                    <>
                                        <img src={screenshotUrl} alt="Device" className="w-full h-full object-contain pointer-events-none" />
                                        {selectedElement?.attributes?.bounds && (
                                            <div className="absolute border-2 border-[#0078D4] bg-[#0078D4]/10 z-[60] pointer-events-none rounded-sm" style={boundsStyle(selectedElement)} />
                                        )}
                                        <div className="absolute inset-0 z-50">
                                            {hierarchy && <Overlays node={hierarchy} onSelect={setSelectedElement} selectedId={selectedElement?.id} />}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-25">
                                        <Smartphone className="w-10 h-10 text-white" />
                                        <span className="text-[11px] font-bold text-white uppercase tracking-wider">No Device Stream</span>
                                        <Button variant="outline" size="sm" className="text-[10px] border-white/30 text-white/60 hover:text-white" onClick={fetchCapture}>Connect</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {isRecording && (
                            <div className="absolute top-4 right-4 z-40">
                                <Badge className="bg-[#D13438] text-white border-none text-[10px] font-bold px-2 animate-pulse">● REC</Badge>
                            </div>
                        )}
                    </div>
                </div>

                {/* ──── RIGHT: TABBED PANEL ──── */}
                {rightOpen && (
                    <div className="w-[340px] shrink-0 bg-white border-l border-[#E5E5E5] flex flex-col overflow-hidden">
                        <Tabs value={rightTab} onValueChange={setRightTab} className="flex-1 flex flex-col overflow-hidden">
                            <div className="border-b border-[#E5E5E5] bg-[#F8F8F8]">
                                <TabsList className="w-full bg-transparent h-9 gap-0 p-0 rounded-none">
                                    {[
                                        { v: 'inspector', l: 'Inspector', ic: <Eye className="w-3 h-3" /> },
                                        { v: 'recorder', l: 'Recorder', ic: <PlayCircle className="w-3 h-3" /> },
                                        { v: 'script', l: 'Script', ic: <Code2 className="w-3 h-3" /> },
                                        { v: 'runner', l: 'Runner', ic: <Terminal className="w-3 h-3" /> },
                                        { v: 'docs', l: 'Docs', ic: <BookOpen className="w-3 h-3" /> },
                                    ].map(t => (
                                        <TabsTrigger key={t.v} value={t.v} className="flex-1 h-9 rounded-none text-[10px] font-bold gap-1 border-b-2 border-transparent data-[state=active]:border-[#0078D4] data-[state=active]:text-[#0078D4] data-[state=active]:bg-white">
                                            {t.ic}{t.l}{t.v === 'recorder' && actions.length > 0 && <span className="ml-0.5 text-[9px] bg-[#D13438] text-white rounded-full w-4 h-4 flex items-center justify-center">{actions.length}</span>}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>

                            {/* ── INSPECTOR TAB ── */}
                            <TabsContent value="inspector" className="flex-1 m-0 overflow-auto">
                                {selectedElement ? (
                                    <ScrollArea className="h-full">
                                        <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-6 h-6 rounded bg-[#0078D4] flex items-center justify-center"><Box className="w-3 h-3 text-white" /></div>
                                                <div>
                                                    <p className="text-[10px] text-[#999] font-semibold">Selected</p>
                                                    <p className="text-[12px] font-bold">{selectedElement.name || selectedElement.type?.split('.').pop()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5 mt-2">
                                                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 border-[#E5E5E5]" onClick={() => { recordAction('CLICK', 'Click'); setRightTab('recorder'); }}>
                                                    <MousePointer2 className="w-2.5 h-2.5 mr-1" />Click
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 border-[#E5E5E5]" onClick={() => { recordAction('TYPE', 'Type into'); setRightTab('recorder'); }}>
                                                    <Type className="w-2.5 h-2.5 mr-1" />Type
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-6 text-[10px] border-[#E5E5E5]" onClick={() => { recordAction('ASSERT_VISIBLE', 'Assert visible'); setRightTab('recorder'); }}>
                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Properties */}
                                        <div className="border-b border-[#E5E5E5]">
                                            <div className="px-3 py-2 bg-[#F8F8F8]"><span className="text-[10px] font-bold text-[#666] uppercase">Properties</span></div>
                                            <PropRow label="Class" value={selectedElement.type} />
                                            <PropRow label="Name" value={selectedElement.name} />
                                            <PropRow label="Text" value={selectedElement.attributes?.text} />
                                            <PropRow label="Resource ID" value={selectedElement.attributes?.resourceId} />
                                            <PropRow label="Content Desc" value={selectedElement.attributes?.contentDesc} />
                                            <PropRow label="Package" value={selectedElement.attributes?.package} />
                                            <PropRow label="Clickable" value={selectedElement.attributes?.clickable?.toString()} />
                                            <PropRow label="Enabled" value={selectedElement.attributes?.enabled?.toString()} />
                                            <PropRow label="Bounds" value={selectedElement.attributes?.bounds ? `[${selectedElement.attributes.bounds.x},${selectedElement.attributes.bounds.y}][${selectedElement.attributes.bounds.width}x${selectedElement.attributes.bounds.height}]` : ''} />
                                        </div>
                                        {/* Locators */}
                                        <div>
                                            <div className="px-3 py-2 bg-[#F8F8F8]"><span className="text-[10px] font-bold text-[#666] uppercase">Locator Strategies</span></div>
                                            <div className="p-3 space-y-2">
                                                {selectedElement.attributes?.contentDesc && <LocatorChip type="Accessibility ID" value={selectedElement.attributes.contentDesc} score={98} />}
                                                {selectedElement.attributes?.resourceId && <LocatorChip type="Resource ID" value={selectedElement.attributes.resourceId.split('/').pop()} score={95} />}
                                                <LocatorChip type="XPath" value={`//${selectedElement.type?.split('.').pop()}[@resource-id='${selectedElement.attributes?.resourceId || ''}']`} score={65} />
                                            </div>
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30">
                                        <Eye className="w-8 h-8 mb-2" />
                                        <p className="text-[11px] font-bold">Select an element to inspect</p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* ── RECORDER TAB ── */}
                            <TabsContent value="recorder" className="flex-1 m-0 flex flex-col overflow-hidden">
                                <ScrollArea className="flex-1">
                                    <div className="p-3 space-y-1.5">
                                        {actions.map((a, i) => (
                                            <div key={a.id} className="flex items-start gap-2 p-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded group hover:border-[#0078D4] transition-colors">
                                                <span className="text-[10px] font-bold text-[#999] w-5 shrink-0 pt-0.5">{i + 1}</span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1 font-bold border-[#E5E5E5]">{a.type}</Badge>
                                                        <span className="text-[10px] font-mono text-[#666] truncate">{a.elementId}</span>
                                                    </div>
                                                    <p className="text-[10px] text-[#999] truncate">{a.description}</p>
                                                </div>
                                                <button onClick={() => setActions(prev => prev.filter(x => x.id !== a.id))} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#D13438]">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {actions.length === 0 && (
                                            <div className="py-16 text-center opacity-30">
                                                <PlayCircle className="w-8 h-8 mx-auto mb-2" />
                                                <p className="text-[11px] font-bold">No steps recorded</p>
                                                <p className="text-[10px] mt-1">Click Record and interact with the device</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                                <div className="p-3 border-t border-[#E5E5E5] bg-[#FAFAFA] space-y-1.5">
                                    {selectedCaseId && (
                                        <Button size="sm" className="w-full h-8 text-[10px] font-bold bg-[#107C10] hover:bg-[#0E6B0E] text-white" disabled={actions.length === 0} onClick={saveActionsToCase}>
                                            <Save className="w-3 h-3 mr-1.5" />Save to Test Case
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="w-full h-8 text-[10px] font-bold border-[#E5E5E5]" onClick={() => setActions([])}>
                                        <Trash2 className="w-3 h-3 mr-1.5" />Clear All
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* ── SCRIPT TAB ── */}
                            <TabsContent value="script" className="flex-1 m-0 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
                                    <Select value={scriptLang} onValueChange={setScriptLang}>
                                        <SelectTrigger className="h-7 w-[120px] text-[11px] border-[#E5E5E5] bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="python" className="text-[11px]">Python</SelectItem>
                                            <SelectItem value="java" className="text-[11px]">Java</SelectItem>
                                            <SelectItem value="javascript" className="text-[11px]">JavaScript</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button size="sm" className="h-7 text-[10px] font-bold bg-[#0078D4] hover:bg-[#006CBE] text-white flex-1" onClick={generateScript} disabled={isGenerating}>
                                        <Zap className="w-3 h-3 mr-1" />{isGenerating ? 'Generating...' : 'Generate Script'}
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1">
                                    {generatedScript ? (
                                        <div className="relative">
                                            <button onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: 'Copied!' }); }} className="absolute top-2 right-2 p-1.5 bg-white/90 border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] z-10">
                                                <Copy className="w-3 h-3" />
                                            </button>
                                            <pre className="p-3 text-[11px] font-mono text-[#1A1A1A] bg-[#FAFAFA] leading-relaxed whitespace-pre-wrap">{generatedScript}</pre>
                                        </div>
                                    ) : (
                                        <div className="py-16 flex flex-col items-center opacity-30">
                                            <Code2 className="w-8 h-8 mb-2" />
                                            <p className="text-[11px] font-bold">Generate a script</p>
                                            <p className="text-[10px] mt-1">Select a case or record steps first</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            {/* ── RUNNER TAB ── */}
                            <TabsContent value="runner" className="flex-1 m-0 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {runStatus === 'idle' && <div className="w-2 h-2 rounded-full bg-[#999]" />}
                                        {runStatus === 'running' && <div className="w-2 h-2 rounded-full bg-[#0078D4] animate-pulse" />}
                                        {runStatus === 'passed' && <CheckCircle2 className="w-3.5 h-3.5 text-[#107C10]" />}
                                        {runStatus === 'failed' && <XCircle className="w-3.5 h-3.5 text-[#D13438]" />}
                                        <span className="text-[11px] font-bold text-[#666] uppercase">{runStatus}</span>
                                    </div>
                                    <Button size="sm" className="h-7 text-[10px] font-bold bg-[#107C10] hover:bg-[#0E6B0E] text-white" onClick={runExecution} disabled={runStatus === 'running' || !selectedCaseId}>
                                        <Play className="w-3 h-3 mr-1" />Run
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1 bg-[#1E1E1E]">
                                    <div className="p-3 space-y-0.5">
                                        {runLogs.map((l, i) => (
                                            <p key={i} className={`text-[11px] font-mono leading-relaxed ${l.includes('[ERROR]') || l.includes('[FAILED]') ? 'text-[#F48771]' : l.includes('[SUCCESS]') ? 'text-[#89D185]' : 'text-[#D4D4D4]'}`}>{l}</p>
                                        ))}
                                        {runLogs.length === 0 && <p className="text-[11px] font-mono text-[#666]">{/* Ready to execute. Select a test case and click Run. */}</p>}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* ── DOCS TAB ── */}
                            <TabsContent value="docs" className="flex-1 m-0 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
                                    <Button size="sm" className="h-7 text-[10px] font-bold bg-[#0078D4] hover:bg-[#006CBE] text-white flex-1" onClick={generateDocs} disabled={!selectedCaseId}>
                                        <FileText className="w-3 h-3 mr-1" />Generate Documentation
                                    </Button>
                                    {generatedDoc && (
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-[#E5E5E5]" onClick={() => { navigator.clipboard.writeText(generatedDoc); toast({ title: 'Copied!' }); }}>
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                                <ScrollArea className="flex-1">
                                    {generatedDoc ? (
                                        <pre className="p-3 text-[11px] font-mono text-[#1A1A1A] bg-white leading-relaxed whitespace-pre-wrap">{generatedDoc}</pre>
                                    ) : (
                                        <div className="py-16 flex flex-col items-center opacity-30">
                                            <BookOpen className="w-8 h-8 mb-2" />
                                            <p className="text-[11px] font-bold">No documentation yet</p>
                                            <p className="text-[10px] mt-1">Select a case and click generate</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {!rightOpen && (
                    <button onClick={() => setRightOpen(true)} className="w-6 shrink-0 bg-white border-l border-[#E5E5E5] flex items-center justify-center hover:bg-[#F5F5F5]">
                        <ChevronLeft className="w-3.5 h-3.5 text-[#999]" />
                    </button>
                )}
            </div>

            {/* ════════ STATUS BAR ════════ */}
            <div className="h-6 shrink-0 flex items-center justify-between px-4 bg-[#0078D4] text-white text-[10px] font-medium">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> ADB: {deviceState}</span>
                    <span>Device: {deviceId || '—'}</span>
                    <span>Package: {currentPackage || '—'}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>{actions.length} recorded steps</span>
                    <span>{platform.toUpperCase()}</span>
                </div>
            </div>

            <Toaster />
        </div>
    );
}
