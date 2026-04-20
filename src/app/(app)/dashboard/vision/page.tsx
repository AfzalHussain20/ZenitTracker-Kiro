"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone, Search, Play, StopCircle, RefreshCw,
  ChevronRight, ChevronDown, Layers, MousePointer2, Type,
  Camera, Copy, Trash2, FileCode, FileText,
  Download, CheckCircle2, XCircle, Clock, Activity, Zap,
  Layout, Eye, ArrowLeft, ArrowUp, ArrowDown, ArrowRight,
  ChevronLeft, RotateCw, Home, Code2, BookOpen, PlayCircle,
  MousePointer, Power, Circle, Square,
  Tag, Hash, AlignLeft, Link2, Crosshair, Terminal, Cpu,
  Signal, Maximize2, Minimize2,
  Package, Blocks, Table2, AlertTriangle, Filter, Wifi
} from 'lucide-react';
import SaveModuleDialog from '@/components/vision/SaveModuleDialog';
import ModuleLibraryPanel from '@/components/vision/ModuleLibraryPanel';
import CodelessBuilder from '@/components/vision/CodelessBuilder';
import DataSetEditor from '@/components/vision/DataSetEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trackerApi } from '@/lib/tracker-api';
import { VisionAction } from '@/types/vision';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// ─────────────────────────────────────────────────────────────
// ACTION TYPE CONFIG
// ─────────────────────────────────────────────────────────────
const ACTION_META: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  CLICK:       { color: '#0078D4', bg: '#EBF4FF', icon: <MousePointer className="w-3 h-3" />,  label: 'Tap' },
  TYPE:        { color: '#107C10', bg: '#E8F5E9', icon: <Type className="w-3 h-3" />,           label: 'Type' },
  SWIPE:       { color: '#8764B8', bg: '#F3EEF9', icon: <ArrowRight className="w-3 h-3" />,     label: 'Swipe' },
  SWIPE_UP:    { color: '#8764B8', bg: '#F3EEF9', icon: <ArrowUp className="w-3 h-3" />,        label: 'Swipe Up' },
  SWIPE_DOWN:  { color: '#8764B8', bg: '#F3EEF9', icon: <ArrowDown className="w-3 h-3" />,      label: 'Swipe Down' },
  SWIPE_LEFT:  { color: '#8764B8', bg: '#F3EEF9', icon: <ArrowLeft className="w-3 h-3" />,      label: 'Swipe Left' },
  SWIPE_RIGHT: { color: '#8764B8', bg: '#F3EEF9', icon: <ArrowRight className="w-3 h-3" />,     label: 'Swipe Right' },
  LONG_PRESS:  { color: '#C7A008', bg: '#FFF8E1', icon: <Clock className="w-3 h-3" />,          label: 'Long Press' },
  DOUBLE_TAP:  { color: '#C7A008', bg: '#FFF8E1', icon: <Zap className="w-3 h-3" />,            label: 'Double Tap' },
  HOME:        { color: '#616161', bg: '#F5F5F5', icon: <Home className="w-3 h-3" />,           label: 'Home' },
  BACK:        { color: '#616161', bg: '#F5F5F5', icon: <ArrowLeft className="w-3 h-3" />,      label: 'Back' },
  WAIT:        { color: '#616161', bg: '#F5F5F5', icon: <Clock className="w-3 h-3" />,          label: 'Wait' },
  SCROLL_UP:   { color: '#0078D4', bg: '#EBF4FF', icon: <ArrowUp className="w-3 h-3" />,        label: 'Scroll Up' },
  SCROLL_DOWN: { color: '#0078D4', bg: '#EBF4FF', icon: <ArrowDown className="w-3 h-3" />,      label: 'Scroll Down' },
};
const getActionMeta = (type: string) => ACTION_META[type] ?? { color: '#616161', bg: '#F5F5F5', icon: <Circle className="w-3 h-3" />, label: type };

// ─────────────────────────────────────────────────────────────
// TREE NODE
// ─────────────────────────────────────────────────────────────
const TreeNode = ({ node, level = 0, selectedId, onSelect }: any) => {
  const [open, setOpen] = useState(level < 2);
  const kids = node.children?.length > 0;
  const sel = selectedId === node.id;
  const label = node.name || node.type?.split('.').pop() || 'Element';
  const sub = node.attributes?.text || node.attributes?.resourceId || '';
  const iconForType = (t: string) => {
    const s = t?.toLowerCase() || '';
    if (s.includes('button'))  return <MousePointer2 className="w-3 h-3" />;
    if (s.includes('edit'))    return <Type className="w-3 h-3" />;
    if (s.includes('text'))    return <AlignLeft className="w-3 h-3" />;
    if (s.includes('image'))   return <Camera className="w-3 h-3" />;
    if (s.includes('recycler') || s.includes('list')) return <Layers className="w-3 h-3" />;
    if (s.includes('layout') || s.includes('view'))   return <Layout className="w-3 h-3" />;
    return <Square className="w-3 h-3" />;
  };
  if (!node) return null;
  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-[4px] pr-2 cursor-pointer rounded-[3px] text-[11.5px] transition-all select-none
          ${sel ? 'bg-[#0078D4] text-white' : 'text-[#2D2D2D] hover:bg-[#E8F0FE]'}`}
        style={{ paddingLeft: `${level * 16 + 6}px` }}
        onClick={() => onSelect(node)}>
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
          className={`w-4 h-4 flex items-center justify-center shrink-0 rounded transition-colors ${kids ? '' : 'invisible'}`}>
          {open ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
        </button>
        <span className={sel ? 'text-white/70' : 'text-[#0078D4]'}>{iconForType(node.type)}</span>
        <div className="flex flex-col min-w-0 leading-tight flex-1">
          <span className="font-medium truncate">{label}</span>
          {sub && <span className={`text-[10px] truncate font-mono ${sel ? 'text-white/60' : 'text-[#888]'}`}>{sub}</span>}
        </div>
        {node.attributes?.clickable && (
          <span className={`text-[9px] px-1 rounded shrink-0 ${sel ? 'bg-white/20 text-white' : 'bg-[#E3F2FD] text-[#0078D4]'}`}>tap</span>
        )}
      </div>
      {kids && open && node.children.map((c: any, i: number) => (
        <TreeNode key={`${c.id}-${i}`} node={c} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ELEMENT OVERLAYS
// ─────────────────────────────────────────────────────────────
const Overlays = ({ node, onSelect, selectedId, isLandscape }: any) => {
  if (!node) return null;
  const b = node.attributes?.bounds;
  let style: React.CSSProperties = { display: 'none' };
  if (b) {
    if (isLandscape) {
      style = {
        position: 'absolute',
        left:   `${(1 - b.y - b.height) * 100}%`,
        top:    `${b.x * 100}%`,
        width:  `${b.height * 100}%`,
        height: `${b.width * 100}%`,
      };
    } else {
      style = {
        position: 'absolute',
        left: `${b.x * 100}%`, top: `${b.y * 100}%`,
        width: `${b.width * 100}%`, height: `${b.height * 100}%`,
      };
    }
  }
  return (
    <>
      {b && (
        <div
          className={`absolute border cursor-crosshair z-[55] transition-all duration-100
            ${selectedId === node.id ? 'border-[#0078D4] bg-[#0078D4]/15 shadow-[inset_0_0_0_1px_#0078D4]' : 'border-transparent hover:border-[#0078D4]/60 hover:bg-[#0078D4]/8'}`}
          style={style}
          onClick={e => { e.stopPropagation(); onSelect(node); }}
        />
      )}
      {node.children?.map((c: any) => <Overlays key={c.id} node={c} onSelect={onSelect} selectedId={selectedId} isLandscape={isLandscape} />)}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// LOCATOR BADGE
// ─────────────────────────────────────────────────────────────
const LocatorBadge = ({ type, value, best }: { type: string; value: string; best?: boolean }) => (
  <div className={`flex items-start gap-2 px-2.5 py-2 rounded-md border text-[11px] ${best ? 'border-[#0078D4] bg-[#EBF4FF]' : 'border-[#E8E8E8] bg-[#FAFAFA]'}`}>
    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
      {best && <div className="w-1.5 h-1.5 rounded-full bg-[#0078D4]" />}
      <span className={`font-semibold uppercase text-[9px] tracking-wider ${best ? 'text-[#0078D4]' : 'text-[#888]'}`}>{type}</span>
    </div>
    <span className="font-mono text-[10.5px] text-[#1E1E1E] break-all flex-1 leading-relaxed">{value}</span>
    <button onClick={() => navigator.clipboard.writeText(value)} className="shrink-0 p-1 hover:bg-[#E0E0E0] rounded transition-colors mt-0.5">
      <Copy className="w-3 h-3 text-[#888]" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// HIERARCHY NORMALISATION (pixel coords → 0-1 ratios)
// ─────────────────────────────────────────────────────────────
function normalizeHierarchy(node: any, sw: number, sh: number): any {
  if (!node) return node;
  // Shallow-clone to avoid mutating the original object
  node = { ...node, attributes: node.attributes ? { ...node.attributes } : {} };
  if (node.attributes.bounds) {
    const b = node.attributes.bounds;
    if (b.x > 1 || b.y > 1 || b.width > 1 || b.height > 1) {
      node.attributes.bounds = {
        x: b.x / sw,
        y: b.y / sh,
        width: b.width / sw,
        height: b.height / sh,
      };
    }
  }
  node.children = node.children?.map((c: any) => normalizeHierarchy(c, sw, sh));
  return node;
}
export default function ZenitVisionPage() {
  useEffect(() => {
    const s = document.createElement('style');
    s.innerHTML = `
      .vs-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .vs-scroll::-webkit-scrollbar-track { background: transparent; }
      .vs-scroll::-webkit-scrollbar-thumb { background: #D0D0D0; border-radius: 3px; }
      .vs-scroll::-webkit-scrollbar-thumb:hover { background: #ABABAB; }
      .no-scrollbar::-webkit-scrollbar { display: none !important; }
      .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
      @keyframes ripple { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
      .ripple-anim { animation: ripple 0.6s ease-out forwards; }
      @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      .fade-slide-in { animation: fadeSlideIn 0.15s ease-out; }
    `;
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);

  const { toast } = useToast();
  const router = useRouter();

  // Device & stream state
  const [deviceState, setDeviceState] = useState<'DISCONNECTED' | 'CONNECTED'>('DISCONNECTED');
  const [deviceId, setDeviceId] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [currentPackage, setCurrentPackage] = useState('');
  const [platform] = useState<'android' | 'ios'>('android');
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [streamFps, setStreamFps] = useState(0);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isSyncing, setIsSyncing] = useState(false);

  // UI state
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [treeSearch, setTreeSearch] = useState('');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState('inspector');
  const [interactionMode, setInteractionMode] = useState<'interact' | 'inspect'>('interact');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<'tree' | 'modules'>('tree');
  const [showSaveModule, setShowSaveModule] = useState(false);

  // Interaction state
  const screenRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [dragStartVisual, setDragStartVisual] = useState<{ x: number; y: number } | null>(null);
  const [dragEndVisual, setDragEndVisual] = useState<{ x: number; y: number } | null>(null);
  const [tapFeedback, setTapFeedback] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [keyboardInput, setKeyboardInput] = useState('');
  const [showKeyboardBar, setShowKeyboardBar] = useState(false);
  const [lastAction, setLastAction] = useState('');
  const [actionFeedbackVisible, setActionFeedbackVisible] = useState(false);

  // Recording & script state
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<VisionAction[]>([]);
  const [scriptLang, setScriptLang] = useState('python');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [runLogs, setRunLogs] = useState<{ text: string; level: 'info' | 'error' | 'success' | 'warn' }[]>([]);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [manualScript, setManualScript] = useState('');
  const [runnerMode, setRunnerMode] = useState<'appium' | 'dsl'>('appium');
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [suites, setSuites] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [scriptCopied, setScriptCopied] = useState(false);

  // Logcat state
  const [logcatLines, setLogcatLines] = useState<{ text: string; level: 'crash' | 'error' | 'warn' | 'drm' | 'info' }[]>([]);
  const [logcatRunning, setLogcatRunning] = useState(false);
  const [logcatFilter, setLogcatFilter] = useState<'all' | 'crash' | 'error' | 'drm'>('all');
  const logcatEndRef = useRef<HTMLDivElement>(null);

  // Native runner state
  const [nativeRunStatus, setNativeRunStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [nativeStepResults, setNativeStepResults] = useState<Record<string, { passed: boolean; detail: string }>>({});

  // WiFi ADB state
  const [showWifiPanel, setShowWifiPanel] = useState(false);
  const [wifiIp, setWifiIp] = useState('');
  const [wifiPort, setWifiPort] = useState('5555');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'enabling' | 'connecting' | 'connected' | 'error'>('idle');
  const [wifiMessage, setWifiMessage] = useState('');

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const actionQueue = useRef<any[]>([]);
  const actionsRef = useRef<VisionAction[]>([]);
  const isSyncingRef = useRef(false);

  // Keep actionsRef in sync
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  // Auto-fetch device IP when WiFi panel opens
  useEffect(() => {
    if (showWifiPanel && wsStatus === 'connected' && !wifiIp) {
      wsRef.current?.send(JSON.stringify({ type: 'wifi_get_ip' }));
    }
  }, [showWifiPanel, wsStatus]);
  useEffect(() => { logcatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logcatLines]);

  // ── WebSocket ──
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const ws = new WebSocket(`ws://${window.location.hostname}:8767`);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus('connected');
    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        try {
          const buf = await event.data.arrayBuffer();
          const imgBlob = new Blob([buf.slice(4)], { type: 'image/png' });
          const newUrl = URL.createObjectURL(imgBlob);
          setScreenshotUrl(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return newUrl; });
          frameCountRef.current++;
          setIsSyncing(false);
          isSyncingRef.current = false;
          // Auto-detect orientation from image dimensions
          const img = new Image();
          img.onload = () => {
            const frameIsLandscape = img.naturalWidth > img.naturalHeight;
            setIsLandscape(prev => {
              if (prev !== frameIsLandscape) {
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN)
                    wsRef.current.send(JSON.stringify({ type: 'refresh_hierarchy' }));
                }, 600);
              }
              return frameIsLandscape;
            });
          };
          img.src = newUrl;
        } catch (e) { console.error('[Vision WS] Binary error:', e); }
        return;
      }
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'frame':
            setScreenshotUrl(`data:image/png;base64,${msg.screenshot}`);
            frameCountRef.current++;
            if (msg.afterAction) {
              setIsSyncing(false);
              isSyncingRef.current = false;
              if (actionQueue.current.length > 0) {
                const next = actionQueue.current.shift();
                sendWsAction(next);
              }
            }
            // Auto-detect orientation from frame dimensions
            if (msg.width && msg.height) {
              const frameIsLandscape = msg.width > msg.height;
              setIsLandscape(prev => {
                if (prev !== frameIsLandscape) {
                  setTimeout(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN)
                      wsRef.current.send(JSON.stringify({ type: 'refresh_hierarchy' }));
                  }, 600);
                }
                return frameIsLandscape;
              });
            }
            break;
          case 'state':
            if (!msg.screenWidth || !msg.screenHeight) console.warn('[Vision WS] state message missing screenWidth/screenHeight — falling back to 1080×1920');
            // Server already sends normalised 0-1 bounds — use directly, no re-normalisation
            setHierarchy(msg.hierarchy);
            setCurrentPackage(msg.currentPackage || '');
            setDeviceModel(msg.deviceModel || '');
            break;
          case 'device_status':
            if (msg.connected) { setDeviceState('CONNECTED'); setDeviceModel(msg.model || ''); setDeviceId(msg.id || msg.model || ''); }
            else setDeviceState('DISCONNECTED');
            break;
          case 'action_done':
            setIsSyncing(false);
            isSyncingRef.current = false;
            if (msg.locators && actionsRef.current.length > 0) {
              const loc = msg.locators;
              // Only upgrade if server found a real stable locator (not just a fallback xpath)
              if (loc.resourceId || loc.accessibilityId || loc.text) {
                setActions(prev => {
                  const updated = [...prev];
                  const last = { ...updated[updated.length - 1] };
                  last.locator = { ...last.locator, ...loc };
                  updated[updated.length - 1] = last;
                  return updated;
                });
              }
            }
            // Drain queue inline — avoids useEffect race with isSyncingRef
            if (actionQueue.current.length > 0) {
              const next = actionQueue.current.shift();
              sendWsAction(next);
            }
            break;
          case 'assertionResult':
            setIsSyncing(false);
            isSyncingRef.current = false;
            setRunLogs(prev => [...prev, {
              text: msg.message || (msg.passed ? 'Assertion passed' : 'Assertion failed'),
              level: msg.passed ? 'success' : 'error',
            }]);
            break;
          case 'log':
            setRunLogs(prev => [...prev, { text: msg.message, level: msg.level || 'info' }]);
            if (msg.level === 'success') setRunStatus('passed');
            if (msg.level === 'error') setRunStatus('failed');
            break;
          case 'logcat_line': {
            const raw: string = msg.line || '';
            let level: 'crash' | 'error' | 'warn' | 'drm' | 'info' = 'info';
            if (/FATAL EXCEPTION|ANR in|Process.*died|SIGSEGV|force.clos/i.test(raw)) level = 'crash';
            else if (/ E[ /]|ERROR/i.test(raw)) level = 'error';
            else if (/ W[ /]|WARN/i.test(raw)) level = 'warn';
            else if (/drm|widevine|clearkey|mediadrm|DrmManager/i.test(raw)) level = 'drm';
            setLogcatLines(prev => {
              const next = [...prev, { text: raw, level }];
              return next.length > 2000 ? next.slice(-2000) : next; // cap at 2000 lines
            });
            break;
          }
          case 'logcat_status':
            setLogcatRunning(msg.running === true);
            break;
          case 'native_run_start':
            setNativeRunStatus('running');
            setNativeStepResults({});
            setRunLogs([{ text: `▶  Native runner — ${msg.total} step(s)`, level: 'info' }]);
            setRunStatus('running');
            setRightTab('runner');
            break;
          case 'native_step_result':
            setNativeStepResults(prev => ({ ...prev, [msg.stepId]: { passed: msg.passed, detail: msg.detail } }));
            break;
          case 'native_run_done':
            setNativeRunStatus(msg.failed === 0 ? 'passed' : 'failed');
            setRunStatus(msg.failed === 0 ? 'passed' : 'failed');
            break;
          case 'wifi_status':
            setWifiStatus(msg.status);
            setWifiMessage(msg.message || '');
            if (msg.ip) setWifiIp(msg.ip);
            break;
          case 'wifi_ip':
            if (msg.ip) { setWifiIp(msg.ip); setWifiMessage(`Device IP detected: ${msg.ip}`); }
            else setWifiMessage('Could not detect IP — check Settings → About → Status → IP address');
            break;
          case 'recording_saved': toast({ title: 'Recording Saved', description: `Saved to: ${msg.path}` }); break;
          case 'orientation': setIsLandscape(msg.landscape === true); setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(JSON.stringify({ type: 'refresh_hierarchy' }));
          }, 800); break;
        }
      } catch (err) { console.error('[Vision WS] Parse error:', err); }
    };
    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
      reconnectTimerRef.current = setTimeout(() => connectWebSocket(), 2000);
    };
    ws.onerror = () => setWsStatus('disconnected');
  }, []);

  useEffect(() => {
    connectWebSocket();
    fpsTimerRef.current = setInterval(() => { setStreamFps(frameCountRef.current); frameCountRef.current = 0; }, 1000);
    return () => {
      wsRef.current?.close();
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (isSyncing) { syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 3500); }
    else { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); }
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [isSyncing]);

  // Keep isSyncingRef in sync with state
  useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);

  const sendWsAction = useCallback((payload: any) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (isSyncingRef.current) {
      actionQueue.current.push(payload);
      return;
    }
    setIsSyncing(true);
    isSyncingRef.current = true;
    wsRef.current.send(JSON.stringify({ type: 'action', payload }));
  }, []); // no deps — uses ref, not state

  const refreshHierarchy = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'refresh_hierarchy' }));
  }, []);

  // ── Coordinate helpers ──
  const getScreenCoords = (e: React.MouseEvent) => {
    if (!screenRef.current) return null;
    const rect = screenRef.current.getBoundingClientRect();
    const rawRx = (e.clientX - rect.left) / rect.width;
    const rawRy = (e.clientY - rect.top) / rect.height;
    // Android landscape is 90° CCW: device_x = rawRy, device_y = 1 - rawRx
    const rx = isLandscape ? rawRy : rawRx;
    const ry = isLandscape ? 1 - rawRx : rawRy;
    return { rx, ry, relX: e.clientX - rect.left, relY: e.clientY - rect.top };
  };

  const findElementAt = (node: any, rx: number, ry: number): any => {
    if (!node?.attributes?.bounds) return null;
    const b = node.attributes.bounds;
    if (rx < b.x || rx > b.x + b.width || ry < b.y || ry > b.y + b.height) return null;
    for (const child of node.children || []) { const f = findElementAt(child, rx, ry); if (f) return f; }
    return node;
  };

  const boundsStyle = (n: any) => {
    if (!n?.attributes?.bounds) return { display: 'none' as const };
    const { x, y, width, height } = n.attributes.bounds;
    if (isLandscape) {
      return {
        left:   `${y * 100}%`,
        top:    `${(1 - x - width) * 100}%`,
        width:  `${height * 100}%`,
        height: `${width * 100}%`,
      };
    }
    return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` };
  };

  const showActionFeedback = (action: string) => {
    setLastAction(action); setActionFeedbackVisible(true);
    setTimeout(() => setActionFeedbackVisible(false), 1400);
  };

  // ── Recording ──
  const recordAction = (type: string, desc: string, value?: string, overrideElement?: any) => {
    if (!isRecording) return;
    const el = overrideElement || selectedElement;
    const resId = el?.attributes?.resourceId || '';
    const contentDesc = el?.attributes?.contentDesc || '';
    const text = el?.attributes?.text || '';
    const className = el?.type?.split('.').pop() || '';
    let xpath = '';
    if (resId) xpath = `//${className || '*'}[@resource-id='${resId}']`;
    else if (contentDesc) xpath = `//${className || '*'}[@content-desc='${contentDesc}']`;
    else if (text) xpath = `//${className || '*'}[@text='${text}']`;
    else if (className) {
      const idx = el?.attributes?.index ?? 0;
      xpath = `//${className}[${Number(idx) + 1}]`;
      console.warn('[Zenit] Weak locator generated for', className, '— element has no id, text, or accessibility label');
    } else {
      xpath = '//*[1]';
    }
    const a: VisionAction = {
      id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type: type as any, value,
      locator: { accessibilityId: contentDesc || undefined, resourceId: resId || undefined, xpath: xpath || undefined, text: text || undefined },
      description: el ? `${desc} '${el.name || text || contentDesc || className || 'Element'}'` : desc,
      elementId: resId || el?.id, componentName: el?.name || className || 'Element',
    };
    setActions(prev => [...prev, a]);
  };

  // ── Device actions ──
  const sendTap = (rx: number, ry: number) => {
    showActionFeedback(`Tap`);
    if (isRecording) { const hit = hierarchy ? findElementAt(hierarchy, rx, ry) : null; recordAction('CLICK', 'Tap', undefined, hit); }
    sendWsAction({ action: 'tap', ratioX: rx, ratioY: ry });
  };

  const sendSwipe = (rx1: number, ry1: number, rx2: number, ry2: number) => {
    const dx = rx2 - rx1, dy = ry2 - ry1;
    let type = 'SWIPE', dir = 'Swipe';
    if (Math.abs(dx) > Math.abs(dy)) { type = dx > 0 ? 'SWIPE_RIGHT' : 'SWIPE_LEFT'; dir = dx > 0 ? 'Swipe Right' : 'Swipe Left'; }
    else { type = dy > 0 ? 'SWIPE_DOWN' : 'SWIPE_UP'; dir = dy > 0 ? 'Swipe Down' : 'Swipe Up'; }
    showActionFeedback(dir);
    if (isRecording) recordAction(type, dir, undefined, undefined);
    sendWsAction({ action: 'swipe', ratioX1: rx1, ratioY1: ry1, ratioX2: rx2, ratioY2: ry2, duration: 300 });
  };

  const sendKeyInput = (text: string, enter = false) => {
    if (!text.trim() || !wsRef.current) return;
    sendWsAction({ action: 'type', text, enter });
    showActionFeedback(`Type: "${text}"`);
    if (isRecording) { const hit = selectedElement || (hierarchy ? findElementAt(hierarchy, 0.5, 0.5) : null); recordAction('TYPE', `Type "${text}"`, text, hit); }
    setKeyboardInput('');
  };

  const sendScroll = (direction: 'up' | 'down') => {
    const type = direction === 'up' ? 'SCROLL_UP' : 'SCROLL_DOWN';
    showActionFeedback(`Scroll ${direction}`);
    if (isRecording) recordAction(type, `Scroll ${direction}`);
    const dry = direction === 'up' ? -0.3 : 0.3;
    sendWsAction({ action: 'swipe', ratioX1: 0.5, ratioY1: 0.5, ratioX2: 0.5, ratioY2: 0.5 + dry, duration: 300 });
  };

  const sendDeviceAction = (actionType: 'home' | 'back' | 'recents') => {
    showActionFeedback(actionType.toUpperCase());
    if (isRecording) recordAction(actionType.toUpperCase(), `Press ${actionType}`);
    sendWsAction({ action: actionType });
  };

  const sendLongPress = (rx: number, ry: number) => {
    showActionFeedback('Long Press');
    if (isRecording) { const hit = hierarchy ? findElementAt(hierarchy, rx, ry) : null; recordAction('LONG_PRESS', 'Long Press', undefined, hit); }
    sendWsAction({ action: 'longpress', ratioX: rx, ratioY: ry, duration: 1500 });
  };

  const sendDoubleTap = (rx: number, ry: number) => {
    showActionFeedback('Double Tap');
    if (isRecording) { const hit = hierarchy ? findElementAt(hierarchy, rx, ry) : null; recordAction('DOUBLE_TAP', 'Double Tap', undefined, hit); }
    sendWsAction({ action: 'doubletap', ratioX: rx, ratioY: ry });
  };

  // ── Mouse handlers ──
  const handleScreenMouseDown = (e: React.MouseEvent) => {
    if (interactionMode !== 'interact' || e.button === 2) return;
    const c = getScreenCoords(e); if (!c) return;
    const rect = screenRef.current!.getBoundingClientRect();
    const rawRx = (e.clientX - rect.left) / rect.width;
    const rawRy = (e.clientY - rect.top) / rect.height;
    setIsDragging(true);
    setDragStart({ x: c.rx, y: c.ry }); setDragEnd(null);
    setDragStartVisual({ x: rawRx, y: rawRy }); setDragEndVisual(null);
  };
  const handleScreenMouseMove = (e: React.MouseEvent) => {
    if (isDragging && interactionMode === 'interact') {
      const c = getScreenCoords(e); if (c) setDragEnd({ x: c.rx, y: c.ry });
      if (screenRef.current) {
        const rect = screenRef.current.getBoundingClientRect();
        setDragEndVisual({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
      }
    }
    if (interactionMode === 'inspect' && hierarchy) {
      const c2 = getScreenCoords(e);
      if (c2) { const hit = findElementAt(hierarchy, c2.rx, c2.ry); if (hit) setSelectedElement(hit); }
    }
  };
  const handleScreenMouseUp = (e: React.MouseEvent) => {
    if (interactionMode !== 'interact' || !isDragging || !dragStart) { setIsDragging(false); return; }
    const c = getScreenCoords(e); if (!c) { setIsDragging(false); return; }
    const dx = c.rx - dragStart.x, dy = c.ry - dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.015) {
      setTapFeedback({ x: c.relX, y: c.relY });
      setTimeout(() => setTapFeedback(null), 700);
      sendTap(c.rx, c.ry);
    } else { sendSwipe(dragStart.x, dragStart.y, c.rx, c.ry); }
    setIsDragging(false); setDragStart(null); setDragEnd(null);
    setDragStartVisual(null); setDragEndVisual(null);
  };
  const handleScreenWheel = (e: React.WheelEvent) => { if (interactionMode !== 'interact') return; sendScroll(e.deltaY > 0 ? 'down' : 'up'); };
  const handleScreenContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const c = getScreenCoords(e); if (!c) return;
    setContextMenu({ x: e.clientX, y: e.clientY, screenX: c.rx, screenY: c.ry });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // ── Suite/Case loading ──
  useEffect(() => { trackerApi.getSuites().then(r => setSuites(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (selectedSuiteId) trackerApi.getCases(selectedSuiteId).then(r => setCases(r.data)).catch(() => {});
  }, [selectedSuiteId]);

  // ── Script generation ──
  const generateScript = async () => {
    if (actionsRef.current.length === 0 && !selectedCaseId) { toast({ title: 'No actions recorded' }); return; }
    setIsGenerating(true);
    if (selectedCaseId) {
      try { const res = await trackerApi.generateScript(selectedCaseId, scriptLang); setGeneratedScript(res.data.script); }
      catch { toast({ variant: 'destructive', title: 'Script generation failed' }); }
      finally { setIsGenerating(false); }
      return;
    }
    const currentActions = actionsRef.current;
    const udid = deviceId || 'YOUR_DEVICE_UDID';
    const pkg = currentPackage || 'com.your.app';

    // Filter out useless container taps (ScrollView, FrameLayout, etc. with no resource-id)
    const CONTAINER_TYPES = ['ScrollView', 'FrameLayout', 'LinearLayout', 'RelativeLayout', 'ConstraintLayout', 'CoordinatorLayout', 'ViewGroup', 'View'];
    const isUselessContainerTap = (a: VisionAction) => {
      if (a.type.toString().toUpperCase() !== 'CLICK') return false;
      if (a.locator?.resourceId) return false;
      if (a.locator?.accessibilityId) return false;
      if (a.locator?.text) return false; // labeled element — keep it
      const comp = a.componentName || '';
      return CONTAINER_TYPES.some(c => comp.includes(c));
    };

    // Warn if a TYPE target looks like a label/hint rather than an input field
    const isLikelyNotInput = (rid: string | undefined) => {
      if (!rid) return false;
      return /helper|hint|label|title|subtitle|description|caption/i.test(rid);
    };

    let s = '';
    if (scriptLang === 'python') {
      s = `# ═══════════════════════════════════════════════════════════
# Zenit Vision — Generated Appium Script (Python)
# Device : ${deviceModel || 'Android Device'}
# UDID   : ${udid}
# Package: ${pkg}
# Steps  : ${currentActions.length}
# Appium : 2.x  |  UiAutomator2
# ═══════════════════════════════════════════════════════════
import time
from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

options = UiAutomator2Options()
options.platform_name = "Android"
options.udid = "${udid}"
options.app_package = "${pkg}"
options.no_reset = True
options.new_command_timeout = 300

# Verify Appium is reachable before creating session
import urllib.request, urllib.error
try:
    urllib.request.urlopen("http://127.0.0.1:4723/status", timeout=5)
except urllib.error.URLError as e:
    print(f"[ERROR] Appium server not reachable at http://127.0.0.1:4723 — {e}")
    print("[ERROR] Start Appium first: appium --port 4723")
    exit(1)

driver = webdriver.Remote("http://127.0.0.1:4723", options=options)
wait = WebDriverWait(driver, 15)

try:
`;
      let stepNum = 1;
      currentActions.forEach((a, i) => {
        if (isUselessContainerTap(a)) return; // skip useless container taps
        const rid = a.locator?.resourceId, cd = a.locator?.accessibilityId, txt = a.locator?.text, xp = a.locator?.xpath;
        let by = 'AppiumBy.XPATH', val = '//*';
        if (rid) { by = 'AppiumBy.ID'; val = rid; }
        else if (cd) { by = 'AppiumBy.ACCESSIBILITY_ID'; val = cd; }
        else if (txt) { by = 'AppiumBy.XPATH'; val = `//*[@text="${txt}"]`; }
        else if (xp) { by = 'AppiumBy.XPATH'; val = xp; }
        const t = a.type.toString().toUpperCase();
        // Warn if typing into a likely label element
        if (t === 'TYPE' && isLikelyNotInput(rid)) {
          s += `    # ⚠ WARNING: Step ${stepNum} — "${rid}" looks like a label/hint, not an input field.\n`;
          s += `    # Inspect the element in Zenit and replace with the actual EditText resource-id.\n`;
        }
        s += `    # Step ${stepNum}: ${a.description || t}\n`;
        if (t === 'CLICK') s += `    wait.until(EC.element_to_be_clickable((${by}, "${val}"))).click()\n\n`;
        else if (t === 'TYPE') {
          s += `    el = wait.until(EC.element_to_be_clickable((${by}, "${val}")))\n`;
          s += `    el.click()\n`;
          s += `    el.clear()\n`;
          s += `    el.send_keys("${a.value || ''}")\n`;
          const nextAction = currentActions.slice(i + 1).find(na => !isUselessContainerTap(na));
          if (nextAction && nextAction.type.toString().toUpperCase() === 'CLICK') {
            s += `    driver.hide_keyboard()\n`;
            s += `    time.sleep(0.5)  # wait for keyboard to dismiss\n`;
          }
          s += `\n`;
        }
        else if (t === 'LONG_PRESS') s += `    el = wait.until(EC.presence_of_element_located((${by}, "${val}")))\n    driver.execute_script("mobile: longClickGesture", {"elementId": el.id, "duration": 1500})\n\n`;
        else if (t === 'DOUBLE_TAP') s += `    el = wait.until(EC.presence_of_element_located((${by}, "${val}")))\n    driver.execute_script("mobile: doubleClickGesture", {"elementId": el.id})\n\n`;
        else if (t === 'SWIPE_UP' || t === 'SCROLL_UP') s += `    driver.execute_script("mobile: scrollGesture", {"left": 100, "top": 300, "width": 200, "height": 400, "direction": "up", "percent": 0.75})\n\n`;
        else if (t === 'SWIPE_DOWN' || t === 'SCROLL_DOWN') s += `    driver.execute_script("mobile: scrollGesture", {"left": 100, "top": 300, "width": 200, "height": 400, "direction": "down", "percent": 0.75})\n\n`;
        else if (t === 'SWIPE_LEFT') s += `    driver.execute_script("mobile: swipeGesture", {"left": 100, "top": 400, "width": 600, "height": 100, "direction": "left", "percent": 0.75})\n\n`;
        else if (t === 'SWIPE_RIGHT') s += `    driver.execute_script("mobile: swipeGesture", {"left": 100, "top": 400, "width": 600, "height": 100, "direction": "right", "percent": 0.75})\n\n`;
        else if (t === 'HOME') s += `    driver.press_keycode(3)  # HOME\n\n`;
        else if (t === 'BACK') s += `    driver.press_keycode(4)  # BACK\n\n`;
        else if (t === 'WAIT') s += `    time.sleep(${a.value || '2'})\n\n`;
        else s += `    # TODO: ${t} — ${a.description}\n\n`;
        stepNum++;
      });
      s += `finally:\n    driver.quit()\n`;
    } else if (scriptLang === 'java') {
      s = `// ═══════════════════════════════════════════════════════════
// Zenit Vision — Generated Appium Script (Java)
// Device : ${deviceModel || 'Android Device'}
// UDID   : ${udid}
// Package: ${pkg}
// Steps  : ${currentActions.length}
// Appium : 2.x  |  UiAutomator2
// ═══════════════════════════════════════════════════════════
package com.zenit.generated;

import java.net.URL;
import java.time.Duration;
import java.util.Map;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import io.appium.java_client.AppiumBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;

public class ZenitGeneratedTest {
    public static void main(String[] args) throws Exception {
        UiAutomator2Options options = new UiAutomator2Options();
        options.setUdid("${udid}");
        options.setAppPackage("${pkg}");
        options.setNoReset(true);
        options.setNewCommandTimeout(Duration.ofSeconds(300));

        AndroidDriver driver = new AndroidDriver(new URL("http://127.0.0.1:4723"), options);
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        try {
`;
      let stepNum = 1;
      currentActions.forEach((a, i) => {
        if (isUselessContainerTap(a)) return;
        const rid = a.locator?.resourceId, cd = a.locator?.accessibilityId, txt = a.locator?.text, xp = a.locator?.xpath;
        let sel = rid ? `By.id("${rid}")` : cd ? `AppiumBy.accessibilityId("${cd}")` : txt ? `By.xpath("//*[@text=\\"${txt}\\"]")` : xp ? `By.xpath("${xp.replace(/"/g, '\\"')}")` : `By.xpath("//*")`;
        const t = a.type.toString().toUpperCase();
        if (t === 'TYPE' && isLikelyNotInput(rid)) {
          s += `            // ⚠ WARNING: "${rid}" looks like a label/hint — replace with actual EditText id\n`;
        }
        s += `            // Step ${stepNum}: ${a.description || t}\n`;
        if (t === 'CLICK') s += `            wait.until(ExpectedConditions.elementToBeClickable(${sel})).click();\n\n`;
        else if (t === 'TYPE') {
          s += `            wait.until(ExpectedConditions.elementToBeClickable(${sel})).click();\n`;
          s += `            wait.until(ExpectedConditions.presenceOfElementLocated(${sel})).sendKeys("${a.value || ''}");\n`;
          const nextAction = currentActions.slice(i + 1).find(na => !isUselessContainerTap(na));
          if (nextAction && nextAction.type.toString().toUpperCase() === 'CLICK') {
            s += `            driver.hideKeyboard();\n`;
          }
          s += `\n`;
        }
        else if (t === 'LONG_PRESS') s += `            var el = wait.until(ExpectedConditions.presenceOfElementLocated(${sel}));\n            driver.executeScript("mobile: longClickGesture", Map.of("elementId", el.getId(), "duration", 1500));\n\n`;
        else if (t === 'SWIPE_UP' || t === 'SCROLL_UP') s += `            driver.executeScript("mobile: scrollGesture", Map.of("left", 100, "top", 300, "width", 200, "height", 400, "direction", "up", "percent", 0.75));\n\n`;
        else if (t === 'SWIPE_DOWN' || t === 'SCROLL_DOWN') s += `            driver.executeScript("mobile: scrollGesture", Map.of("left", 100, "top", 300, "width", 200, "height", 400, "direction", "down", "percent", 0.75));\n\n`;
        else if (t === 'HOME') s += `            driver.pressKey(new KeyEvent(AndroidKey.HOME));\n\n`;
        else if (t === 'BACK') s += `            driver.pressKey(new KeyEvent(AndroidKey.BACK));\n\n`;
        else if (t === 'WAIT') s += `            Thread.sleep(${(parseFloat(a.value || '2') * 1000).toFixed(0)});\n\n`;
        else s += `            // TODO: ${t} — ${a.description}\n\n`;
        stepNum++;
      });
      s += `        } finally {\n            driver.quit();\n        }\n    }\n}\n`;
    } else {
      s = `// ═══════════════════════════════════════════════════════════
// Zenit Vision — Generated Appium Script (JavaScript/WebdriverIO)
// Device : ${deviceModel || 'Android Device'}
// UDID   : ${udid}
// Package: ${pkg}
// Steps  : ${currentActions.length}
// Appium : 2.x  |  UiAutomator2
// ═══════════════════════════════════════════════════════════
const { remote } = require('webdriverio');

const caps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': '${udid}',
    'appium:appPackage': '${pkg}',
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
};

(async () => {
    const driver = await remote({ hostname: '127.0.0.1', port: 4723, capabilities: caps });
    try {
`;
      let stepNum = 1;
      currentActions.forEach((a, i) => {
        if (isUselessContainerTap(a)) return;
        const rid = a.locator?.resourceId, cd = a.locator?.accessibilityId, txt = a.locator?.text, xp = a.locator?.xpath;
        const loc = rid ? `id:${rid}` : cd ? `~${cd}` : txt ? `//*[@text="${txt}"]` : xp || '//*';
        const t = a.type.toString().toUpperCase();
        if (t === 'TYPE' && isLikelyNotInput(rid)) {
          s += `        // ⚠ WARNING: "${rid}" looks like a label/hint — replace with actual input id\n`;
        }
        s += `        // Step ${stepNum}: ${a.description || t}\n`;
        if (t === 'CLICK') s += `        await $('${loc}').click();\n\n`;
        else if (t === 'TYPE') {
          s += `        await $('${loc}').click();\n`;
          s += `        await $('${loc}').setValue('${a.value || ''}');\n`;
          const nextAction = currentActions.slice(i + 1).find(na => !isUselessContainerTap(na));
          if (nextAction && nextAction.type.toString().toUpperCase() === 'CLICK') {
            s += `        await driver.hideKeyboard();\n`;
          }
          s += `\n`;
        }
        else if (t === 'LONG_PRESS') s += `        await driver.execute('mobile: longClickGesture', { element: await $('${loc}').elementId, duration: 1500 });\n\n`;
        else if (t === 'SWIPE_UP' || t === 'SCROLL_UP') s += `        await driver.execute('mobile: scrollGesture', { left: 100, top: 300, width: 200, height: 400, direction: 'up', percent: 0.75 });\n\n`;
        else if (t === 'SWIPE_DOWN' || t === 'SCROLL_DOWN') s += `        await driver.execute('mobile: scrollGesture', { left: 100, top: 300, width: 200, height: 400, direction: 'down', percent: 0.75 });\n\n`;
        else if (t === 'SWIPE_LEFT') s += `        await driver.execute('mobile: swipeGesture', { left: 100, top: 400, width: 600, height: 100, direction: 'left', percent: 0.75 });\n\n`;
        else if (t === 'SWIPE_RIGHT') s += `        await driver.execute('mobile: swipeGesture', { left: 100, top: 400, width: 600, height: 100, direction: 'right', percent: 0.75 });\n\n`;
        else if (t === 'HOME') s += `        await driver.pressKeyCode(3);\n\n`;
        else if (t === 'BACK') s += `        await driver.pressKeyCode(4);\n\n`;
        else if (t === 'WAIT') s += `        await driver.pause(${(parseFloat(a.value || '2') * 1000).toFixed(0)});\n\n`;
        else s += `        // TODO: ${t} — ${a.description}\n\n`;
        stepNum++;
      });
      s += `    } finally {\n        await driver.deleteSession();\n    }\n})();\n`;
    }
    setGeneratedScript(s);
    setIsGenerating(false);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  };

  const runScript = () => {
    if (!manualScript.trim() && !generatedScript.trim()) return;
    const script = runnerMode === 'appium' ? (manualScript || generatedScript) : manualScript;
    setRunStatus('running');
    setRunLogs([{ text: '▶  Initializing execution engine…', level: 'info' }, { text: `   Device  : ${deviceModel || 'Unknown'}`, level: 'info' }, { text: `   Package : ${currentPackage || 'Unknown'}`, level: 'info' }, { text: `   Language: ${scriptLang}`, level: 'info' }, { text: '', level: 'info' }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: runnerMode === 'appium' ? 'run_appium_script' : 'run_manual_script', payload: { script, language: scriptLang, lines: script.split('\n').filter(l => l.trim() && !l.startsWith('#')) } }));
    } else { setRunStatus('failed'); setRunLogs(prev => [...prev, { text: '[ERROR] WebSocket disconnected', level: 'error' }]); }
  };

  const downloadRecording = () => {
    if (actions.length === 0) return;
    const data = JSON.stringify({ device: deviceModel, udid: deviceId, package: currentPackage, platform: platform.toUpperCase(), timestamp: new Date().toISOString(), steps: actions }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ZenitRecording_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: 'Recording downloaded' });
  };

  const saveActionsToCase = async () => {
    if (!selectedCaseId || actionsRef.current.length === 0) return;
    const steps = actionsRef.current.map((a, i) => ({
      id: a.id, action: a.type.toLowerCase(),
      target_type: a.locator?.resourceId ? 'resourceId' : a.locator?.accessibilityId ? 'accessibilityId' : 'xpath',
      target_value: a.locator?.resourceId || a.locator?.accessibilityId || a.locator?.xpath || '',
      input_value: a.value || '', expected_result: a.description, order: i + 1,
    }));
    setIsSyncing(true);
    try { await trackerApi.updateCase(selectedCaseId, { steps }); toast({ title: 'Synced to test case' }); }
    catch { toast({ variant: 'destructive', title: 'Sync failed' }); }
    finally { setIsSyncing(false); }
  };

  // ── Filtered tree ──
  const filteredHierarchy = hierarchy;
  const bestLocator = selectedElement ? (
    selectedElement.attributes?.resourceId ? { type: 'Resource ID', value: selectedElement.attributes.resourceId } :
    selectedElement.attributes?.contentDesc ? { type: 'Accessibility ID', value: selectedElement.attributes.contentDesc } :
    selectedElement.attributes?.text ? { type: 'Text', value: selectedElement.attributes.text } : null
  ) : null;

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: '#F0F2F5', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", height: '100dvh' }}>
      <Toaster />

      {/* SaveModuleDialog — rendered at root to escape overflow:hidden tabs */}
      {showSaveModule && selectedElement && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <SaveModuleDialog
            element={selectedElement}
            currentPackage={currentPackage}
            screenshotUrl={screenshotUrl}
            onSave={(m) => { setShowSaveModule(false); toast({ title: `Module "${m.name}" saved` }); }}
            onClose={() => setShowSaveModule(false)}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TOP TOOLBAR
      ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-0 h-11 bg-[#1F1F1F] text-white shrink-0 z-50 px-2">
        {/* Brand */}
        <button onClick={() => router.back()} className="flex items-center gap-2 px-3 h-full hover:bg-white/10 transition-colors text-[12px] text-white/70 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-semibold text-white tracking-wide">ZENIT</span>
          <span className="text-white/40 text-[10px]">VISION</span>
        </button>

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Connection status pill */}
        <div className={`flex items-center gap-2 px-3 py-1 mx-1 rounded text-[11px] font-medium transition-all
          ${wsStatus === 'connected' ? 'bg-green-500/20 text-green-300' : wsStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-green-400' : wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
          {wsStatus === 'connected' ? (
            <span>{deviceModel || 'Device'} <span className="opacity-60">· {streamFps} fps</span></span>
          ) : wsStatus === 'connecting' ? 'Connecting…' : 'No Device'}
        </div>

        {currentPackage && (
          <>
            <div className="w-px h-5 bg-white/15 mx-1" />
            <div className="flex items-center gap-1.5 px-2 text-[11px] text-white/50">
              <Cpu className="w-3 h-3" />
              <span className="font-mono truncate max-w-[200px]">{currentPackage}</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Suite / Case selectors */}
        <div className="flex items-center gap-2 mr-2">
          <Select value={selectedSuiteId} onValueChange={v => { setSelectedSuiteId(v); setSelectedCaseId(''); }}>
            <SelectTrigger className="h-7 text-[11px] w-[150px] bg-white/10 border-white/20 text-white hover:bg-white/15">
              <SelectValue placeholder="Select Suite" />
            </SelectTrigger>
            <SelectContent>{suites.map(s => <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedCaseId} onValueChange={setSelectedCaseId} disabled={!selectedSuiteId}>
            <SelectTrigger className="h-7 text-[11px] w-[150px] bg-white/10 border-white/20 text-white hover:bg-white/15 disabled:opacity-40">
              <SelectValue placeholder="Select Case" />
            </SelectTrigger>
            <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id} className="text-[11px]">{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Record button */}
        <button
          onClick={() => { setIsRecording(r => !r); if (isRecording) {} }}
          className={`flex items-center gap-2 px-4 h-7 mx-1 rounded text-[11px] font-semibold transition-all
            ${isRecording ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-[#0078D4] text-white hover:bg-[#106EBE]'}`}>
          {isRecording ? <><StopCircle className="w-3.5 h-3.5" /> Stop · {actions.length}</> : <><Circle className="w-3 h-3 fill-current" /> Record</>}
        </button>

        {/* WiFi ADB connect */}
        <button onClick={() => setShowWifiPanel(p => !p)} title="Connect via WiFi"
          className={`flex items-center justify-center w-8 h-8 mx-0.5 rounded hover:bg-white/10 transition-colors
            ${wifiStatus === 'connected' ? 'text-green-400' : showWifiPanel ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'}`}>
          <Wifi className="w-3.5 h-3.5" />
        </button>

        {/* Refresh */}
        <button onClick={refreshHierarchy} title="Refresh hierarchy"
          className={`flex items-center justify-center w-8 h-8 mx-0.5 rounded hover:bg-white/10 transition-colors ${isSyncing ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}>
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        {/* Fullscreen toggle */}
        <button onClick={() => setIsFullscreen(f => !f)} title="Toggle fullscreen"
          className="flex items-center justify-center w-8 h-8 mx-0.5 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          WIFI CONNECT PANEL
      ══════════════════════════════════════════════════════ */}
      {showWifiPanel && (
        <div className="shrink-0 bg-[#2A2A2A] border-b border-white/10 px-4 py-3 flex items-center gap-3 z-40">
          <Wifi className="w-4 h-4 text-[#0078D4] shrink-0" />
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[11px] font-semibold text-white">WiFi ADB</span>
            <span className="text-[10px] text-white/40">USB required for first-time setup</span>
          </div>
          <div className="w-px h-8 bg-white/10 mx-1" />
          {/* Step 1: Enable tcpip */}
          <button
            onClick={async () => {
              setWifiStatus('enabling');
              setWifiMessage('Enabling TCP/IP…');
              wsRef.current?.send(JSON.stringify({ type: 'wifi_enable_tcpip', port: parseInt(wifiPort) }));
            }}
            disabled={wifiStatus === 'enabling' || wsStatus !== 'connected'}
            className="flex items-center gap-1.5 px-3 h-7 text-[11px] rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 font-medium transition-colors shrink-0">
            {wifiStatus === 'enabling' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span className="text-white/60 mr-0.5">1.</span>}
            Enable TCP/IP
          </button>
          <div className="w-px h-8 bg-white/10 mx-1" />
          {/* Step 2: Enter IP and connect */}
          <span className="text-[11px] text-white/60 shrink-0">2. Device IP:</span>
          <input
            value={wifiIp}
            onChange={e => setWifiIp(e.target.value)}
            placeholder="192.168.1.x"
            className="w-[120px] h-7 px-2 text-[11px] bg-white/10 border border-white/20 rounded text-white placeholder:text-white/30 outline-none focus:border-[#0078D4]"
          />
          <span className="text-white/40 text-[11px]">:</span>
          <input
            value={wifiPort}
            onChange={e => setWifiPort(e.target.value)}
            className="w-[52px] h-7 px-2 text-[11px] bg-white/10 border border-white/20 rounded text-white outline-none focus:border-[#0078D4]"
          />
          <button
            onClick={() => wsRef.current?.send(JSON.stringify({ type: 'wifi_connect', ip: wifiIp, port: parseInt(wifiPort) }))}
            disabled={!wifiIp.trim() || wifiStatus === 'connecting' || wsStatus !== 'connected'}
            className="flex items-center gap-1.5 px-3 h-7 text-[11px] rounded bg-[#0078D4] text-white hover:bg-[#106EBE] disabled:opacity-40 font-medium transition-colors shrink-0">
            {wifiStatus === 'connecting' ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
            Connect
          </button>
          {/* Status message */}
          {wifiMessage && (
            <span className={`text-[11px] ml-1 ${wifiStatus === 'connected' ? 'text-green-400' : wifiStatus === 'error' ? 'text-red-400' : 'text-white/60'}`}>
              {wifiMessage}
            </span>
          )}
          <div className="flex-1" />
          {/* Disconnect */}
          {wifiStatus === 'connected' && (
            <button
              onClick={() => wsRef.current?.send(JSON.stringify({ type: 'wifi_disconnect', ip: wifiIp, port: parseInt(wifiPort) }))}
              className="flex items-center gap-1.5 px-3 h-7 text-[11px] rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 font-medium transition-colors shrink-0">
              Disconnect
            </button>
          )}
          <button onClick={() => setShowWifiPanel(false)} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MAIN WORKSPACE
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL: Element Tree ── */}
        {!isFullscreen && (
          <div className={`flex flex-col bg-white border-r border-[#E0E0E0] transition-all duration-200 shrink-0 min-h-0 ${leftOpen ? 'w-[260px]' : 'w-10'}`}>
            {/* Panel header */}
            <div className="flex items-center h-9 px-2 border-b border-[#E8E8E8] bg-[#FAFAFA] shrink-0">
              {leftOpen && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-[#0078D4] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#2D2D2D] uppercase tracking-wider">
                    {leftPanelMode === 'tree' ? 'Element Tree' : 'Modules'}
                  </span>
                  {hierarchy && leftPanelMode === 'tree' && <span className="text-[10px] text-[#999] bg-[#F0F0F0] px-1.5 py-0.5 rounded-full">Live</span>}
                  <div className="flex rounded overflow-hidden border border-[#E0E0E0] ml-auto">
                    <button onClick={() => setLeftPanelMode('tree')} className={`px-2 py-0.5 text-[10px] transition-colors ${leftPanelMode === 'tree' ? 'bg-[#0078D4] text-white' : 'text-[#616161] hover:bg-[#F0F0F0]'}`}>Tree</button>
                    <button onClick={() => setLeftPanelMode('modules')} className={`px-2 py-0.5 text-[10px] transition-colors ${leftPanelMode === 'modules' ? 'bg-[#0078D4] text-white' : 'text-[#616161] hover:bg-[#F0F0F0]'}`}>Modules</button>
                  </div>
                </div>
              )}
              <button onClick={() => setLeftOpen(o => !o)} className={`${leftOpen ? 'ml-1' : 'mx-auto'} p-1 hover:bg-[#F0F0F0] rounded transition-colors`}>
                {leftOpen ? <ChevronLeft className="w-3.5 h-3.5 text-[#616161]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#616161]" />}
              </button>
            </div>

            {leftOpen && (
              <>
                {leftPanelMode === 'tree' ? (
                  <>
                    {/* Search */}
                    <div className="px-2 py-2 border-b border-[#F0F0F0] shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#ABABAB]" />
                        <input value={treeSearch} onChange={e => setTreeSearch(e.target.value)}
                          placeholder="Filter elements…"
                          className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-[#F5F5F5] border border-[#E0E0E0] rounded-md outline-none focus:border-[#0078D4] focus:bg-white transition-colors placeholder:text-[#ABABAB]" />
                      </div>
                    </div>

                    {/* Tree */}
                    <div className="flex-1 min-h-0 overflow-y-auto vs-scroll">
                      <div className="p-1.5">
                        {filteredHierarchy
                          ? <TreeNode node={filteredHierarchy} level={0} selectedId={selectedElement?.id} onSelect={setSelectedElement} />
                          : (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                              <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                                <Smartphone className="w-5 h-5 text-[#ABABAB]" />
                              </div>
                              <div>
                                <div className="text-[12px] font-medium text-[#424242]">No hierarchy</div>
                                <div className="text-[11px] text-[#999] mt-0.5">Connect a device to inspect elements</div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ModuleLibraryPanel currentPackage={currentPackage} hierarchy={hierarchy} screenshotUrl={screenshotUrl} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CENTER: Device Screen ── */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #E8EDF2 0%, #DDE3EA 100%)' }}>

          {/* Mode toggle — top left */}
          <div className="absolute top-4 left-4 z-20 flex rounded-lg overflow-hidden border border-[#D0D0D0] shadow-sm bg-white">
            {(['interact', 'inspect'] as const).map(m => (
              <button key={m} onClick={() => setInteractionMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors
                  ${interactionMode === m ? 'bg-[#0078D4] text-white' : 'text-[#616161] hover:bg-[#F5F5F5]'}`}>
                {m === 'interact' ? <MousePointer className="w-3 h-3" /> : <Crosshair className="w-3 h-3" />}
                {m === 'interact' ? 'Interact' : 'Inspect'}
              </button>
            ))}
          </div>

          {/* Action feedback badge — top right */}
          {actionFeedbackVisible && (
            <div className="absolute top-4 right-4 z-30 fade-slide-in">
              <div className="flex items-center gap-2 bg-[#1F1F1F]/90 text-white text-[11px] px-3 py-2 rounded-lg shadow-xl backdrop-blur-sm font-medium">
                <Zap className="w-3 h-3 text-yellow-400" />
                {lastAction}
              </div>
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-500 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg font-semibold">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              REC · {actions.length} actions
            </div>
          )}

          {/* Device frame — orientation-aware */}
          <div className={`relative flex items-center justify-center flex-1 min-h-0 w-full transition-all duration-500 ${isLandscape ? 'flex-row gap-3 px-6 py-4' : 'flex-col gap-0 py-4'}`}>

            {/* ── PHONE SHELL ── */}
            <div
              className="relative shadow-2xl transition-all duration-500 shrink-0"
              style={isLandscape
                ? { width: 'min(calc(100vh - 200px), 680px)', aspectRatio: '19.5/9' }
                : { height: 'min(calc(100vh - 200px), 680px)', aspectRatio: '9/19.5' }
              }>

              {/* Outer shell */}
              <div className={`absolute inset-0 bg-gradient-to-b from-[#2A2A2A] to-[#1A1A1A] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.5)] transition-all duration-500 ${isLandscape ? 'rounded-[20px]' : 'rounded-[36px]'}`} />

              {/* Hardware buttons — portrait */}
              {!isLandscape && <>
                <div className="absolute -left-[3px] top-[18%] w-[3px] h-8 bg-[#333] rounded-l-sm" />
                <div className="absolute -left-[3px] top-[28%] w-[3px] h-12 bg-[#333] rounded-l-sm" />
                <div className="absolute -left-[3px] top-[42%] w-[3px] h-12 bg-[#333] rounded-l-sm" />
                <div className="absolute -right-[3px] top-[25%] w-[3px] h-16 bg-[#333] rounded-r-sm" />
              </>}

              {/* Hardware buttons — landscape (rotated 90°: left=bottom, right=top) */}
              {isLandscape && <>
                <div className="absolute bottom-[-3px] left-[18%] h-[3px] w-8 bg-[#333] rounded-b-sm" />
                <div className="absolute bottom-[-3px] left-[28%] h-[3px] w-12 bg-[#333] rounded-b-sm" />
                <div className="absolute bottom-[-3px] left-[42%] h-[3px] w-12 bg-[#333] rounded-b-sm" />
                <div className="absolute top-[-3px] left-[25%] h-[3px] w-16 bg-[#333] rounded-t-sm" />
              </>}

              {/* Screen area */}
              <div className={`absolute bg-black overflow-hidden transition-all duration-500 ${isLandscape ? 'inset-[5px] rounded-[15px]' : 'inset-[6px] rounded-[30px]'}`}>

                {/* Notch — portrait: top center | landscape: left center */}
                {!isLandscape && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[3%] bg-[#1A1A1A] rounded-b-2xl z-10 flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                    <div className="w-2.5 h-1 rounded-full bg-[#2A2A2A]" />
                  </div>
                )}
                {isLandscape && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[30%] w-[2%] bg-[#1A1A1A] rounded-r-2xl z-10 flex flex-col items-center justify-center gap-1">
                    <div className="w-1 h-1.5 rounded-full bg-[#333]" />
                    <div className="w-1 h-2.5 rounded-full bg-[#2A2A2A]" />
                  </div>
                )}

                {/* Interactive screen */}
                <div
                  ref={screenRef}
                  className={`absolute inset-0 ${interactionMode === 'interact' ? 'cursor-crosshair' : 'cursor-default'}`}
                  onMouseDown={handleScreenMouseDown}
                  onMouseMove={handleScreenMouseMove}
                  onMouseUp={handleScreenMouseUp}
                  onWheel={handleScreenWheel}
                  onContextMenu={handleScreenContextMenu}>

                  {screenshotUrl
                    ? <img src={screenshotUrl} alt="device screen" className="w-full h-full object-fill select-none pointer-events-none" draggable={false} />
                    : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0D0D0D]">
                        <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center">
                          <Smartphone className="w-8 h-8 text-[#444]" />
                        </div>
                        <div className="text-center">
                          <div className="text-[#555] text-[13px] font-medium">
                            {wsStatus === 'connecting' ? 'Connecting to device…' : wsStatus === 'connected' ? 'Waiting for stream…' : 'No device connected'}
                          </div>
                          <div className="text-[#333] text-[11px] mt-1">
                            {wsStatus === 'disconnected' ? 'Connect via ADB: adb devices' : ''}
                          </div>
                        </div>
                        {wsStatus === 'connecting' && <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#0078D4] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
                      </div>
                    )}

                  {/* Inspect overlays */}
                  {interactionMode === 'inspect' && hierarchy && (
                    <div className="absolute inset-0 z-50">
                      <Overlays node={hierarchy} onSelect={setSelectedElement} selectedId={selectedElement?.id} isLandscape={isLandscape} />
                    </div>
                  )}

                  {/* Selected element highlight */}
                  {selectedElement && interactionMode === 'interact' && (
                    <div className="absolute pointer-events-none z-40 transition-all duration-150"
                      style={{ ...boundsStyle(selectedElement), border: '2px solid #0078D4', background: 'rgba(0,120,212,0.12)', boxShadow: '0 0 0 1px rgba(0,120,212,0.3)' }} />
                  )}

                  {/* Tap ripple */}
                  {tapFeedback && (
                    <div className="absolute pointer-events-none z-50" style={{ left: tapFeedback.x - 24, top: tapFeedback.y - 24 }}>
                      <div className="w-12 h-12 rounded-full border-2 border-[#0078D4] ripple-anim" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#0078D4] opacity-80" />
                      </div>
                    </div>
                  )}

                  {/* Swipe trail */}
                  {isDragging && dragStartVisual && dragEndVisual && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
                      <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                          <polygon points="0 0, 6 2, 0 4" fill="#0078D4" />
                        </marker>
                      </defs>
                      <line x1={`${dragStartVisual.x * 100}%`} y1={`${dragStartVisual.y * 100}%`} x2={`${dragEndVisual.x * 100}%`} y2={`${dragEndVisual.y * 100}%`}
                        stroke="#0078D4" strokeWidth="2.5" strokeDasharray="6 3" markerEnd="url(#arrowhead)" opacity="0.8" />
                      <circle cx={`${dragStartVisual.x * 100}%`} cy={`${dragStartVisual.y * 100}%`} r="5" fill="#0078D4" opacity="0.5" />
                    </svg>
                  )}

                  {/* Keyboard bar */}
                  {showKeyboardBar && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#F3F3F3]/95 backdrop-blur-sm border-t border-[#D0D0D0] p-2 z-50 flex gap-2 shadow-lg">
                      <input autoFocus value={keyboardInput} onChange={e => setKeyboardInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { sendKeyInput(keyboardInput, true); setShowKeyboardBar(false); } if (e.key === 'Escape') setShowKeyboardBar(false); }}
                        placeholder="Type and press Enter to send…"
                        className="flex-1 text-[12px] px-3 py-1.5 border border-[#D0D0D0] rounded-md outline-none focus:border-[#0078D4] bg-white" />
                      <button onClick={() => { const t = keyboardInput; sendKeyInput(t); if (t.trim()) setShowKeyboardBar(false); }} className="px-3 py-1.5 bg-[#0078D4] text-white text-[11px] rounded-md font-medium hover:bg-[#106EBE]">Send</button>
                      <button onClick={() => setShowKeyboardBar(false)} className="px-2 py-1.5 text-[#616161] text-[11px] hover:bg-[#E8E8E8] rounded-md">✕</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── NAV BAR — portrait: horizontal below | landscape: vertical right ── */}
            <div className={`bg-white/90 backdrop-blur-sm shadow-lg border border-white/60 transition-all duration-500 shrink-0
              ${isLandscape
                ? 'flex flex-col items-center gap-1 rounded-2xl px-2.5 py-4 self-center'
                : 'flex flex-row items-center gap-1 rounded-2xl px-4 py-2.5 mt-4'
              }`}>
              {[
                { icon: <ArrowLeft className="w-4 h-4" />, fn: () => sendDeviceAction('back'), title: 'Back' },
                { icon: <Home className="w-4 h-4" />, fn: () => sendDeviceAction('home'), title: 'Home' },
                { icon: <Square className="w-4 h-4" />, fn: () => sendDeviceAction('recents'), title: 'Recents' },
              ].map(b => (
                <button key={b.title} onClick={b.fn} title={b.title}
                  className="p-2 hover:bg-[#F0F0F0] rounded-xl transition-colors text-[#424242]">{b.icon}</button>
              ))}
              <div className={isLandscape ? 'h-px w-5 bg-[#E0E0E0] my-1' : 'w-px h-5 bg-[#E0E0E0] mx-1'} />
              {[
                { icon: <ArrowUp className="w-4 h-4" />, fn: () => sendScroll('up'), title: 'Scroll Up' },
                { icon: <ArrowDown className="w-4 h-4" />, fn: () => sendScroll('down'), title: 'Scroll Down' },
              ].map(b => (
                <button key={b.title} onClick={b.fn} title={b.title}
                  className="p-2 hover:bg-[#F0F0F0] rounded-xl transition-colors text-[#424242]">{b.icon}</button>
              ))}
              <div className={isLandscape ? 'h-px w-5 bg-[#E0E0E0] my-1' : 'w-px h-5 bg-[#E0E0E0] mx-1'} />
              <button onClick={() => setShowKeyboardBar(b => !b)} title="Keyboard"
                className={`p-2 rounded-xl transition-colors ${showKeyboardBar ? 'bg-[#0078D4] text-white' : 'hover:bg-[#F0F0F0] text-[#424242]'}`}>
                <Type className="w-4 h-4" />
              </button>
              <button onClick={() => sendWsAction({ action: 'screenshot' })} title="Screenshot"
                className="p-2 hover:bg-[#F0F0F0] rounded-xl transition-colors text-[#424242]">
                <Camera className="w-4 h-4" />
              </button>
              <div className={isLandscape ? 'h-px w-5 bg-[#E0E0E0] my-1' : 'w-px h-5 bg-[#E0E0E0] mx-1'} />
              {/* Rotate button — always visible here */}
              <button
                onClick={() => sendWsAction({ action: 'rotate' })}
                title={isLandscape ? 'Switch to Portrait' : 'Switch to Landscape'}
                className={`p-2 rounded-xl transition-all ${isLandscape ? 'bg-[#0078D4] text-white' : 'hover:bg-[#F0F0F0] text-[#424242]'}`}>
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context menu */}
          {contextMenu && (
            <div className="fixed z-[100] bg-white border border-[#E0E0E0] rounded-xl shadow-2xl py-1.5 text-[12px] min-w-[160px] overflow-hidden"
              style={{ left: contextMenu.x, top: contextMenu.y }}>
              <div className="px-3 py-1 text-[10px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#F0F0F0] mb-1">Actions</div>
              {[
                { label: 'Tap', icon: <MousePointer className="w-3.5 h-3.5" />, fn: () => sendTap(contextMenu.screenX, contextMenu.screenY) },
                { label: 'Long Press', icon: <Clock className="w-3.5 h-3.5" />, fn: () => sendLongPress(contextMenu.screenX, contextMenu.screenY) },
                { label: 'Double Tap', icon: <Zap className="w-3.5 h-3.5" />, fn: () => sendDoubleTap(contextMenu.screenX, contextMenu.screenY) },
                { label: 'Inspect Element', icon: <Crosshair className="w-3.5 h-3.5" />, fn: () => { setInteractionMode('inspect'); const hit = hierarchy ? findElementAt(hierarchy, contextMenu.screenX, contextMenu.screenY) : null; if (hit) { setSelectedElement(hit); setRightTab('inspector'); } } },
              ].map(item => (
                <button key={item.label} onClick={() => { item.fn(); setContextMenu(null); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-[#F5F5F5] text-left text-[#2D2D2D] transition-colors">
                  <span className="text-[#0078D4]">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Inspector / Recorder / Script / Runner ── */}
        {!isFullscreen && (
          <div className={`flex flex-col bg-white border-l border-[#E0E0E0] transition-all duration-200 shrink-0 min-h-0 ${rightOpen ? 'w-[380px]' : 'w-10'}`}>
            {/* Panel header */}
            <div className="flex items-center h-9 px-2 border-b border-[#E8E8E8] bg-[#FAFAFA] shrink-0">
              <button onClick={() => setRightOpen(o => !o)} className={`${rightOpen ? '' : 'mx-auto'} p-1 hover:bg-[#F0F0F0] rounded transition-colors`}>
                {rightOpen ? <ChevronRight className="w-3.5 h-3.5 text-[#616161]" /> : <ChevronLeft className="w-3.5 h-3.5 text-[#616161]" />}
              </button>
              {rightOpen && (
                <div className="flex items-center gap-2 flex-1 ml-1">
                  <span className="text-[11px] font-semibold text-[#2D2D2D] uppercase tracking-wider">Inspector</span>
                  {isRecording && <span className="ml-auto flex items-center gap-1 text-[10px] text-red-500 font-semibold"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />REC</span>}
                </div>
              )}
            </div>

            {rightOpen && (
              <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ height: 0 }}>
                {/* Tab bar */}
                <TabsList className="flex h-9 bg-[#F8F8F8] border-b border-[#E8E8E8] rounded-none px-0 gap-0 shrink-0 overflow-x-auto no-scrollbar">
                  {[
                    { v: 'inspector', icon: <Eye className="w-3 h-3" />,         label: 'Inspect' },
                    { v: 'recorder',  icon: <Activity className="w-3 h-3" />,    label: actions.length > 0 ? `Rec (${actions.length})` : 'Rec' },
                    { v: 'gestures',  icon: <MousePointer2 className="w-3 h-3" />, label: 'Gestures' },
                    { v: 'script',    icon: <Code2 className="w-3 h-3" />,       label: 'Script' },
                    { v: 'runner',    icon: <Terminal className="w-3 h-3" />,    label: 'Runner' },
                    { v: 'docs',      icon: <BookOpen className="w-3 h-3" />,    label: 'Docs' },
                    { v: 'modules',   icon: <Package className="w-3 h-3" />,     label: 'Modules' },
                    { v: 'builder',   icon: <Blocks className="w-3 h-3" />,      label: 'Build' },
                    { v: 'data',      icon: <Table2 className="w-3 h-3" />,      label: 'Data' },
                    { v: 'logcat',    icon: <FileText className="w-3 h-3" />,    label: logcatRunning ? 'Logs ●' : 'Logs' },
                  ].map(t => (                    <TabsTrigger key={t.v} value={t.v}
                      className="flex items-center gap-1.5 px-2 h-full text-[10.5px] font-medium rounded-none border-b-2 border-transparent
                        data-[state=active]:border-[#0078D4] data-[state=active]:text-[#0078D4] data-[state=active]:bg-white
                        text-[#616161] hover:text-[#2D2D2D] hover:bg-[#F0F0F0] transition-colors whitespace-nowrap">
                      {t.icon}{t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── INSPECTOR TAB ── */}
                <TabsContent value="inspector" className="flex-1 min-h-0 overflow-y-auto vs-scroll m-0 data-[state=inactive]:hidden">
                  {selectedElement ? (
                    <div className="p-3 space-y-3 pb-6">
                      {/* Element header */}
                      <div className="bg-gradient-to-r from-[#EBF4FF] to-[#F0F7FF] rounded-lg p-3 border border-[#C7E0F4]">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#0078D4] flex items-center justify-center shrink-0">
                            <MousePointer2 className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[#0078D4] truncate">{selectedElement.name || selectedElement.type?.split('.').pop()}</div>
                            <div className="text-[10px] text-[#616161] font-mono truncate mt-0.5">{selectedElement.type}</div>
                          </div>
                          {selectedElement.attributes?.clickable && (
                            <span className="text-[9px] bg-[#0078D4] text-white px-1.5 py-0.5 rounded-full font-semibold shrink-0">CLICKABLE</span>
                          )}
                        </div>
                      </div>

                      {/* Locators section */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="w-3 h-3 text-[#0078D4]" />
                          <span className="text-[11px] font-semibold text-[#2D2D2D] uppercase tracking-wider">Locators</span>
                          <span className="text-[9px] text-[#999] bg-[#F0F0F0] px-1.5 py-0.5 rounded-full">Priority order</span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedElement.attributes?.resourceId && <LocatorBadge type="Resource ID" value={selectedElement.attributes.resourceId} best />}
                          {selectedElement.attributes?.contentDesc && <LocatorBadge type="Accessibility ID" value={selectedElement.attributes.contentDesc} best={!selectedElement.attributes?.resourceId} />}
                          {selectedElement.attributes?.text && <LocatorBadge type="Text" value={selectedElement.attributes.text} />}
                          {(() => {
                            const cls = selectedElement.type?.split('.').pop() || '*';
                            const rid = selectedElement.attributes?.resourceId;
                            const cd = selectedElement.attributes?.contentDesc;
                            const txt = selectedElement.attributes?.text;
                            const xp = rid ? `//${cls}[@resource-id='${rid}']` : cd ? `//${cls}[@content-desc='${cd}']` : txt ? `//${cls}[@text='${txt}']` : `//${cls}`;
                            return <LocatorBadge type="XPath" value={xp} />;
                          })()}
                        </div>
                      </div>

                      {/* Attributes */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="w-3 h-3 text-[#616161]" />
                          <span className="text-[11px] font-semibold text-[#2D2D2D] uppercase tracking-wider">Attributes</span>
                        </div>
                        <div className="rounded-lg border border-[#E8E8E8] overflow-hidden">
                          {Object.entries(selectedElement.attributes || {}).filter(([k]) => k !== 'bounds').map(([k, v], idx) => (
                            <div key={k} className={`flex items-center gap-2 px-3 py-2 text-[11px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                              <span className="text-[#888] w-24 shrink-0 font-medium">{k}</span>
                              <span className="text-[#1E1E1E] font-mono text-[10.5px] flex-1 truncate">{String(v)}</span>
                              <button onClick={() => navigator.clipboard.writeText(String(v))} className="shrink-0 p-1 hover:bg-[#E8E8E8] rounded transition-colors">
                                <Copy className="w-2.5 h-2.5 text-[#ABABAB]" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bounds */}
                      {selectedElement.attributes?.bounds && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Crosshair className="w-3 h-3 text-[#616161]" />
                            <span className="text-[11px] font-semibold text-[#2D2D2D] uppercase tracking-wider">Bounds</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(selectedElement.attributes.bounds).map(([k, v]) => (
                              <div key={k} className="bg-[#F8F8F8] rounded-md px-2.5 py-2 border border-[#E8E8E8]">
                                <div className="text-[9px] text-[#999] uppercase tracking-wider">{k}</div>
                                <div className="text-[12px] font-semibold text-[#1E1E1E] font-mono">{typeof v === 'number' ? (v * 100).toFixed(1) + '%' : String(v)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { const rid = selectedElement.attributes?.resourceId; if (rid) { sendWsAction({ action: 'tap_by_id', resourceId: rid }); showActionFeedback(`Tap: ${rid}`); } }}
                          className="flex-1 py-2 bg-[#0078D4] text-white text-[11px] rounded-lg hover:bg-[#106EBE] font-medium transition-colors flex items-center justify-center gap-1.5">
                          <MousePointer className="w-3 h-3" /> Tap Element
                        </button>
                        <button onClick={() => setShowKeyboardBar(true)}
                          className="flex-1 py-2 border border-[#D0D0D0] text-[#424242] text-[11px] rounded-lg hover:bg-[#F5F5F5] font-medium transition-colors flex items-center justify-center gap-1.5">
                          <Type className="w-3 h-3" /> Type Into
                        </button>
                      </div>
                      <button onClick={() => setShowSaveModule(true)}
                        className="w-full py-2 border border-dashed border-[#0078D4] text-[#0078D4] text-[11px] rounded-lg hover:bg-[#EBF4FF] font-medium transition-colors flex items-center justify-center gap-1.5 mt-1">
                        <Package className="w-3 h-3" /> Save as Module
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#F0F4FF] flex items-center justify-center">
                        <Crosshair className="w-7 h-7 text-[#0078D4] opacity-50" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#424242]">No element selected</div>
                        <div className="text-[11px] text-[#999] mt-1 leading-relaxed">Switch to Inspect mode and click<br />any element on the device screen</div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── RECORDER TAB ── */}
                <TabsContent value="recorder" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-[#F0F0F0] shrink-0 bg-[#FAFAFA]">
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold text-[#2D2D2D]">{actions.length} Recorded Actions</div>
                      {actions.length > 0 && <div className="text-[10px] text-[#999] mt-0.5">Ready to run or generate script</div>}
                    </div>
                    <button onClick={downloadRecording} disabled={actions.length === 0} title="Download JSON"
                      className="p-1.5 hover:bg-[#E8E8E8] rounded-md transition-colors disabled:opacity-40 text-[#616161]">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={saveActionsToCase} disabled={!selectedCaseId || actions.length === 0} title="Sync to test case"
                      className="p-1.5 hover:bg-[#E8E8E8] rounded-md transition-colors disabled:opacity-40 text-[#616161]">
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    {/* Run on Device — native ADB runner, no Appium needed */}
                    <button
                      onClick={() => {
                        if (nativeRunStatus === 'running') {
                          wsRef.current?.send(JSON.stringify({ type: 'stop_script' }));
                          setNativeRunStatus('idle');
                          setRunStatus('idle');
                        } else {
                          setNativeStepResults({});
                          setRightTab('runner');
                          wsRef.current?.send(JSON.stringify({ type: 'run_native_steps', steps: actionsRef.current }));
                        }
                      }}
                      disabled={actions.length === 0 || wsStatus !== 'connected'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-[11px] rounded-md font-medium transition-colors disabled:opacity-40
                        ${nativeRunStatus === 'running' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                      {nativeRunStatus === 'running' ? <><StopCircle className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Run</>}
                    </button>
                    <button onClick={() => { generateScript(); setRightTab('script'); }} disabled={actions.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0078D4] text-white text-[11px] rounded-md hover:bg-[#106EBE] disabled:opacity-40 font-medium transition-colors">
                      <Code2 className="w-3 h-3" /> Script
                    </button>
                    <button onClick={() => setActions([])} disabled={actions.length === 0} title="Clear all"
                      className="p-1.5 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40 text-red-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Action list */}
                  <div className="flex-1 min-h-0 overflow-y-auto vs-scroll">
                    {actions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFF0F0] flex items-center justify-center">
                          <Circle className="w-7 h-7 text-red-400 opacity-50" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#424242]">No actions recorded</div>
                          <div className="text-[11px] text-[#999] mt-1 leading-relaxed">Press Record and interact with<br />the device to capture actions</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {actions.map((a, i) => {
                          const meta = getActionMeta(a.type.toString());
                          const bestLoc = a.locator?.resourceId || a.locator?.accessibilityId || a.locator?.text || a.locator?.xpath || '';
                          const stepResult = nativeStepResults[a.id];
                          return (
                            <div key={a.id} className={`group flex items-start gap-2.5 p-2.5 rounded-lg border transition-all
                              ${stepResult ? (stepResult.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50') : 'border-[#F0F0F0] hover:border-[#E0E0E0] hover:bg-[#FAFAFA]'}`}>
                              {/* Step number / result indicator */}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5
                                ${stepResult ? (stepResult.passed ? 'bg-green-500' : 'bg-red-500') : 'bg-[#F0F0F0]'}`}>
                                {stepResult
                                  ? (stepResult.passed
                                    ? <CheckCircle2 className="w-3 h-3 text-white" />
                                    : <XCircle className="w-3 h-3 text-white" />)
                                  : <span className="text-[9px] font-bold text-[#888]">{i + 1}</span>}
                              </div>
                              {/* Action type badge */}
                              <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 mt-0.5" style={{ background: meta.bg, color: meta.color }}>
                                {meta.icon}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                  {a.value && <span className="text-[10px] text-[#888] font-mono truncate max-w-[100px]">&quot;{a.value}&quot;</span>}
                                </div>
                                <div className="text-[10.5px] text-[#616161] truncate mt-0.5">{a.description}</div>
                                {stepResult && !stepResult.passed && (
                                  <div className="text-[10px] text-red-500 mt-0.5 truncate">{stepResult.detail}</div>
                                )}
                                {bestLoc && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Hash className="w-2.5 h-2.5 text-[#ABABAB] shrink-0" />
                                    <span className="text-[9.5px] font-mono text-[#ABABAB] truncate">{bestLoc}</span>
                                  </div>
                                )}
                              </div>
                              {/* Delete */}
                              <button onClick={() => setActions(prev => prev.filter(x => x.id !== a.id))}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── GESTURES TAB ── */}
                <TabsContent value="gestures" className="flex-1 min-h-0 overflow-y-auto vs-scroll m-0 p-3 data-[state=inactive]:hidden">
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-1 mb-2">Navigation</div>
                    {[
                      { label: 'Back', icon: <ArrowLeft className="w-4 h-4" />, fn: () => sendDeviceAction('back'), color: '#616161' },
                      { label: 'Home', icon: <Home className="w-4 h-4" />, fn: () => sendDeviceAction('home'), color: '#616161' },
                      { label: 'Recents', icon: <Square className="w-4 h-4" />, fn: () => sendDeviceAction('recents'), color: '#616161' },
                    ].map(g => (
                      <button key={g.label} onClick={g.fn}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-[12px] bg-[#F8F8F8] hover:bg-[#EEF4FF] border border-[#EEEEEE] hover:border-[#C7E0F4] rounded-lg transition-all text-left font-medium text-[#2D2D2D]">
                        <span style={{ color: g.color }}>{g.icon}</span>{g.label}
                      </button>
                    ))}
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-1 mt-4 mb-2">Swipe & Scroll</div>
                    {[
                      { label: 'Swipe Up', icon: <ArrowUp className="w-4 h-4" />, fn: () => sendSwipe(0.5, 0.7, 0.5, 0.3), color: '#8764B8' },
                      { label: 'Swipe Down', icon: <ArrowDown className="w-4 h-4" />, fn: () => sendSwipe(0.5, 0.3, 0.5, 0.7), color: '#8764B8' },
                      { label: 'Swipe Left', icon: <ArrowLeft className="w-4 h-4" />, fn: () => sendSwipe(0.8, 0.5, 0.2, 0.5), color: '#8764B8' },
                      { label: 'Swipe Right', icon: <ArrowRight className="w-4 h-4" />, fn: () => sendSwipe(0.2, 0.5, 0.8, 0.5), color: '#8764B8' },
                      { label: 'Scroll Up', icon: <ArrowUp className="w-4 h-4" />, fn: () => sendScroll('up'), color: '#0078D4' },
                      { label: 'Scroll Down', icon: <ArrowDown className="w-4 h-4" />, fn: () => sendScroll('down'), color: '#0078D4' },
                    ].map(g => (
                      <button key={g.label} onClick={g.fn}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-[12px] bg-[#F8F8F8] hover:bg-[#EEF4FF] border border-[#EEEEEE] hover:border-[#C7E0F4] rounded-lg transition-all text-left font-medium text-[#2D2D2D]">
                        <span style={{ color: g.color }}>{g.icon}</span>{g.label}
                      </button>
                    ))}
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-1 mt-4 mb-2">Device</div>
                    {[
                      { label: 'Rotate', icon: <RotateCw className="w-4 h-4" />, fn: () => sendWsAction({ action: 'rotate' }), color: '#107C10' },
                      { label: 'Screenshot', icon: <Camera className="w-4 h-4" />, fn: () => sendWsAction({ action: 'screenshot' }), color: '#107C10' },
                      { label: 'Power', icon: <Power className="w-4 h-4" />, fn: () => sendWsAction({ action: 'power' }), color: '#C7A008' },
                    ].map(g => (
                      <button key={g.label} onClick={g.fn}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-[12px] bg-[#F8F8F8] hover:bg-[#EEF4FF] border border-[#EEEEEE] hover:border-[#C7E0F4] rounded-lg transition-all text-left font-medium text-[#2D2D2D]">
                        <span style={{ color: g.color }}>{g.icon}</span>{g.label}
                      </button>
                    ))}
                  </div>
                </TabsContent>

                {/* ── SCRIPT TAB ── */}
                <TabsContent value="script" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
                  {/* Script toolbar */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F0F0F0] shrink-0 bg-[#FAFAFA]">
                    <Select value={scriptLang} onValueChange={setScriptLang}>
                      <SelectTrigger className="h-7 text-[11px] w-[120px] border-[#D0D0D0] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="python" className="text-[11px]">🐍 Python</SelectItem>
                        <SelectItem value="java" className="text-[11px]">☕ Java</SelectItem>
                        <SelectItem value="javascript" className="text-[11px]">🟨 JavaScript</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={generateScript} disabled={isGenerating || (actions.length === 0 && !selectedCaseId)}
                      className="flex items-center gap-1.5 px-3 h-7 bg-[#0078D4] text-white text-[11px] rounded-md hover:bg-[#106EBE] disabled:opacity-50 font-medium transition-colors">
                      {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileCode className="w-3 h-3" />}
                      {isGenerating ? 'Generating…' : 'Generate'}
                    </button>
                    <div className="flex-1" />
                    {generatedScript && (
                      <>
                        <button onClick={copyScript}
                          className={`flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-md border transition-all font-medium
                            ${scriptCopied ? 'bg-green-50 border-green-300 text-green-600' : 'border-[#D0D0D0] text-[#616161] hover:bg-[#F0F0F0]'}`}>
                          {scriptCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {scriptCopied ? 'Copied!' : 'Copy'}
                        </button>
                        <button onClick={() => { setManualScript(generatedScript); setRightTab('runner'); setRunnerMode('appium'); }}
                          className="flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-md border border-[#D0D0D0] text-[#616161] hover:bg-[#F0F0F0] transition-colors font-medium">
                          <PlayCircle className="w-3 h-3" /> Run
                        </button>
                      </>
                    )}
                  </div>

                  {/* Script editor */}
                  {generatedScript ? (
                    <div className="flex-1 min-h-0 overflow-hidden relative">
                      {/* Language badge */}
                      <div className="absolute top-2 right-3 z-10 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#2D2D2D] text-[#888]">
                        {scriptLang}
                      </div>
                      <textarea
                        value={generatedScript}
                        onChange={e => setGeneratedScript(e.target.value)}
                        className="w-full h-full text-[11px] font-mono bg-[#1E1E1E] text-[#D4D4D4] p-4 resize-none outline-none vs-scroll leading-relaxed"
                        style={{ tabSize: 4 }}
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#1E1E1E]">
                      <div className="w-14 h-14 rounded-2xl bg-[#2D2D2D] flex items-center justify-center">
                        <Code2 className="w-7 h-7 text-[#555]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#888]">No script generated</div>
                        <div className="text-[11px] text-[#555] mt-1 leading-relaxed">Record actions then click Generate<br />to produce a complete Appium script</div>
                      </div>
                      <button onClick={generateScript} disabled={actions.length === 0 && !selectedCaseId}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0078D4] text-white text-[12px] rounded-lg hover:bg-[#106EBE] disabled:opacity-40 font-medium transition-colors">
                        <FileCode className="w-4 h-4" /> Generate Script
                      </button>
                    </div>
                  )}
                </TabsContent>

                {/* ── RUNNER TAB ── */}
                <TabsContent value="runner" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
                  {/* Runner toolbar */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F0F0F0] shrink-0 bg-[#FAFAFA]">
                    <div className="flex rounded-md overflow-hidden border border-[#D0D0D0]">
                      {[{ v: 'appium', label: 'Appium Script' }, { v: 'dsl', label: 'ADB DSL' }].map(m => (
                        <button key={m.v} onClick={() => setRunnerMode(m.v as any)}
                          className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${runnerMode === m.v ? 'bg-[#0078D4] text-white' : 'bg-white text-[#616161] hover:bg-[#F5F5F5]'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1" />
                    {runStatus === 'running' ? (
                      <button onClick={() => { wsRef.current?.send(JSON.stringify({ type: 'stop_script' })); setRunStatus('idle'); }}
                        className="flex items-center gap-1.5 px-3 h-7 bg-red-500 text-white text-[11px] rounded-md hover:bg-red-600 font-medium">
                        <StopCircle className="w-3 h-3" /> Stop
                      </button>
                    ) : (
                      <button onClick={runScript} disabled={!manualScript.trim() && !generatedScript.trim()}
                        className="flex items-center gap-1.5 px-3 h-7 bg-green-600 text-white text-[11px] rounded-md hover:bg-green-700 disabled:opacity-40 font-medium transition-colors">
                        <Play className="w-3 h-3" /> Run
                      </button>
                    )}
                    <button onClick={() => { setRunLogs([]); setRunStatus('idle'); }}
                      className="p-1.5 hover:bg-[#E8E8E8] rounded-md transition-colors text-[#616161]" title="Clear logs">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Script input */}
                  {runnerMode === 'appium' && (
                    <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[10.5px] text-amber-700 leading-relaxed">
                        <span className="font-semibold">Appium script runner</span> requires Appium server + Python packages installed separately.
                        {' '}<span className="font-mono bg-amber-100 px-1 rounded">pip install Appium-Python-Client selenium</span>
                        <span className="ml-1 text-amber-600">· For zero-setup execution, use the </span>
                        <button onClick={() => setRightTab('recorder')} className="underline font-semibold text-amber-700 hover:text-amber-900">Recorder tab → Run</button>
                        <span className="text-amber-600"> button instead.</span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col border-b border-[#F0F0F0] shrink-0" style={{ height: '160px' }}>
                    <textarea
                      value={manualScript}
                      onChange={e => setManualScript(e.target.value)}
                      className="w-full h-full text-[11px] font-mono bg-[#1E1E1E] text-[#D4D4D4] p-3 rounded-lg border border-[#333] resize-none outline-none focus:border-[#0078D4] vs-scroll leading-relaxed"
                      placeholder={runnerMode === 'appium'
                        ? '# Paste or generate an Appium script here\n# Python, Java, or JavaScript supported\n# Click Run to execute on device'
                        : '# ADB DSL commands\ntap 0.5 0.5\ntype Hello World\nhome\nback\nwait 2'}
                      spellCheck={false}
                    />
                  </div>

                  {/* Execution logs */}
                  <div className="flex-1 min-h-0 overflow-y-auto vs-scroll bg-[#0D0D0D] p-3 font-mono">
                    {runLogs.length === 0 ? (
                      <div className="text-[#333] text-[11px]">{/* Execution output will appear here… */}</div>
                    ) : (
                      runLogs.map((l, i) => (
                        <div key={i} className={`text-[11px] leading-relaxed ${l.level === 'error' ? 'text-red-400' : l.level === 'success' ? 'text-green-400' : l.level === 'warn' ? 'text-yellow-400' : 'text-[#CCCCCC]'}`}>
                          {l.text}
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>

                  {/* Status bar */}
                  {runStatus !== 'idle' && (
                    <div className={`flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-semibold border-t shrink-0
                      ${runStatus === 'passed' ? 'bg-green-50 text-green-700 border-green-200' : runStatus === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {runStatus === 'passed' ? <CheckCircle2 className="w-4 h-4" /> : runStatus === 'failed' ? <XCircle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                      {runStatus === 'running' ? 'Executing script…' : runStatus === 'passed' ? 'Script completed successfully' : 'Script execution failed'}
                    </div>
                  )}
                </TabsContent>

                {/* ── DOCS TAB ── */}
                <TabsContent value="docs" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
                  <div className="px-3 py-2.5 border-b border-[#F0F0F0] shrink-0 bg-[#FAFAFA]">
                    <button onClick={async () => {
                      if (!selectedCaseId) { toast({ title: 'Select a test case first' }); return; }
                      try { const r = await trackerApi.generateDoc(selectedCaseId); setGeneratedDoc(r.data.doc); }
                      catch { toast({ variant: 'destructive', title: 'Failed to generate documentation' }); }
                    }} className="flex items-center gap-2 px-3 h-7 bg-[#0078D4] text-white text-[11px] rounded-md hover:bg-[#106EBE] font-medium transition-colors">
                      <FileText className="w-3 h-3" /> Generate Documentation
                    </button>
                  </div>
                  <textarea
                    value={generatedDoc}
                    onChange={e => setGeneratedDoc(e.target.value)}
                    className="flex-1 min-h-0 text-[11px] bg-white border-0 p-4 resize-none outline-none vs-scroll leading-relaxed text-[#2D2D2D]"
                    placeholder="Generated test documentation will appear here…"
                  />
                </TabsContent>

                {/* ── MODULES TAB ── */}
                <TabsContent value="modules" className="flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden">
                  <ModuleLibraryPanel currentPackage={currentPackage} hierarchy={hierarchy} screenshotUrl={screenshotUrl} />
                </TabsContent>

                {/* ── BUILDER TAB ── */}
                <TabsContent value="builder" className="flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden">
                  <CodelessBuilder hierarchy={hierarchy} currentPackage={currentPackage} wsRef={wsRef} onToast={(msg, v) => toast({ title: msg, variant: v })} />
                </TabsContent>

                {/* ── DATA TAB ── */}
                <TabsContent value="data" className="flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden">
                  <DataSetEditor />
                </TabsContent>

                {/* ── LOGCAT TAB ── */}
                <TabsContent value="logcat" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F0F0F0] shrink-0 bg-[#FAFAFA]">
                    <button
                      onClick={() => {
                        if (logcatRunning) {
                          wsRef.current?.send(JSON.stringify({ type: 'logcat_stop' }));
                        } else {
                          setLogcatLines([]);
                          wsRef.current?.send(JSON.stringify({ type: 'logcat_start', package: currentPackage }));
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 h-7 text-[11px] rounded-md font-medium transition-colors
                        ${logcatRunning ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#0078D4] text-white hover:bg-[#106EBE]'}`}>
                      {logcatRunning ? <><StopCircle className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Start Logcat</>}
                    </button>
                    {/* Filter chips */}
                    <div className="flex gap-1">
                      {(['all', 'crash', 'error', 'drm'] as const).map(f => (
                        <button key={f} onClick={() => setLogcatFilter(f)}
                          className={`px-2 py-0.5 text-[10px] rounded-full border font-medium transition-colors
                            ${logcatFilter === f
                              ? f === 'crash' ? 'bg-red-500 text-white border-red-500'
                              : f === 'error' ? 'bg-orange-500 text-white border-orange-500'
                              : f === 'drm' ? 'bg-purple-500 text-white border-purple-500'
                              : 'bg-[#0078D4] text-white border-[#0078D4]'
                              : 'bg-white text-[#616161] border-[#D0D0D0] hover:bg-[#F0F0F0]'}`}>
                          {f === 'all' ? 'All' : f === 'crash' ? '💥 Crash' : f === 'error' ? '🔴 Error' : '🔒 DRM'}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1" />
                    <span className="text-[10px] text-[#999]">{logcatLines.length} lines</span>
                    <button onClick={() => {
                      const filtered = logcatLines.filter(l => logcatFilter === 'all' || l.level === logcatFilter);
                      const blob = new Blob([filtered.map(l => l.text).join('\n')], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `logcat_${Date.now()}.txt`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    }} disabled={logcatLines.length === 0}
                      className="p-1.5 hover:bg-[#E8E8E8] rounded-md transition-colors disabled:opacity-40 text-[#616161]" title="Download log">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setLogcatLines([])} disabled={logcatLines.length === 0}
                      className="p-1.5 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40 text-red-400" title="Clear">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Log lines */}
                  <div className="flex-1 min-h-0 overflow-y-auto vs-scroll bg-[#0D0D0D] p-2 font-mono">
                    {logcatLines.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <FileText className="w-8 h-8 text-[#333]" />
                        <div className="text-[#444] text-[11px]">
                          {logcatRunning ? 'Waiting for log output…' : 'Click Start Logcat to capture device logs'}
                        </div>
                        {currentPackage && <div className="text-[#333] text-[10px] font-mono">{currentPackage}</div>}
                      </div>
                    ) : (
                      logcatLines
                        .filter(l => logcatFilter === 'all' || l.level === logcatFilter)
                        .map((l, i) => (
                          <div key={i} className={`text-[10px] leading-relaxed whitespace-pre-wrap break-all
                            ${l.level === 'crash' ? 'text-red-400 font-bold' :
                              l.level === 'error' ? 'text-orange-400' :
                              l.level === 'drm' ? 'text-purple-400' :
                              l.level === 'warn' ? 'text-yellow-400' : 'text-[#AAAAAA]'}`}>
                            {l.level === 'crash' && '💥 '}{l.level === 'drm' && '🔒 '}{l.text}
                          </div>
                        ))
                    )}
                    <div ref={logcatEndRef} />
                  </div>

                  {/* Crash summary banner */}
                  {logcatLines.some(l => l.level === 'crash') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-900/80 text-red-200 text-[11px] shrink-0 border-t border-red-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">{logcatLines.filter(l => l.level === 'crash').length} crash event(s) detected</span>
                      <button onClick={() => setLogcatFilter('crash')} className="ml-auto text-[10px] underline opacity-80 hover:opacity-100">View crashes</button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          BOTTOM STATUS BAR
      ══════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-0 h-6 bg-[#0078D4] text-white text-[10.5px] shrink-0 px-3">
        <span className="flex items-center gap-1.5 pr-3 border-r border-white/20">
          <Signal className="w-3 h-3" />
          <span className="font-medium">{wsStatus === 'connected' ? 'Connected' : wsStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}</span>
        </span>
        {deviceModel && <span className="px-3 border-r border-white/20 opacity-80">{deviceModel}</span>}
        {currentPackage && <span className="px-3 border-r border-white/20 opacity-60 font-mono truncate max-w-[200px]">{currentPackage}</span>}
        <div className="flex-1" />
        {isRecording && (
          <span className="flex items-center gap-1.5 px-3 border-l border-white/20 text-red-200 font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />
            REC · {actions.length} actions
          </span>
        )}
        {isSyncing && (
          <span className="flex items-center gap-1.5 px-3 border-l border-white/20 opacity-70">
            <RefreshCw className="w-3 h-3 animate-spin" /> Syncing…
          </span>
        )}
        <span className="px-3 border-l border-white/20 font-mono opacity-70">{streamFps} fps</span>
        <span className="px-3 border-l border-white/20 opacity-60">Zenit Vision v2</span>
      </div>
    </div>
  );
}
