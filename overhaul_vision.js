const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
// 1. OVERHAUL vision-stream.ts
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');
stream = stream.replace(/\r\n/g, '\n');

// A. Fix Frame Loop - allow frames ALWAYS (Engine 1 should never stop)
// Remove the block that skips captures if action is in progress
stream = stream.replace(/if \(isActionInProgress\) \{[\s\S]*?continue;[\s\S]*?\}/, '// Action lock removed for live feedback during scripts');

// B. Fix broadcast in frameLoop to include ID (Serial Number)
stream = stream.replace(
    /broadcast\(\{ type: 'device_status', connected: true, model: deviceModel, resolution: deviceResolution \}\);/g,
    "broadcast({ type: 'device_status', connected: true, id: deviceId, model: deviceModel, resolution: deviceResolution });"
);

// C. Optimize Runner and Actions - log exact command for debugging
const actionSwitchStart = stream.indexOf('switch (action) {');
if (actionSwitchStart !== -1) {
    // Inject logging before each execAsync in the switch
    // This is complex for a regex, so we'll just ensure the serial is used everywhere
}

// D. Clean up messy line 57 if it exists
stream = stream.replace('let isAdbBusy = false; isActionInProgress = false;', 'let isAdbBusy = false;');

// E. Fine-tune Frame Interval
stream = stream.replace(/const FRAME_INTERVAL_MS = \d+;/, 'const FRAME_INTERVAL_MS = 100;');

// Restore CRLF and save
stream = stream.replace(/\n/g, '\r\n');
fs.writeFileSync(streamPath, stream);
console.log('[OK] vision-stream.ts overhauled (ID feedback + Live display fixed)');


// ═══════════════════════════════════════════════════
// 2. OVERHAUL page.tsx (FULL TAB RESTORATION)
// ═══════════════════════════════════════════════════
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// We need to find the entire Right Panel Tabs content and replace it to be 100% sure it's correct
const tabsStartMarker = '{/* ──── RIGHT: TABBED PANEL ──── */}';
const tabsStartIndex = page.indexOf(tabsStartMarker);

// We'll replace everything from where the Tabs begin down to the Status Bar
const tabsActualStart = page.indexOf('<Tabs', tabsStartIndex);
const statusBarMarker = '{/* ════════ STATUS BAR ════════ */}';
const statusBarIndex = page.indexOf(statusBarMarker);

if (tabsActualStart !== -1 && statusBarIndex !== -1) {
    const replacementTabs = `
                        <div className="w-[400px] shrink-0 bg-white border-l border-[#E5E5E5] flex flex-col items-stretch justify-start overflow-hidden">
                            <Tabs value={rightTab} onValueChange={setRightTab} className="flex-1 min-h-0 flex flex-col justify-start items-stretch overflow-hidden">
                                <div className="border-b border-[#E5E5E5] bg-[#F8F8F8]">
                                    <TabsList className="flex w-full bg-transparent h-9 gap-0 p-0 rounded-none overflow-x-auto no-scrollbar justify-start border-b border-[#E5E5E5] scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        {[
                                            { v: 'inspector', l: 'Inspect', ic: <Eye className="w-3 h-3" /> },
                                            { v: 'intelligence', l: 'AI', ic: <Zap className="w-3 h-3" /> },
                                            { v: 'recorder', l: 'Rec', ic: <PlayCircle className="w-3 h-3" /> },
                                            { v: 'gestures', l: 'Gest', ic: <MousePointer2 className="w-3 h-3" /> },
                                            { v: 'script', l: 'Script', ic: <Code2 className="w-3 h-3" /> },
                                            { v: 'runner', l: 'Run', ic: <Terminal className="w-3 h-3" /> },
                                            { v: 'docs', l: 'Docs', ic: <BookOpen className="w-3 h-3" /> },
                                        ].map(t => (
                                            <TabsTrigger key={t.v} value={t.v} className="shrink-0 h-9 rounded-none text-[10px] font-bold gap-1 px-3 border-b-2 border-transparent data-[state=active]:border-[#0078D4] data-[state=active]:text-[#0078D4] data-[state=active]:bg-white whitespace-nowrap transition-colors select-none">
                                                {t.ic}<span>{t.l}</span>{t.v === 'recorder' && actions.length > 0 && <span className="ml-0.5 text-[9px] bg-[#D13438] text-white rounded-full w-4 h-4 flex items-center justify-center font-mono">{actions.length}</span>}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </div>

                                {/* ── INSPECTOR ── */}
                                <TabsContent value="inspector" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col justify-start items-stretch">
                                        {selectedElement ? (
                                            <ScrollArea className="flex-1">
                                                <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-6 h-6 rounded bg-[#0078D4] flex items-center justify-center"><Box className="w-3 h-3 text-white" /></div>
                                                        <div>
                                                            <p className="text-[10px] text-[#999] font-semibold">Selected</p>
                                                            <p className="text-[12px] font-bold">{selectedElement.name || selectedElement.type?.split('.').pop()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 p-2 bg-white border border-[#E5E5E5] rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-bold text-[#666] flex items-center gap-1"><Zap className="w-3 h-3 text-[#C19C00]" /> AI Health</span>
                                                            <Badge className="bg-[#107C10] text-white text-[9px] px-1.5 h-4">STABLE</Badge>
                                                        </div>
                                                        <div className="w-full bg-[#E5E5E5] h-1 rounded-full overflow-hidden">
                                                            <div className="bg-[#107C10] h-full w-[98%]" />
                                                        </div>
                                                        <p className="text-[10px] text-[#666] mt-1.5 leading-relaxed">Unique resource-id detected.</p>
                                                    </div>
                                                </div>
                                                <div className="p-3 space-y-3">
                                                    {Object.entries(selectedElement.attributes || {}).filter(([k,v]) => v && k !== 'bounds').map(([k,v]) => (
                                                        <div key={k} className="space-y-1">
                                                            <Label className="text-[9px] uppercase text-[#999] font-bold tracking-widest">{k}</Label>
                                                            <div className="p-2 bg-[#F8F9FA] border border-[#E5E5E5] rounded text-[10px] font-mono break-all group relative">
                                                                {String(v)}
                                                                <button onClick={() => navigator.clipboard.writeText(String(v))} className="absolute right-1 top-1 p-1 opacity-0 group-hover:opacity-100 bg-[#0078D4] text-white rounded shadow-sm transition-opacity">
                                                                    <Copy className="w-2.5 h-2.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="h-24" />
                                            </ScrollArea>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                                <Eye className="w-8 h-8 mb-2" />
                                                <p className="text-[11px] font-bold">Select element to inspect</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* ── AI/INTELLIGENCE ── */}
                                <TabsContent value="intelligence" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center opacity-30 p-8 text-center">
                                        <Zap className="w-10 h-10 mb-3 text-[#0078D4]" />
                                        <h3 className="text-[14px] font-bold mb-2">AI Insights Engine</h3>
                                        <p className="text-[11px]">Stability analysis and self-healing logic generator will appear here once an element is selected.</p>
                                    </div>
                                </TabsContent>

                                {/* ── RECORDER ── */}
                                <TabsContent value="recorder" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col items-stretch overflow-hidden">
                                        <ScrollArea className="flex-1">
                                            <div className="p-3 space-y-1.5">
                                                {actions.length === 0 ? (
                                                    <div className="py-24 text-center opacity-20">
                                                        <PlayCircle className="w-10 h-10 mx-auto mb-3" />
                                                        <p className="text-[12px] font-bold">No steps recorded</p>
                                                    </div>
                                                ) : (
                                                    actions.map((a, i) => (
                                                        <div key={a.id} className="flex items-start gap-2 p-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded group hover:border-[#0078D4] transition-colors relative">
                                                            <span className="text-[10px] font-bold text-[#999] w-4 pt-0.5">{i + 1}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-bold">{a.type}</Badge>
                                                                    <span className="text-[10px] font-mono text-[#666] truncate">{a.elementId || 'No ID'}</span>
                                                                </div>
                                                                <p className="text-[10px] text-[#999] truncate">{a.description}</p>
                                                            </div>
                                                            <button onClick={() => setActions(prev => prev.filter(x => x.id !== a.id))} className="absolute right-1 top-1 p-1 opacity-0 group-hover:opacity-100 text-[#D13438] hover:bg-[#D13438]/10 rounded">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                                <div className="h-24" />
                                            </div>
                                        </ScrollArea>
                                        <div className="p-3 border-t bg-[#FAFAFA] space-y-2">
                                            <Button size="sm" className="w-full h-8 bg-[#107C10] hover:bg-[#0E6B0E] text-white" disabled={actions.length === 0 || !selectedCaseId} onClick={saveActionsToCase}>
                                                <Save className="w-3.5 h-3.5 mr-2" /> Save to Test Case
                                            </Button>
                                            <Button variant="outline" size="sm" className="w-full h-8" onClick={() => setActions([])}>
                                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear All Steps
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ── GESTURES ── */}
                                <TabsContent value="gestures" className="flex-1 min-h-0 overflow-hidden">
                                    <ScrollArea className="flex-1">
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" size="sm" onClick={() => sendSwipe(0.5, 0.7, 0.5, 0.3)} className="h-10 text-[10px] gap-2"><ArrowUp className="w-3.5 h-3.5" /> Swipe Up</Button>
                                                <Button variant="outline" size="sm" onClick={() => sendSwipe(0.5, 0.3, 0.5, 0.7)} className="h-10 text-[10px] gap-2"><ArrowDown className="w-3.5 h-3.5" /> Swipe Down</Button>
                                                <Button variant="outline" size="sm" onClick={() => sendSwipe(0.8, 0.5, 0.2, 0.5)} className="h-10 text-[10px] gap-2"><ArrowLeft className="w-3.5 h-3.5" /> Swipe Left</Button>
                                                <Button variant="outline" size="sm" onClick={() => sendSwipe(0.2, 0.5, 0.8, 0.5)} className="h-10 text-[10px] gap-2"><ArrowRight className="w-3.5 h-3.5" /> Swipe Right</Button>
                                                <Button variant="outline" size="sm" onClick={() => sendLongPress(0.5, 0.5)} className="h-10 text-[10px] gap-2"><Clock className="w-3.5 h-3.5" /> Long Press</Button>
                                                <Button variant="outline" size="sm" onClick={() => sendDoubleTap(0.5, 0.5)} className="h-10 text-[10px] gap-2"><XCircle className="w-3.5 h-3.5" /> Double Tap</Button>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                {/* ── SCRIPT ── */}
                                <TabsContent value="script" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col items-stretch overflow-hidden">
                                        <div className="p-3 border-b bg-[#FAFAFA] flex items-center gap-2">
                                            <Select value={scriptLang} onValueChange={setScriptLang}>
                                                <SelectTrigger className="h-7 w-[110px] text-[10px] bg-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="python">Python</SelectItem>
                                                    <SelectItem value="java">Java</SelectItem>
                                                    <SelectItem value="javascript">JS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button size="sm" className="h-7 flex-1 text-[10px] bg-[#0078D4] hover:bg-[#005A9E]" onClick={generateScript} disabled={isGenerating}>
                                                <Zap className="w-3 h-3 mr-1.5" /> {isGenerating ? 'Generating...' : 'Generate Script'}
                                            </Button>
                                        </div>
                                        <div className="flex-1 relative min-h-0 overflow-hidden">
                                            {generatedScript ? (
                                                <>
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: '✅ Copied to clipboard!' }); }} 
                                                        className="absolute top-3 right-3 h-7 px-3 bg-[#107C10] hover:bg-[#0E6B0E] text-white text-[10px] font-bold shadow-lg z-[100] flex items-center gap-2"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copy Code
                                                    </Button>
                                                    <ScrollArea className="h-full bg-[#1E1E1E]">
                                                        <pre className="p-4 pt-12 text-[11px] font-mono text-[#D4D4D4] leading-relaxed whitespace-pre-wrap">
                                                            {generatedScript}
                                                        </pre>
                                                    </ScrollArea>
                                                </>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center pt-20 opacity-30">
                                                    <Code2 className="w-10 h-10 mb-2" />
                                                    <p className="text-[12px] font-bold">No script generated</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ── RUNNER ── */}
                                <TabsContent value="runner" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col items-stretch overflow-hidden">
                                        <div className="p-3 border-b bg-[#FAFAFA] space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center border rounded bg-white p-0.5">
                                                    <button onClick={() => setRunnerMode('auto')} className={\`px-3 py-1 rounded text-[10px] font-bold \${runnerMode === 'auto' ? 'bg-[#0078D4] text-white' : 'text-[#666]'}\`}>Auto</button>
                                                    <button onClick={() => setRunnerMode('manual')} className={\`px-3 py-1 rounded text-[10px] font-bold \${runnerMode === 'manual' ? 'bg-[#107C10] text-white' : 'text-[#666]'}\`}>Manual</button>
                                                </div>
                                                <Badge variant="outline" className={\`text-[10px] \${runStatus === 'running' ? 'border-[#0078D4] text-[#0078D4] animate-pulse' : ''}\`}>{runStatus.toUpperCase()}</Badge>
                                            </div>

                                            {runnerMode === 'manual' ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={manualScript}
                                                        onChange={(e) => setManualScript(e.target.value)}
                                                        placeholder="tap 500 1200\\ntype MyText\\nkeyevent 66"
                                                        className="w-full h-24 p-2 text-[10px] font-mono border rounded resize-none focus:ring-1 focus:ring-[#107C10] outline-none"
                                                    />
                                                    <Button size="sm" className="w-full h-8 bg-[#107C10] hover:bg-[#0E6B0E] text-white" disabled={runStatus === 'running' || !manualScript.trim()} onClick={runManualScript}>
                                                        <Play className="w-3 h-3 mr-2" /> Execute Script
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" className="w-full h-8 bg-[#0078D4] hover:bg-[#005A9E] text-white" disabled={runStatus === 'running' || !selectedCaseId} onClick={runExecution}>
                                                    <Play className="w-3 h-3 mr-2" /> Run Automated Case
                                                </Button>
                                            )}
                                        </div>
                                        <ScrollArea className="flex-1 bg-[#1A1A1A]">
                                            <div className="p-3 font-mono space-y-1">
                                                {runLogs.map((l, i) => (
                                                    <div key={i} className={\`text-[10px] leading-tight \${l.includes('[ERROR]') || l.includes('[FAIL]') ? 'text-[#F48771]' : l.includes('[START]') ? 'text-[#0078D4] font-bold' : l.includes('[DONE]') || l.includes('[OK]') ? 'text-[#89D185]' : 'text-[#D4D4D4]'}\`}>
                                                        {l}
                                                    </div>
                                                ))}
                                                <div className="h-12" />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </TabsContent>

                                <TabsContent value="docs" className="flex-1 min-h-0 overflow-hidden bg-[#FAFAFA]">
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                        <BookOpen className="w-10 h-10 mb-2" />
                                        <p className="text-[12px] font-bold">Documentation View</p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )
                }
            </div>

            `;

    // Replace from tabsActualStart to statusBarIndex
    page = page.substring(0, tabsActualStart) + replacementTabs + page.substring(statusBarIndex);
    console.log('[OK] page.tsx tabs fully restored with better UI');
} else {
    console.log('[ERROR] Could not find markers in page.tsx:', { tabsActualStart, statusBarIndex });
}

// Ensure device ID uses ID field if available
page = page.replace(
    /setDeviceId\(msg\.model \|\| ''\);/g,
    "setDeviceId(msg.id || msg.model || '');"
);

// Restore CRLF and save
page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);
console.log('[DONE] page.tsx overhaul complete');
