"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { TestSession, TestCase } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, XCircle, MinusCircle, ChevronLeft, ChevronRight,
  Menu, X, ListChecks, Target, Loader2, Search,
  Rocket, Bug, CheckCheck, Zap, ArrowRight, ExternalLink
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const naReasonOptions = ["Feature not available in this region","Environment configuration issue","Feature temporarily disabled","Device specific incompatibility","Blocked by critical bug","UI element not interactable","Other"];
const incompleteReasonOptions = ["Session paused","Blocked by bug","Time constraints","Environment unavailable","Other"];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; dot: string }> = {
    'Pass':         { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
    'Fail':         { cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dot: 'bg-red-500' },
    'Fail (Known)': { cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dot: 'bg-orange-500' },
    'N/A':          { cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
    'Untested':     { cls: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary' },
  };
  const c = cfg[status] ?? cfg['Untested'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border', c.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />{status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const cfg: Record<string, string> = {
    'High': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    'Medium': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'Low': 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  };
  return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg[priority] ?? cfg['Low'])}>{priority}</span>;
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold', color)}>
      <span className="text-base font-extrabold">{value}</span>
      <span className="opacity-70 font-medium">{label}</span>
    </div>
  );
}

export default function TestSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<TestSession | null>(null);
  const [sessionCollection, setSessionCollection] = useState<'sessions' | 'testSessions'>('sessions');
  const [isLoading, setIsLoading] = useState(true);
  const [showEntrance, setShowEntrance] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [failOpen, setFailOpen] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [bugId, setBugId] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [naReason, setNaReason] = useState('');
  const [isKnown, setIsKnown] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [verdict, setVerdict] = useState<'Pass' | 'Fail' | 'N/A' | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  // Jira
  const [jiraPushing, setJiraPushing] = useState(false);
  const [jiraIssueKey, setJiraIssueKey] = useState<string | null>(null);
  const [jiraIssueLink, setJiraIssueLink] = useState<string | null>(null);

  const pushToJira = async () => {
    if (!tc || !session) return;
    setJiraPushing(true);
    try {
      const res = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseName: tc.testCaseTitle,
          testerName: session.userName,
          steps: tc.testSteps,
          expected: tc.expectedResult,
          actual: bugDesc || tc.actualResult || 'Not recorded',
          platform: session.platformDetails.platformName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Jira error');
      setJiraIssueKey(data.issueKey);
      setJiraIssueLink(data.issueLink);
      setBugId(data.issueKey);
      toast({ title: `Jira issue created: ${data.issueKey}`, description: 'Bug logged successfully.' });
    } catch (e: any) {
      toast({ title: 'Jira Error', description: e.message, variant: 'destructive' });
    } finally { setJiraPushing(false); }
  };

  useEffect(() => { const t = setTimeout(() => setShowEntrance(false), 2200); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      setIsLoading(true);
      try {
        let ref = doc(db, 'sessions', sessionId);
        let snap = await getDoc(ref);
        if (!snap.exists()) { ref = doc(db, 'testSessions', sessionId); snap = await getDoc(ref); }
        if (!snap.exists() || snap.data()?.userId !== user.uid) { router.replace('/dashboard'); return; }
        setSessionCollection(ref.path.startsWith('sessions/') ? 'sessions' : 'testSessions');
        const data = snap.data();
        const parsed: TestSession = {
          id: snap.id, ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          testCases: (data.testCases || []).map((tc: any) => ({ ...tc, lastModified: (tc.lastModified as Timestamp)?.toDate?.() ?? new Date() })),
        } as TestSession;
        if (parsed.status === 'Completed') { router.replace(`/dashboard/session/${sessionId}/results`); return; }
        setSession(parsed);
        const first = parsed.testCases.findIndex(tc => tc.status === 'Untested');
        setCurrentIndex(first !== -1 ? first : 0);
      } catch { toast({ title: 'Error', description: 'Failed to load session.', variant: 'destructive' }); }
      finally { setIsLoading(false); }
    })();
  }, [sessionId, user, router, toast]);

  useEffect(() => {
    setVerdict(null);
    setJiraIssueKey(null);
    setJiraIssueLink(null);
    if (centerRef.current) centerRef.current.scrollTop = 0;
  }, [currentIndex]);

  const handleUpdate = useCallback(async (data: Partial<TestSession>) => {
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), JSON.parse(JSON.stringify(data)));
      setSession(prev => prev ? { ...prev, ...data, updatedAt: new Date() } as TestSession : null);
    } catch { toast({ title: 'Sync Error', description: 'Cloud save failed.', variant: 'destructive' }); }
  }, [sessionId, sessionCollection, toast]);

  const handleComplete = async (reason?: string) => {
    if (!session) return;
    await handleUpdate({ status: untestedCount > 0 ? 'Aborted' : 'Completed', updatedAt: new Date(), completedAt: new Date(), reasonForIncompletion: reason });
    router.replace(`/dashboard/session/${sessionId}/results`);
  };

  const markStatus = async (base: 'Pass' | 'Fail' | 'N/A', details?: any) => {
    if (!session || !tc) return;
    const status = base === 'Fail' && details?.isKnown ? 'Fail (Known)' : base;
    setVerdict(base);
    const updated = [...session.testCases];
    updated[currentIndex] = { ...tc, status, lastModified: new Date(), bugId: details?.bugId || null, naReason: details?.naReason || null, notes: details?.bugDesc ? (tc.notes || '') + `\nBug: ${details.bugDesc}` : tc.notes, actualResult: status === 'Pass' ? tc.expectedResult : (tc.actualResult || '') };
    const summary = { pass: updated.filter(t => t.status === 'Pass').length, fail: updated.filter(t => t.status === 'Fail').length, failKnown: updated.filter(t => t.status === 'Fail (Known)').length, na: updated.filter(t => t.status === 'N/A').length, untested: updated.filter(t => t.status === 'Untested').length, total: updated.length };
    await handleUpdate({ testCases: updated, summary, updatedAt: new Date() });
    setTimeout(() => { if (currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1); else setCompleteOpen(true); }, 400);
    setFailOpen(false); setNaOpen(false); setBugId(''); setBugDesc(''); setIsKnown(false); setNaReason('');
  };

  const patchField = (field: keyof TestCase, value: string) => {
    if (!session || !tc) return;
    const updated = [...session.testCases];
    updated[currentIndex] = { ...tc, [field]: value };
    setSession({ ...session, testCases: updated });
  };

  const saveField = () => session && handleUpdate({ testCases: session.testCases });

  if (isLoading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    </div>
  );
  if (!session) return null;

  const tc = session.testCases[currentIndex];
  const untestedCount = session.testCases.filter(t => t.status === 'Untested').length;
  const passCount = session.testCases.filter(t => t.status === 'Pass').length;
  const failCount = session.testCases.filter(t => t.status.includes('Fail')).length;
  const naCount = session.testCases.filter(t => t.status === 'N/A').length;
  const progress = Math.round(((session.testCases.length - untestedCount) / session.testCases.length) * 100);
  const steps = (tc?.testSteps || '').split('\n').filter(Boolean);
  const filteredCases = session.testCases.filter(t => {
    const matchSearch = !searchQuery || t.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'all' || t.status === filterStatus || (filterStatus === 'fail' && t.status.includes('Fail'));
    return matchSearch && matchFilter;
  });

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">

      {/* ENTRANCE */}
      <AnimatePresence>
        {showEntrance && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18 }} className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Rocket className="w-9 h-9 text-primary" />
                </div>
                <motion.div className="absolute inset-0 rounded-3xl border-2 border-primary/30"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">{session.platformDetails.platformName}</h2>
                <p className="text-sm text-muted-foreground">{session.testCases.length} test cases loaded</p>
              </div>
              <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2, ease: 'easeInOut' }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur-md z-30 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden h-9 w-9 rounded-xl shrink-0">
          <Menu className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{session.platformDetails.platformName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{session.platformDetails.deviceModel || session.platformDetails.appVersion || 'Active Session'}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4">
          <StatChip label="Pass" value={passCount} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" />
          <StatChip label="Fail" value={failCount} color="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" />
          <StatChip label="N/A" value={naCount} color="bg-muted text-muted-foreground border-border" />
          <StatChip label="Left" value={untestedCount} color="bg-primary/10 text-primary border-primary/20" />
        </div>
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
          <span className="text-xs font-bold text-muted-foreground tabular-nums">{progress}%</span>
        </div>
        <Button size="sm" onClick={() => setCompleteOpen(true)}
          className={cn('ml-auto sm:ml-3 rounded-xl px-4 text-xs font-bold h-8 shrink-0',
            untestedCount === 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20')}>
          {untestedCount === 0 ? <><CheckCheck className="w-3.5 h-3.5 mr-1.5" />Finish</> : <><X className="w-3.5 h-3.5 mr-1.5" />Abort</>}
        </Button>
      </header>

      {/* BODY */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" />
          )}
        </AnimatePresence>

        {/* LEFT SIDEBAR */}
        <aside className={cn(
          'shrink-0 w-72 border-r border-border bg-card flex flex-col z-50',
          'fixed lg:relative inset-y-0 left-0 top-14 bottom-0',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">Test Cases</p>
              <p className="text-xs text-muted-foreground">{session.testCases.length} total · {untestedCount} remaining</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-8 w-8 lg:hidden">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="shrink-0 px-3 py-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search cases..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>
          <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-border/50 overflow-x-auto">
            {[{ key: 'all', label: 'All' }, { key: 'Untested', label: 'Todo' }, { key: 'Pass', label: 'Pass' }, { key: 'fail', label: 'Fail' }, { key: 'N/A', label: 'N/A' }].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)}
                className={cn('shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors', filterStatus === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {filteredCases.map((t) => {
              const realIdx = session.testCases.findIndex(x => x.id === t.id);
              const isActive = realIdx === currentIndex;
              const dotCls = t.status === 'Pass' ? 'bg-emerald-500' : t.status.includes('Fail') ? 'bg-red-500' : t.status === 'N/A' ? 'bg-muted-foreground' : 'bg-border';
              return (
                <button key={t.id} onClick={() => { setCurrentIndex(realIdx); setSidebarOpen(false); }}
                  className={cn('w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group', isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted border border-transparent')}>
                  <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dotCls)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs leading-snug line-clamp-2', isActive ? 'text-foreground font-semibold' : 'text-muted-foreground group-hover:text-foreground')}>{t.testCaseTitle}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-muted-foreground/50 font-mono">#{realIdx + 1}</span>
                      {t.priority && <span className={cn('text-[9px] font-bold', t.priority === 'High' ? 'text-red-500' : t.priority === 'Medium' ? 'text-amber-500' : 'text-muted-foreground')}>{t.priority}</span>}
                    </div>
                  </div>
                  {isActive && <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-1" />}
                </button>
              );
            })}
            {filteredCases.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No cases match filter</p>}
          </div>
        </aside>

        {/* CENTER */}
        <div ref={centerRef} className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tc?.id || currentIndex}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }} className="flex-1 flex flex-col">

              {/* Title bar */}
              <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">TC-{String(currentIndex + 1).padStart(3, '0')}</span>
                      <PriorityBadge priority={tc?.priority} />
                      <StatusBadge status={tc?.status || 'Untested'} />
                    </div>
                    <h2 className="text-base md:text-lg font-bold text-foreground leading-snug">{tc?.testCaseTitle}</h2>
                    {tc?.testBed && <p className="text-xs text-muted-foreground mt-1">Module: <span className="text-foreground/70">{tc.testBed}</span></p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} className="h-8 w-8 rounded-lg disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums px-1">{currentIndex + 1}/{session.testCases.length}</span>
                    <Button variant="ghost" size="icon" disabled={currentIndex === session.testCases.length - 1} onClick={() => setCurrentIndex(i => Math.min(session.testCases.length - 1, i + 1))} className="h-8 w-8 rounded-lg disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Steps</h3>
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono">{steps.length}</span>
                </div>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}
                      className="flex gap-3 items-start p-3 rounded-xl bg-muted/40 border border-border/50 hover:border-border transition-colors">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</div>
                      <p className="text-sm text-foreground/80 leading-relaxed flex-1">{step.replace(/^\d+[\.\)]\s*/, '')}</p>
                    </motion.div>
                  ))}
                  {steps.length === 0 && <p className="text-sm text-muted-foreground italic px-1">No steps defined.</p>}
                </div>
              </div>

              {/* Expected Result */}
              <div className="px-5 pt-2 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Expected Result</h3>
                </div>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{tc?.expectedResult || 'No expected result defined.'}</p>
                </div>
              </div>

              {/* Observations */}
              <div className="px-5 pt-2 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bug className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observations / Actual Result</h3>
                </div>
                <Textarea placeholder="Log what actually happened, any deviations, or notes..."
                  value={tc?.actualResult || ''} onChange={e => patchField('actualResult', e.target.value)} onBlur={saveField}
                  className="resize-none h-24 text-sm bg-muted/40 border-border focus:border-primary/50 focus:ring-0 rounded-xl" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT PANEL */}
        <div className="hidden lg:flex shrink-0 w-64 xl:w-72 border-l border-border bg-card flex-col">
          <div className="shrink-0 px-4 py-3.5 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verdict</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Mark the outcome for this test case</p>
          </div>
          <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
            {/* PASS */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => markStatus('Pass')}
              className={cn('relative flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden',
                verdict === 'Pass' ? 'border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/10' : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/12 hover:border-emerald-500/40')}>
              <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors', verdict === 'Pass' ? 'bg-emerald-500/25' : 'bg-emerald-500/10')}>
                <CheckCircle2 className={cn('w-6 h-6', verdict === 'Pass' ? 'text-emerald-500' : 'text-emerald-600 dark:text-emerald-400')} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Pass</p>
                <p className="text-[10px] text-muted-foreground">Test case passed</p>
              </div>
              <kbd className="text-[9px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">P</kbd>
            </motion.button>

            {/* FAIL */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setFailOpen(true)}
              className={cn('relative flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden',
                verdict === 'Fail' ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/10' : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/12 hover:border-red-500/40')}>
              <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors', verdict === 'Fail' ? 'bg-red-500/25' : 'bg-red-500/10')}>
                <XCircle className={cn('w-6 h-6', verdict === 'Fail' ? 'text-red-500' : 'text-red-600 dark:text-red-400')} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">Fail</p>
                <p className="text-[10px] text-muted-foreground">Log defect details</p>
              </div>
              <kbd className="text-[9px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">F</kbd>
            </motion.button>

            {/* N/A */}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setNaOpen(true)}
              className={cn('relative flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 transition-all duration-200',
                verdict === 'N/A' ? 'border-muted-foreground/50 bg-muted/60' : 'border-border hover:bg-muted hover:border-muted-foreground/30')}>
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <MinusCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-muted-foreground">N/A</p>
                <p className="text-[10px] text-muted-foreground">Not applicable</p>
              </div>
              <kbd className="text-[9px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">N</kbd>
            </motion.button>

            {/* Progress mini */}
            <div className="mt-auto pt-4 border-t border-border/50 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Session Progress</p>
              <div className="space-y-2">
                {[
                  { label: 'Passed', val: passCount, total: session.testCases.length, cls: 'bg-emerald-500' },
                  { label: 'Failed', val: failCount, total: session.testCases.length, cls: 'bg-red-500' },
                  { label: 'Remaining', val: untestedCount, total: session.testCases.length, cls: 'bg-primary' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-bold text-foreground">{s.val}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <motion.div className={cn('h-full rounded-full', s.cls)} animate={{ width: `${(s.val / s.total) * 100}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div className="lg:hidden shrink-0 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 z-20">
        <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
          <button onClick={() => markStatus('Pass')}
            className={cn('flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95', verdict === 'Pass' ? 'border-emerald-500 bg-emerald-500/15' : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/12')}>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Pass</span>
          </button>
          <button onClick={() => setFailOpen(true)}
            className={cn('flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95', verdict === 'Fail' ? 'border-red-500 bg-red-500/15' : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/12')}>
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Fail</span>
          </button>
          <button onClick={() => setNaOpen(true)}
            className="flex flex-col items-center gap-1 py-3 rounded-2xl border-2 border-border hover:bg-muted transition-all active:scale-95">
            <MinusCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">N/A</span>
          </button>
        </div>
      </div>

      {/* FAIL DIALOG */}
      <Dialog open={failOpen} onOpenChange={v => { setFailOpen(v); if (!v) { setJiraIssueKey(null); setJiraIssueLink(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bug className="w-4 h-4 text-red-500" />Report Defect</DialogTitle>
            <DialogDescription>Document the failure. Optionally push to Jira before confirming.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2">
              <Checkbox id="known" checked={isKnown} onCheckedChange={v => setIsKnown(v as boolean)} />
              <Label htmlFor="known" className="text-sm">Known Issue</Label>
            </div>
            <Textarea placeholder="Describe the defect (required)..." value={bugDesc} onChange={e => setBugDesc(e.target.value)} className="resize-none h-24" />

            {/* Jira section */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jira Integration</p>
              {jiraIssueKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ {jiraIssueKey} created</span>
                  {jiraIssueLink && (
                    <a href={jiraIssueLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline">
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input placeholder="Bug ID (auto-filled from Jira)" value={bugId} onChange={e => setBugId(e.target.value)} className="h-8 text-xs" />
                  <Button size="sm" variant="outline" disabled={!bugDesc || jiraPushing} onClick={pushToJira}
                    className="shrink-0 h-8 text-xs gap-1.5">
                    {jiraPushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                    Push to Jira
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/60">Requires Jira credentials in .env.local</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!bugDesc} onClick={() => markStatus('Fail', { bugId, bugDesc, isKnown })}>Confirm Failure</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={naOpen} onOpenChange={setNaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as N/A</DialogTitle>
            <DialogDescription>Select a reason for skipping this test case.</DialogDescription>
          </DialogHeader>
          <Select onValueChange={setNaReason}>
            <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
            <SelectContent>{naReasonOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setNaOpen(false)}>Cancel</Button>
            <Button disabled={!naReason} onClick={() => markStatus('N/A', { naReason })}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPLETE DIALOG */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{untestedCount === 0 ? 'Session Complete' : 'Abort Session?'}</DialogTitle>
            <DialogDescription>{untestedCount === 0 ? 'All test cases executed. Ready to generate the report.' : `${untestedCount} cases remain untested.`}</DialogDescription>
          </DialogHeader>
          {untestedCount > 0 && (
            <Select onValueChange={setIncompleteReason}>
              <SelectTrigger><SelectValue placeholder="Reason for aborting..." /></SelectTrigger>
              <SelectContent>{incompleteReasonOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button onClick={() => handleComplete(incompleteReason)} className="bg-emerald-500 hover:bg-emerald-600 text-white">Generate Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
