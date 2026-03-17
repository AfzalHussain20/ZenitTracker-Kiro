import { useState, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
    Search,
    Smartphone,
    Crosshair,
    ChevronRight,
    ChevronDown,
    Copy,
    RefreshCcw,
    Layers,
    Code2,
    Target,
    MousePointer2,
    Database,
    ShieldCheck,
    Zap,
    Boxes,
    Activity,
    Maximize2
} from 'lucide-react';
import { toast } from 'sonner';

const MOCK_ELEMENT_TREE = {
    id: 'root',
    type: 'android.widget.FrameLayout',
    name: 'Sun NXT Main Activity',
    children: [
        {
            id: 'toolbar',
            type: 'android.widget.Toolbar',
            name: 'Navigation Bar',
            accessibilityId: 'toolbar_nav',
            children: [
                { id: 'menu_icon', type: 'android.widget.ImageView', name: 'Menu Icon', accessibilityId: 'menu_drawer' },
                { id: 'app_logo', type: 'android.widget.ImageView', name: 'App Logo', resourceId: 'com.sunnxt:id/logo' }
            ]
        },
        {
            id: 'content_root',
            type: 'android.widget.RelativeLayout',
            name: 'Main Content',
            children: [
                {
                    id: 'featured_carousel',
                    type: 'androidx.viewpager2.widget.ViewPager2',
                    name: 'Featured Banner',
                    accessibilityId: 'featured_carousel',
                    resourceId: 'com.sunnxt:id/banner_view'
                },
                {
                    id: 'play_btn',
                    type: 'android.widget.Button',
                    name: 'Play Now',
                    accessibilityId: 'play_btn_main',
                    resourceId: 'com.sunnxt:id/btn_play_prime',
                    text: 'PLAY NOW'
                }
            ]
        },
        {
            id: 'tab_bar',
            type: 'android.widget.LinearLayout',
            name: 'Bottom Tabs',
            children: [
                { id: 'tab_home', type: 'android.widget.TextView', name: 'Home Tab', accessibilityId: 'nav_home', text: 'Home' },
                { id: 'tab_movies', type: 'android.widget.TextView', name: 'Movies Tab', accessibilityId: 'nav_movies', text: 'Movies' },
                { id: 'tab_search', type: 'android.widget.TextView', name: 'Search Tab', accessibilityId: 'nav_search' }
            ]
        }
    ]
};

export default function Inspector() {
    const [selectedElement, setSelectedElement] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set(['root', 'toolbar', 'content_root']));

    const toggleExpand = (id) => {
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const handleCopy = (val) => {
        navigator.clipboard.writeText(val);
        toast.success('Strategy copied to clipboard');
    };

    const renderTree = (node, depth = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedElement?.id === node.id;

        return (
            <div key={node.id} className="min-w-fit">
                <div
                    onClick={() => setSelectedElement(node)}
                    className={`
            flex items-center gap-1.5 py-1.5 px-3 rounded-md cursor-pointer transition-all border border-transparent
            ${isSelected ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-bold' : 'hover:bg-zinc-900/60 text-zinc-500'}
          `}
                    style={{ paddingLeft: `${depth * 16 + 12}px` }}
                >
                    {node.children ? (
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }} className="text-zinc-700 hover:text-zinc-500">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : <div className="w-3.5" />}

                    <Code2 size={12} className={isSelected ? 'text-sky-400' : 'text-zinc-700'} />
                    <span className="text-[11px] font-mono tracking-tighter uppercase whitespace-nowrap">{node.type.split('.').pop()}</span>
                    {node.accessibilityId && <span className="text-[10px] text-pink-500 font-mono italic opacity-60">@{node.accessibilityId}</span>}
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse ml-auto" />}
                </div>
                {node.children && isExpanded && node.children.map(c => renderTree(c, depth + 1))}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 animate-fade-in h-full flex flex-col" data-testid="inspector-page">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-barlow text-3xl md:text-5xl font-bold tracking-tight text-white uppercase italic leading-none">
                        Infrastructure <span className="text-sky-500">Inspector</span>
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase mt-2">Surface Element Discovery & Maping</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="font-barlow border-zinc-700 text-zinc-300 uppercase italic h-12 px-6">
                        <RefreshCcw size={16} className="mr-2" /> Sync DOM
                    </Button>
                    <Button className="bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] font-barlow tracking-widest uppercase italic h-12 px-6">
                        <Target size={18} className="mr-2" /> Element Pick
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
                {/* Device Mirror */}
                <div className="lg:col-span-3 flex flex-col min-h-0 min-w-0">
                    <div className="aspect-[9/18.5] relative rounded-[40px] bg-[#0c0c0e] border-[8px] border-zinc-800 shadow-2xl overflow-hidden group">
                        <div className="absolute top-0 inset-x-0 h-6 bg-black flex items-center justify-center pt-1 z-10">
                            <div className="w-12 h-4 rounded-full bg-zinc-900 border border-zinc-800" />
                        </div>

                        {/* Mock Content */}
                        <div className="absolute inset-0 pt-8 flex flex-col grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700">
                            <div className="h-12 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
                                <div className="w-20 h-3 bg-zinc-800 rounded" />
                                <div className="flex gap-2">
                                    <div className="w-4 h-4 rounded-full bg-zinc-800" />
                                    <div className="w-4 h-4 rounded-full bg-zinc-800" />
                                </div>
                            </div>
                            <div className="flex-1 p-4 space-y-4">
                                <div className="aspect-video bg-zinc-900/50 rounded-lg border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
                                    <div className="w-8 h-8 rounded-full border border-sky-500/40 flex items-center justify-center">
                                        <Crosshair size={14} className="text-sky-400" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="w-full h-8 bg-zinc-800/40 rounded flex items-center justify-center"><Zap size={10} className="text-zinc-700" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="h-20 bg-zinc-900 rounded border border-zinc-800" />
                                        <div className="h-20 bg-zinc-900 rounded border border-zinc-800" />
                                    </div>
                                </div>
                            </div>
                            <div className="h-14 border-t border-zinc-800 flex items-center px-8 justify-between bg-black">
                                <div className="w-2 h-2 rounded-full bg-zinc-800" />
                                <div className="w-2 h-2 rounded-full bg-zinc-800" />
                                <div className="w-2 h-2 rounded-full bg-zinc-800" />
                            </div>
                        </div>

                        {/* Selected Element Overlay */}
                        {selectedElement && (
                            <div className="absolute inset-0 z-20 pointer-events-none border-2 border-sky-500 shadow-[0_0_40px_rgba(14,165,233,0.3)] bg-sky-500/5 m-4 rounded" />
                        )}
                    </div>
                    <div className="mt-4 flex items-center justify-between px-2">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">SAMSUNG_S24_ULTRA</p>
                        <div className="flex items-center gap-1.5">
                            <Maximize2 size={12} className="text-zinc-700 hover:text-zinc-400 cursor-pointer" />
                            <Smartphone size={12} className="text-zinc-700" />
                        </div>
                    </div>
                </div>

                {/* DOM Hierarchy */}
                <Card className="lg:col-span-5 bg-[#121215] border-zinc-800/60 shadow-2xl flex flex-col min-h-0 overflow-hidden relative">
                    <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-900/10">
                        <h3 className="font-barlow text-sm font-bold tracking-widest uppercase text-zinc-400 flex items-center gap-2 italic">
                            Hierarchy Explorer <span className="text-[9px] font-mono text-indigo-500 not-italic ml-2 animate-pulse">[SCANNING_DOM]</span>
                        </h3>
                        <Boxes size={14} className="text-zinc-700" />
                    </div>

                    <ScrollArea className="flex-1 p-4">
                        <div className="font-mono text-[11px] stagger-children">
                            {renderTree(MOCK_ELEMENT_TREE)}
                        </div>
                    </ScrollArea>

                    <div className="p-3 border-t border-zinc-900/50 bg-black/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-[9px] font-mono text-zinc-600 uppercase">Elements Discovery Rate:</p>
                            <div className="w-24 h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="w-[85%] h-full bg-sky-500" />
                            </div>
                        </div>
                        <p className="text-[9px] font-mono text-sky-500">85% HEURISTIC</p>
                    </div>
                </Card>

                {/* Properties & Locators */}
                <div className="lg:col-span-4 flex flex-col gap-6 min-h-0 min-w-0">
                    {selectedElement ? (
                        <Card className="flex-1 bg-[#121215] border-zinc-800 flex flex-col overflow-hidden animate-slide-in shadow-2xl">
                            <div className="p-6 border-b border-zinc-900/50 bg-sky-500/5">
                                <p className="text-[9px] font-barlow font-bold tracking-widest uppercase text-sky-500 italic">Property Inspector</p>
                                <h3 className="font-barlow text-lg font-bold text-zinc-100 uppercase tracking-wide truncate">{selectedElement.name}</h3>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <PropertyItem label="Standard Type" value={selectedElement.type} />
                                        {selectedElement.text && <PropertyItem label="Inner Text" value={selectedElement.text} />}
                                        <PropertyItem label="Resource ID" value={selectedElement.resourceId || 'N/A'} />
                                        <PropertyItem label="Accessibility ID" value={selectedElement.accessibilityId || 'N/A'} />
                                    </div>

                                    <div className="pt-6 border-t border-zinc-900">
                                        <h4 className="text-[10px] font-barlow font-bold tracking-widest uppercase text-zinc-500 mb-4 flex items-center gap-2">
                                            <ShieldCheck size={12} className="text-green-500" /> Reliable Strategies
                                        </h4>
                                        <div className="space-y-3">
                                            {selectedElement.accessibilityId && (
                                                <StrategyItem
                                                    type="ACC_ID"
                                                    value={selectedElement.accessibilityId}
                                                    stability={95}
                                                    onCopy={() => handleCopy(selectedElement.accessibilityId)}
                                                />
                                            )}
                                            <StrategyItem
                                                type="XPATH"
                                                value={`//${selectedElement.type.split('.').pop()}[@text='${selectedElement.name}']`}
                                                stability={65}
                                                tier="P2"
                                                onCopy={() => handleCopy(`//${selectedElement.type.split('.').pop()}[@text='${selectedElement.name}']`)}
                                            />
                                            {selectedElement.resourceId && (
                                                <StrategyItem
                                                    type="RES_ID"
                                                    value={selectedElement.resourceId}
                                                    stability={88}
                                                    onCopy={() => handleCopy(selectedElement.resourceId)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex gap-3">
                                <Button variant="outline" className="flex-1 h-10 border-zinc-800 text-[10px] font-barlow font-bold tracking-widest uppercase">
                                    <Database size={12} className="mr-2" /> Add to Store
                                </Button>
                                <Button className="flex-1 h-10 bg-sky-500 hover:bg-sky-600 text-white font-barlow font-bold tracking-widest uppercase">
                                    <MousePointer2 size={12} className="mr-2" /> Capture Flow
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <Card className="flex-1 bg-[#121215] border-zinc-800 border-dashed flex flex-col items-center justify-center p-12 text-zinc-800 shadow-inner">
                            <Search size={48} className="opacity-10 mb-6" />
                            <h3 className="font-barlow text-sm font-bold tracking-[0.3em] uppercase opacity-20 italic">Awaiting Selection</h3>
                            <p className="text-[10px] font-mono opacity-10 uppercase mt-2 text-center">Pick an element from the source tree or device mirror to begin analysis</p>
                        </Card>
                    )}

                    <Card className="bg-[#121215] border-zinc-800 p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-3 border-b border-zinc-900 pb-2">
                            <p className="text-[9px] font-barlow font-bold tracking-widest uppercase text-zinc-600 italic">Network Integrity</p>
                            <Activity size={12} className="text-green-500 animate-pulse" />
                        </div>
                        <div className="flex items-center gap-6">
                            <div>
                                <p className="text-[8px] font-mono text-zinc-700 uppercase">Appium Port</p>
                                <p className="text-xs font-mono text-zinc-400">4723</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-mono text-zinc-700 uppercase">Heuristic Depth</p>
                                <p className="text-xs font-mono text-zinc-400">0.92</p>
                            </div>
                            <div className="ml-auto">
                                <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[9px] font-mono">STABLE</Badge>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function PropertyItem({ label, value }) {
    return (
        <div className="group/item relative pb-4 border-b border-zinc-900/40">
            <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-mono text-zinc-300 truncate tracking-tight">{value}</p>
                <button
                    onClick={() => { navigator.clipboard.writeText(value); toast.success('Value copied'); }}
                    className="text-zinc-800 hover:text-sky-500 transition-colors opacity-0 group-hover/item:opacity-100"
                >
                    <Copy size={12} />
                </button>
            </div>
        </div>
    );
}

function StrategyItem({ type, value, stability, onCopy, tier = "P1" }) {
    const stabilityColor = stability >= 90 ? 'text-green-500' : stability >= 70 ? 'text-yellow-500' : 'text-red-500';

    return (
        <div className="p-3 bg-black/60 rounded border border-zinc-900 hover:border-sky-500/30 transition-all group/strat">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Badge className="text-[8px] bg-zinc-900 text-zinc-500 border-zinc-800 px-1 py-0">{tier}</Badge>
                    <span className="text-[10px] font-mono font-bold text-sky-500 uppercase">{type}</span>
                </div>
                <span className={`text-[9px] font-mono ${stabilityColor} flex items-center gap-1 uppercase`}>
                    <ShieldCheck size={10} /> {stability}% STABLE
                </span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-mono text-zinc-400 truncate opacity-80">{value}</p>
                <button onClick={onCopy} className="text-zinc-700 hover:text-sky-400 transition-colors">
                    <Copy size={12} />
                </button>
            </div>
        </div>
    );
}
