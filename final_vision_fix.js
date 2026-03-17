const fs = require('fs');

// ═══════════════════════════════════════════════════
// FIX 1: page.tsx — RESTORE BROKEN JSX AND ENHANCE
// ═══════════════════════════════════════════════════
const pagePath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/app/(app)/dashboard/vision/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/\r\n/g, '\n');

// The broken section is around "generatedScript ? ("
const scriptTabStart = page.indexOf('<TabsContent value="script"');
const runnerTabStart = page.indexOf('<TabsContent value="runner"');

if (scriptTabStart !== -1 && runnerTabStart !== -1) {
    const fixedScriptTab = `<TabsContent value="script" className="flex-1 min-h-0 overflow-hidden">
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

                                `;

    // We need to be careful what we replace. 
    // Let's find the end of the script tab content more accurately or just replace from scriptTabStart to runnerTabStart
    page = page.substring(0, scriptTabStart) + fixedScriptTab + page.substring(runnerTabStart);
    console.log('[OK] page.tsx Script Tab restored and button fixed');
} else {
    console.log('[ERROR] Could not find script/runner tabs in page.tsx');
}

// Restore CRLF
page = page.replace(/\n/g, '\r\n');
fs.writeFileSync(pagePath, page);


// ═══════════════════════════════════════════════════
// FIX 2: vision-stream.ts — Latency & Runner
// ═══════════════════════════════════════════════════
const streamPath = 'd:/Zenit Antigravity/ZenitTracker-AntiGravity-1/src/server/vision-stream.ts';
let stream = fs.readFileSync(streamPath, 'utf8');
stream = stream.replace(/\r\n/g, '\n');

// Lower intervals significantly
stream = stream.replace(/const FRAME_INTERVAL_MS = \d+;/, 'const FRAME_INTERVAL_MS = 80;'); // 12.5 FPS
stream = stream.replace(/const HIERARCHY_INTERVAL_MS = \d+;/, 'const HIERARCHY_INTERVAL_MS = 600;'); // Low latency sync

// Ensure compressed dump
stream = stream.replace(/uiautomator dump .*xml/g, 'uiautomator dump --compressed /data/local/tmp/v_sync.xml');

// Fix run_manual_script to toggle isActionInProgress so frame loop is snappy
const runManualPattern = "if (msg.type === 'run_manual_script') {";
const runManualIndex = stream.indexOf(runManualPattern);
if (runManualIndex !== -1) {
    // Find the next (async () => { ... }) block
    const asyncStart = stream.indexOf('(async () => {', runManualIndex);
    if (asyncStart !== -1) {
        const iabStart = stream.indexOf('isAdbBusy = true;', asyncStart);
        if (iabStart !== -1 && iabStart < asyncStart + 100) {
            stream = stream.substring(0, iabStart) + 'isAdbBusy = true; isActionInProgress = true;' + stream.substring(iabStart + 'isAdbBusy = true;'.length);
        }

        // And the finally block
        const finallyIndex = stream.indexOf('finally {', asyncStart);
        if (finallyIndex !== -1) {
            const iabEnd = stream.indexOf('isAdbBusy = false;', finallyIndex);
            if (iabEnd !== -1) {
                stream = stream.substring(0, iabEnd) + 'isAdbBusy = false; isActionInProgress = false;' + stream.substring(iabEnd + 'isAdbBusy = false;'.length);
            }
        }
    }
    console.log('[OK] vision-stream runner augmented with action lock');
}

// Restore CRLF
stream = stream.replace(/\n/g, '\r\n');
fs.writeFileSync(streamPath, stream);
console.log('[DONE] All fixes applied');
