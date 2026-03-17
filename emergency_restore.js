const fs = require('fs');

const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// Find the start of the broken section
const brokenMarker = '<TabsContent value="script"';
const brokenIndex = page.indexOf(brokenMarker);

// Find the start of the Status Bar (which seems to survived)
const statusBarMarker = '{/* ════════ STATUS BAR ════════ */}';
const statusBarIndex = page.indexOf(statusBarMarker);

if (brokenIndex !== -1 && statusBarIndex !== -1) {
    const replacement = `
                                <TabsContent value="script" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col justify-start items-stretch">
                                        <div className="shrink-0 p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
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
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => { navigator.clipboard.writeText(generatedScript); toast({ title: '✅ Copied to clipboard!' }); }} 
                                                        className="absolute top-3 right-3 h-7 px-3 bg-[#0078D4] hover:bg-[#005A9E] text-white text-[10px] font-bold shadow-lg z-[100] flex items-center gap-2"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" /> Copy Code
                                                    </Button>
                                                    <pre className="p-4 pt-12 text-[11px] font-mono text-[#1A1A1A] bg-[#FAFAFA] leading-relaxed whitespace-pre-wrap">{generatedScript}</pre>
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center opacity-30">
                                                    <Code2 className="w-8 h-8 mb-2" />
                                                    <p className="text-[11px] font-bold">Generate a script</p>
                                                    <p className="text-[10px] mt-1">Select a case or record steps first</p>
                                                </div>
                                            )}
                                            <div className="h-24" />
                                        </ScrollArea>
                                    </div>
                                </TabsContent>

                                <TabsContent value="runner" className="flex-1 min-h-0 overflow-hidden">
                                    <div className="flex-1 min-h-0 flex flex-col justify-start items-stretch">
                                        <div className="shrink-0 p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center border border-[#E5E5E5] rounded bg-white p-0.5">
                                                    <button onClick={() => setRunnerMode('auto')} className={\`px-2 py-1 rounded-sm text-[9px] font-bold uppercase transition-colors \${runnerMode === 'auto' ? 'bg-[#0078D4] text-white shadow-sm' : 'text-[#666] hover:bg-[#F5F5F5]'}\`}>Auto</button>
                                                    <button onClick={() => setRunnerMode('manual')} className={\`px-2 py-1 rounded-sm text-[9px] font-bold uppercase transition-colors \${runnerMode === 'manual' ? 'bg-[#107C10] text-white shadow-sm' : 'text-[#666] hover:bg-[#F5F5F5]'}\`}>Manual</button>
                                                </div>
                                                <div className="flex items-center gap-2 mr-1">
                                                    <div className={\`w-1.5 h-1.5 rounded-full \${runStatus === 'running' ? 'bg-[#0078D4] animate-pulse' : 'bg-[#999]'}\`} />
                                                    <span className="text-[9px] font-bold text-[#666] uppercase">{runStatus}</span>
                                                </div>
                                            </div>

                                            {runnerMode === 'manual' ? (
                                                <div className="flex flex-col gap-2">
                                                    <textarea
                                                        value={manualScript}
                                                        onChange={(e) => setManualScript(e.target.value)}
                                                        placeholder="# Paste ADB commands here (one per line)\\ntap 500 1200\\ntype MyPassword\\nkeyevent 66"
                                                        className="w-full h-24 p-2 text-[10px] font-mono border-[#E5E5E5] rounded resize-none focus:outline-none focus:border-[#107C10] bg-white"
                                                    />
                                                    <Button size="sm" className="h-7 text-[10px] font-bold bg-[#107C10] hover:bg-[#0E6B0E] text-white w-full" onClick={runManualScript} disabled={runStatus === 'running' || !manualScript.trim()}>
                                                        <Play className="w-3 h-3 mr-1" />Execute Manual Script
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" className="h-7 text-[10px] font-bold bg-[#0078D4] hover:bg-[#005C9E] text-white w-full" onClick={runExecution} disabled={runStatus === 'running' || !selectedCaseId}>
                                                    <Play className="w-3 h-3 mr-1" />Run Automated Case
                                                </Button>
                                            )}
                                        </div>
                                        <ScrollArea className="flex-1 bg-[#1E1E1E]">
                                            <div className="p-3 space-y-0.5">
                                                {runLogs.map((l, i) => (
                                                    <p key={i} className={\`text-[11px] font-mono leading-relaxed \${l.includes('[ERROR]') || l.includes('[FAILED]') ? 'text-[#F48771]' : l.includes('[SUCCESS]') ? 'text-[#89D185]' : 'text-[#D4D4D4]'}\`}>{l}</p>
                                                ))}
                                                <div className="h-12" />
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </TabsContent>

                                <TabsContent value="docs" className="flex-1 min-h-0 overflow-hidden bg-white">
                                    <div className="flex-1 min-h-0 flex flex-col items-center justify-start pt-20 opacity-30">
                                        <BookOpen className="w-8 h-8 mb-2" />
                                        <p className="text-[11px] font-bold">Test Documentation</p>
                                        <p className="text-[10px] mt-1">Select a case to view generated documentation</p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )
                }
            </div>

            `;

    page = page.substring(0, brokenIndex) + replacement + page.substring(statusBarIndex);
    console.log('[OK] page.tsx fully restored and fixed');
} else {
    console.log('[ERROR] Could not find markers in page.tsx');
}

page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);


// ═══════════════════════════════════════════════════
// FIX 3: vision-stream.ts — Clean State & Intervals
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');
stream = stream.replace(/\r\n/g, '\n');

// Reset intervals to optimized values
stream = stream.replace(/const FRAME_INTERVAL_MS = \d+;/, 'const FRAME_INTERVAL_MS = 60;'); // Fast frames
stream = stream.replace(/const HIERARCHY_INTERVAL_MS = \d+;/, 'const HIERARCHY_INTERVAL_MS = 500;'); // Immediate sync

// Fix the messy line 57
stream = stream.replace('let isAdbBusy = false; isActionInProgress = false;', 'let isAdbBusy = false;');

// Ensure compressed dump
stream = stream.replace(/uiautomator dump .*xml/g, 'uiautomator dump --compressed /data/local/tmp/v_sync.xml');

// Restore CRLF
stream = stream.replace(/\n/g, '\r\n');
fs.writeFileSync(streamPath, stream);
console.log('[OK] vision-stream.ts cleaned and optimized');

console.log('RESTART SERVER NOW');
