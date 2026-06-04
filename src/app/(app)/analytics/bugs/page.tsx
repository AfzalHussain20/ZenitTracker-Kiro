"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bug, RefreshCw, TrendingUp, Users, Award, BarChart3, Calendar, Clock,
    CheckCircle2, AlertTriangle, Search, Download, Layers, Globe, ArrowLeft,
    ExternalLink, Star, FileText, Zap, X, ChevronRight, Trophy, AlertCircle, Flame, Activity
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useJiraKPI, type PersonKPI, type JiraIssueRaw } from '@/hooks/useJiraKPI';
import { useExport } from '@/hooks/useExport';
import { TeamCard } from '@/components/dashboard/TeamCard';

// --- Status sets --------------------------------------------------------------
const CLOSED_SET = new Set([
    'done','closed','resolved','live','completed','fixed','dev completed','infra completed',
    'by design','qa verified','verified','released','deployed','deferred','not reproducing',
    'change','changed','duplicate',"won't do",
]);
const IN_PROGRESS_SET = new Set([
    'in progress','inprogress','in development','testing','qa','in review',
    'code review','uat','staging','retest','reopen',
]);
const OPEN_STATUSES  = new Set(['New','Open','Reopen','To Do']);
const CLOSED_STATUSES = new Set(['Fixed','Closed','QA Verified','By Design','Deferred','Done','Resolved','Not reproducing','Duplicate']);
const IP_STATUSES    = new Set(['Inprogress','In Progress','Retest','Testing','QA']);

function classifyStatus(s: string): 'open'|'in_progress'|'closed' {
    const sl = s.toLowerCase().trim();
    if (CLOSED_SET.has(sl)) return 'closed';
    if (IN_PROGRESS_SET.has(sl)) return 'in_progress';
    return 'open';
}

function n(v: number|undefined|null) { return String(v ?? 0); }

function Delta({ v, hib=true, size='sm' }: { v:number; hib?:boolean; size?:'sm'|'xs' }) {
    if (v === 0) return null;
    const good = hib ? v > 0 : v < 0;
    return (
        <span className={cn('font-bold rounded-full px-1.5 py-0.5', size==='xs'?'text-[10px]':'text-xs', good?'bg-green-500/15 text-green-700':'bg-red-500/15 text-red-700')}>
            {v>0?'▲':'▼'}{Math.abs(v)}
        </span>
    );
}

const PRIORITY_STYLE: Record<string,string> = {
    Highest:'bg-red-500/20 text-red-700 border-red-500/30',
    High:'bg-orange-500/20 text-orange-700 border-orange-500/30',
    Medium:'bg-amber-500/20 text-amber-700 border-amber-500/30',
    Low:'bg-blue-500/20 text-blue-700 border-blue-500/30',
    Lowest:'bg-slate-500/20 text-slate-600 border-slate-500/30',
};

// --- Active Filter Bar --------------------------------------------------------
interface ActiveFilter { key:string; label:string; value:string; onClear:()=>void; color?:string }
function ActiveFilterBar({ filters, onClearAll }: { filters:ActiveFilter[]; onClearAll:()=>void }) {
    const active = filters.filter(f => f.value && f.value !== 'all' && f.value !== '');
    if (!active.length) return null;
    return (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-xs font-semibold text-primary/70 shrink-0">Active Filters:</span>
            {active.map(f => (
                <span key={f.key} className={cn('inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium', f.color||'bg-primary/10 text-primary border-primary/30')}>
                    {f.label}: <span className="font-bold">{f.value}</span>
                    <button onClick={f.onClear} className="ml-0.5 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                </span>
            ))}
            <button onClick={onClearAll} className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1">
                <X className="w-3 h-3"/> Clear all
            </button>
        </div>
    );
}


// --- Avatar helpers ----------------------------------------------------------
const AVATAR_PALETTE=[
    {bg:'bg-rose-500',text:'text-white',ring:'ring-rose-300'},
    {bg:'bg-blue-600',text:'text-white',ring:'ring-blue-300'},
    {bg:'bg-emerald-600',text:'text-white',ring:'ring-emerald-300'},
    {bg:'bg-violet-600',text:'text-white',ring:'ring-violet-300'},
    {bg:'bg-amber-500',text:'text-white',ring:'ring-amber-300'},
    {bg:'bg-cyan-600',text:'text-white',ring:'ring-cyan-300'},
    {bg:'bg-pink-600',text:'text-white',ring:'ring-pink-300'},
    {bg:'bg-indigo-600',text:'text-white',ring:'ring-indigo-300'},
];
function getAvatarStyle(name:string){let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))&0xffff;return AVATAR_PALETTE[h%AVATAR_PALETTE.length];}
const PRIORITY_COLORS:Record<string,string>={Highest:'bg-red-500',High:'bg-orange-500',Medium:'bg-amber-400',Low:'bg-blue-400',Lowest:'bg-slate-400'};

// --- Stat Card ---------------------------------------------------------------
function StatCard({label,value,sub,color,bg,onClick,bar,barColor}:{label:string;value:string|number;sub?:string;color:string;bg:string;onClick?:()=>void;bar?:number;barColor?:string}) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag onClick={onClick} className={cn('rounded-xl p-3 border text-left w-full transition-all',bg,onClick&&'cursor-pointer hover:scale-[1.03] hover:shadow-md active:scale-95 hover:ring-2 hover:ring-primary/30')}>
            <div className={cn('text-2xl font-black leading-none',color)}>{value}</div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">{label}</div>
            {sub&&<div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
            {bar!==undefined&&<div className="mt-2 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"><div className={cn('h-full rounded-full',barColor||'bg-primary/60')} style={{width:`${Math.min(Math.max(bar,0),100)}%`}}/></div>}
            {onClick&&<div className="text-[9px] text-primary/50 mt-1">view &rarr;</div>}
        </Tag>
    );
}

// --- SP Breakdown ------------------------------------------------------------
function SPBreakdown({assigned,todo,inProg,done}:{assigned:number;todo:number;inProg:number;done:number}) {
    if(assigned===0) return null;
    const fmt=(v:number)=>v%1===0?String(v):v.toFixed(1);
    const pct=(v:number)=>assigned>0?Math.round((v/assigned)*100):0;
    return (
        <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Story Points Breakdown</p>
            <div className="grid grid-cols-4 gap-2">
                {[
                    {l:'Total SP',v:assigned,c:'text-violet-600',bg:'bg-violet-500/8 border-violet-200',bar:100,bc:'bg-violet-500'},
                    {l:'To-Do',v:todo,c:'text-red-600',bg:'bg-red-500/8 border-red-200',bar:pct(todo),bc:'bg-red-500'},
                    {l:'In Progress',v:inProg,c:'text-amber-600',bg:'bg-amber-500/8 border-amber-200',bar:pct(inProg),bc:'bg-amber-500'},
                    {l:'Done',v:done,c:'text-green-600',bg:'bg-green-500/8 border-green-200',bar:pct(done),bc:'bg-green-500'},
                ].map(s=>(
                    <div key={s.l} className={cn('rounded-xl p-3 border text-center',s.bg)}>
                        <div className={cn('text-xl font-black',s.c)}>{fmt(s.v)}</div>
                        <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">{s.l}</div>
                        <div className="mt-1.5 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"><div className={cn('h-full rounded-full',s.bc)} style={{width:`${s.bar}%`}}/></div>
                        <div className="text-[9px] text-muted-foreground/60 mt-0.5">{s.bar}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
}


// --- Member Profile Portal ---------------------------------------------------
function MemberProfileModal({ person, allIssues, sprintIssues, allSprints, onClose, onFilterBugs }: {
    person:PersonKPI; allIssues:JiraIssueRaw[]; sprintIssues?:JiraIssueRaw[];
    allSprints?: Array<{id:number;name:string;state:string;startDate:string|null;endDate:string|null}>;
    onClose:()=>void;
    onFilterBugs?:(filters:{reporterId?:string; assigneeId?:string; statusFilter?:string; priorityFilter?:string; issueType?:string})=>void
}) {
    const [tab, setTab] = useState<string>('overview');
    const [viewScope, setViewScope] = useState<'overall' | 'sprint'>('overall');
    const [selectedSprintId, setSelectedSprintId] = useState<string>('current');
    const [sprintData, setSprintData] = useState<JiraIssueRaw[] | null>(null);
    const [loadingSprint, setLoadingSprint] = useState(false);
    // Load sprints independently so the dropdown always has data
    const [localSprints, setLocalSprints] = useState<Array<{id:number;name:string;state:string;startDate:string|null;endDate:string|null}>>(allSprints || []);
    const av = getAvatarStyle(person.name);
    const initials = person.name.split(' ').map((w:string)=>w[0]||'').join('').slice(0,2).toUpperCase();

    // Load sprint list on mount if not provided or empty
    useEffect(() => {
        if (allSprints && allSprints.length > 1) {
            setLocalSprints(allSprints);
            // Auto-select the active sprint as default (if none already selected)
            const active = allSprints.find(s => s.state === 'active');
            if (active) setSelectedSprintId(String(active.id));
            return;
        }
        fetch('/api/jira/sprints')
            .then(r => r.json())
            .then(d => {
                if (d.sprints?.length) {
                    setLocalSprints(d.sprints);
                    const active = d.sprints.find((s: any) => s.state === 'active');
                    if (active) setSelectedSprintId(String(active.id));
                }
            })
            .catch(() => {});
    }, [allSprints]);

    // Fetch issues for a specific sprint when selected
    useEffect(() => {
        if (viewScope !== 'sprint') return;
        if (!selectedSprintId || selectedSprintId === 'current') {
            setSprintData(sprintIssues || null);
            return;
        }
        setLoadingSprint(true);
        fetch(`/api/jira/sync?sprintId=${selectedSprintId}`)
            .then(r => r.json())
            .then(d => {
                // Sprint-scoped issues: bugs/stories/epics/tasks assigned to this sprint
                const sprintAll = [...(d.bugs||[]), ...(d.stories||[]), ...(d.epics||[]), ...(d.tasks||[]), ...(d.subtasks||[])];
                // Also include allTimeAll so reporter-based counts work (all-time bugs reported by this person)
                // BUT mark sprint issues separately so we can filter by sprint membership accurately
                const sprintIds = new Set(sprintAll.map((i:any) => i.id));
                // For reporter view: use sprint issues + filter allTimeAll by sprint date range
                const sprintInfo = localSprints.find(s => String(s.id) === selectedSprintId);
                if (sprintInfo?.startDate && sprintInfo?.endDate) {
                    // Include all-time issues created WITHIN the sprint's date range for reporter counts
                    const allTime: JiraIssueRaw[] = d.allTimeAll || [];
                    const inRange = allTime.filter(i => {
                        const created = i.created.slice(0, 10);
                        return created >= sprintInfo.startDate!.slice(0, 10) && created <= sprintInfo.endDate!.slice(0, 10);
                    });
                    // Merge: sprint membership issues + date-range issues (deduplicated)
                    const merged = [...sprintAll];
                    inRange.forEach(i => { if (!sprintIds.has(i.id)) merged.push(i); });
                    setSprintData(merged);
                } else {
                    setSprintData(sprintAll);
                }
            })
            .catch(() => setSprintData([]))
            .finally(() => setLoadingSprint(false));
    }, [selectedSprintId, viewScope, sprintIssues, localSprints]);

    // Switch between all-time and sprint-scoped issues
    const activeIssues = viewScope === 'sprint'
        ? (sprintData ?? sprintIssues ?? allIssues)
        : allIssues;

    // Derived data — all computed from activeIssues so toggle/sprint-select works
    const myReported = useMemo(()=>activeIssues.filter(i=>i.reporter?.accountId===person.userId),[activeIssues,person.userId]);
    const myBugs     = useMemo(()=>myReported.filter(i=>i.issueType==='Bug'),[myReported]);
    const myStories  = useMemo(()=>myReported.filter(i=>i.issueType==='Story'),[myReported]);
    const myEpics    = useMemo(()=>myReported.filter(i=>i.issueType==='Epic'),[myReported]);
    const myTasks    = useMemo(()=>myReported.filter(i=>i.issueType==='Task'),[myReported]);
    const myLive     = useMemo(()=>activeIssues.filter(i=>i.assignee?.accountId===person.userId&&i.isLive),[activeIssues,person.userId]);
    const myAssigned = useMemo(()=>activeIssues.filter(i=>i.assignee?.accountId===person.userId&&!i.isSubTask),[activeIssues,person.userId]);
    const openBugs   = useMemo(()=>myBugs.filter(b=>classifyStatus(b.status)==='open'),[myBugs]);
    const closedBugs = useMemo(()=>myBugs.filter(b=>classifyStatus(b.status)==='closed'),[myBugs]);
    const inProgBugs = useMemo(()=>myBugs.filter(b=>classifyStatus(b.status)==='in_progress'),[myBugs]);
    const priBreak   = useMemo(()=>{const c:Record<string,number>={Highest:0,High:0,Medium:0,Low:0,Lowest:0};myBugs.forEach(b=>{if(b.priority in c)c[b.priority]++;});return c;},[myBugs]);

    // SP — computed dynamically from activeIssues so sprint toggle shows correct SP
    const spAssigned   = useMemo(()=>myAssigned.reduce((s,i)=>s+(i.storyPoints||0),0),[myAssigned]);
    const spDone       = useMemo(()=>myAssigned.filter(i=>classifyStatus(i.status)==='closed').reduce((s,i)=>s+(i.storyPoints||0),0),[myAssigned]);
    const spInProgress = useMemo(()=>myAssigned.filter(i=>classifyStatus(i.status)==='in_progress').reduce((s,i)=>s+(i.storyPoints||0),0),[myAssigned]);
    const spTodo       = useMemo(()=>myAssigned.filter(i=>classifyStatus(i.status)==='open').reduce((s,i)=>s+(i.storyPoints||0),0),[myAssigned]);
    const spPct        = spAssigned>0?Math.round((spDone/spAssigned)*100):0;

    // 6-month trend
    const monthlyTrend = useMemo(()=>{
        const m=new Map<string,number>();
        // For monthly trend, always use all-time reported issues for context
        allIssues.filter(i=>i.reporter?.accountId===person.userId).forEach(b=>{const mk=b.created.slice(0,7);m.set(mk,(m.get(mk)||0)+1);});
        const now=new Date();
        return Array.from({length:6},(_,i)=>{
            const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
            const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            return {month:mk.slice(5),key:mk,count:m.get(mk)||0};
        });
    },[allIssues,person.userId]);
    const maxMC = Math.max(...monthlyTrend.map(m=>m.count),1);
    const peakMonth = monthlyTrend.reduce((a,b)=>b.count>a.count?b:a,{month:'',key:'',count:0});

    // Handlers
    const handleFilterBugs = (statusFilter?:string, priorityFilter?:string) => {
        if(onFilterBugs){onFilterBugs({reporterId:person.userId,statusFilter,priorityFilter});onClose();}
    };
    const handleWorkFilter = (filterType:'assigned'|'reporter', issueType?:string) => {
        if(onFilterBugs){onFilterBugs({assigneeId:filterType==='assigned'?person.userId:undefined,reporterId:filterType==='reporter'?person.userId:undefined,issueType});onClose();}
    };

    useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow=''; }; },[]);

    const fmtSP=(v:number)=>v%1===0?String(v):v.toFixed(1);

    const dynamicTabs = useMemo(()=>{
        const tabs: Array<{id:string;label:string;icon:string;count:number}> = [{id:'overview',label:'Overview',icon:'chart',count:0}];
        if(myBugs.length>0)    tabs.push({id:'bugs',    label:'Bugs',    icon:'bug',  count:myBugs.length});
        if(myStories.length>0) tabs.push({id:'stories', label:'Stories', icon:'book', count:myStories.length});
        if(myEpics.length>0)   tabs.push({id:'epics',   label:'Epics',   icon:'zap',  count:myEpics.length});
        if(myTasks.length>0)   tabs.push({id:'tasks',   label:'Tasks',   icon:'check',count:myTasks.length});
        if(myLive.length>0)    tabs.push({id:'live',    label:'Live',    icon:'live', count:myLive.length});
        if(myAssigned.length>0)tabs.push({id:'assigned',label:'Assigned',icon:'clip', count:myAssigned.length});
        tabs.push({id:'monthly',label:'Monthly',icon:'cal',count:0});
        return tabs;
    },[myBugs,myStories,myEpics,myTasks,myLive,myAssigned]);

    const IssueList = ({ issues, emptyMsg }: { issues:JiraIssueRaw[]; emptyMsg:string }) => (
        <div className="p-4 space-y-1.5">
            {issues.length===0&&<div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><div className="font-medium mt-3">{emptyMsg}</div></div>}
            {issues.map(issue=>(
                <a key={issue.id} href={issue.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl border hover:bg-muted/40 hover:border-primary/30 transition-all group">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20 shrink-0 min-w-[76px] text-center group-hover:bg-blue-500/20">{issue.key}</span>
                    <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-md shrink-0 font-medium">{issue.issueType}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border shrink-0',PRIORITY_STYLE[issue.priority]||PRIORITY_STYLE.Medium)}>{issue.priority}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md shrink-0">{issue.status}</span>
                    {issue.isLive&&<span className="text-[10px] bg-emerald-500/15 text-emerald-700 px-1.5 py-0.5 rounded-md shrink-0 font-medium">Live</span>}
                    {issue.storyPoints&&<span className="text-[10px] bg-violet-500/15 text-violet-700 px-1.5 py-0.5 rounded-md shrink-0">{issue.storyPoints}sp</span>}
                    <span className="text-xs flex-1 truncate text-foreground/80">{issue.summary}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{issue.created.slice(0,10)}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0"/>
                </a>
            ))}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-md" onClick={onClose}>
            <motion.div initial={{opacity:0,scale:0.95,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:12}} transition={{duration:0.18,ease:[0.16,1,0.3,1]}}
                className="bg-background border border-border/60 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>

                {/* HERO HEADER */}
                <div className="relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"/>
                    <div className="absolute inset-0 opacity-30" style={{backgroundImage:'radial-gradient(ellipse at 70% 0%, #6366f1 0%, transparent 60%), radial-gradient(ellipse at 10% 100%, #0ea5e9 0%, transparent 50%)'}}/>
                    <div className="relative p-5">
                        <div className="flex items-start gap-4">
                            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl ring-2 shrink-0',av.bg,av.text,av.ring)}>{initials}</div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <h2 className="text-xl font-bold text-white leading-tight truncate">{person.name}</h2>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {person.teams.map(t=><span key={t} className="inline-flex items-center gap-1 text-[11px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full border border-white/15 font-medium">{t}</span>)}
                                    {person.teams.length===0&&<span className="text-xs text-white/40 italic">No team</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/50">
                                    <span>{myReported.length} reported</span>
                                    <span className="opacity-40">|</span>
                                    <span>{myAssigned.length} assigned</span>
                                    <span className="opacity-40">|</span>
                                    <span>{myLive.length} live</span>
                                    {spAssigned>0&&<><span className="opacity-40">|</span><span>{fmtSP(spAssigned)} SP</span></>}
                                    {viewScope==='sprint'&&<span className="text-blue-300 font-semibold">· Sprint view</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {/* Overall / Sprint toggle */}
                                {sprintIssues && (
                                    <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg p-0.5">
                                            <button
                                                onClick={() => setViewScope('overall')}
                                                className={cn('px-2.5 py-1 rounded-md text-[10px] font-bold transition-all', viewScope === 'overall' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/50 hover:text-white')}
                                            >Overall</button>
                                            <button
                                                onClick={() => { setViewScope('sprint'); setSprintData(sprintIssues||null); }}
                                                className={cn('px-2.5 py-1 rounded-md text-[10px] font-bold transition-all', viewScope === 'sprint' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/50 hover:text-white')}
                                            >Sprint</button>
                                        </div>
                                        {/* Sprint selector — only when Sprint tab active */}
                                        {viewScope === 'sprint' && localSprints.length > 0 && (
                                            <Select value={selectedSprintId} onValueChange={v => setSelectedSprintId(v)}>
                                                <SelectTrigger className="h-7 text-[10px] bg-white/10 border-white/20 text-white w-[180px] [&>svg]:text-white">
                                                    <SelectValue placeholder="Select Sprint" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {localSprints.map(s => (
                                                        <SelectItem key={s.id} value={String(s.id)}>
                                                            {s.state === 'active' ? '🟢 ' : s.state === 'future' ? '🔵 ' : ''}{s.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {loadingSprint && <span className="text-[9px] text-white/40 animate-pulse">Loading…</span>}
                                    </div>
                                )}
                                <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all"><X className="w-5 h-5"/></button>
                            </div>
                        </div>
                        {/* 5 KPI cards — Total SP replaces redundant SP To-Do */}
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-4">
                            {[
                                {label:'Close Rate',value:`${person.closeRate}%`,color:person.closeRate>=70?'text-emerald-400':person.closeRate>=40?'text-amber-400':'text-red-400',bar:person.closeRate},
                                {label:'Quality',value:String(person.qualityScore),color:'text-violet-400',bar:person.qualityScore},
                                {label:'Total SP',value:fmtSP(spAssigned),color:'text-sky-400',bar:100},
                                {label:'SP In Progress',value:fmtSP(spInProgress),color:'text-amber-400',bar:spAssigned>0?(spInProgress/spAssigned)*100:0},
                                {label:'SP Done',value:fmtSP(spDone),color:'text-emerald-400',bar:spAssigned>0?(spDone/spAssigned)*100:0},
                            ].map(s=>(
                                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                                    <div className={cn('text-lg font-black',s.color)}>{s.value}</div>
                                    <div className="text-[9px] text-white/40 mt-0.5 font-medium leading-tight">{s.label}</div>
                                    <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full bg-white/40" style={{width:`${Math.min(s.bar,100)}%`}}/></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TAB BAR */}
                <div className="flex border-b border-border bg-muted/20 shrink-0 overflow-x-auto">
                    {dynamicTabs.map(t=>(
                        <button key={t.id} onClick={()=>setTab(t.id)} className={cn('shrink-0 py-3 px-3 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-[80px]',tab===t.id?'border-b-2 border-primary text-primary bg-background':'text-muted-foreground hover:text-foreground hover:bg-muted/30')}>
                            <span>{t.label}</span>
                            {t.count>0&&<span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',tab===t.id?'bg-primary/15 text-primary':'bg-muted text-muted-foreground')}>{t.count}</span>}
                        </button>
                    ))}
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto overscroll-contain">

                    {/* OVERVIEW TAB */}
                    {tab==='overview'&&(
                        <div className="p-4 space-y-5">

                            {/* Work Summary */}
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Work Summary</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <StatCard label="Total Reported" value={myReported.length} color="text-slate-700" bg="bg-slate-500/8 border-slate-200"/>
                                    <StatCard label="Assigned" value={person.ticketsAssigned} color="text-blue-600" bg="bg-blue-500/8 border-blue-200" sub={`${person.assignedOpen} to-do, ${person.assignedInProgress} in prog`}/>
                                    <StatCard label="Live Tickets" value={myLive.length} color="text-emerald-600" bg="bg-emerald-500/8 border-emerald-200"/>
                                </div>
                            </div>

                            {/* Story Points Breakdown */}
                            <SPBreakdown assigned={spAssigned} todo={spTodo} inProg={spInProgress} done={spDone}/>

                            {/* Issue Types */}
                            {myReported.length>0&&(
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Issue Types — Click to View</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            {label:'Bugs',value:myBugs.length,c:'text-red-600',bg:'bg-red-500/8 border-red-200',show:myBugs.length>0,t:'bugs'},
                                            {label:'Stories',value:myStories.length,c:'text-blue-600',bg:'bg-blue-500/8 border-blue-200',show:myStories.length>0,t:'stories'},
                                            {label:'Epics',value:myEpics.length,c:'text-violet-600',bg:'bg-violet-500/8 border-violet-200',show:myEpics.length>0,t:'epics'},
                                            {label:'Tasks',value:myTasks.length,c:'text-green-600',bg:'bg-green-500/8 border-green-200',show:myTasks.length>0,t:'tasks'},
                                        ].filter(s=>s.show).map(s=>(
                                            <StatCard key={s.label} label={s.label} value={s.value} color={s.c} bg={s.bg} onClick={()=>setTab(s.t)}/>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bug Status */}
                            {myBugs.length>0&&(
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Bug Status — Click to Filter</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        <StatCard label="Total Bugs" value={myBugs.length} color="text-slate-700" bg="bg-slate-500/8 border-slate-200" onClick={()=>handleFilterBugs(undefined,undefined)}/>
                                        <StatCard label="To-Do" value={openBugs.length} color="text-red-600" bg="bg-red-500/8 border-red-200" onClick={()=>handleFilterBugs('open_group',undefined)} bar={myBugs.length>0?(openBugs.length/myBugs.length)*100:0} barColor="bg-red-500"/>
                                        <StatCard label="In Progress" value={inProgBugs.length} color="text-amber-600" bg="bg-amber-500/8 border-amber-200" onClick={()=>handleFilterBugs('in_progress_group',undefined)} bar={myBugs.length>0?(inProgBugs.length/myBugs.length)*100:0} barColor="bg-amber-500"/>
                                        <StatCard label="Done" value={closedBugs.length} color="text-green-600" bg="bg-green-500/8 border-green-200" onClick={()=>handleFilterBugs('closed_group',undefined)} bar={myBugs.length>0?(closedBugs.length/myBugs.length)*100:0} barColor="bg-green-500"/>
                                    </div>
                                </div>
                            )}

                            {/* Assigned Work Status */}
                            {person.ticketsAssigned>0&&(
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Assigned Work Status</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        <StatCard label="Total Assigned" value={person.ticketsAssigned} color="text-slate-700" bg="bg-slate-500/8 border-slate-200" onClick={()=>handleWorkFilter('assigned')}/>
                                        <StatCard label="To-Do" value={person.assignedOpen} color="text-red-600" bg="bg-red-500/8 border-red-200" bar={person.ticketsAssigned>0?(person.assignedOpen/person.ticketsAssigned)*100:0} barColor="bg-red-500"/>
                                        <StatCard label="In Progress" value={person.assignedInProgress} color="text-amber-600" bg="bg-amber-500/8 border-amber-200" bar={person.ticketsAssigned>0?(person.assignedInProgress/person.ticketsAssigned)*100:0} barColor="bg-amber-500"/>
                                        <StatCard label="Done" value={person.assignedClosed} color="text-green-600" bg="bg-green-500/8 border-green-200" bar={person.ticketsAssigned>0?(person.assignedClosed/person.ticketsAssigned)*100:0} barColor="bg-green-500"/>
                                    </div>
                                </div>
                            )}

                            {/* Priority Breakdown */}
                            {myBugs.length>0&&(
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Priority Breakdown — Click to Filter</p>
                                    <div className="rounded-xl border bg-card p-3 space-y-2">
                                        {Object.entries(priBreak).filter(([,v])=>v>0).map(([p,v])=>(
                                            <button key={p} onClick={()=>handleFilterBugs(undefined,p)} className="flex items-center gap-2 w-full cursor-pointer hover:bg-muted/40 p-2 rounded-lg transition-all hover:ring-1 hover:ring-primary/30">
                                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 w-20 text-center',PRIORITY_STYLE[p]||PRIORITY_STYLE.Medium)}>{p}</span>
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full',PRIORITY_COLORS[p]||'bg-slate-400')} style={{width:`${(v/myBugs.length)*100}%`,opacity:0.8}}/>
                                                </div>
                                                <span className="text-xs font-bold w-6 text-right">{v}</span>
                                                <span className="text-[9px] text-primary/50 shrink-0">view</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 6-Month Activity Trend */}
                            {monthlyTrend.some(m=>m.count>0)&&(
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">6-Month Activity Trend</p>
                                        {peakMonth.key&&<span className="text-[10px] text-muted-foreground">Peak: <strong>{peakMonth.month}</strong> ({peakMonth.count})</span>}
                                    </div>
                                    <div className="rounded-xl border bg-card p-4">
                                        <div className="flex items-end gap-2" style={{height:'96px'}}>
                                            {monthlyTrend.map(m=>{
                                                const barH=Math.max(Math.round((m.count/maxMC)*80),4);
                                                const isPeak=m.key===peakMonth.key;
                                                return (
                                                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                                                        <span className="text-[9px] text-muted-foreground font-medium leading-none">{m.count||''}</span>
                                                        <div className={cn('w-full rounded-t-md transition-colors',isPeak?'bg-amber-500':'bg-primary/40 group-hover:bg-primary/70')} style={{height:`${barH}px`}}/>
                                                        <span className="text-[8px] text-muted-foreground leading-none">{m.month}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Performance Insights */}
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Performance Insights</p>
                                <div className="rounded-xl border bg-card p-3 space-y-2">
                                    {[
                                        {label:'Bug Close Rate',val:person.closeRate,color:person.closeRate>=70?'bg-green-500':person.closeRate>=40?'bg-amber-500':'bg-red-500',display:`${person.closeRate}%`},
                                        ...(spAssigned>0?[{label:'SP Completion',val:spPct,color:spPct>=70?'bg-emerald-500':spPct>=40?'bg-amber-500':'bg-violet-500',display:`${spPct}%`}]:[]),
                                        {label:'Quality Score',val:person.qualityScore,color:person.qualityScore>=70?'bg-green-500':person.qualityScore>=40?'bg-amber-500':'bg-red-500',display:String(person.qualityScore)},
                                    ].map(s=>(
                                        <div key={s.label} className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground w-28 shrink-0">{s.label}</span>
                                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                                <div className={cn('h-full rounded-full',s.color)} style={{width:`${Math.min(s.val,100)}%`}}/>
                                            </div>
                                            <span className="text-xs font-bold w-10 text-right">{s.display}</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-border/50 space-y-1">
                                        {person.bugsCritical>0&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0"/><span>Reported <strong>{person.bugsCritical}</strong> critical bugs</span></div>}
                                        {person.closeRate>=70&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-green-500 inline-block shrink-0"/><span>Excellent close rate of <strong>{person.closeRate}%</strong></span></div>}
                                        {person.closeRate>0&&person.closeRate<40&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block shrink-0"/><span><strong>{openBugs.length}</strong> bugs still open — needs attention</span></div>}
                                        {spDone>0&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block shrink-0"/><span>Completed <strong>{fmtSP(spDone)}</strong> story points ({spPct}%)</span></div>}
                                        {spInProgress>0&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0"/><span><strong>{fmtSP(spInProgress)}</strong> SP currently in progress</span></div>}
                                        {peakMonth.key&&<div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0"/><span>Most active in <strong>{peakMonth.month}</strong> ({peakMonth.count} issues)</span></div>}
                                        {person.bugsReported===0&&person.ticketsAssigned===0&&<div className="text-xs text-muted-foreground italic">No activity recorded yet</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            {myReported.length>0&&(
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Recent Activity</p>
                                    <div className="space-y-1">
                                        {myReported.slice().sort((a,b)=>b.created.localeCompare(a.created)).slice(0,5).map(issue=>(
                                            <a key={issue.id} href={issue.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 rounded-xl border hover:bg-muted/40 hover:border-primary/30 transition-all group">
                                                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20 shrink-0 min-w-[72px] text-center">{issue.key}</span>
                                                <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-md shrink-0 font-medium">{issue.issueType}</span>
                                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border shrink-0',PRIORITY_STYLE[issue.priority]||PRIORITY_STYLE.Medium)}>{issue.priority}</span>
                                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md shrink-0">{issue.status}</span>
                                                <span className="text-xs flex-1 truncate text-foreground/80">{issue.summary}</span>
                                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0"/>
                                            </a>
                                        ))}
                                        {myReported.length>5&&<div className="text-xs text-center text-muted-foreground pt-1">+{myReported.length-5} more — see tabs above</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ISSUE LIST TABS */}
                    {tab==='bugs'&&<IssueList issues={myBugs} emptyMsg="No bugs reported"/>}
                    {tab==='stories'&&<IssueList issues={myStories} emptyMsg="No stories reported"/>}
                    {tab==='epics'&&<IssueList issues={myEpics} emptyMsg="No epics reported"/>}
                    {tab==='tasks'&&<IssueList issues={myTasks} emptyMsg="No tasks reported"/>}
                    {tab==='live'&&<IssueList issues={myLive} emptyMsg="No live build tickets"/>}
                    {tab==='assigned'&&<IssueList issues={myAssigned} emptyMsg="No tickets assigned"/>}

                    {/* MONTHLY TAB */}
                    {tab==='monthly'&&(
                        <div className="p-4 space-y-3">
                            {Object.keys(person.monthly).length===0&&<div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Calendar className="w-12 h-12 mb-3 opacity-20"/><div className="font-medium">No monthly data</div></div>}
                            {Object.entries(person.monthly).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,stats])=>{
                                const total=stats.reported||0;
                                const cr=total>0?Math.round((stats.closed/total)*100):0;
                                const fmt=(v:number)=>v%1===0?String(v):v.toFixed(1);
                                return (
                                    <div key={month} className="rounded-xl border bg-card overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
                                            <span className="text-sm font-bold">{month}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{total} bugs</span>
                                                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',cr>=70?'bg-green-500/15 text-green-700':cr>=40?'bg-amber-500/15 text-amber-700':'bg-red-500/15 text-red-700')}>{cr}% done</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-6 divide-x divide-border">
                                            {[
                                                {l:'Reported',v:stats.reported,c:'text-slate-700',bg:''},
                                                {l:'To-Do',v:stats.open,c:'text-red-600',bg:'bg-red-500/5'},
                                                {l:'Inprogress',v:(stats as any).inProgress||0,c:'text-amber-600',bg:'bg-amber-500/5'},
                                                {l:'Done',v:stats.closed,c:'text-green-600',bg:'bg-green-500/5'},
                                                {l:'Assigned',v:stats.assigned,c:'text-blue-600',bg:'bg-blue-500/5'},
                                                {l:'Story Pts',v:stats.storyPoints||0,c:'text-violet-600',bg:'bg-violet-500/5'},
                                            ].map(({l,v,c,bg})=>(
                                                <div key={l} className={cn('py-3 text-center',bg)}>
                                                    <div className={cn('text-xl font-black',c)}>{typeof v==='number'&&v%1!==0?v.toFixed(1):v}</div>
                                                    <div className="text-[10px] text-muted-foreground font-medium">{l}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}


// --- Teams Tab ----------------------------------------------------------------
function TeamsTab({ allPeople, allIssues, jiraTeams, allTeams, onSelectPerson }: {
    allPeople: PersonKPI[];
    allIssues: JiraIssueRaw[];
    jiraTeams: Array<{id:string;name:string;members:{accountId:string;displayName:string;avatarUrl?:string}[]}>;
    allTeams: string[];
    onSelectPerson: (p: PersonKPI) => void;
}) {
    const [selectedTeam, setSelectedTeam] = useState<string|null>(null);
    const [memberSearch, setMemberSearch] = useState('');

    // Build a lookup: accountId -> PersonKPI (for stats)
    const personById = useMemo(()=>{
        const m=new Map<string,PersonKPI>();
        allPeople.forEach(p=>m.set(p.userId,p));
        return m;
    },[allPeople]);

    // Build a lookup: displayName (lowercase) -> PersonKPI (fallback match)
    const personByName = useMemo(()=>{
        const m=new Map<string,PersonKPI>();
        allPeople.forEach(p=>m.set(p.name.toLowerCase().trim(),p));
        return m;
    },[allPeople]);

    const getPersonKPI = useMemo(()=>(accountId:string, displayName:string): PersonKPI => {
        return personById.get(accountId) ||
               personByName.get(displayName.toLowerCase().trim()) ||
               {
                   userId:accountId, name:displayName, avatarUrl:undefined,
                   bugsReported:0, bugsOpen:0, bugsClosed:0, bugsInProgress:0, bugsCritical:0, bugsHigh:0,
                   ticketsAssigned:0, assignedOpen:0, assignedClosed:0, assignedInProgress:0,
                   storyPointsAssigned:0, storyPointsCompleted:0, storyPointsInProgress:0, storyPointsTodo:0,
                   storiesReported:0, epicsReported:0, tasksReported:0, totalIssues:0,
                   qualityScore:0, closeRate:0, teams:[], monthly:{},
               };
    },[personById,personByName]);

    // Use jiraTeams as source of truth if available, else fall back to allTeams
    const teamsSource = useMemo(()=>{
        if(jiraTeams.length>0) return jiraTeams;
        // Fallback: build from allTeams using issue-based membership
        return allTeams.map(name=>({
            id:name, name,
            members: Array.from(new Map(
                allIssues
                    .filter(i=>i.team===name)
                    .flatMap(i=>[i.reporter,i.assignee].filter(Boolean))
                    .map(u=>([u!.accountId, {accountId:u!.accountId,displayName:u!.displayName,avatarUrl:u!.avatarUrl}]))
            ).values()),
        }));
    },[jiraTeams,allTeams,allIssues]);

    // Build team stats
    const teamStats = useMemo(() => {
        const now = new Date();
        const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const prevDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

        return teamsSource.map(team => {
            const memberKPIs = team.members.map(m=>getPersonKPI(m.accountId,m.displayName));
            const memberIds = new Set(team.members.map(m=>m.accountId));

            // All issues for this team (deduplicated)
            const teamIssues = Array.from(new Map(
                allIssues.filter(i =>
                    i.team === team.name ||
                    (i.reporter && memberIds.has(i.reporter.accountId)) ||
                    (i.assignee && memberIds.has(i.assignee.accountId))
                ).map(i=>[i.id,i])
            ).values());

            const teamBugs = teamIssues.filter(i=>i.issueType==='Bug');
            const open = teamBugs.filter(b=>classifyStatus(b.status)==='open').length;
            const closed = teamBugs.filter(b=>classifyStatus(b.status)==='closed').length;
            const critical = teamBugs.filter(b=>b.priority==='Highest').length;
            const closeRate = teamBugs.length>0?Math.min(100,Math.round((closed/teamBugs.length)*100)):0;
            const totalSP = memberKPIs.reduce((s,p)=>s+p.storyPointsAssigned,0);
            const doneSP = memberKPIs.reduce((s,p)=>s+p.storyPointsCompleted,0);
            const liveBuilds = teamIssues.filter(i=>i.isLive).length;
            const stories = teamIssues.filter(i=>i.issueType==='Story').length;

            // Monthly trend - last 6 months of bugs
            const monthlyBugs = new Map<string,number>();
            teamBugs.forEach(b=>{
                const mk = b.created.slice(0,7);
                monthlyBugs.set(mk,(monthlyBugs.get(mk)||0)+1);
            });
            const last6Months: {month:string;count:number}[] = [];
            for(let i=5;i>=0;i--){
                const d=new Date(now.getFullYear(),now.getMonth()-i,1);
                const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                last6Months.push({month:mk.slice(5),count:monthlyBugs.get(mk)||0});
            }
            const maxMonthly = Math.max(...last6Months.map(m=>m.count),1);

            // Current vs previous month
            const curMonthBugs = teamBugs.filter(b=>b.created.startsWith(curKey)).length;
            const prevMonthBugs = teamBugs.filter(b=>b.created.startsWith(prevKey)).length;
            const monthDelta = curMonthBugs - prevMonthBugs;

            // Top contributor
            const topContributor = memberKPIs.sort((a,b)=>
                (b.bugsReported+b.storyPointsAssigned) - (a.bugsReported+a.storyPointsAssigned)
            )[0] || null;

            return {
                id:team.id, name:team.name, rawMembers:team.members, memberKPIs,
                totalBugs:teamBugs.length, open, closed, critical, closeRate,
                totalSP, doneSP, liveBuilds, stories,
                last6Months, maxMonthly, curMonthBugs, prevMonthBugs, monthDelta,
                topContributor,
            };
        }).sort((a,b)=>b.totalBugs-a.totalBugs);
    },[teamsSource,allIssues,getPersonKPI]);

    const selectedTeamData = teamStats.find(t => t.name === selectedTeam);

    const filteredMembers = useMemo(() => {
        if (!selectedTeamData) return [];
        const q = memberSearch.toLowerCase();
        return selectedTeamData.rawMembers
            .map(m=>({raw:m, kpi:getPersonKPI(m.accountId,m.displayName)}))
            .filter(({kpi}) => !q || kpi.name.toLowerCase().includes(q))
            .sort((a,b)=>{
                // Sort by total activity: bugs + SP + stories + assigned
                const scoreA = a.kpi.bugsReported*3 + a.kpi.storyPointsAssigned + a.kpi.storiesReported*2 + a.kpi.ticketsAssigned;
                const scoreB = b.kpi.bugsReported*3 + b.kpi.storyPointsAssigned + b.kpi.storiesReported*2 + b.kpi.ticketsAssigned;
                return scoreB - scoreA;
            });
    },[selectedTeamData,memberSearch,getPersonKPI]);

    if (teamsSource.length === 0) {
        return (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                <div className="font-medium">No teams found</div>
                <div className="text-xs mt-1">Teams are detected from the Team field on Jira issues</div>
            </CardContent></Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Team grid */}
            {!selectedTeam && (
                <>
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-primary"/> All Teams
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{teamsSource.length} teams</span>
                        </h2>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={async()=>{await fetch('/api/jira/teams',{method:'POST'});window.location.reload();}}>
                            <RefreshCw className="w-3 h-3"/> Refresh Teams
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teamStats.map(team => (
                            <TeamCard
                                key={team.name}
                                name={team.name}
                                memberCount={team.rawMembers.length}
                                totalBugs={team.totalBugs}
                                openBugs={team.open}
                                closedBugs={team.closed}
                                criticalBugs={team.critical}
                                closeRate={team.closeRate}
                                storyPoints={team.totalSP}
                                liveBuilds={team.liveBuilds}
                                thisMonth={team.curMonthBugs}
                                monthlyTrend={team.last6Months.map(m => m.count)}
                                topContributor={team.topContributor?.name}
                                onClick={() => setSelectedTeam(team.name)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Team detail view */}
            {selectedTeam && selectedTeamData && (
                <div className="space-y-4">
                    {/* Back + header */}
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={()=>{setSelectedTeam(null);setMemberSearch('');}} className="gap-1.5">
                            <ArrowLeft className="w-4 h-4"/> All Teams
                        </Button>
                        <div className="flex-1"/>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
                            <Input placeholder="Search members..." value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} className="pl-8 h-8 text-xs w-48"/>
                        </div>
                    </div>

                    {/* Team hero */}
                    <div className="relative overflow-hidden rounded-2xl p-5">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"/>
                        <div className="absolute inset-0 opacity-25" style={{backgroundImage:'radial-gradient(ellipse at 70% 0%, #6366f1 0%, transparent 60%), radial-gradient(ellipse at 10% 100%, #0ea5e9 0%, transparent 50%)'}}/>
                        <div className="relative">
                            <div className="flex items-center gap-4 mb-4">
                                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl',getAvatarStyle(selectedTeam).bg)}>
                                    {selectedTeam.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedTeam}</h2>
                                    <div className="text-sm text-white/50">{selectedTeamData.rawMembers.length} members · {selectedTeamData.totalBugs} bugs total</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                {[
                                    {label:'Total Bugs',value:selectedTeamData.totalBugs,c:'text-white'},
                                    {label:'Open',value:selectedTeamData.open,c:'text-red-400'},
                                    {label:'Closed',value:selectedTeamData.closed,c:'text-green-400'},
                                    {label:'Critical',value:selectedTeamData.critical,c:'text-red-300'},
                                    {label:'Close Rate',value:`${selectedTeamData.closeRate}%`,c:selectedTeamData.closeRate>=70?'text-green-400':selectedTeamData.closeRate>=40?'text-amber-400':'text-red-400'},
                                    {label:'Story Pts',value:selectedTeamData.totalSP,c:'text-violet-300'},
                                    {label:'Live Builds',value:selectedTeamData.liveBuilds,c:selectedTeamData.liveBuilds>0?'text-emerald-400':'text-white/40'},
                                    {label:'This Month',value:selectedTeamData.curMonthBugs,c:'text-amber-300'},
                                ].map(s=>(
                                    <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                                        <div className={cn('text-lg font-black',s.c)}>{s.value}</div>
                                        <div className="text-[9px] text-white/40 mt-0.5 leading-tight">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Monthly trend in detail view */}
                            {selectedTeamData.last6Months.some(m=>m.count>0)&&(
                                <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-white/50 font-medium">6-Month Bug Trend</span>
                                        {selectedTeamData.monthDelta!==0&&(
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',selectedTeamData.monthDelta>0?'bg-red-500/20 text-red-300':'bg-green-500/20 text-green-300')}>
                                                {selectedTeamData.monthDelta>0?'▲':'▼'}{Math.abs(selectedTeamData.monthDelta)} vs prev month
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-end gap-1 h-10">
                                        {selectedTeamData.last6Months.map(({month,count})=>{
                                            const h=Math.max(Math.round((count/selectedTeamData.maxMonthly)*36),2);
                                            return (
                                                <div key={month} className="flex-1 flex flex-col items-center gap-0.5" title={`${month}: ${count} bugs`}>
                                                    <span className="text-[8px] text-white/40 leading-none">{count||''}</span>
                                                    <div className="w-full rounded-t-sm bg-white/30 hover:bg-white/50 transition-colors" style={{height:`${h}px`}}/>
                                                    <span className="text-[8px] text-white/30 leading-none">{month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Team Monthly Report */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary"/> Team Monthly Report
                            </CardTitle>
                            <CardDescription className="text-xs">Month-by-month breakdown of team performance</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {(() => {
                                // Calculate team monthly stats by aggregating all member monthly data
                                const teamMonthlyMap = new Map<string, {reported:number; open:number; inProgress:number; closed:number; assigned:number; storyPoints:number}>();
                                
                                selectedTeamData.memberKPIs.forEach(member => {
                                    Object.entries(member.monthly).forEach(([month, stats]) => {
                                        const existing = teamMonthlyMap.get(month) || {reported:0, open:0, inProgress:0, closed:0, assigned:0, storyPoints:0};
                                        teamMonthlyMap.set(month, {
                                            reported: existing.reported + (stats.reported || 0),
                                            open: existing.open + (stats.open || 0),
                                            inProgress: existing.inProgress + ((stats as any).inProgress || 0),
                                            closed: existing.closed + (stats.closed || 0),
                                            assigned: existing.assigned + (stats.assigned || 0),
                                            storyPoints: existing.storyPoints + (stats.storyPoints || 0),
                                        });
                                    });
                                });

                                const teamMonthlyEntries = Array.from(teamMonthlyMap.entries()).sort((a,b)=>b[0].localeCompare(a[0]));
                                const formatDecimal=(v:number)=>v%1===0?v.toString():v.toFixed(1);

                                if (teamMonthlyEntries.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                            <Calendar className="w-10 h-10 mb-3 opacity-20"/>
                                            <div className="font-medium">No monthly data available</div>
                                        </div>
                                    );
                                }

                                return teamMonthlyEntries.map(([month, stats]) => {
                                    const total = stats.reported || 0;
                                    const cr = total > 0 ? Math.round((stats.closed / total) * 100) : 0;
                                    // Use real inProgress field tracked per-bug status
                                    const inprogress = (stats as any).inProgress || 0;

                                    return (
                                        <div key={month} className="rounded-xl border bg-card overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
                                                <span className="text-sm font-bold">{month}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">{total} bugs</span>
                                                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',cr>=70?'bg-green-500/15 text-green-700':cr>=40?'bg-amber-500/15 text-amber-700':'bg-red-500/15 text-red-700')}>{cr}% done</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-6 divide-x divide-border">
                                                {[
                                                    {l:'Reported',v:stats.reported,c:'text-slate-700',bg:'',isDecimal:false},
                                                    {l:'To-Do',v:stats.open,c:'text-red-600',bg:'bg-red-500/5',isDecimal:false},
                                                    {l:'Inprogress',v:inprogress,c:'text-amber-600',bg:'bg-amber-500/5',isDecimal:false},
                                                    {l:'Done',v:stats.closed,c:'text-green-600',bg:'bg-green-500/5',isDecimal:false},
                                                    {l:'Assigned',v:stats.assigned,c:'text-blue-600',bg:'bg-blue-500/5',isDecimal:false},
                                                    {l:'Story Points',v:stats.storyPoints||0,c:'text-violet-600',bg:'bg-violet-500/5',isDecimal:true}
                                                ].map(({l,v,c,bg,isDecimal})=>(
                                                    <div key={l} className={cn('py-3 text-center',bg)}>
                                                        <div className={cn('text-xl font-black',c)}>{isDecimal?formatDecimal(v):v}</div>
                                                        <div className="text-[10px] text-muted-foreground font-medium">{l}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </CardContent>
                    </Card>

                    {/* Members grid */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary"/> Members
                                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filteredMembers.length}</span>
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredMembers.map(({ raw, kpi: member }, idx) => {
                                const av = getAvatarStyle(member.name);
                                const initials = member.name.split(' ').map((w:string)=>w[0]||'').join('').slice(0,2).toUpperCase();
                                const spPct = member.storyPointsAssigned > 0 ? Math.round((member.storyPointsCompleted/member.storyPointsAssigned)*100) : 0;
                                const spInProgress = member.storyPointsAssigned - member.storyPointsCompleted - (member.assignedOpen > 0 ? 0 : 0);
                                // Actual SP in progress = assigned - completed (remaining work)
                                const spRemaining = member.storyPointsAssigned - member.storyPointsCompleted;

                                // Role detection
                                const hasBugs = member.bugsReported > 0;
                                const hasSP   = member.storyPointsAssigned > 0;
                                const hasStories = member.storiesReported > 0;
                                const isDev = (hasSP || hasStories) && !hasBugs;
                                const isQA  = hasBugs && !hasSP && !hasStories;
                                const isMixed = hasBugs && (hasSP || hasStories);
                                const roleLabel = isDev ? 'Dev' : isQA ? 'QA' : isMixed ? 'Mixed' : member.ticketsAssigned > 0 ? 'Dev' : '—';
                                const roleColor = isDev||(!hasBugs&&member.ticketsAssigned>0) ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                                               : isQA ? 'bg-red-500/10 text-red-700 border-red-500/20'
                                               : isMixed ? 'bg-violet-500/10 text-violet-700 border-violet-500/20'
                                               : 'bg-muted text-muted-foreground border-border';

                                // Delivery rate
                                const deliveryRate = hasBugs && hasSP ? Math.round((member.closeRate + spPct)/2)
                                                   : hasSP ? spPct
                                                   : hasBugs ? member.closeRate : 0;
                                const deliveryColor = deliveryRate>=70?'text-green-600':deliveryRate>=40?'text-amber-600':'text-red-500';

                                return (
                                    <motion.div key={raw.accountId} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:idx*0.03}}>
                                        <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group" onClick={()=>onSelectPerson(member)}>
                                            <CardContent className="p-4">
                                                {/* Member header */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-black shrink-0 shadow-sm',av.bg)}>{initials}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-sm truncate group-hover:text-primary transition-colors">{member.name}</div>
                                                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-bold shrink-0',roleColor)}>{roleLabel}</span>
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground">
                                                            {member.teams.filter(t=>t!==selectedTeam).length>0
                                                                ?`Also in: ${member.teams.filter(t=>t!==selectedTeam).slice(0,2).join(', ')}`
                                                                :'Primary team member'}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"/>
                                                </div>

                                                {/* Role-aware KPI grid */}
                                                {hasBugs ? (
                                                    /* QA / Mixed: show bug stats */
                                                    <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
                                                        {[
                                                            {label:'Bugs',value:member.bugsReported,c:'text-red-600',bg:'bg-red-500/8'},
                                                            {label:'Open',value:member.bugsOpen,c:member.bugsOpen>0?'text-amber-600':'text-muted-foreground',bg:member.bugsOpen>0?'bg-amber-500/8':'bg-muted/30'},
                                                            {label:'Closed',value:member.bugsClosed,c:member.bugsClosed>0?'text-green-600':'text-muted-foreground',bg:member.bugsClosed>0?'bg-green-500/8':'bg-muted/30'},
                                                            {label:'Critical',value:member.bugsCritical,c:member.bugsCritical>0?'text-red-700':'text-muted-foreground',bg:member.bugsCritical>0?'bg-red-500/15':'bg-muted/30'},
                                                        ].map(s=>(
                                                            <div key={s.label} className={cn('rounded-lg py-2',s.bg)}>
                                                                <div className={cn('text-base font-black',s.c)}>{s.value}</div>
                                                                <div className="text-[9px] text-muted-foreground">{s.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : hasSP ? (
                                                    /* Dev: show SP breakdown */
                                                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                                                        {[
                                                            {label:'SP Assigned',value:member.storyPointsAssigned,c:'text-violet-600',bg:'bg-violet-500/8'},
                                                            {label:'SP Done',value:member.storyPointsCompleted,c:'text-emerald-600',bg:'bg-emerald-500/8'},
                                                            {label:'SP In Progress',value:spRemaining,c:spRemaining>0?'text-amber-600':'text-muted-foreground',bg:spRemaining>0?'bg-amber-500/8':'bg-muted/30'},
                                                        ].map(s=>(
                                                            <div key={s.label} className={cn('rounded-lg py-2',s.bg)}>
                                                                <div className={cn('text-base font-black',s.c)}>{s.value}</div>
                                                                <div className="text-[9px] text-muted-foreground">{s.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : hasStories ? (
                                                    /* Dev with stories but no SP */
                                                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                                                        {[
                                                            {label:'Stories',value:member.storiesReported,c:'text-blue-600',bg:'bg-blue-500/8'},
                                                            {label:'Epics',value:member.epicsReported,c:'text-violet-600',bg:'bg-violet-500/8'},
                                                            {label:'Tasks',value:member.tasksReported,c:'text-green-600',bg:'bg-green-500/8'},
                                                        ].map(s=>(
                                                            <div key={s.label} className={cn('rounded-lg py-2',s.bg)}>
                                                                <div className={cn('text-base font-black',s.c)}>{s.value}</div>
                                                                <div className="text-[9px] text-muted-foreground">{s.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    /* No reported issues - show assigned work */
                                                    <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                                                        {[
                                                            {label:'Assigned',value:member.ticketsAssigned,c:'text-blue-600',bg:'bg-blue-500/8'},
                                                            {label:'Open',value:member.assignedOpen,c:member.assignedOpen>0?'text-amber-600':'text-muted-foreground',bg:member.assignedOpen>0?'bg-amber-500/8':'bg-muted/30'},
                                                            {label:'Closed',value:member.assignedClosed,c:member.assignedClosed>0?'text-green-600':'text-muted-foreground',bg:member.assignedClosed>0?'bg-green-500/8':'bg-muted/30'},
                                                        ].map(s=>(
                                                            <div key={s.label} className={cn('rounded-lg py-2',s.bg)}>
                                                                <div className={cn('text-base font-black',s.c)}>{s.value}</div>
                                                                <div className="text-[9px] text-muted-foreground">{s.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Progress bars - role-aware */}
                                                <div className="space-y-1.5">
                                                    {hasBugs&&(
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-muted-foreground w-20 shrink-0">Bug Close Rate</span>
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className={cn('h-full rounded-full',member.closeRate>=70?'bg-green-500':member.closeRate>=40?'bg-amber-500':'bg-red-500')} style={{width:`${member.closeRate}%`}}/>
                                                            </div>
                                                            <span className={cn('text-[10px] font-bold w-8 text-right',member.closeRate>=70?'text-green-600':member.closeRate>=40?'text-amber-600':'text-red-500')}>{member.closeRate}%</span>
                                                        </div>
                                                    )}
                                                    {hasSP&&(
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-muted-foreground w-20 shrink-0">SP Completion</span>
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className={cn('h-full rounded-full',spPct>=70?'bg-emerald-500':spPct>=40?'bg-amber-500':'bg-violet-500')} style={{width:`${spPct}%`}}/>
                                                            </div>
                                                            <span className={cn('text-[10px] font-bold w-8 text-right',spPct>=70?'text-emerald-600':spPct>=40?'text-amber-600':'text-violet-600')}>{spPct}%</span>
                                                        </div>
                                                    )}
                                                    {/* Delivery rate - single headline metric */}
                                                    {deliveryRate>0&&(
                                                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                                            <span className="text-[10px] text-muted-foreground">Delivery Rate</span>
                                                            <span className={cn('text-xs font-black',deliveryColor)}>{deliveryRate}%</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Footer */}
                                                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                                                        {member.ticketsAssigned>0&&<span>{member.ticketsAssigned} assigned</span>}
                                                        {hasSP&&<span>{member.storyPointsAssigned} SP</span>}
                                                        {!hasBugs&&!hasSP&&!hasStories&&member.ticketsAssigned===0&&<span className="italic">No activity yet</span>}
                                                    </div>
                                                    <span className="text-[10px] text-primary font-medium group-hover:underline shrink-0">View profile →</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                            {filteredMembers.length===0&&(
                                <div className="col-span-2 text-center py-12 text-muted-foreground">
                                    <Search className="w-10 h-10 mx-auto mb-3 opacity-20"/>
                                    <div className="font-medium">No members found</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Work Logs Tab ------------------------------------------------------------
interface WorkLogData {
    worklogs: Array<{issueKey:string;issueUrl?:string;author:string;authorId:string;timeSpentSeconds:number;timeSpent:string;started:string;comment:string}>;
    byUser: Array<{authorId:string;author:string;totalSeconds:number;totalHours:number;logCount:number;issueCount:number}>;
    totalIssuesWithLogs:number; fromCache:boolean;
}
const WORK_BADGES=[
    {min:40,label:'On Fire',color:'text-red-600',bg:'bg-red-500/10 border-red-500/30'},
    {min:30,label:'Power User',color:'text-amber-600',bg:'bg-amber-500/10 border-amber-500/30'},
    {min:20,label:'Hard Worker',color:'text-blue-600',bg:'bg-blue-500/10 border-blue-500/30'},
    {min:10,label:'Active',color:'text-purple-600',bg:'bg-purple-500/10 border-purple-500/30'},
    {min:0,label:'Getting Started',color:'text-green-600',bg:'bg-green-500/10 border-green-500/30'},
];
function getWorkBadge(h:number){return WORK_BADGES.find(b=>h>=b.min)||WORK_BADGES[WORK_BADGES.length-1];}

function WorkLogsTab({teamFilter,memberFilter,kpiPeople,onSelectPerson,allIssues}:{
    teamFilter:string;memberFilter:string;kpiPeople:PersonKPI[];
    onSelectPerson:(p:PersonKPI)=>void;allIssues:JiraIssueRaw[];
}) {
    const [data,setData]=useState<WorkLogData|null>(null);
    const [loading,setLoading]=useState(false);
    const [days,setDays]=useState('30');
    const [loaded,setLoaded]=useState(false);
    const [localTeam,setLocalTeam]=useState(teamFilter);
    const [localMember,setLocalMember]=useState(memberFilter);
    const [expandedUser,setExpandedUser]=useState<string|null>(null);

    // Sync parent filters into local state when they change
    useEffect(()=>{
        setLocalTeam(teamFilter);
    },[teamFilter]);
    
    useEffect(()=>{
        setLocalMember(memberFilter);
    },[memberFilter]);

    const load=async()=>{
        setLoading(true);
        try{const res=await fetch(`/api/jira/worklogs?days=${days}`);const json=await res.json();setData(json);setLoaded(true);}
        catch(e){console.error('Worklogs error:',e);}finally{setLoading(false);}
    };

    // Build a name?accountId map from kpiPeople for matching work log authors
    const nameToPersonMap = useMemo(()=>{
        const m=new Map<string,PersonKPI>();
        kpiPeople.forEach(p=>m.set(p.name.toLowerCase().trim(),p));
        return m;
    },[kpiPeople]);

    const idToPersonMap = useMemo(()=>{
        const m=new Map<string,PersonKPI>();
        kpiPeople.forEach(p=>m.set(p.userId,p));
        return m;
    },[kpiPeople]);

    // Get the PersonKPI for a work log user (match by accountId first, then by name)
    const getPersonForUser = (u:{authorId:string;author:string}): PersonKPI|null => {
        return idToPersonMap.get(u.authorId) || nameToPersonMap.get(u.author.toLowerCase().trim()) || null;
    };

    // Team members for the selected team
    const teamMemberIds = useMemo(()=>{
        if(localTeam==='all') return null;
        const ids=new Set(kpiPeople.filter(p=>p.teams.includes(localTeam)).map(p=>p.userId));
        // Also add by name for work log matching
        const names=new Set(kpiPeople.filter(p=>p.teams.includes(localTeam)).map(p=>p.name.toLowerCase().trim()));
        return {ids,names};
    },[kpiPeople,localTeam]);

    // Members of selected team who have NO work logs
    const missedLoggers=useMemo(()=>{
        if(!loaded||!data) return [];
        // Only show missed loggers when a specific team is selected
        if(localTeam==='all') return [];
        const teamPeople=kpiPeople.filter(p=>p.teams.includes(localTeam));
        const loggedIds=new Set(data.byUser.map(u=>u.authorId));
        const loggedNames=new Set(data.byUser.map(u=>u.author.toLowerCase().trim()));
        return teamPeople.filter(p=>!loggedIds.has(p.userId)&&!loggedNames.has(p.name.toLowerCase().trim()));
    },[data,loaded,kpiPeople,localTeam]);

    const filteredUsers=useMemo(()=>{
        if(!data)return[];
        let users=data.byUser;
        if(localMember!=='all'){
            // Match by accountId or name
            const person=idToPersonMap.get(localMember);
            users=users.filter(u=>u.authorId===localMember||(person&&u.author.toLowerCase().trim()===person.name.toLowerCase().trim()));
        } else if(localTeam!=='all'&&teamMemberIds){
            // Filter to only team members - match by accountId OR name
            users=users.filter(u=>teamMemberIds.ids.has(u.authorId)||teamMemberIds.names.has(u.author.toLowerCase().trim()));
        }
        return users;
    },[data,localTeam,localMember,teamMemberIds,idToPersonMap]);

    const userFeaturePeak=(authorId:string)=>{
        if(!data)return[];
        const logs=data.worklogs.filter(w=>w.authorId===authorId);
        const issueMap=new Map<string,{key:string;url?:string;seconds:number}>();
        logs.forEach(w=>{const ex=issueMap.get(w.issueKey)||{key:w.issueKey,url:w.issueUrl,seconds:0};ex.seconds+=w.timeSpentSeconds;issueMap.set(w.issueKey,ex);});
        return Array.from(issueMap.values()).sort((a,b)=>b.seconds-a.seconds).slice(0,5);
    };

    const totalHours=Math.round(filteredUsers.reduce((s,u)=>s+u.totalHours,0)*10)/10;
    const topUser=filteredUsers[0];
    const allTeams=Array.from(new Set(kpiPeople.flatMap(p=>p.teams))).sort();
    const allMembers=localTeam!=='all'?kpiPeople.filter(p=>p.teams.includes(localTeam)):kpiPeople;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-blue-500/10 to-purple-500/15 border border-primary/30 p-5">
                <div className="relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">Work Log Analytics</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {loaded
                                    ? localTeam!=='all'
                                        ? `${filteredUsers.length} of ${kpiPeople.filter(p=>p.teams.includes(localTeam)).length} ${localTeam} members logged \u00b7 ${totalHours}h in last ${days} days`
                                        : `${filteredUsers.length} members \u00b7 ${totalHours}h total in last ${days} days`
                                    : 'Track time logged by your team in Jira'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger className="w-32 h-8 text-xs bg-background/80"><SelectValue/></SelectTrigger>
                                <SelectContent>{['7','14','30','60','90'].map(d=><SelectItem key={d} value={d}>Last {d} days</SelectItem>)}</SelectContent>
                            </Select>
                            <Button onClick={load} disabled={loading} className="h-8 text-xs gap-1 shadow-lg">
                                <RefreshCw className={cn('w-3 h-3',loading&&'animate-spin')}/>
                                {loading?'Loading...':loaded?'Refresh':'Load Work Logs'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/20">
                        <Select value={localTeam} onValueChange={v=>{setLocalTeam(v);setLocalMember('all');}}>
                            <SelectTrigger className={cn('w-36 h-7 text-xs bg-background/80',localTeam!=='all'&&'border-primary font-medium')}><SelectValue placeholder="All Teams"/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Teams</SelectItem>{allTeams.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={localMember} onValueChange={setLocalMember}>
                            <SelectTrigger className={cn('w-44 h-7 text-xs bg-background/80',localMember!=='all'&&'border-primary font-medium')}><SelectValue placeholder="All Members"/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Members</SelectItem>{allMembers.map(p=><SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {(localTeam!=='all'||localMember!=='all')&&<Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={()=>{setLocalTeam('all');setLocalMember('all');}}>Clear</Button>}
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl"/>
            </div>

            {!loaded&&!loading&&(
                <Card><CardContent className="py-16 text-center">
                    <div className="text-5xl mb-4 opacity-30 text-muted-foreground">WL</div>
                    <div className="text-lg font-bold mb-2">Ready to track your team&apos;s effort?</div>
                    <div className="text-sm text-muted-foreground mb-4">Click &quot;Load Work Logs&quot; to see who&apos;s putting in the hours</div>
                    <Button onClick={load} className="gap-2"><RefreshCw className="w-4 h-4"/> Load Work Logs</Button>
                </CardContent></Card>
            )}
            {loading&&(
                <Card><CardContent className="py-16 text-center">
                    <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-primary opacity-60"/>
                    <div className="text-sm font-medium">Fetching work logs from Jira...</div>
                </CardContent></Card>
            )}

            {loaded&&!loading&&(
                <>
                    {/* Missed loggers - only shown when a team is selected */}
                    {missedLoggers.length>0&&(
                        <Card className="border-amber-500/40 bg-amber-500/5">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600"/>
                                    <span className="text-sm font-semibold text-amber-700">No Logs Recorded &mdash; {localTeam} ({missedLoggers.length})</span>
                                    <span className="text-xs text-muted-foreground">no work logs in the last {days} days</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {missedLoggers.map(p=>{
                                        const av=getAvatarStyle(p.name);
                                        return (
                                            <button key={p.userId} onClick={()=>onSelectPerson(p)}
                                                className="inline-flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 px-2.5 py-1 rounded-full hover:bg-amber-500/20 transition-colors cursor-pointer">
                                                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',av.bg)}>{p.name.charAt(0)}</span>
                                                {p.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* No logs at all for selected team */}
                    {filteredUsers.length===0&&localTeam!=='all'&&(
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center">
                                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20"/>
                                <div className="font-semibold text-muted-foreground">No work logs recorded</div>
                                <div className="text-xs text-muted-foreground mt-1">No members of <strong>{localTeam}</strong> have logged work in the last {days} days</div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary stats */}
                    {topUser&&filteredUsers.length>0&&(
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {label:'Total Hours Logged',value:`${totalHours}h`,color:'text-blue-600'},
                                {label:'Top Contributor',value:topUser.author,color:'text-amber-600'},
                                {label:'Active Members',value:String(filteredUsers.length),color:'text-green-600'},
                            ].map(s=>(
                                <Card key={s.label}><CardContent className="p-4 text-center">
                                    
                                    <div className={cn('text-lg font-bold truncate',s.color)}>{s.value}</div>
                                    <div className="text-xs text-muted-foreground">{s.label}</div>
                                </CardContent></Card>
                            ))}
                        </div>
                    )}

                    {/* Work log leaderboard - clickable rows */}
                    {filteredUsers.length>0&&(
                        <div className="space-y-2">
                            {filteredUsers.map((user,idx)=>{
                                const badge=getWorkBadge(user.totalHours);
                                const isExpanded=expandedUser===user.authorId;
                                const peak=isExpanded?userFeaturePeak(user.authorId):[];
                                const person=getPersonForUser(user);
                                const av=getAvatarStyle(user.author);
                                const medals=['#1','#2','#3'];
                                return (
                                    <Card key={user.authorId} className={cn('transition-all hover:shadow-md',isExpanded&&'ring-1 ring-primary/30')}>
                                        <CardContent className="p-0">
                                            {/* Main row - click to expand */}
                                            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={()=>setExpandedUser(isExpanded?null:user.authorId)}>
                                                <span className="text-base font-bold text-muted-foreground w-7 text-center shrink-0">{idx<3?medals[idx]:`#${idx+1}`}</span>
                                                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',av.bg)}>{user.author.charAt(0).toUpperCase()}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm">{user.author}</span>
                                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium',badge.bg,badge.color)}>{badge.label}</span>
                                                        {person&&person.teams.length>0&&<span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{person.teams[0]}</span>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">{user.logCount} logs &middot; {user.issueCount} issues</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* View profile button */}
                                                    {person&&(
                                                        <button onClick={e=>{e.stopPropagation();onSelectPerson(person);}}
                                                            className="text-[10px] text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg border border-primary/20 transition-colors font-medium">
                                                            View Profile
                                                        </button>
                                                    )}
                                                    <div className="text-right">
                                                        <div className={cn('text-lg font-bold',badge.color)}>{Math.round(user.totalHours*10)/10}h</div>
                                                        <div className="text-[10px] text-muted-foreground">logged</div>
                                                    </div>
                                                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform',isExpanded&&'rotate-90')}/>
                                                </div>
                                            </div>
                                            {/* Expanded: top issues */}
                                            {isExpanded&&(
                                                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                                                    {peak.length>0?(
                                                        <>
                                                            <div className="text-xs font-semibold text-muted-foreground mb-2 mt-3 flex items-center gap-1"><Flame className="w-3 h-3 text-amber-500"/> Top Issues by Time Spent</div>
                                                            <div className="space-y-1.5">
                                                                {peak.map(issue=>(
                                                                    <div key={issue.key} className="flex items-center gap-2">
                                                                        {issue.url?<a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 hover:bg-blue-500/20 shrink-0">{issue.key}</a>:<span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{issue.key}</span>}
                                                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full" style={{width:`${(issue.seconds/peak[0].seconds)*100}%`}}/></div>
                                                                        <span className="text-xs text-muted-foreground shrink-0">{Math.round(issue.seconds/3600*10)/10}h</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ):(
                                                        <div className="text-xs text-muted-foreground mt-3">No detailed log data available</div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


// --- Main Dashboard -----------------------------------------------------------
export default function KPIDashboard() {
    const [activeSprint, setActiveSprint] = useState<string|undefined>(undefined);
    const { kpi, loading, error, lastSync, forceRefresh, allSprints } = useJiraKPI(activeSprint);

    // Auto-select the active sprint as soon as sprint list is available
    // This ensures first load is always sprint-scoped, not all-time
    useEffect(() => {
        if (activeSprint === undefined && allSprints.length > 0) {
            const active = allSprints.find(s => s.state === 'active');
            // Also check for the most recent closed sprint if no active
            const latest = active || allSprints[0]; // allSprints is sorted active-first
            if (latest) {
                setActiveSprint(String(latest.id));
            }
        }
    }, [allSprints, activeSprint]);
    const { exportData, exporting } = useExport();
    const tabsRef = useRef<HTMLDivElement>(null);

    const [memberSearch, setMemberSearch] = useState('');
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterType, setFilterType] = useState('Bug');
    const [liveTeamFilter, setLiveTeamFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');
    const [memberFilter, setMemberFilter] = useState('all');
    const [sortBy, setSortBy] = useState<'bugsReported'|'ticketsAssigned'|'storyPointsAssigned'|'closeRate'|'storiesReported'>('bugsReported');
    const [issueSearch, setIssueSearch] = useState('');
    
    // Instant filters - single state, no pending/apply pattern
    const [issueStatusFilter, setIssueStatusFilter] = useState('all');
    const [issuePriorityFilter, setIssuePriorityFilter] = useState('all');
    const [issueAssigneeFilter, setIssueAssigneeFilter] = useState('all');
    const [issueReporterFilter, setIssueReporterFilter] = useState('all');
    const [issueDateFrom, setIssueDateFrom] = useState('');
    const [issueDateTo, setIssueDateTo] = useState('');
    // Aliases so existing code using temp* still works without changes
    const setTempIssueStatusFilter = setIssueStatusFilter;
    const setTempIssuePriorityFilter = setIssuePriorityFilter;
    const setTempIssueAssigneeFilter = setIssueAssigneeFilter;
    const setTempIssueReporterFilter = setIssueReporterFilter;
    const setTempIssueDateFrom = setIssueDateFrom;
    const setTempIssueDateTo = setIssueDateTo;
    const tempIssueStatusFilter = issueStatusFilter;
    const tempIssuePriorityFilter = issuePriorityFilter;
    const tempIssueAssigneeFilter = issueAssigneeFilter;
    const tempIssueReporterFilter = issueReporterFilter;
    const tempIssueDateFrom = issueDateFrom;
    const tempIssueDateTo = issueDateTo;
    const [activeTab, setActiveTab] = useState('team');
    const [spPeriod, setSpPeriod] = useState<'overall'|'6months'|'monthly'|'custom'>('overall');
    const [spMonth, setSpMonth] = useState('all');
    const [spDateFrom, setSpDateFrom] = useState('');
    const [spDateTo, setSpDateTo] = useState('');
    const [monthlyTeamFilter, setMonthlyTeamFilter] = useState('all');
    const [spView, setSpView] = useState<'individual'|'team'|'sprint'>('individual');
    const [spSprintFilter, setSpSprintFilter] = useState('all');
    const [spTeamFilter, setSpTeamFilter] = useState('all');
    const [spMonthFilter, setSpMonthFilter] = useState('all');
    const [drilldownLabel, setDrilldownLabel] = useState<string|null>(null);
    const [selectedPerson, setSelectedPerson] = useState<PersonKPI|null>(null);
    const [viewMode, setViewMode] = useState<'grid'|'list'>('grid');
    
    // Polling state for real-time updates
    const [isPolling, setIsPolling] = useState(true);
    const [pollingInterval] = useState(30000); // 30 seconds
    
    // filtersChanged is always false (instant filters)
    const filtersChanged = false;
    const handleApplyFilters = useCallback(() => {}, []);
    const handleResetFilters = useCallback(() => {
        setIssueStatusFilter('all'); setIssuePriorityFilter('all');
        setIssueAssigneeFilter('all'); setIssueReporterFilter('all');
        setIssueDateFrom(''); setIssueDateTo('');
        setDrilldownLabel(null);
    }, []);
    
    // Polling effect for real-time updates
    useEffect(() => {
        if (!isPolling) return;
        
        const interval = setInterval(() => {
            forceRefresh();
        }, pollingInterval);
        
        return () => clearInterval(interval);
    }, [isPolling, pollingInterval, forceRefresh]);

    const drillToIssues = (cat: 'open'|'closed'|'in_progress'|'critical'|'high'|'total'|null) => {
        let sp='all', pp='all';
        if(cat==='critical') pp='Highest';
        else if(cat==='high') pp='High';
        else if(cat==='open') sp='open_group';
        else if(cat==='closed') sp='closed_group';
        else if(cat==='in_progress') sp='in_progress_group';
        setActiveTab('issues'); setDrilldownLabel(cat);
        setIssueStatusFilter(sp); setIssuePriorityFilter(pp);
        setTempIssueStatusFilter(sp); setTempIssuePriorityFilter(pp);
        setTimeout(()=>tabsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);
    };

    const clearAllFilters = () => {
        setTeamFilter('all'); setMemberFilter('all'); setMemberSearch('');
        setFilterMonth('all'); 
        setIssueStatusFilter('all'); setIssuePriorityFilter('all');
        setTempIssueStatusFilter('all'); setTempIssuePriorityFilter('all');
        setIssueSearch(''); setDrilldownLabel(null);
        setIssueAssigneeFilter('all'); setIssueReporterFilter('all');
        setTempIssueAssigneeFilter('all'); setTempIssueReporterFilter('all');
        setIssueDateFrom(''); setIssueDateTo('');
        setTempIssueDateFrom(''); setTempIssueDateTo('');
    };
    
    // Handler for member profile modal filters
    const handleFilterBugsFromModal = (filters: {
        reporterId?: string;
        assigneeId?: string;
        statusFilter?: string;
        priorityFilter?: string;
        issueType?: string;
    }) => {
        // Apply filters immediately
        if (filters.reporterId) {
            setIssueReporterFilter(filters.reporterId);
            setTempIssueReporterFilter(filters.reporterId);
        }
        if (filters.assigneeId) {
            setIssueAssigneeFilter(filters.assigneeId);
            setTempIssueAssigneeFilter(filters.assigneeId);
        }
        if (filters.statusFilter) {
            setIssueStatusFilter(filters.statusFilter);
            setTempIssueStatusFilter(filters.statusFilter);
        }
        if (filters.priorityFilter) {
            setIssuePriorityFilter(filters.priorityFilter);
            setTempIssuePriorityFilter(filters.priorityFilter);
        }
        if (filters.issueType) {
            setFilterType(filters.issueType as any);
        } else if (filters.statusFilter || filters.priorityFilter) {
            // When drilling from bug status/priority cards, force Bug type
            setFilterType('Bug');
        }
        setDrilldownLabel(null);
        // Switch to issues tab
        setActiveTab('issues');
        // Scroll to issues tab (no forceRefresh - data is already loaded)
        setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const [now] = useState(()=>new Date());
    const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const prevDate = new Date(now.getFullYear(),now.getMonth()-1,1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

    // Sprint period info — used for period overview labels and date filtering
    const activeSprint_info = useMemo(() => {
        if (!activeSprint || !allSprints.length) return null;
        return allSprints.find(s => String(s.id) === activeSprint) || null;
    }, [activeSprint, allSprints]);

    const prevSprint_info = useMemo(() => {
        if (!activeSprint || !allSprints.length) return null;
        const idx = allSprints.findIndex(s => String(s.id) === activeSprint);
        // allSprints is sorted active→future→closed; previous sprint = next in closed list
        return idx >= 0 && idx < allSprints.length - 1 ? allSprints[idx + 1] : null;
    }, [activeSprint, allSprints]);

    const cm = kpi?.currentMonth;
    const pm = kpi?.previousMonth;
    const typeLabel = filterType==='all'?'Issues':filterType==='Bug'?'Bugs':filterType==='Story'?'Stories':filterType==='Epic'?'Epics':'Tasks';

    const teamMembers = useMemo(()=>{
        if(!kpi)return[];
        const names=new Set<string>();
        kpi.all.forEach(i=>{if(i.assignee)names.add(i.assignee.displayName);});
        return Array.from(names).sort();
    },[kpi]);

    // Get members for the selected team from Jira Teams API data
    const selectedTeamMembers = useMemo(()=>{
        if(!kpi||teamFilter==='all') return null;
        const jiraTeam = kpi.jiraTeams?.find(t=>t.name===teamFilter);
        return jiraTeam?.members || null;
    },[kpi,teamFilter]);

    // For the member filter dropdown: show only that team's members when team is selected
    const memberDropdownPeople = useMemo(()=>{
        if(!kpi) return [];
        if(teamFilter!=='all') return kpi.people.filter(p=>p.teams.includes(teamFilter));
        return kpi.people;
    },[kpi,teamFilter]);

    const filteredPeople = useMemo(()=>{
        if(!kpi)return[];
        let people=kpi.people;
        if(memberFilter!=='all'){
            people=people.filter(p=>p.userId===memberFilter);
        } else if(teamFilter!=='all'){
            // Filter by team - works whether teams came from API or issue field
            people=people.filter(p=>p.teams.includes(teamFilter));
        }
        if(memberSearch){const q=memberSearch.toLowerCase();people=people.filter(p=>p.name.toLowerCase().includes(q));}
        if(filterMonth!=='all'){
            people=people.map(p=>{
                const m=p.monthly[filterMonth]||{reported:0,closed:0,open:0,assigned:0,storyPoints:0};
                return{...p,bugsReported:m.reported,bugsClosed:m.closed,bugsOpen:m.open,ticketsAssigned:m.assigned,storyPointsAssigned:m.storyPoints};
            }).filter(p=>p.bugsReported>0||p.ticketsAssigned>0||p.storyPointsAssigned>0);
        }
        return [...people].sort((a,b)=>(b[sortBy] as number)-(a[sortBy] as number)).map((p,i)=>({...p,rank:i+1}));
    },[kpi,memberSearch,memberFilter,teamFilter,filterMonth,sortBy]);

    const teamScopedStats = useMemo(()=>{
        if(!kpi||teamFilter==='all')return null;
        const cl=(s:string)=>{const sl=s.toLowerCase().trim();if(CLOSED_SET.has(sl))return'closed';if(IN_PROGRESS_SET.has(sl))return'in_progress';return'open';};
        // Get all people in this team, then get their bugs
        const teamPeopleIds=new Set(kpi.people.filter(p=>p.teams.includes(teamFilter)).map(p=>p.userId));
        // Bugs where reporter OR assignee is in the team
        const teamBugs=kpi.bugs.filter(b=>
            (b.reporter&&teamPeopleIds.has(b.reporter.accountId))||
            (b.assignee&&teamPeopleIds.has(b.assignee.accountId))||
            b.team===teamFilter
        );
        const n2=new Date();
        const curStart=new Date(n2.getFullYear(),n2.getMonth(),1).toISOString().split('T')[0];
        const prevStart=new Date(n2.getFullYear(),n2.getMonth()-1,1).toISOString().split('T')[0];
        const prevEnd=new Date(n2.getFullYear(),n2.getMonth(),0).toISOString().split('T')[0];
        const sum=(bugs:typeof teamBugs)=>({total:bugs.length,open:bugs.filter(b=>cl(b.status)==='open').length,closed:bugs.filter(b=>cl(b.status)==='closed').length,inProgress:bugs.filter(b=>cl(b.status)==='in_progress').length,critical:bugs.filter(b=>b.priority==='Highest').length,high:bugs.filter(b=>b.priority==='High').length});
        return{overall:sum(teamBugs),currentMonth:sum(teamBugs.filter(b=>b.created>=curStart)),previousMonth:sum(teamBugs.filter(b=>b.created>=prevStart&&b.created<=prevEnd))};
    },[kpi,teamFilter]);

    const filteredIssues = useMemo(()=>{
        if(!kpi)return[];
        let issues=filterType==='all'?kpi.all:filterType==='Bug'?kpi.bugs:filterType==='Story'?kpi.stories:filterType==='Epic'?kpi.epics:kpi.tasks;
        if(teamFilter!=='all'){
            const teamMemberIds=new Set(kpi.people.filter(p=>p.teams.includes(teamFilter)).map(p=>p.userId));
            issues=issues.filter(i=>
                i.team===teamFilter||
                (i.reporter&&teamMemberIds.has(i.reporter.accountId))||
                (i.assignee&&teamMemberIds.has(i.assignee.accountId))
            );
            // Deduplicate
            issues=Array.from(new Map(issues.map(i=>[i.id,i])).values());
        }
        if(filterMonth!=='all') issues=issues.filter(i=>i.created.startsWith(filterMonth));
        if(issueStatusFilter==='open_group') issues=issues.filter(i=>classifyStatus(i.status)==='open');
        else if(issueStatusFilter==='closed_group') issues=issues.filter(i=>classifyStatus(i.status)==='closed');
        else if(issueStatusFilter==='in_progress_group') issues=issues.filter(i=>classifyStatus(i.status)==='in_progress');
        else if(issueStatusFilter!=='all') issues=issues.filter(i=>i.status===issueStatusFilter);
        if(issuePriorityFilter!=='all') issues=issues.filter(i=>i.priority===issuePriorityFilter);
        if(issueAssigneeFilter!=='all') issues=issues.filter(i=>i.assignee?.accountId===issueAssigneeFilter);
        if(issueReporterFilter!=='all') issues=issues.filter(i=>i.reporter?.accountId===issueReporterFilter);
        if(issueDateFrom) issues=issues.filter(i=>i.created.slice(0,10)>=issueDateFrom);
        if(issueDateTo) issues=issues.filter(i=>i.created.slice(0,10)<=issueDateTo);
        if(issueSearch.trim()){
            const q=issueSearch.trim();
            if(/^[A-Z]+-\d+$/i.test(q)) issues=issues.filter(i=>i.key.toUpperCase()===q.toUpperCase());
            else{const ql=q.toLowerCase();issues=issues.filter(i=>i.summary.toLowerCase().includes(ql)||i.reporter?.displayName.toLowerCase().includes(ql)||i.assignee?.displayName.toLowerCase().includes(ql)||i.key.toLowerCase().includes(ql));}
        }
        return issues;
    },[kpi,filterType,filterMonth,issueSearch,issueStatusFilter,issuePriorityFilter,teamFilter,issueAssigneeFilter,issueReporterFilter,issueDateFrom,issueDateTo]);

    const filteredMonthly = useMemo(()=>{
        if(!kpi)return[];
        if(monthlyTeamFilter==='all')return kpi.monthly;
        // Get team member IDs for accurate filtering
        const teamMemberIds = new Set(kpi.people.filter(p=>p.teams.includes(monthlyTeamFilter)).map(p=>p.userId));
        return kpi.monthly.map(month=>{
            const mi=kpi.all.filter(i=>
                i.created.startsWith(month.month)&&(
                    i.team===monthlyTeamFilter||
                    (i.reporter&&teamMemberIds.has(i.reporter.accountId))||
                    (i.assignee&&teamMemberIds.has(i.assignee.accountId))
                )
            );
            // Deduplicate
            const unique=Array.from(new Map(mi.map(i=>[i.id,i])).values());
            return{...month,bugs:unique.filter(i=>i.issueType==='Bug').length,stories:unique.filter(i=>i.issueType==='Story').length,epics:unique.filter(i=>i.issueType==='Epic').length,tasks:unique.filter(i=>i.issueType==='Task').length,total:unique.length,open:unique.filter(i=>classifyStatus(i.status)==='open').length,closed:unique.filter(i=>classifyStatus(i.status)==='closed').length,inProgress:unique.filter(i=>classifyStatus(i.status)==='in_progress').length,critical:unique.filter(i=>i.priority==='Highest').length,storyPoints:Math.round(unique.reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10,liveTickets:unique.filter(i=>i.isLive).length};
        });
    },[kpi,monthlyTeamFilter]);

    const filteredLiveTickets = useMemo(()=>{
        if(!kpi)return[];
        let t=kpi.liveTickets;
        if(teamFilter!=='all'){
            const teamMemberIds=new Set(kpi.people.filter(p=>p.teams.includes(teamFilter)).map(p=>p.userId));
            t=t.filter(x=>x.team===teamFilter||(x.assignee&&teamMemberIds.has(x.assignee.accountId))||(x.reporter&&teamMemberIds.has(x.reporter.accountId)));
            t=Array.from(new Map(t.map(x=>[x.id,x])).values());
        }
        if(liveTeamFilter!=='all') t=t.filter(x=>x.assignee?.displayName===liveTeamFilter||x.reporter?.displayName===liveTeamFilter);
        return t;
    },[kpi,liveTeamFilter,teamFilter]);

    const hasActiveFilters = teamFilter!=='all'||memberFilter!=='all'||filterMonth!=='all'||issueStatusFilter!=='all'||issuePriorityFilter!=='all'||issueSearch!==''||issueAssigneeFilter!=='all'||issueReporterFilter!=='all'||issueDateFrom!==''||issueDateTo!=='';

    // Period card data helper - must be before early returns (React hooks rule)
    const periodCards = useMemo(() => {
        // Use allTimeAll (all issue types) for accurate overall counts
        const allIssues = kpi?.allTimeIssues || kpi?.bugs || [];

        // Helper: sum ALL issues (not just bugs) in a date range with full breakdown
        const sumRange = (issues: typeof allIssues, start?: string, end?: string) => {
            const filtered = start ? issues.filter(i => {
                const d = i.created.slice(0, 10);
                return d >= start && (!end || d <= end);
            }) : issues;
            return {
                total:      filtered.length,
                bugs:       filtered.filter(i => i.issueType === 'Bug').length,
                stories:    filtered.filter(i => i.issueType === 'Story').length,
                epics:      filtered.filter(i => i.issueType === 'Epic').length,
                tasks:      filtered.filter(i => i.issueType === 'Task').length,
                open:       filtered.filter(i => classifyStatus(i.status) === 'open').length,
                closed:     filtered.filter(i => classifyStatus(i.status) === 'closed').length,
                inProgress: filtered.filter(i => classifyStatus(i.status) === 'in_progress').length,
                critical:   filtered.filter(i => i.priority === 'Highest').length,
                high:       filtered.filter(i => i.priority === 'High').length,
                storyPoints: Math.round(filtered.reduce((s, i) => s + (i.storyPoints || 0), 0) * 10) / 10,
            };
        };

        // For team filter: use all issues (not just bugs) attributed to team
        const teamAllIssues = (kpi && teamFilter !== 'all')
            ? (() => {
                const teamPeopleIds = new Set(kpi.people.filter(p => p.teams.includes(teamFilter)).map(p => p.userId));
                return allIssues.filter(i =>
                    i.team === teamFilter ||
                    (i.reporter && teamPeopleIds.has(i.reporter.accountId)) ||
                    (i.assignee && teamPeopleIds.has(i.assignee.accountId))
                );
            })()
            : allIssues;

        const overallData = sumRange(teamAllIssues);

        // Current period = sprint date range if sprint selected, else current calendar month
        const curStart = activeSprint_info?.startDate?.slice(0, 10) ||
            `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        const curEnd = activeSprint_info?.endDate?.slice(0, 10) || undefined;

        // Previous period = previous sprint or previous calendar month
        const prevStart = prevSprint_info?.startDate?.slice(0, 10) ||
            `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-01`;
        const prevEnd = prevSprint_info?.endDate?.slice(0, 10) ||
            new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

        const curLabel = activeSprint_info
            ? `${activeSprint_info.name}${activeSprint_info.state === 'active' ? ' 🟢' : ''}`
            : cm?.label || 'Current Month';
        const prevLabel = prevSprint_info
            ? prevSprint_info.name
            : pm?.label || 'Previous Month';

        const curData  = sumRange(teamAllIssues, curStart, curEnd);
        const prevData = sumRange(teamAllIssues, prevStart, prevEnd);

        return [
            { title: 'Overall (All Time)', icon: Award, color: 'text-purple-500', border: 'border-purple-500/40', bg: 'bg-purple-500/5',
              data: overallData, prevData: null as null | typeof overallData },
            { title: `${curLabel}`, icon: TrendingUp, color: 'text-amber-500', border: 'border-amber-500/40', bg: 'bg-amber-500/5',
              data: curData, prevData: prevData },
            { title: `${prevLabel}`, icon: Clock, color: 'text-blue-500', border: 'border-blue-500/40', bg: 'bg-blue-500/5',
              data: prevData, prevData: null as null | typeof overallData },
        ];
    }, [kpi, cm, pm, activeSprint_info, prevSprint_info, now, prevDate, teamFilter]);

    if(loading&&!kpi) {
        return (
            <div className="space-y-6">
                {/* Full-page loading state — much more visible than a tiny spinner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-blue-500/5 to-purple-500/10 border border-primary/20 p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 animate-pulse flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-primary animate-spin"/>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Loading Jira KPI Dashboard</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">Fetching all-time data from Jira — this may take 15–30s on first load</p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{width:'60%',animation:'progress-indeterminate 1.5s ease-in-out infinite'}}/>
                    </div>
                    <style>{`@keyframes progress-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
                </div>
                {/* Skeleton cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1,2,3].map(i=><div key={i} className="h-52 rounded-2xl bg-muted animate-pulse"/>)}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[1,2,3,4,5,6,7].map(i=><div key={i} className="h-24 rounded-xl bg-muted animate-pulse"/>)}
                </div>
                <div className="h-96 rounded-2xl bg-muted animate-pulse"/>
            </div>
        );
    }
    
    if(error&&!kpi) {
        return (<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-10 h-10 text-red-500"/>
            <div className="text-lg font-semibold text-red-600">Failed to load: {error}</div>
            <Button onClick={forceRefresh}>Retry</Button>
        </div>);
    }

    // Main component return
    return (
        <div className="space-y-6">
            {/* Top loading bar — shows when refreshing with existing data */}
            {loading && kpi && (
                <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary" style={{animation:'progress-indeterminate 1.5s ease-in-out infinite',width:'40%'}}/>
                    <style>{`@keyframes progress-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
                </div>
            )}
            {selectedPerson&&kpi&&(
                <AnimatePresence>
                    <MemberProfileModal 
                        person={selectedPerson} 
                        allIssues={kpi.allTimeIssues ?? kpi.all} 
                        sprintIssues={kpi.all}
                        allSprints={allSprints.length > 0 ? allSprints : kpi.sprints}
                        onClose={()=>setSelectedPerson(null)}
                        onFilterBugs={handleFilterBugsFromModal}
                    />
                </AnimatePresence>
            )}

            {/* HEADER */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-blue-500/5 to-purple-500/10 border border-primary/20 p-6">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/apps"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5"/></Button></Link>
                        <div>
                            <h1 className="text-2xl font-bold">Jira KPI Dashboard</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {n(kpi?.counts.total)} total issues — Auto-syncs every {isPolling ? '30 sec' : '10 min'}
                                {lastSync&&<span suppressHydrationWarning className="ml-2 opacity-60">— Synced {lastSync.toLocaleTimeString()}</span>}
                                {kpi?.fromCache&&<span className="ml-2 text-amber-600 text-xs">— Cached ({kpi.cacheAge}s old)</span>}
                                {kpi?.refreshing&&<span className="ml-2 text-blue-600 text-xs">— Refreshing...</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {hasActiveFilters&&<Button onClick={clearAllFilters} variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5"><X className="w-4 h-4 mr-1"/> Clear All Filters</Button>}
                        <Button 
                            onClick={() => setIsPolling(!isPolling)}
                            variant="outline"
                            size="sm"
                            className={cn(isPolling && 'border-green-500/50 bg-green-500/5')}
                        >
                            {isPolling ? (
                                <>
                                    <Activity className="w-4 h-4 mr-2 animate-pulse text-green-500" />
                                    Live Updates ON
                                </>
                            ) : (
                                <>
                                    <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Live Updates OFF
                                </>
                            )}
                        </Button>
                        <Button onClick={forceRefresh} variant="outline" disabled={loading} size="sm"><RefreshCw className={cn('w-4 h-4 mr-2',loading&&'animate-spin')}/>{loading?'Syncing...':'Force Sync'}</Button>
                        {/* Sprint selector — scopes ALL data to the selected sprint */}
                        <Select value={activeSprint || ''} onValueChange={v => setActiveSprint(v || undefined)}>
                            <SelectTrigger className={cn('w-56 h-9 text-xs', activeSprint && 'border-primary bg-primary/10 font-semibold text-primary')}>
                                <SelectValue placeholder={allSprints.length === 0 ? 'Loading sprints…' : 'Select Sprint'} />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {allSprints.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.state === 'active' ? '🟢 ' : s.state === 'future' ? '🔵 ' : '⬜ '}{s.name}
                                        {s.startDate && s.endDate && (
                                            <span className="text-muted-foreground ml-1 text-[10px]">
                                                ({s.startDate.slice(5, 10)} – {s.endDate.slice(5, 10)})
                                            </span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <a href="https://sunnetwork-techteam-hanqzy91.atlassian.net/jira/software/projects/SUN/boards" target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-2"/> Jira Board</Button>
                        </a>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl"/>
            </div>

            {/* GLOBAL ACTIVE FILTER BAR */}
            <ActiveFilterBar
                filters={[
                    {key:'team',label:'Team',value:teamFilter,onClear:()=>setTeamFilter('all'),color:'bg-primary/10 text-primary border-primary/30'},
                    {key:'member',label:'Member',value:kpi?.people.find(p=>p.userId===memberFilter)?.name||'',onClear:()=>setMemberFilter('all'),color:'bg-blue-500/10 text-blue-700 border-blue-500/30'},
                    {key:'month',label:'Month',value:filterMonth==='all'?'':kpi?.monthly.find(m=>m.month===filterMonth)?.label||filterMonth,onClear:()=>setFilterMonth('all')},
                    {key:'status',label:'Status',value:issueStatusFilter==='all'?'':issueStatusFilter==='open_group'?'Open':issueStatusFilter==='closed_group'?'Closed':issueStatusFilter==='in_progress_group'?'In Progress':issueStatusFilter,onClear:()=>{setIssueStatusFilter('all');setTempIssueStatusFilter('all');}},
                    {key:'priority',label:'Priority',value:issuePriorityFilter==='all'?'':issuePriorityFilter,onClear:()=>{setIssuePriorityFilter('all');setTempIssuePriorityFilter('all');}},
                    {key:'type',label:'Type',value:filterType==='all'?'':filterType,onClear:()=>setFilterType('all')},
                    {key:'assignee',label:'Assignee',value:issueAssigneeFilter==='all'?'':kpi?.people.find(p=>p.userId===issueAssigneeFilter)?.name||issueAssigneeFilter,onClear:()=>{setIssueAssigneeFilter('all');setTempIssueAssigneeFilter('all');},color:'bg-cyan-500/10 text-cyan-700 border-cyan-500/30'},
                    {key:'reporter',label:'Reporter',value:issueReporterFilter==='all'?'':kpi?.people.find(p=>p.userId===issueReporterFilter)?.name||issueReporterFilter,onClear:()=>{setIssueReporterFilter('all');setTempIssueReporterFilter('all');},color:'bg-violet-500/10 text-violet-700 border-violet-500/30'},
                    {key:'dateFrom',label:'From',value:issueDateFrom,onClear:()=>{setIssueDateFrom('');setTempIssueDateFrom('');}},
                    {key:'dateTo',label:'To',value:issueDateTo,onClear:()=>{setIssueDateTo('');setTempIssueDateTo('');}},
                    {key:'search',label:'Search',value:issueSearch,onClear:()=>setIssueSearch('')},
                ]}
                onClearAll={clearAllFilters}
            />

            {/* PERIOD OVERVIEW */}
            <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary"/>
                    {teamFilter!=='all'?`${teamFilter} — Period Overview`:'Period Overview'}
                    {teamFilter!=='all'&&<span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 ml-1">{teamFilter}</span>}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {periodCards.map(({title,icon:Icon,color,border,bg,data,prevData})=>{
                        const closeRate=data.total>0?Math.min(100,Math.round((data.closed/data.total)*100)):0;
                        const d = data as any; // has bugs,stories,epics,tasks,storyPoints
                        return(
                            <Card key={title} className={`border-2 ${border}`}>
                                <CardHeader className={`pb-2 ${bg}`}>
                                    <CardTitle className="text-sm flex items-center gap-2"><Icon className={`w-4 h-4 ${color}`}/>{title}</CardTitle>
                                    {/* Ticket type breakdown — Total: 4 | 2 Bugs · 1 Story · 1 Task */}
                                    {data.total > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            <span className={cn('text-xs font-bold', color)}>{data.total} total</span>
                                            {d.bugs>0&&<span className="text-[10px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full border border-red-500/20 font-medium">{d.bugs}B</span>}
                                            {d.stories>0&&<span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-500/20 font-medium">{d.stories}S</span>}
                                            {d.epics>0&&<span className="text-[10px] bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-500/20 font-medium">{d.epics}E</span>}
                                            {d.tasks>0&&<span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full border border-green-500/20 font-medium">{d.tasks}T</span>}
                                            {d.storyPoints>0&&<span className="text-[10px] bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded-full border border-violet-500/20 font-medium">{d.storyPoints}SP</span>}
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            {label:'Total Issues',value:data.total,c:color,b:'bg-muted/40',dk:null as string|null,delta:prevData?data.total-prevData.total:0,hib:true},
                                            {label:'Open',value:data.open,c:'text-red-600',b:'bg-red-500/5 border border-red-500/20',dk:'open',delta:prevData?data.open-prevData.open:0,hib:false},
                                            {label:'Closed',value:data.closed,c:'text-green-600',b:'bg-green-500/5 border border-green-500/20',dk:'closed',delta:prevData?data.closed-prevData.closed:0,hib:true},
                                            {label:'In Progress',value:data.inProgress,c:'text-amber-600',b:'bg-amber-500/5 border border-amber-500/20',dk:'in_progress',delta:0,hib:true},
                                            {label:'Critical',value:data.critical,c:'text-red-700',b:'bg-red-500/5 border border-red-500/20',dk:'critical',delta:prevData?data.critical-prevData.critical:0,hib:false},
                                            {label:'High',value:data.high,c:'text-orange-600',b:'bg-orange-500/5 border border-orange-500/20',dk:'high',delta:0,hib:true},
                                        ].map(({label,value,c,b,dk,delta,hib})=>(
                                            <button key={label} onClick={()=>dk&&drillToIssues(dk as any)}
                                                className={cn('text-center p-2 rounded-xl w-full transition-all',b,dk?'cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 hover:ring-1 hover:ring-primary/30':'cursor-default')}
                                                title={dk?`Click to view ${label} issues`:undefined}>
                                                <div className={cn('text-2xl font-bold',c)}>{value}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                                                {delta!==0&&<Delta v={delta} hib={hib} size="xs"/>}
                                                {dk&&<div className="text-[9px] text-primary/50 mt-0.5">view</div>}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Close Rate</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',closeRate>=50?'bg-green-500':'bg-amber-500')} style={{width:`${closeRate}%`}}/></div>
                                            <span className="font-bold">{closeRate}%</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* OVERALL SUMMARY CARDS */}
            <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary"/>Overall Summary (All Time)
                    {filterType!=='all'&&<span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 ml-1">Viewing: {typeLabel}</span>}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                        {label:'Total Issues',value:kpi?.counts.total||0,color:'text-primary',icon:Layers,active:filterType==='all',drillFilter:'total' as const,typeFilter:'all' as const},
                        {label:'Bugs',value:kpi?.counts.bugs||0,color:'text-red-600',icon:Bug,active:filterType==='Bug',drillFilter:'total' as const,typeFilter:'Bug' as const},
                        {label:'Stories',value:kpi?.counts.stories||0,color:'text-blue-600',icon:FileText,active:filterType==='Story',drillFilter:'total' as const,typeFilter:'Story' as const},
                        {label:'Epics',value:kpi?.counts.epics||0,color:'text-purple-600',icon:Zap,active:filterType==='Epic',drillFilter:'total' as const,typeFilter:'Epic' as const},
                        {label:'Tasks',value:kpi?.counts.tasks||0,color:'text-green-600',icon:CheckCircle2,active:filterType==='Task',drillFilter:'total' as const,typeFilter:'Task' as const},
                        {label:'Story Points',value:(kpi?.totalStoryPoints||0)%1===0?String(kpi?.totalStoryPoints||0):(kpi?.totalStoryPoints||0).toFixed(1),color:'text-purple-600',icon:Star,active:activeTab==='storypoints',drillFilter:'storypoints' as const,typeFilter:null},
                        {label:'Live Tickets',value:kpi?.liveBuildsCount||0,color:'text-emerald-600',icon:Globe,active:activeTab==='live',drillFilter:'live' as const,typeFilter:null},
                    ].map((s,i)=>(
                        <motion.div key={s.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}>
                            <Card className={cn(s.active&&'border-2 border-primary/40 shadow-md','cursor-pointer hover:shadow-lg hover:scale-105 transition-all active:scale-95')}
                                onClick={()=>{
                                    if(s.drillFilter==='live'){setActiveTab('live');setTimeout(()=>tabsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);}
                                    else if(s.drillFilter==='storypoints'){setActiveTab('storypoints');setTimeout(()=>tabsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);}
                                    else if(s.drillFilter==='total'&&s.typeFilter){setFilterType(s.typeFilter);drillToIssues('total');}
                                }}>
                                <CardContent className="p-4">
                                    <s.icon className={cn('w-4 h-4 mb-2',s.active?s.color:'text-muted-foreground')}/>
                                    <div className={cn('text-2xl font-bold',s.color)}>{typeof s.value === 'number' ? n(s.value) : s.value}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                                    {s.active&&<div className="text-[10px] text-primary font-medium mt-0.5">Active filter</div>}
                                    <div className="text-[9px] text-primary/50 mt-0.5">click to view</div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* TABS */}
            <div ref={tabsRef}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="team" className="text-xs sm:text-sm"><Users className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Team KPIs</TabsTrigger>
                    <TabsTrigger value="teams" className="text-xs sm:text-sm"><Trophy className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Teams</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs sm:text-sm"><Calendar className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Monthly</TabsTrigger>
                    <TabsTrigger value="issues" className="text-xs sm:text-sm"><Layers className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Issues</TabsTrigger>
                    <TabsTrigger value="live" className="text-xs sm:text-sm"><Globe className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Live Builds</TabsTrigger>
                    <TabsTrigger value="storypoints" className="text-xs sm:text-sm"><Star className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Story Points</TabsTrigger>
                    <TabsTrigger value="worklogs" className="text-xs sm:text-sm"><Clock className="w-3.5 h-3.5 mr-1 hidden sm:inline"/> Work Logs</TabsTrigger>
                </TabsList>

                {/* TAB 1: TEAM KPIs */}
                <TabsContent value="team" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary"/>Team Performance — All Members
                                <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">{filteredPeople.length} members</span>
                            </CardTitle>
                            <CardDescription>Professional KPIs — QA: bug open/close rate — Dev: SP delivery — All: assigned tickets</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <Select value={teamFilter} onValueChange={setTeamFilter}>
                                    <SelectTrigger className={cn('w-40 h-8 text-xs',teamFilter!=='all'&&'border-primary bg-primary/5 font-medium')}><SelectValue placeholder="All Teams"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Teams</SelectItem>{(kpi?.allTeams||[]).map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={memberFilter} onValueChange={setMemberFilter}>
                                    <SelectTrigger className={cn('w-44 h-8 text-xs',memberFilter!=='all'&&'border-primary bg-primary/5 font-medium')}><SelectValue placeholder="All Members"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Members</SelectItem>{memberDropdownPeople.map(p=><SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <div className="relative min-w-36">
                                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground"/>
                                    <Input placeholder="Search..." value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} className="pl-8 h-8 text-xs"/>
                                </div>
                                <Select value={filterMonth} onValueChange={setFilterMonth}>
                                    <SelectTrigger className={cn('w-40 h-8 text-xs',filterMonth!=='all'&&'border-primary bg-primary/5')}><SelectValue placeholder="All Time"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Time</SelectItem>{(kpi?.monthly||[]).slice().reverse().map(m=><SelectItem key={m.month} value={m.month}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={sortBy} onValueChange={v=>setSortBy(v as any)}>
                                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bugsReported">Sort: Bugs Reported</SelectItem>
                                        <SelectItem value="ticketsAssigned">Sort: Tickets Assigned</SelectItem>
                                        <SelectItem value="storyPointsAssigned">Sort: SP Assigned</SelectItem>
                                        <SelectItem value="storiesReported">Sort: Stories</SelectItem>
                                        <SelectItem value="closeRate">Sort: Bug Close Rate</SelectItem>
                                    </SelectContent>
                                </Select>
                                {(teamFilter!=='all'||memberFilter!=='all'||memberSearch)&&<Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={()=>{setTeamFilter('all');setMemberFilter('all');setMemberSearch('');}}>Clear</Button>}
                                <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={async()=>{
                                    if(!kpi)return;
                                    const exportRows = filteredPeople.map((p,idx)=>({
                                        Rank: idx+1,
                                        Name: p.name,
                                        Team: p.teams[0]||'',
                                        'Bugs Reported': p.bugsReported,
                                        'Bugs Open': p.bugsOpen,
                                        'Bugs Closed': p.bugsClosed,
                                        'Bugs In Progress': p.bugsInProgress,
                                        'Critical Bugs': p.bugsCritical,
                                        'High Bugs': p.bugsHigh,
                                        'Close Rate %': p.closeRate,
                                        'Stories Reported': p.storiesReported,
                                        'Total SP': p.storyPointsAssigned,
                                        'SP Done': p.storyPointsCompleted,
                                        'SP In Progress': (p as any).storyPointsInProgress||0,
                                        'SP To-Do': (p as any).storyPointsTodo||0,
                                        'Tickets Assigned': p.ticketsAssigned,
                                        'Assigned Open': p.assignedOpen,
                                        'Assigned Closed': p.assignedClosed,
                                        'Quality Score': p.qualityScore,
                                    }));
                                    await exportData({format:'excel',data:exportRows as any,fileName:`team-kpi-${Date.now()}.xlsx`,metadata:{exportDate:new Date(),exportedBy:'system',filters:{}}});
                                }} disabled={exporting}>
                                    <Download className="w-3 h-3 mr-1"/>{exporting?'...':'Export'}
                                </Button>
                            </div>
                            {(teamFilter!=='all'||memberFilter!=='all')&&(
                                <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/30 rounded-lg border border-border/50">
                                    <span className="text-xs text-muted-foreground font-medium">Active:</span>
                                    {teamFilter!=='all'&&<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 flex items-center gap-1">{teamFilter}<button onClick={()=>setTeamFilter('all')} className="ml-1 hover:text-destructive font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>}
                                    {memberFilter!=='all'&&<span className="text-xs bg-blue-500/10 text-blue-700 px-2 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">{kpi?.people.find(p=>p.userId===memberFilter)?.name}<button onClick={()=>setMemberFilter('all')} className="ml-1 hover:text-destructive font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>}
                                    <span className="text-xs text-muted-foreground ml-auto">{filteredPeople.length} member{filteredPeople.length!==1?'s':''} shown{teamFilter!=='all'&&memberFilter==='all'?' (team view)':''}{memberFilter!=='all'?' (individual view)':''}</span>
                                </div>
                            )}
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-8">#</th>
                                            <th className="text-left px-3 py-2.5 text-xs font-semibold">Member</th>
                                            {/* Bug columns */}
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-red-600">Bugs</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-red-500">Open</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-green-600">Closed</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-red-700">Critical</th>
                                            {/* Dev columns */}
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-blue-600">Stories</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-violet-600">Total SP</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-emerald-600">SP Done</th>
                                            {/* Common */}
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-amber-600">Assigned</th>
                                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground min-w-[90px]">Delivery Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPeople.map((p,idx)=>{
                                            const medals=['#1','#2','#3'];
                                            
                                            // Delivery rate: for QA = bug close rate, for Dev = SP completion %, for mixed = weighted
                                            const spPct = p.storyPointsAssigned>0?Math.round((p.storyPointsCompleted/p.storyPointsAssigned)*100):0;
                                            const deliveryRate = p.bugsReported>0&&p.storyPointsAssigned>0
                                                ? Math.round((p.closeRate + spPct)/2)
                                                : p.storyPointsAssigned>0 ? spPct
                                                : p.bugsReported>0 ? p.closeRate : 0;
                                            const deliveryColor = deliveryRate>=70?'text-green-600 bg-green-500/10':deliveryRate>=40?'text-amber-600 bg-amber-500/10':'text-red-600 bg-red-500/10';

                                            return(
                                                <motion.tr key={p.userId} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:Math.min(idx*0.02,0.4)}}
                                                    className={cn('border-b hover:bg-muted/20 transition-colors cursor-pointer group',idx===0&&'bg-amber-500/5',idx===1&&'bg-slate-500/5',idx===2&&'bg-orange-500/5')}
                                                    onClick={()=>setSelectedPerson(p)}>
                                                    <td className="px-3 py-2.5 text-center">{idx<3?medals[idx]:<span className="text-xs text-muted-foreground">#{idx+1}</span>}</td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0',getAvatarStyle(p.name).bg)}>{p.name.charAt(0)}</div>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.name}</div>
                                                                {teamFilter==='all'&&p.teams.length>0&&<div className="text-[10px] text-muted-foreground truncate">{p.teams[0]}</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* Bug columns - show value or dash */}
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.bugsReported>0?<span className="font-bold text-red-600">{p.bugsReported}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.bugsReported>0?<span className={cn('font-semibold text-xs px-1.5 py-0.5 rounded',p.bugsOpen>0?'bg-red-500/10 text-red-600':'text-muted-foreground')}>{p.bugsOpen}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.bugsReported>0?<span className={cn('font-semibold text-xs px-1.5 py-0.5 rounded',p.bugsClosed>0?'bg-green-500/10 text-green-600':'text-muted-foreground')}>{p.bugsClosed}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.bugsCritical>0?<span className="bg-red-500/20 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">{p.bugsCritical}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    {/* Dev columns */}
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.storiesReported>0?<span className="font-semibold text-blue-600">{p.storiesReported}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.storyPointsAssigned>0?<span className="font-semibold text-violet-600">{p.storyPointsAssigned}</span>:<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        {p.storyPointsAssigned>0?(
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',spPct>=70?'bg-emerald-500':spPct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${spPct}%`}}/></div>
                                                                <span className="text-xs font-bold text-emerald-700">{p.storyPointsCompleted}</span>
                                                            </div>
                                                        ):<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                    {/* Assigned */}
                                                    <td className="px-2 py-2.5 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-blue-600">{p.ticketsAssigned}</span>
                                                            {p.assignedOpen>0&&<span className="text-[9px] text-amber-600">{p.assignedOpen} open</span>}
                                                        </div>
                                                    </td>
                                                    {/* Delivery rate - the key metric */}
                                                    <td className="px-2 py-2.5 text-center">
                                                        {deliveryRate>0?(
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className={cn('text-xs font-black px-2 py-0.5 rounded-full',deliveryColor)}>{deliveryRate}%</span>
                                                                <span className="text-[9px] text-muted-foreground">
                                                                    {p.bugsReported>0&&p.storyPointsAssigned>0?'avg':p.storyPointsAssigned>0?'SP done':p.bugsReported>0?'bugs closed':''}
                                                                </span>
                                                            </div>
                                                        ):<span className="text-muted-foreground text-xs">&#8212;</span>}
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                    {filteredPeople.length>0&&(
                                        <tfoot>
                                            <tr className="border-t-2 bg-muted/50 font-bold">
                                                <td colSpan={3} className="px-3 py-2.5 text-xs text-muted-foreground">TOTAL ({filteredPeople.length} members)</td>
                                                <td className="px-2 py-2.5 text-center text-red-600">{filteredPeople.reduce((s,p)=>s+p.bugsReported,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-red-500">{filteredPeople.reduce((s,p)=>s+p.bugsOpen,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-green-600">{filteredPeople.reduce((s,p)=>s+p.bugsClosed,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-red-700">{filteredPeople.reduce((s,p)=>s+p.bugsCritical,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-blue-600">{filteredPeople.reduce((s,p)=>s+p.storiesReported,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-violet-600">{filteredPeople.reduce((s,p)=>s+p.storyPointsAssigned,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-emerald-700">{filteredPeople.reduce((s,p)=>s+p.storyPointsCompleted,0)}</td>
                                                <td className="px-2 py-2.5 text-center text-blue-600">{filteredPeople.reduce((s,p)=>s+p.ticketsAssigned,0)}</td>
                                                <td/>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: MONTHLY */}
                <TabsContent value="monthly" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary"/>
                                        {monthlyTeamFilter!=='all'?`${monthlyTeamFilter} — Monthly Ticket Counts`:'Monthly Ticket Counts — Last 12 Months'}
                                        {monthlyTeamFilter!=='all'&&<span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 ml-1">{monthlyTeamFilter}</span>}
                                    </CardTitle>
                                    <CardDescription className="mt-1">Exact counts per month for all issue types, story points, and live tickets</CardDescription>
                                </div>
                                {/* Team dropdown — independent of global team filter */}
                                <div className="flex items-center gap-2">
                                    <Select value={monthlyTeamFilter} onValueChange={setMonthlyTeamFilter}>
                                        <SelectTrigger className={cn('w-44 h-8 text-xs',monthlyTeamFilter!=='all'&&'border-primary bg-primary/5 font-medium')}>
                                            <SelectValue placeholder="All Teams"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Teams</SelectItem>
                                            {(kpi?.allTeams||[]).map(t=>(
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {monthlyTeamFilter!=='all'&&(
                                        <button onClick={()=>setMonthlyTeamFilter('all')} className="text-xs text-destructive hover:underline">Clear</button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Month</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600">Bugs</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600">Stories</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-purple-600">Epics</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600">Tasks</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Total</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-500">Open</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600">Closed</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">In Prog</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-700">Critical</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-purple-600">Story Pts</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-emerald-600">Live</th>
                                            <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Close%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMonthly.slice().reverse().map(m=>{
                                            const isCur=m.month===curKey, isPrev=m.month===prevKey;
                                            const cr=m.total>0?Math.round((m.closed/m.total)*100):0;
                                            return(
                                                <tr key={m.month} className={cn('border-b hover:bg-muted/20 transition-colors',isCur&&'bg-amber-500/5 font-semibold',isPrev&&'bg-blue-500/5')}>
                                                    <td className="px-4 py-2.5"><div className="flex items-center gap-2">{m.label}{isCur&&<span className="text-[10px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">Current</span>}{isPrev&&<span className="text-[10px] bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded-full">Previous</span>}</div></td>
                                                    <td className="px-3 py-2.5 text-center font-bold text-red-600">{m.bugs}</td>
                                                    <td className="px-3 py-2.5 text-center text-blue-600">{m.stories||'—'}</td>
                                                    <td className="px-3 py-2.5 text-center text-purple-600">{m.epics||'—'}</td>
                                                    <td className="px-3 py-2.5 text-center text-green-600">{m.tasks||'—'}</td>
                                                    <td className="px-3 py-2.5 text-center font-bold">{m.total}</td>
                                                    <td className="px-3 py-2.5 text-center text-red-500">{m.open}</td>
                                                    <td className="px-3 py-2.5 text-center text-green-600">{m.closed}</td>
                                                    <td className="px-3 py-2.5 text-center text-amber-600">{m.inProgress}</td>
                                                    <td className="px-3 py-2.5 text-center">{m.critical>0?<span className="bg-red-500/20 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">{m.critical}</span>:'—'}</td>
                                                    <td className="px-3 py-2.5 text-center text-purple-600 font-medium">{m.storyPoints>0?(m.storyPoints%1===0?m.storyPoints:m.storyPoints.toFixed(1)):'—'}</td>
                                                    <td className="px-3 py-2.5 text-center">{m.liveTickets>0?<span className="bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold">{m.liveTickets}</span>:'—'}</td>
                                                    <td className="px-3 py-2.5 text-center"><div className="flex items-center gap-1 justify-center"><div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',cr>=50?'bg-green-500':'bg-amber-500')} style={{width:`${cr}%`}}/></div><span className="text-xs font-bold">{cr}%</span></div></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: ISSUES */}
                <TabsContent value="issues" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary"/>Issues — Advanced Search
                                <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">{filteredIssues.length.toLocaleString()} results</span>
                            </CardTitle>
                            <CardDescription>Search by bug ID (e.g. SUN-123), keyword, or use filters below</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {drilldownLabel&&(
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                                    <span className="text-xs font-medium text-primary">Showing: <span className="font-bold capitalize">{drilldownLabel==='total'?'All':drilldownLabel.replace('_',' ')}</span> {filterType!=='all'?filterType+'s':'issues'}{teamFilter!=='all'&&` — Team: ${teamFilter}`}</span>
                                    <button onClick={()=>{setDrilldownLabel(null);setIssueStatusFilter('all');setIssuePriorityFilter('all');}} className="ml-auto text-xs text-destructive hover:underline">Clear filter</button>
                                </div>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                                <Input placeholder="Search by bug ID (SUN-123), summary keyword, or reporter name..." value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} className="pl-10 h-10"/>
                                {issueSearch&&<button onClick={()=>setIssueSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">×</button>}
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                {(['Bug','Story','Epic','Task','all'] as const).map(t=>(
                                    <Button key={t} variant={filterType===t?'default':'outline'} size="sm" onClick={()=>setFilterType(t)} className={cn('text-xs h-7',filterType===t&&'ring-2 ring-primary/30')}>
                                        {t==='all'?'All':t==='Bug'?'Bug':t==='Story'?'Story':t==='Epic'?'Epic':'Task'}
                                        <span className="ml-1 opacity-60 text-[10px]">({t==='all'?kpi?.counts.total:t==='Bug'?kpi?.counts.bugs:t==='Story'?kpi?.counts.stories:t==='Epic'?kpi?.counts.epics:kpi?.counts.tasks})</span>
                                    </Button>
                                ))}
                                {/* Team filter in Issues tab */}
                                <Select value={teamFilter} onValueChange={setTeamFilter}>
                                    <SelectTrigger className={cn('w-36 h-7 text-xs',teamFilter!=='all'&&'border-primary bg-primary/5 font-medium')}><SelectValue placeholder="All Teams"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Teams</SelectItem>
                                        {(kpi?.allTeams||[]).map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={tempIssueStatusFilter} onValueChange={setTempIssueStatusFilter}>
                                    <SelectTrigger className={cn('w-36 h-7 text-xs',tempIssueStatusFilter!=='all'&&'border-primary bg-primary/5')}><SelectValue placeholder="All Status"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="open_group">Open (Group)</SelectItem>
                                        <SelectItem value="in_progress_group">In Progress (Group)</SelectItem>
                                        <SelectItem value="closed_group">Closed (Group)</SelectItem>
                                        {Object.keys(kpi?.byStatus||{}).sort().map(s=><SelectItem key={s} value={s}>{s} ({kpi?.byStatus[s]})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={tempIssuePriorityFilter} onValueChange={setTempIssuePriorityFilter}>
                                    <SelectTrigger className={cn('w-32 h-7 text-xs',tempIssuePriorityFilter!=='all'&&'border-primary bg-primary/5')}><SelectValue placeholder="All Priority"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Priority</SelectItem>{['Highest','High','Medium','Low','Lowest'].map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={filterMonth} onValueChange={setFilterMonth}>
                                    <SelectTrigger className={cn('w-40 h-7 text-xs',filterMonth!=='all'&&'border-primary bg-primary/5')}><SelectValue placeholder="All Months"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Time</SelectItem>{(kpi?.monthly||[]).slice().reverse().map(m=><SelectItem key={m.month} value={m.month}>{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                                {/* Assignee filter */}
                                <Select value={tempIssueAssigneeFilter} onValueChange={setTempIssueAssigneeFilter}>
                                    <SelectTrigger className={cn('w-40 h-7 text-xs',tempIssueAssigneeFilter!=='all'&&'border-cyan-500 bg-cyan-500/5 font-medium')}><SelectValue placeholder="Assignee"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Assignees</SelectItem>
                                        {(kpi?.people||[]).map(p=><SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {/* Reporter filter */}
                                <Select value={tempIssueReporterFilter} onValueChange={setTempIssueReporterFilter}>
                                    <SelectTrigger className={cn('w-40 h-7 text-xs',tempIssueReporterFilter!=='all'&&'border-violet-500 bg-violet-500/5 font-medium')}><SelectValue placeholder="Reporter"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Reporters</SelectItem>
                                        {(kpi?.people||[]).map(p=><SelectItem key={p.userId} value={p.userId}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {/* Date range */}
                                <div className="flex items-center gap-1">
                                    <input type="date" value={tempIssueDateFrom} onChange={e=>setTempIssueDateFrom(e.target.value)}
                                        className={cn('h-7 text-xs px-2 rounded-md border bg-background',tempIssueDateFrom&&'border-primary bg-primary/5')}
                                        title="Created from"/>
                                    <span className="text-xs text-muted-foreground">&mdash;</span>
                                    <input type="date" value={tempIssueDateTo} onChange={e=>setTempIssueDateTo(e.target.value)}
                                        className={cn('h-7 text-xs px-2 rounded-md border bg-background',tempIssueDateTo&&'border-primary bg-primary/5')}
                                        title="Created to"/>
                                </div>
                            </div>
                            
                            {/* Filters changed indicator and Apply/Reset buttons */}
                            {filtersChanged && (
                                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm text-amber-700 font-semibold">Filters pending — </span>
                                        <span className="text-xs text-amber-600">
                                            {[
                                                tempIssueStatusFilter!==issueStatusFilter && `Status: ${tempIssueStatusFilter==='all'?'Any':tempIssueStatusFilter==='open_group'?'Open':tempIssueStatusFilter==='closed_group'?'Closed':tempIssueStatusFilter==='in_progress_group'?'In Progress':tempIssueStatusFilter}`,
                                                tempIssuePriorityFilter!==issuePriorityFilter && `Priority: ${tempIssuePriorityFilter==='all'?'Any':tempIssuePriorityFilter}`,
                                                tempIssueAssigneeFilter!==issueAssigneeFilter && `Assignee changed`,
                                                tempIssueReporterFilter!==issueReporterFilter && `Reporter changed`,
                                                tempIssueDateFrom!==issueDateFrom && `From: ${tempIssueDateFrom||'any'}`,
                                                tempIssueDateTo!==issueDateTo && `To: ${tempIssueDateTo||'any'}`,
                                            ].filter(Boolean).join(' ? ')}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button 
                                            onClick={handleApplyFilters}
                                            size="sm"
                                            className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-xs font-semibold"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Apply
                                        </Button>
                                        <Button 
                                            onClick={handleResetFilters}
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 h-8 text-xs"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            Reset
                                        </Button>
                                    </div>
                                </div>
                            )}
                            
                            {!filtersChanged && (issueSearch||teamFilter!=='all'||issueStatusFilter!=='all'||issuePriorityFilter!=='all'||filterMonth!=='all'||issueAssigneeFilter!=='all'||issueReporterFilter!=='all'||issueDateFrom||issueDateTo)&&(
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearAllFilters}>Clear All Filters</Button>
                            )}
                            {issueSearch&&/^[A-Z]+-\d+$/i.test(issueSearch.trim())&&(
                                <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-700 px-3 py-2 rounded-lg border border-blue-500/20">
                                    <Search className="w-3 h-3"/>Searching by Bug ID: <span className="font-bold">{issueSearch.trim().toUpperCase()}</span>
                                </div>
                            )}
                            <div className="max-h-[600px] overflow-y-auto space-y-1 rounded-lg border p-2">
                                {filteredIssues.slice(0,500).map(issue=>(
                                    <div key={issue.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                        <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 hover:bg-blue-500/20 shrink-0 min-w-[80px] text-center">{issue.key}</a>
                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border shrink-0',PRIORITY_STYLE[issue.priority]||PRIORITY_STYLE.Medium)}>{issue.priority}</span>
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{issue.status}</span>
                                        {issue.isLive&&<span className="text-[10px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">Live</span>}
                                        {issue.storyPoints&&<span className="text-[10px] bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded shrink-0">{issue.storyPoints}sp</span>}
                                        <span className="text-sm flex-1 truncate">{issue.summary}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{issue.reporter?.displayName||'—'}</span>
                                        {issue.assignee&&<span className="text-xs text-blue-600 shrink-0">{issue.assignee.displayName}</span>}
                                        <span suppressHydrationWarning className="text-xs text-muted-foreground shrink-0">{new Date(issue.created).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}</span>
                                    </div>
                                ))}
                                {filteredIssues.length===0&&<div className="text-center py-12 text-muted-foreground"><Search className="w-10 h-10 mx-auto mb-3 opacity-20"/><div className="font-medium">No issues found</div><div className="text-xs mt-1">Try a different search term or clear filters</div></div>}
                                {filteredIssues.length>500&&<div className="text-center py-3 text-xs text-muted-foreground border-t">Showing 500 of {filteredIssues.length.toLocaleString()} ? use filters to narrow down</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: LIVE BUILDS */}
                <TabsContent value="live" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-emerald-500"/>Live Build Tickets — Team Wise
                                <span className="ml-auto text-xs font-normal bg-emerald-500/20 text-emerald-700 px-2 py-1 rounded-full">{filteredLiveTickets.length} tickets</span>
                            </CardTitle>
                            <CardDescription>Tickets deployed to production — filter by team or member</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <Select value={teamFilter} onValueChange={v=>{setTeamFilter(v);setLiveTeamFilter('all');}}>
                                    <SelectTrigger className={cn('w-40 h-8 text-xs',teamFilter!=='all'&&'border-emerald-500 bg-emerald-500/5 font-medium')}><SelectValue placeholder="All Teams"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Teams</SelectItem>{(kpi?.allTeams||[]).map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={liveTeamFilter} onValueChange={setLiveTeamFilter}>
                                    <SelectTrigger className={cn('w-48 h-8 text-xs',liveTeamFilter!=='all'&&'border-emerald-500 bg-emerald-500/5 font-medium')}><SelectValue placeholder="All Members"/></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Members</SelectItem>{memberDropdownPeople.map(p=><SelectItem key={p.userId} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                {(teamFilter!=='all'||liveTeamFilter!=='all')&&<Button variant="ghost" size="sm" onClick={()=>{setTeamFilter('all');setLiveTeamFilter('all');}} className="h-8 text-xs text-destructive">Clear</Button>}
                            </div>
                            {(teamFilter!=='all'||liveTeamFilter!=='all')&&(
                                <div className="flex items-center gap-2 flex-wrap p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                                    <span className="text-xs text-muted-foreground font-medium">Active:</span>
                                    {teamFilter!=='all'&&<span className="text-xs bg-emerald-500/20 text-emerald-700 px-2 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">{teamFilter}<button onClick={()=>setTeamFilter('all')} className="ml-1 hover:text-destructive font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>}
                                    {liveTeamFilter!=='all'&&<span className="text-xs bg-emerald-500/20 text-emerald-700 px-2 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">{liveTeamFilter}<button onClick={()=>setLiveTeamFilter('all')} className="ml-1 hover:text-destructive font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>}
                                    <span className="text-xs text-muted-foreground ml-auto">{filteredLiveTickets.length} ticket{filteredLiveTickets.length!==1?'s':''} shown</span>
                                </div>
                            )}
                            {liveTeamFilter==='all'&&kpi&&kpi.liveTickets.length>0&&(
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {(()=>{
                                        const byMember=new Map<string,number>();
                                        kpi.liveTickets.forEach(t=>{const name=t.assignee?.displayName||t.reporter?.displayName||'Unassigned';byMember.set(name,(byMember.get(name)||0)+1);});
                                        return Array.from(byMember.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>(
                                            <button key={name} onClick={()=>setLiveTeamFilter(name)} className="text-left p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                                                <div className="text-xl font-bold text-emerald-600">{count}</div>
                                                <div className="text-xs font-medium truncate">{name}</div>
                                                <div className="text-[10px] text-muted-foreground">live tickets</div>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            )}
                            {!kpi?.liveTickets.length?(
                                <div className="text-center py-12 text-muted-foreground"><Globe className="w-12 h-12 mx-auto mb-3 opacity-20"/>No live build tickets found.</div>
                            ):(
                                <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                                    {filteredLiveTickets.map(issue=>(
                                        <div key={issue.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                                            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0">{issue.key}</a>
                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{issue.issueType}</span>
                                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border shrink-0',PRIORITY_STYLE[issue.priority]||PRIORITY_STYLE.Medium)}>{issue.priority}</span>
                                            <span className="text-sm flex-1 truncate">{issue.summary}</span>
                                            {issue.liveVersion&&<span className="text-xs bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">v{issue.liveVersion}</span>}
                                            {issue.storyPoints&&<span className="text-[10px] bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded shrink-0">{issue.storyPoints}sp</span>}
                                            <span className="text-xs text-muted-foreground shrink-0">{issue.assignee?.displayName||issue.reporter?.displayName||'—'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 5: STORY POINTS */}
                <TabsContent value="storypoints" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-purple-500"/>Story Points</CardTitle>
                                    <CardDescription className="mt-1">Sprint-wise, Team-wise, and Individual breakdown</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {(['individual','team','sprint'] as const).map(v=>(
                                        <button key={v} onClick={()=>setSpView(v)}
                                            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                                spView===v?'bg-primary text-primary-foreground border-primary':'bg-muted/40 border-border hover:bg-muted')}>
                                            {v==='individual'?'Individual':v==='team'?'By Team':'By Sprint'}
                                        </button>
                                    ))}
                                    {(spView==='sprint'||spView==='individual')&&(
                                        <Select value={spSprintFilter} onValueChange={v=>{setSpSprintFilter(v);setSpMonthFilter('all');setSpDateFrom('');setSpDateTo('');}}>
                                            <SelectTrigger className={cn('w-52 h-8 text-xs',spSprintFilter!=='all'&&'border-primary bg-primary/5 font-medium')}>
                                                <SelectValue placeholder="All Sprints"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sprints</SelectItem>
                                                {(kpi?.sprints||[]).map(s=>(
                                                    <SelectItem key={s.id} value={String(s.id)}>
                                                        {s.name}{s.state==='active'?' (Active)':s.state==='future'?' (Future)':''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Select value={spTeamFilter} onValueChange={setSpTeamFilter}>
                                        <SelectTrigger className={cn('w-44 h-8 text-xs',spTeamFilter!=='all'&&'border-primary bg-primary/5 font-medium')}>
                                            <SelectValue placeholder="All Teams"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Teams</SelectItem>
                                            {(kpi?.allTeams||[]).map(t=>(
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Date filter — month dropdown OR custom date range */}
                                    {spSprintFilter==='all'&&(
                                        <>
                                            <Select value={spMonthFilter} onValueChange={v=>{setSpMonthFilter(v);setSpDateFrom('');setSpDateTo('');}}>
                                                <SelectTrigger className={cn('w-40 h-8 text-xs',spMonthFilter!=='all'&&'border-primary bg-primary/5 font-medium')}>
                                                    <SelectValue placeholder="All Time"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Time</SelectItem>
                                                    {(kpi?.monthly||[]).slice().reverse().map(m=>(
                                                        <SelectItem key={m.month} value={m.month}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {/* Custom date range */}
                                            <div className="flex items-center gap-1">
                                                <input type="date" value={spDateFrom}
                                                    onChange={e=>{setSpDateFrom(e.target.value);setSpMonthFilter('all');}}
                                                    className={cn('h-8 text-xs px-2 rounded-md border bg-background',spDateFrom&&'border-primary bg-primary/5')}
                                                    title="From date"/>
                                                <span className="text-xs text-muted-foreground">&mdash;</span>
                                                <input type="date" value={spDateTo}
                                                    onChange={e=>{setSpDateTo(e.target.value);setSpMonthFilter('all');}}
                                                    className={cn('h-8 text-xs px-2 rounded-md border bg-background',spDateTo&&'border-primary bg-primary/5')}
                                                    title="To date"/>
                                            </div>
                                        </>
                                    )}
                                    {/* When sprint is selected, show its date range info */}
                                    {spSprintFilter!=='all'&&(()=>{
                                        const sp=kpi?.sprints.find(s=>String(s.id)===spSprintFilter);
                                        if(!sp?.startDate||!sp?.endDate) return null;
                                        return <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{sp.startDate.slice(0,10)} &mdash; {sp.endDate.slice(0,10)}</span>;
                                    })()}
                                    {(spSprintFilter!=='all'||spTeamFilter!=='all'||spMonthFilter!=='all'||spDateFrom||spDateTo)&&(
                                        <button onClick={()=>{setSpSprintFilter('all');setSpTeamFilter('all');setSpMonthFilter('all');setSpDateFrom('');setSpDateTo('');}}
                                            className="text-xs text-destructive hover:underline">Clear</button>
                                    )}
                                </div>
                            </div>
                            {(spSprintFilter!=='all'||spTeamFilter!=='all'||spMonthFilter!=='all'||spDateFrom||spDateTo)&&(
                                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                    {spSprintFilter!=='all'&&(()=>{
                                        const sp=kpi?.sprints.find(s=>String(s.id)===spSprintFilter);
                                        return <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Sprint: {sp?.name||spSprintFilter}{sp?.startDate?` (${sp.startDate.slice(0,10)} — ${sp.endDate?.slice(0,10)||'?'})`:''}</span>;
                                    })()}
                                    {spTeamFilter!=='all'&&<span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Team: {spTeamFilter}</span>}
                                    {spMonthFilter!=='all'&&<span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Month: {kpi?.monthly.find(m=>m.month===spMonthFilter)?.label||spMonthFilter}</span>}
                                    {(spDateFrom||spDateTo)&&<span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Date: {spDateFrom||'any'} &mdash; {spDateTo||'any'}</span>}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            {(()=>{
                                const fmt=(v:number)=>v%1===0?String(v):v.toFixed(1);
                                // Build team membership lookup from Jira Teams API (most accurate)
                                const teamMemberMap = new Map<string, Set<string>>();
                                (kpi?.jiraTeams||[]).forEach(jt=>{
                                    const ids = new Set(jt.members.map(m=>m.accountId));
                                    teamMemberMap.set(jt.name, ids);
                                });
                                // Fallback: use people array teams
                                if(teamMemberMap.size===0){
                                    (kpi?.allTeams||[]).forEach(team=>{
                                        const ids=new Set((kpi?.people||[]).filter(p=>p.teams.includes(team)).map(p=>p.userId));
                                        teamMemberMap.set(team, ids);
                                    });
                                }

                                const baseIssues = (kpi?.all||[]).filter(i=>{
                                    // Exclude sub-tasks — they duplicate parent story SP
                                    if(i.isSubTask) return false;
                                    // Sprint filter: exact sprint ID match
                                    if(spSprintFilter!=='all' && String(i.sprint?.id)!==spSprintFilter) return false;
                                    // Team filter: use issue's team field ONLY — exact match with Jira
                                    // Tickets with no team field are excluded when team filter is active
                                    if(spTeamFilter!=='all'){
                                        if(!i.team || i.team !== spTeamFilter) return false;
                                    }
                                    // Date filter — only applied when NO sprint is selected
                                    if(spSprintFilter==='all'){
                                        if(spMonthFilter!=='all'){
                                            if(!i.updated.startsWith(spMonthFilter)) return false;
                                        } else if(spDateFrom||spDateTo){
                                            const d=i.updated.slice(0,10);
                                            if(spDateFrom && d<spDateFrom) return false;
                                            if(spDateTo && d>spDateTo) return false;
                                        }
                                    }
                                    return (i.storyPoints||0) > 0;
                                });
                                const issues = Array.from(new Map(baseIssues.map(i=>[i.id,i])).values());
                                const totalSP = Math.round(issues.reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                const doneSP = Math.round(issues.filter(i=>classifyStatus(i.status)==='closed').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                const inProgSP = Math.round(issues.filter(i=>classifyStatus(i.status)==='in_progress').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                const todoSP = Math.round(issues.filter(i=>classifyStatus(i.status)==='open').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                const donePct = totalSP>0?Math.min(100,Math.round((doneSP/totalSP)*100)):0;
                                return (
                                    <div>
                                        {/* SP Overview by Issue Type */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b bg-muted/20">
                                            {[
                                                {label:'Tasks SP',total:(kpi?.spByType?.tasks||0),type:'Task',color:'text-blue-600',bg:'bg-blue-500/10',border:'border-blue-500/30'},
                                                {label:'Bugs SP',total:(kpi?.spByType?.bugs||0),type:'Bug',color:'text-red-600',bg:'bg-red-500/10',border:'border-red-500/30'},
                                                {label:'Stories SP',total:(kpi?.spByType?.stories||0),type:'Story',color:'text-violet-600',bg:'bg-violet-500/10',border:'border-violet-500/30'},
                                                {label:'Epics SP',total:(kpi?.spByType?.epics||0),type:'Epic',color:'text-amber-600',bg:'bg-amber-500/10',border:'border-amber-500/30'},
                                            ].map(s=>{
                                                const typeIssues=issues.filter(i=>i.issueType===s.type);
                                                const done=Math.round(typeIssues.filter(i=>classifyStatus(i.status)==='closed').reduce((t,i)=>t+(i.storyPoints||0),0)*10)/10;
                                                const inProg=Math.round(typeIssues.filter(i=>classifyStatus(i.status)==='in_progress').reduce((t,i)=>t+(i.storyPoints||0),0)*10)/10;
                                                const todo=Math.round(typeIssues.filter(i=>classifyStatus(i.status)==='open').reduce((t,i)=>t+(i.storyPoints||0),0)*10)/10;
                                                const total=Math.round(s.total*10)/10;
                                                const pct=total>0?Math.min(100,Math.round((done/total)*100)):0;
                                                if(total===0) return null;
                                                return (
                                                    <div key={s.label} className={cn('rounded-xl p-4 border cursor-pointer hover:shadow-md transition-all',s.bg,s.border)}
                                                        onClick={()=>setSpView('individual')}>
                                                        <div className={cn('text-2xl font-black',s.color)}>{fmt(total)}</div>
                                                        <div className="text-xs font-semibold text-muted-foreground mt-1">{s.label}</div>
                                                        <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                                                            <div className="flex justify-between"><span>Done</span><span className="text-green-600 font-bold">{fmt(done)}</span></div>
                                                            <div className="flex justify-between"><span>In Progress</span><span className="text-amber-600 font-bold">{fmt(inProg)}</span></div>
                                                            <div className="flex justify-between"><span>To-Do</span><span className="text-red-600 font-bold">{fmt(todo)}</span></div>
                                                        </div>
                                                        <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
                                                            <div className={cn('h-full rounded-full',pct>=70?'bg-green-500':pct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${pct}%`}}/>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-1">{pct}% done &middot; {typeIssues.length} tickets</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Summary totals bar */}
                                        <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 border-b flex-wrap">
                                            {[
                                                {label:'Total SP',v:totalSP,c:'text-sky-600',bg:'bg-sky-500/10'},
                                                {label:'To-Do',v:todoSP,c:'text-red-600',bg:'bg-red-500/10'},
                                                {label:'In Progress',v:inProgSP,c:'text-amber-600',bg:'bg-amber-500/10'},
                                                {label:'Done',v:doneSP,c:'text-green-600',bg:'bg-green-500/10'},
                                            ].map(s=>(
                                                <div key={s.label} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg',s.bg)}>
                                                    <span className={cn('text-lg font-black',s.c)}>{fmt(s.v)}</span>
                                                    <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                                                </div>
                                            ))}
                                            <div className="ml-auto flex items-center gap-2">
                                                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full',donePct>=70?'bg-green-500':donePct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${donePct}%`}}/>
                                                </div>
                                                <span className="text-xs font-bold">{donePct}% done</span>
                                            </div>
                                        </div>
                                        {spView==='sprint'&&(
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b bg-muted/30">
                                                        <th className="text-left px-4 py-2.5 text-xs font-semibold">Sprint</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-sky-600">Total SP</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-500">To-Do</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">In Progress</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600">Done</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Done %</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {(kpi?.sprints||[]).map(sprint=>{
                                                            const si=issues.filter(i=>String(i.sprint?.id)===String(sprint.id));
                                                            if(si.length===0) return null;
                                                            const t=Math.round(si.reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const d=Math.round(si.filter(i=>classifyStatus(i.status)==='closed').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const ip=Math.round(si.filter(i=>classifyStatus(i.status)==='in_progress').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const td=Math.round(si.filter(i=>classifyStatus(i.status)==='open').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const pct=t>0?Math.min(100,Math.round((d/t)*100)):0;
                                                            return(
                                                                <tr key={sprint.id} className="border-b hover:bg-muted/20 transition-colors">
                                                                    <td className="px-4 py-2.5 font-semibold">{sprint.name}</td>
                                                                    <td className="px-3 py-2.5 text-center">
                                                                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold',sprint.state==='active'?'bg-green-500/20 text-green-700':sprint.state==='future'?'bg-blue-500/20 text-blue-700':'bg-muted text-muted-foreground')}>
                                                                            {sprint.state==='active'?'Active':sprint.state==='future'?'Future':'Closed'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center font-bold text-sky-600">{fmt(t)}</td>
                                                                    <td className="px-3 py-2.5 text-center text-red-500">{fmt(td)}</td>
                                                                    <td className="px-3 py-2.5 text-center text-amber-600">{fmt(ip)}</td>
                                                                    <td className="px-3 py-2.5 text-center font-bold text-green-600">{fmt(d)}</td>
                                                                    <td className="px-3 py-2.5 text-center"><div className="flex items-center gap-2 justify-center"><div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',pct>=70?'bg-green-500':pct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${pct}%`}}/></div><span className="text-xs font-bold">{pct}%</span></div></td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        {spView==='team'&&(
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b bg-muted/30">
                                                        <th className="text-left px-4 py-2.5 text-xs font-semibold">Team</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Members</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-sky-600">Total SP</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-500">To-Do</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">In Progress</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600">Done</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Done %</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {(()=>{
                                                            // Group issues by their team field (most accurate for By Team view)
                                                            const teamGroups = new Map<string, typeof issues>();
                                                            issues.forEach(i=>{
                                                                if(!i.team) return; // skip tickets with no team field
                                                                const t = i.team;
                                                                if(!teamGroups.has(t)) teamGroups.set(t, []);
                                                                teamGroups.get(t)!.push(i);
                                                            });
                                                            return Array.from(teamGroups.entries())
                                                                .filter(([team])=>spTeamFilter==='all'||team===spTeamFilter)
                                                                .sort((a,b)=>b[1].reduce((s,i)=>s+(i.storyPoints||0),0)-a[1].reduce((s,i)=>s+(i.storyPoints||0),0))
                                                                .map(([team, ti])=>{
                                                            const unique=Array.from(new Map(ti.map(i=>[i.id,i])).values());
                                                            if(unique.length===0) return null;
                                                            const t=Math.round(unique.reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const d=Math.round(unique.filter(i=>classifyStatus(i.status)==='closed').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const ip=Math.round(unique.filter(i=>classifyStatus(i.status)==='in_progress').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const td=Math.round(unique.filter(i=>classifyStatus(i.status)==='open').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                            const pct=t>0?Math.min(100,Math.round((d/t)*100)):0;
                                                            const mc=new Set(unique.map(i=>i.assignee?.accountId).filter(Boolean)).size;
                                                            return(
                                                                <tr key={team} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={()=>setSpTeamFilter(team)}>
                                                                    <td className="px-4 py-2.5 font-semibold">{team}</td>
                                                                    <td className="px-3 py-2.5 text-center text-muted-foreground">{mc}</td>
                                                                    <td className="px-3 py-2.5 text-center font-bold text-sky-600">{fmt(t)}</td>
                                                                    <td className="px-3 py-2.5 text-center text-red-500">{fmt(td)}</td>
                                                                    <td className="px-3 py-2.5 text-center text-amber-600">{fmt(ip)}</td>
                                                                    <td className="px-3 py-2.5 text-center font-bold text-green-600">{fmt(d)}</td>
                                                                    <td className="px-3 py-2.5 text-center"><div className="flex items-center gap-2 justify-center"><div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',pct>=70?'bg-green-500':pct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${pct}%`}}/></div><span className="text-xs font-bold">{pct}%</span></div></td>
                                                                </tr>
                                                            );
                                                        });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                        {spView==='individual'&&(
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead><tr className="border-b bg-muted/30">
                                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">#</th>
                                                        <th className="text-left px-4 py-2.5 text-xs font-semibold">Member</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-sky-600">Total SP</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-500">To-Do</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">In Progress</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-600">Done</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600">Tickets</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">By Type</th>
                                                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Done %</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {(()=>{
                                                            const byPerson=new Map<string,{name:string;team:string;issues:typeof issues}>();
                                                            issues.forEach(i=>{
                                                                if(!i.assignee) return;
                                                                const id=i.assignee.accountId;
                                                                if(!byPerson.has(id)) byPerson.set(id,{name:i.assignee.displayName,team:'',issues:[]});
                                                                byPerson.get(id)!.issues.push(i);
                                                            });
                                                            // Set team from Jira Teams API membership (most accurate)
                                                            byPerson.forEach((v, id)=>{
                                                                for(const [teamName, ids] of teamMemberMap.entries()){
                                                                    if(ids.has(id)){ v.team=teamName; break; }
                                                                }
                                                                // Fallback to people array
                                                                if(!v.team){
                                                                    const p=(kpi?.people||[]).find(p=>p.userId===id);
                                                                    if(p) v.team=p.teams[0]||'';
                                                                }
                                                            });
                                                            // Don't override team from people array — use issue's team field for accuracy
                                                            return Array.from(byPerson.entries())
                                                                .map(([id,{name,team,issues:pi}])=>{
                                                                    const t=Math.round(pi.reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                                    const d=Math.round(pi.filter(i=>classifyStatus(i.status)==='closed').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                                    const ip=Math.round(pi.filter(i=>classifyStatus(i.status)==='in_progress').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                                    const td=Math.round(pi.filter(i=>classifyStatus(i.status)==='open').reduce((s,i)=>s+(i.storyPoints||0),0)*10)/10;
                                                                    return {id,name,team,t,d,ip,td,count:pi.length};
                                                                })
                                                                .filter(r=>r.t>0)
                                                                .sort((a,b)=>b.t-a.t)
                                                                .map((r,idx)=>{
                                                                    const pct=r.t>0?Math.min(100,Math.round((r.d/r.t)*100)):0;
                                                                    const person=(kpi?.people||[]).find(p=>p.userId===r.id);
                                                                    return(
                                                                        <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={()=>person&&setSelectedPerson(person)}>
                                                                            <td className="px-4 py-2.5 text-xs text-muted-foreground">#{idx+1}</td>
                                                                            <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className={cn('w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0',getAvatarStyle(r.name).bg)}>{r.name.charAt(0)}</div><div><div className="font-semibold text-sm">{r.name}</div>{r.team&&<div className="text-[10px] text-muted-foreground">{r.team}</div>}</div></div></td>
                                                                            <td className="px-3 py-2.5 text-center font-bold text-sky-600 text-base">{fmt(r.t)}</td>
                                                                            <td className="px-3 py-2.5 text-center text-red-500">{fmt(r.td)}</td>
                                                                            <td className="px-3 py-2.5 text-center font-semibold text-amber-600">{fmt(r.ip)}</td>
                                                                            <td className="px-3 py-2.5 text-center font-bold text-green-600">{fmt(r.d)}</td>
                                                                            <td className="px-3 py-2.5 text-center text-blue-600">{r.count}</td>
                                                                            <td className="px-3 py-2.5 text-center">
                                                                                <div className="flex gap-1 justify-center flex-wrap">
                                                                                    {[
                                                                                        {t:'Task',c:'bg-blue-500/15 text-blue-700'},
                                                                                        {t:'Bug',c:'bg-red-500/15 text-red-700'},
                                                                                        {t:'Story',c:'bg-violet-500/15 text-violet-700'},
                                                                                        {t:'Epic',c:'bg-amber-500/15 text-amber-700'},
                                                                                    ].map(({t,c})=>{
                                                                                        const sp=byPerson.get(r.id)?.issues.filter(i=>i.issueType===t).reduce((s,i)=>s+(i.storyPoints||0),0)||0;
                                                                                        if(!sp) return null;
                                                                                        return <span key={t} className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold',c)}>{t}: {sp%1===0?sp:sp.toFixed(1)}</span>;
                                                                                    })}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2.5 text-center"><div className="flex items-center gap-2 justify-center"><div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className={cn('h-full rounded-full',pct>=70?'bg-green-500':pct>=40?'bg-amber-500':'bg-red-500')} style={{width:`${pct}%`}}/></div><span className="text-xs font-bold">{pct}%</span></div></td>
                                                                        </tr>
                                                                    );
                                                                });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>

            {/* TAB 6: WORK LOGS */}
                <TabsContent value="worklogs" className="mt-4">
                    <WorkLogsTab teamFilter={teamFilter} memberFilter={memberFilter} kpiPeople={kpi?.people||[]} onSelectPerson={setSelectedPerson} allIssues={kpi?.all||[]}/>
                </TabsContent>

                {/* TAB 7: TEAMS */}
                <TabsContent value="teams" className="mt-4">
                    <TeamsTab allPeople={kpi?.people||[]} allIssues={kpi?.all||[]} jiraTeams={kpi?.jiraTeams||[]} allTeams={kpi?.allTeams||[]} onSelectPerson={setSelectedPerson}/>
                </TabsContent>
            </Tabs>
            </div>
        </div>
    );
}
