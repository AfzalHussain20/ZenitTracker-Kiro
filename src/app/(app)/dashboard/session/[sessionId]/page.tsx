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
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, XCircle, MinusCircle, ChevronLeft, ChevronRight,
  Menu, X, Loader2, Search, Rocket, Bug, ExternalLink, Timer,
  ArrowRight, CheckCheck, Zap, ListChecks, Target
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const naReasonOptions = [
  "Content not available in this region/language",
  "Subscription plan not applicable to this device",
  "Feature not yet released on this platform",
  "Device/OS version incompatibility",
  "Content geo-restricted or DRM-blocked",
  "Backend/API dependency unavailable",
  "Test environment not configured for this scenario",
  "Blocked by another critical bug",
  "Third-party integration unavailable (payment gateway, CDN, etc.)",
  "Other",
];
const incompleteReasonOptions = [
  "Session paused",
  "Blocked by bug",
  "Time constraints",
  "Environment unavailable",
  "Other",
];

// ─── Timer Hook ──────────────────────────────────────────────────────────────
function useTimer(currentIndex: number) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSeconds(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentIndex]);

  const formatted = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return formatted;
}

// ─── Jira Auto-Fetch Hook ────────────────────────────────────────────────────
function useJiraFetch(bugId: string) {
  const [bugTitle, setBugTitle] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBugTitle(null);
    if (!bugId || !/^[A-Z]+-\d+$/.test(bugId.trim())) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`/api/jira/issue/${bugId.trim()}`);
        if (res.ok) {
          const data = await res.json();
          setBugTitle(data.summary);
        }
      } catch { /* silent */ }
      finally { setFetching(false); }
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [bugId]);

  return { bugTitle, fetching };
}

// ─── Swipe Hook ──────────────────────────────────────────────────────────────
function useSwipe(onLeft: () => void, onRight: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) onRight();
      else onLeft();
    }
    touchStart.current = null;
  };

  return { onTouchStart, onTouchEnd };
}

// ─── Main Component ──────────────────────────────────────────────────────────
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialogs
  const [failOpen, setFailOpen] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Fail form
  const [bugId, setBugId] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [incompleteReason, setIncompleteReason] = useState('');
  const [naReason, setNaReason] = useState('');

  // Jira
  const [jiraPushing, setJiraPushing] = useState(false);
  const [jiraIssueKey, setJiraIssueKey] = useState<string | null>(null);
  const [jiraIssueLink, setJiraIssueLink] = useState<string | null>(null);

  // Verdict animation state
  const [verdict, setVerdict] = useState<'Pass' | 'Fail' | 'N/A' | null>(null);

  const timer = useTimer(currentIndex);
  const { bugTitle, fetching: bugFetching } = useJiraFetch(bugId);

  const goNext = useCallback(() => {
    if (session && currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1);
  }, [session, currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  const swipeHandlers = useSwipe(goNext, goPrev);

  // Push to Jira (create new issue)
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
      toast({ title: `Jira issue created: ${data.issueKey}` });
    } catch (e: any) {
      toast({ title: 'Jira Error', description: e.message, variant: 'destructive' });
    } finally { setJiraPushing(false); }
  };

  // ─── Entrance Animation ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowEntrance(false), 1800);
    return () => clearTimeout(t);
  }, []);

  // ─── Load Session ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      setIsLoading(true);
      try {
        let ref = doc(db, 'sessions', sessionId);
        let snap = await getDoc(ref);
        if (!snap.exists()) {
          ref = doc(db, 'testSessions', sessionId);
          snap = await getDoc(ref);
        }
        if (!snap.exists() || snap.data()?.userId !== user.uid) {
          router.replace('/dashboard');
          return;
        }
        setSessionCollection(ref.path.startsWith('sessions/') ? 'sessions' : 'testSessions');
        const data = snap.data();
        const parsed: TestSession = {
          id: snap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          testCases: (data.testCases || []).map((tc: any) => ({
            ...tc,
            lastModified: (tc.lastModified as Timestamp)?.toDate?.() ?? new Date(),
          })),
        } as TestSession;
        if (parsed.status === 'Completed') {
          router.replace(`/dashboard/session/${sessionId}/results`);
          return;
        }
        setSession(parsed);
        const first = parsed.testCases.findIndex(tc => tc.status === 'Untested');
        setCurrentIndex(first !== -1 ? first : 0);
      } catch {
        toast({ title: 'Error', description: 'Failed to load session.', variant: 'destructive' });
      } finally { setIsLoading(false); }
    })();
  }, [sessionId, user, router, toast]);

  // Reset state on index change
  useEffect(() => {
    setVerdict(null);
    setJiraIssueKey(null);
    setJiraIssueLink(null);
    setBugId('');
    setBugDesc('');
    setNaReason('');
  }, [currentIndex]);

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (failOpen || naOpen || completeOpen || drawerOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'p': markStatus('Pass'); break;
        case 'f': setFailOpen(true); break;
        case 'n': setNaOpen(true); break;
        case 'arrowleft': goPrev(); break;
        case 'arrowright': goNext(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [failOpen, naOpen, completeOpen, drawerOpen, currentIndex, session]);

  // ─── Firestore Sync ─────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (data: Partial<TestSession>) => {
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), JSON.parse(JSON.stringify(data)));
      setSession(prev => prev ? { ...prev, ...data, updatedAt: new Date() } as TestSession : null);
    } catch {
      toast({ title: 'Sync Error', description: 'Cloud save failed.', variant: 'destructive' });
    }
  }, [sessionId, sessionCollection, toast]);

  const handleComplete = async (reason?: string) => {
    if (!session) return;
    await handleUpdate({
      status: untestedCount > 0 ? 'Aborted' : 'Completed',
      updatedAt: new Date(),
      completedAt: new Date(),
      reasonForIncompletion: reason,
    });
    router.replace(`/dashboard/session/${sessionId}/results`);
  };

  // ─── Mark Verdict ───────────────────────────────────────────────────────────
  const markStatus = async (base: 'Pass' | 'Fail' | 'N/A', details?: any) => {
    if (!session || !tc) return;
    setVerdict(base);
    const updated = [...session.testCases];
    updated[currentIndex] = {
      ...tc,
      status: base,
      lastModified: new Date(),
      bugId: details?.bugId || null,
      bugTitle: details?.bugTitle || null,
      naReason: details?.naReason || null,
      notes: details?.bugDesc ? (tc.notes || '') + `\nBug: ${details.bugDesc}` : tc.notes,
      actualResult: base === 'Pass' ? tc.expectedResult : (tc.actualResult || ''),
    };
    const summary = {
      pass: updated.filter(t => t.status === 'Pass').length,
      fail: updated.filter(t => t.status === 'Fail' || t.status === 'Fail (Known)').length,
      failKnown: updated.filter(t => t.status === 'Fail (Known)').length,
      na: updated.filter(t => t.status === 'N/A').length,
      untested: updated.filter(t => t.status === 'Untested').length,
      total: updated.length,
    };
    await handleUpdate({ testCases: updated, summary, updatedAt: new Date() });

    // Auto-advance
    setTimeout(() => {
      if (currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1);
      else setCompleteOpen(true);
    }, 350);

    setFailOpen(false);
    setNaOpen(false);
  };

  const patchField = (field: keyof TestCase, value: string) => {
    if (!session || !tc) return;
    const updated = [...session.testCases];
    updated[currentIndex] = { ...tc, [field]: value };
    setSession({ ...session, testCases: updated });
  };

  const saveField = () => session && handleUpdate({ testCases: session.testCases });

  // ─── Loading State ──────────────────────────────────────────────────────────
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

  // ─── Derived State ──────────────────────────────────────────────────────────
  const tc = session.testCases[currentIndex];
  const untestedCount = session.testCases.filter(t => t.status === 'Untested').length;
  const passCount = session.testCases.filter(t => t.status === 'Pass').length;
  const failCount = session.testCases.filter(t => t.status.includes('Fail')).length;
  const naCount = session.testCases.filter(t => t.status === 'N/A').length;
  const progress = Math.round(((session.testCases.length - untestedCount) / session.testCases.length) * 100);
  const steps = (tc?.testSteps || '').split('\n').filter(Boolean);

  // Test bed grouping for sidebar
  const testBeds = Array.from(new Set(session.testCases.map(t => t.testBed || 'Uncategorized')));

  const filteredCases = session.testCases.filter(t => {
    const matchSearch = !searchQuery || t.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'all' || t.status === filterStatus || (filterStatus === 'fail' && t.status.includes('Fail'));
    return matchSearch && matchFilter;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">

      {/* ─── Entrance Animation ─── */}
      <AnimatePresence>
        {showEntrance && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }} className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Rocket className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">{session.platformDetails.platformName}</h2>
                <p className="text-sm text-muted-foreground">{session.testCases.length} test cases</p>
              </div>
              <div className="w-40 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }} animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header (48px) ─── */}
      <header className="shrink-0 h-12 border-b border-border bg-card/95 backdrop-blur-md z-30 flex items-center px-3 gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}
          className="h-8 w-8 rounded-lg shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-primary" />
          <span className="font-medium text-foreground">{session.platformDetails.platformName}</span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2 mx-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
            <motion.div className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">{progress}%</span>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-3 text-[11px] font-bold tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">P:{passCount}</span>
          <span className="text-red-600 dark:text-red-400">F:{failCount}</span>
          <span className="text-muted-foreground">N:{naCount}</span>
          <span className="text-primary">Left:{untestedCount}</span>
        </div>

        {/* Sidebar toggle */}
        <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}
          className="h-8 w-8 rounded-lg shrink-0 ml-1">
          <Menu className="w-4 h-4" />
        </Button>

        {/* Finish/Abort */}
        <Button size="sm" onClick={() => setCompleteOpen(true)}
          className={cn('rounded-lg px-3 text-[11px] font-bold h-7 shrink-0',
            untestedCount === 0
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20')}>
          {untestedCount === 0 ? 'Finish' : 'Abort'}
        </Button>
      </header>

      {/* ─── Main Content: Single Focused Card ─── */}
      <div className="flex-1 flex items-start justify-center overflow-y-auto py-6 px-4"
        {...swipeHandlers}>
        <AnimatePresence mode="wait">
          <motion.div key={tc?.id || currentIndex}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-[720px]">

            {/* Card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                      TC-{String(currentIndex + 1).padStart(3, '0')}
                    </span>
                    {tc?.priority && (
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                        tc.priority === 'High' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                        tc.priority === 'Medium' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      )}>{tc.priority}</span>
                    )}
                    {tc?.testBed && (
                      <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                        {tc.testBed}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Timer className="w-3 h-3" />
                    <span className="font-mono tabular-nums">{timer}</span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-5 py-5 space-y-5">
                {/* Title */}
                <h2 className="text-base md:text-lg font-bold text-foreground leading-snug">
                  {tc?.testCaseTitle}
                </h2>

                {/* Steps */}
                {steps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps</h3>
                    </div>
                    <div className="space-y-2">
                      {steps.map((step, i) => (
                        <div key={i} className="flex gap-3 items-start p-2.5 rounded-xl bg-muted/40 border border-border/50">
                          <div className="shrink-0 w-5 h-5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                            {i + 1}
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed flex-1">
                            {step.replace(/^\d+[\.\)]\s*/, '')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected Result */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Expected Result</h3>
                  </div>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {tc?.expectedResult || 'No expected result defined.'}
                    </p>
                  </div>
                </div>

                {/* Actual Result (editable) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actual Result</h3>
                  </div>
                  <Textarea
                    placeholder="Log what actually happened..."
                    value={tc?.actualResult || ''}
                    onChange={e => patchField('actualResult', e.target.value)}
                    onBlur={saveField}
                    className="resize-none h-20 text-sm bg-muted/40 border-border focus:border-primary/50 focus:ring-0 rounded-xl"
                  />
                </div>
              </div>

              {/* Card Footer: Verdict Buttons */}
              <div className="px-5 py-4 border-t border-border bg-muted/20">
                <div className="grid grid-cols-3 gap-3">
                  {/* Pass */}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => markStatus('Pass')}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                      verdict === 'Pass'
                        ? 'border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                        : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40'
                    )}>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Pass</span>
                    <kbd className="text-[9px] font-mono text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">P</kbd>
                  </motion.button>

                  {/* Fail */}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFailOpen(true)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                      verdict === 'Fail'
                        ? 'border-red-500 bg-red-500/15 shadow-md shadow-red-500/10'
                        : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40'
                    )}>
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">Fail</span>
                    <kbd className="text-[9px] font-mono text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">F</kbd>
                  </motion.button>

                  {/* N/A */}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setNaOpen(true)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                      verdict === 'N/A'
                        ? 'border-muted-foreground/50 bg-muted/60'
                        : 'border-border hover:bg-muted hover:border-muted-foreground/30'
                    )}>
                    <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">N/A</span>
                    <kbd className="text-[9px] font-mono text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">N</kbd>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Navigation arrows below card */}
            <div className="flex items-center justify-between mt-4 px-2">
              <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={goPrev}
                className="rounded-lg text-xs gap-1 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIndex + 1} / {session.testCases.length}
              </span>
              <Button variant="ghost" size="sm" disabled={currentIndex === session.testCases.length - 1} onClick={goNext}
                className="rounded-lg text-xs gap-1 disabled:opacity-30">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Sidebar Drawer (overlay) ─── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-card border-l border-border shadow-2xl flex flex-col">

              {/* Drawer Header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <p className="text-sm font-semibold">Test Cases</p>
                  <p className="text-[10px] text-muted-foreground">{session.testCases.length} total · {untestedCount} remaining</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Search */}
              <div className="shrink-0 px-3 py-2 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search cases..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>

              {/* Filters */}
              <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-border/50 overflow-x-auto">
                {[{ key: 'all', label: 'All' }, { key: 'Untested', label: 'Todo' }, { key: 'Pass', label: 'Pass' }, { key: 'fail', label: 'Fail' }, { key: 'N/A', label: 'N/A' }].map(f => (
                  <button key={f.key} onClick={() => setFilterStatus(f.key)}
                    className={cn('shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors',
                      filterStatus === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Grouped list by testBed */}
              <div className="flex-1 overflow-y-auto py-2 px-2">
                {testBeds.map(bed => {
                  const casesInBed = filteredCases.filter(t => (t.testBed || 'Uncategorized') === bed);
                  if (casesInBed.length === 0) return null;
                  return (
                    <div key={bed} className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">{bed}</p>
                      <div className="space-y-0.5">
                        {casesInBed.map(t => {
                          const realIdx = session.testCases.findIndex(x => x.id === t.id);
                          const isActive = realIdx === currentIndex;
                          const dotCls = t.status === 'Pass' ? 'bg-emerald-500' : t.status.includes('Fail') ? 'bg-red-500' : t.status === 'N/A' ? 'bg-muted-foreground' : 'bg-border';
                          return (
                            <button key={t.id} onClick={() => { setCurrentIndex(realIdx); setDrawerOpen(false); }}
                              className={cn('w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                                isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted border border-transparent')}>
                              <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dotCls)} />
                              <div className="min-w-0 flex-1">
                                <p className={cn('text-xs leading-snug line-clamp-2', isActive ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                                  {t.testCaseTitle}
                                </p>
                                <span className="text-[9px] text-muted-foreground/50 font-mono">#{realIdx + 1}</span>
                              </div>
                              {isActive && <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredCases.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No cases match filter</p>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Fail Dialog ─── */}
      <Dialog open={failOpen} onOpenChange={v => { setFailOpen(v); if (!v) { setJiraIssueKey(null); setJiraIssueLink(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-500" /> Log Bug
            </DialogTitle>
            <DialogDescription>Enter a bug ID or create a new Jira issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Bug ID input with auto-fetch */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bug ID</label>
              <Input
                placeholder="e.g. SN-1234"
                value={bugId}
                onChange={e => setBugId(e.target.value.toUpperCase())}
                className="h-9 text-sm font-mono"
              />
              {bugFetching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                </div>
              )}
              {bugTitle && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{bugId} — {bugTitle}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Textarea
                placeholder="Brief description of the failure..."
                value={bugDesc}
                onChange={e => setBugDesc(e.target.value)}
                className="resize-none h-20 text-sm"
              />
            </div>

            {/* Jira Create */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Jira Integration</p>
              {jiraIssueKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600">✓ {jiraIssueKey} created</span>
                  {jiraIssueLink && (
                    <a href={jiraIssueLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline">
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <Button size="sm" variant="outline" disabled={jiraPushing} onClick={pushToJira}
                  className="h-7 text-xs gap-1.5">
                  {jiraPushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  Create in Jira
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setFailOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm"
              disabled={!bugId && !bugDesc}
              onClick={() => markStatus('Fail', { bugId, bugDesc, bugTitle })}>
              Confirm Fail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── N/A Dialog ─── */}
      <Dialog open={naOpen} onOpenChange={setNaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as N/A</DialogTitle>
            <DialogDescription>Select a reason for skipping this test case.</DialogDescription>
          </DialogHeader>
          <Select onValueChange={setNaReason}>
            <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
            <SelectContent>
              {naReasonOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setNaOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!naReason} onClick={() => markStatus('N/A', { naReason })}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Complete/Abort Dialog ─── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{untestedCount === 0 ? 'Session Complete' : 'Abort Session?'}</DialogTitle>
            <DialogDescription>
              {untestedCount === 0
                ? 'All test cases executed. Ready to generate the report.'
                : `${untestedCount} cases remain untested.`}
            </DialogDescription>
          </DialogHeader>
          {untestedCount > 0 && (
            <Select onValueChange={setIncompleteReason}>
              <SelectTrigger><SelectValue placeholder="Reason for aborting..." /></SelectTrigger>
              <SelectContent>
                {incompleteReasonOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => handleComplete(incompleteReason)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white">
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
