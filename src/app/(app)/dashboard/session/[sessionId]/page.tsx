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
  Menu, X, Loader2, Search, Bug, ExternalLink, Timer,
  ArrowRight, Zap, ListChecks, Target, Keyboard,
  SkipForward, Clock
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
  "Session paused", "Blocked by bug", "Time constraints", "Environment unavailable", "Other",
];

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useTimer(currentIndex: number) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    setSeconds(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentIndex]);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function useJiraFetch(bugId: string) {
  const [bugTitle, setBugTitle] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    setBugTitle(null); setFetchError(null);
    const trimmed = bugId?.trim() || '';
    if (!trimmed || !/^[A-Z]{2,10}-\d+$/.test(trimmed)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true); setFetchError(null);
      try {
        const res = await fetch(`/api/jira/issue/${encodeURIComponent(trimmed)}`);
        if (res.ok) { const d = await res.json(); setBugTitle(d.summary || 'Untitled'); }
        else { const e = await res.json().catch(() => ({})); setFetchError(e.error || `Error ${res.status}`); }
      } catch { setFetchError('Network error'); }
      finally { setFetching(false); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [bugId]);
  return { bugTitle, fetching, fetchError };
}

function useSwipe(onLeft: () => void, onRight: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx > 0 ? onRight() : onLeft(); }
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
  const [failOpen, setFailOpen] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [bugId, setBugId] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [incompleteReason, setIncompleteReason] = useState('');
  const [naReason, setNaReason] = useState('');
  const [jiraPushing, setJiraPushing] = useState(false);
  const [jiraIssueKey, setJiraIssueKey] = useState<string | null>(null);
  const [jiraIssueLink, setJiraIssueLink] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'Pass' | 'Fail' | 'N/A' | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const timer = useTimer(currentIndex);
  const { bugTitle, fetching: bugFetching, fetchError: bugFetchError } = useJiraFetch(bugId);
  const anyDialogOpen = failOpen || naOpen || completeOpen || drawerOpen;

  const goNext = useCallback(() => {
    if (session && currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1);
  }, [session, currentIndex]);
  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);
  const swipeHandlers = useSwipe(goNext, goPrev);

  // Push to Jira
  const pushToJira = async () => {
    if (!session) return;
    const tc = session.testCases[currentIndex];
    if (!tc) return;
    setJiraPushing(true);
    try {
      const res = await fetch('/api/jira/create-issue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseName: tc.testCaseTitle, testerName: session.userName, steps: tc.testSteps, expected: tc.expectedResult, actual: bugDesc || tc.actualResult || 'Not recorded', platform: session.platformDetails.platformName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Jira error');
      setJiraIssueKey(data.issueKey); setJiraIssueLink(data.issueLink); setBugId(data.issueKey);
      toast({ title: `Created ${data.issueKey}` });
    } catch (e: any) { toast({ title: 'Jira Error', description: e.message, variant: 'destructive' }); }
    finally { setJiraPushing(false); }
  };

  // Entrance
  useEffect(() => { const t = setTimeout(() => setShowEntrance(false), 1600); return () => clearTimeout(t); }, []);

  // Load session
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
        const parsed: TestSession = { id: snap.id, ...data, createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(), testCases: (data.testCases || []).map((tc: any) => ({ ...tc, lastModified: (tc.lastModified as Timestamp)?.toDate?.() ?? new Date() })) } as TestSession;
        if (parsed.status === 'Completed') { router.replace(`/dashboard/session/${sessionId}/results`); return; }
        setSession(parsed);
        const first = parsed.testCases.findIndex(tc => tc.status === 'Untested');
        setCurrentIndex(first !== -1 ? first : 0);
      } catch { toast({ title: 'Error', description: 'Failed to load session.', variant: 'destructive' }); }
      finally { setIsLoading(false); }
    })();
  }, [sessionId, user, router, toast]);

  // Reset on index change
  useEffect(() => { setVerdict(null); setJiraIssueKey(null); setJiraIssueLink(null); setBugId(''); setBugDesc(''); setNaReason(''); }, [currentIndex]);

  // Firestore sync
  const handleUpdate = useCallback(async (data: Partial<TestSession>) => {
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), JSON.parse(JSON.stringify(data)));
      setSession(prev => prev ? { ...prev, ...data, updatedAt: new Date() } as TestSession : null);
    } catch { toast({ title: 'Sync Error', description: 'Cloud save failed.', variant: 'destructive' }); }
  }, [sessionId, sessionCollection, toast]);

  const handleComplete = async (reason?: string) => {
    if (!session) return;
    const remaining = session.testCases.filter(t => t.status === 'Untested').length;
    await handleUpdate({ status: remaining > 0 ? 'Aborted' : 'Completed', updatedAt: new Date(), completedAt: new Date(), reasonForIncompletion: reason });
    router.replace(`/dashboard/session/${sessionId}/results`);
  };

  // Mark verdict
  const markStatus = useCallback(async (base: 'Pass' | 'Fail' | 'N/A', details?: any) => {
    if (!session) return;
    const currentTc = session.testCases[currentIndex];
    if (!currentTc) return;
    setVerdict(base);
    const updated = [...session.testCases];
    updated[currentIndex] = {
      ...currentTc, status: base, lastModified: new Date(),
      bugId: details?.bugId || null, bugTitle: details?.bugTitle || null,
      naReason: details?.naReason || null,
      notes: details?.bugDesc ? (currentTc.notes || '') + `\nBug: ${details.bugDesc}` : currentTc.notes,
      actualResult: base === 'Pass' ? currentTc.expectedResult : (currentTc.actualResult || ''),
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
    setTimeout(() => { if (currentIndex < updated.length - 1) setCurrentIndex(i => i + 1); else setCompleteOpen(true); }, 400);
    setFailOpen(false); setNaOpen(false);
  }, [session, currentIndex, handleUpdate]);

  // Keyboard shortcuts — ONLY when no dialog is open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block ALL shortcuts when any dialog/drawer is open
      if (anyDialogOpen) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case 'p': e.preventDefault(); markStatus('Pass'); break;
        case 'f': e.preventDefault(); setFailOpen(true); break;
        case 'n': e.preventDefault(); setNaOpen(true); break;
        case 'arrowleft': e.preventDefault(); goPrev(); break;
        case 'arrowright': e.preventDefault(); goNext(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [anyDialogOpen, markStatus, goPrev, goNext]);

  const patchField = (field: keyof TestCase, value: string) => {
    if (!session) return;
    const updated = [...session.testCases];
    const tc = updated[currentIndex];
    if (!tc) return;
    updated[currentIndex] = { ...tc, [field]: value };
    setSession({ ...session, testCases: updated });
  };
  const saveField = () => session && handleUpdate({ testCases: session.testCases });

  // Loading
  if (isLoading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
      </motion.div>
    </div>
  );
  if (!session) return null;

  // Derived
  const tc = session.testCases[currentIndex];
  const untestedCount = session.testCases.filter(t => t.status === 'Untested').length;
  const passCount = session.testCases.filter(t => t.status === 'Pass').length;
  const failCount = session.testCases.filter(t => t.status.includes('Fail')).length;
  const naCount = session.testCases.filter(t => t.status === 'N/A').length;
  const total = session.testCases.length;
  const progress = Math.round(((total - untestedCount) / total) * 100);
  const steps = (tc?.testSteps || '').split('\n').filter(Boolean);
  const testBeds = Array.from(new Set(session.testCases.map(t => t.testBed || 'Uncategorized')));
  const filteredCases = session.testCases.filter(t => {
    const matchSearch = !searchQuery || t.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'all' || t.status === filterStatus || (filterStatus === 'fail' && t.status.includes('Fail'));
    return matchSearch && matchFilter;
  });

  return (
    <div className="fixed inset-0 bg-[#0a0a0b] text-white flex flex-col overflow-hidden">

      {/* ─── Entrance ─── */}
      <AnimatePresence>
        {showEntrance && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] bg-[#0a0a0b] flex items-center justify-center">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }} className="flex flex-col items-center gap-5">
              <div className="relative">
                <motion.div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center"
                  animate={{ boxShadow: ['0 0 30px rgba(139,92,246,0.2)', '0 0 60px rgba(139,92,246,0.4)', '0 0 30px rgba(139,92,246,0.2)'] }}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <Zap className="w-9 h-9 text-violet-400" />
                </motion.div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">{session.platformDetails.platformName}</h2>
                <p className="text-sm text-white/50 mt-1">{total} test cases ready</p>
              </div>
              <motion.div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                  initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header ─── */}
      <header className="shrink-0 h-14 border-b border-white/[0.06] bg-[#0a0a0b]/95 backdrop-blur-xl z-30 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}
          className="h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="text-sm font-medium text-white/80 truncate hidden sm:block">{session.platformDetails.platformName}</span>
        </div>

        {/* Progress */}
        <div className="flex-1 flex items-center gap-3 mx-4">
          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden max-w-sm">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
              animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
          <span className="text-[11px] font-semibold text-white/40 tabular-nums">{progress}%</span>
        </div>

        {/* Stats pills */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 tabular-nums">{passCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[10px] font-bold text-red-400 tabular-nums">{failCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <span className="text-[10px] font-bold text-white/40 tabular-nums">{naCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
            <span className="text-[10px] font-bold text-violet-400 tabular-nums">{untestedCount} left</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(s => !s)}
            className="h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 hidden sm:flex">
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}
            className="h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <Menu className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setCompleteOpen(true)}
            className={cn('rounded-lg px-3 text-[11px] font-semibold h-7 ml-1',
              untestedCount === 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10')}>
            {untestedCount === 0 ? 'Finish' : 'End'}
          </Button>
        </div>
      </header>

      {/* Shortcuts tooltip */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="absolute top-16 right-4 z-40 bg-[#1a1a1d] border border-white/10 rounded-xl p-3 shadow-2xl">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
              {[['P', 'Pass'], ['F', 'Fail'], ['N', 'N/A'], ['←', 'Prev'], ['→', 'Next']].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-white/70">{k}</kbd>
                  <span className="text-white/50">{v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Card Area ─── */}
      <div className="flex-1 flex items-start justify-center overflow-y-auto py-8 px-4" {...swipeHandlers}>
        <AnimatePresence mode="wait">
          <motion.div key={tc?.id || currentIndex}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[680px]">

            {/* Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden shadow-2xl shadow-black/20">

              {/* Card header */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-mono text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                    {currentIndex + 1}/{total}
                  </span>
                  {tc?.priority && (
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md',
                      tc.priority === 'High' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                      tc.priority === 'Medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                      'bg-white/5 text-white/50 border border-white/10'
                    )}>{tc.priority}</span>
                  )}
                  {tc?.testBed && (
                    <span className="text-[10px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                      {tc.testBed}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-white/30">
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px] font-mono tabular-nums">{timer}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="px-6 py-6 space-y-6">
                {/* Title */}
                <h2 className="text-lg font-semibold text-white leading-snug tracking-tight">
                  {tc?.testCaseTitle}
                </h2>

                {/* Steps */}
                {steps.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Steps</span>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {steps.map((step, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex gap-3 items-start py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                          <span className="shrink-0 w-5 h-5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[13px] text-white/70 leading-relaxed">{step.replace(/^\d+[\.\)]\s*/, '')}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Expected</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
                    <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">{tc?.expectedResult || 'Not defined'}</p>
                  </div>
                </div>

                {/* Actual */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Actual Result</span>
                  </div>
                  <Textarea placeholder="What happened..."
                    value={tc?.actualResult || ''} onChange={e => patchField('actualResult', e.target.value)} onBlur={saveField}
                    className="resize-none h-20 text-[13px] bg-white/[0.03] border-white/[0.08] text-white/80 placeholder:text-white/20 rounded-xl focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/20" />
                </div>
              </div>

              {/* Verdict buttons */}
              <div className="px-6 py-5 border-t border-white/[0.06] bg-white/[0.01]">
                <div className="grid grid-cols-3 gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => markStatus('Pass')}
                    className={cn('group relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200',
                      verdict === 'Pass' ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'border-white/[0.08] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/5')}>
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      verdict === 'Pass' ? 'bg-emerald-500/20' : 'bg-white/[0.04] group-hover:bg-emerald-500/10')}>
                      <CheckCircle2 className={cn('w-5 h-5 transition-colors', verdict === 'Pass' ? 'text-emerald-400' : 'text-white/40 group-hover:text-emerald-400')} />
                    </div>
                    <span className={cn('text-xs font-semibold', verdict === 'Pass' ? 'text-emerald-400' : 'text-white/50 group-hover:text-emerald-400')}>Pass</span>
                    <kbd className="text-[9px] font-mono text-white/20 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">P</kbd>
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setFailOpen(true)}
                    className={cn('group relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200',
                      verdict === 'Fail' ? 'border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/10' : 'border-white/[0.08] bg-white/[0.02] hover:border-red-500/30 hover:bg-red-500/5')}>
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      verdict === 'Fail' ? 'bg-red-500/20' : 'bg-white/[0.04] group-hover:bg-red-500/10')}>
                      <XCircle className={cn('w-5 h-5 transition-colors', verdict === 'Fail' ? 'text-red-400' : 'text-white/40 group-hover:text-red-400')} />
                    </div>
                    <span className={cn('text-xs font-semibold', verdict === 'Fail' ? 'text-red-400' : 'text-white/50 group-hover:text-red-400')}>Fail</span>
                    <kbd className="text-[9px] font-mono text-white/20 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">F</kbd>
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setNaOpen(true)}
                    className={cn('group relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200',
                      verdict === 'N/A' ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]')}>
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      verdict === 'N/A' ? 'bg-white/10' : 'bg-white/[0.04] group-hover:bg-white/[0.06]')}>
                      <SkipForward className={cn('w-5 h-5 transition-colors', verdict === 'N/A' ? 'text-white/60' : 'text-white/30 group-hover:text-white/50')} />
                    </div>
                    <span className={cn('text-xs font-semibold', verdict === 'N/A' ? 'text-white/60' : 'text-white/40 group-hover:text-white/50')}>Skip</span>
                    <kbd className="text-[9px] font-mono text-white/20 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">N</kbd>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5 px-1">
              <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={goPrev}
                className="rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 gap-1.5">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <div className="flex items-center gap-1">
                {session.testCases.slice(Math.max(0, currentIndex - 3), Math.min(total, currentIndex + 4)).map((_, i) => {
                  const idx = Math.max(0, currentIndex - 3) + i;
                  return (
                    <button key={idx} onClick={() => setCurrentIndex(idx)}
                      className={cn('w-1.5 h-1.5 rounded-full transition-all',
                        idx === currentIndex ? 'w-4 bg-violet-400' : session.testCases[idx]?.status === 'Pass' ? 'bg-emerald-500' : session.testCases[idx]?.status.includes('Fail') ? 'bg-red-500' : 'bg-white/15 hover:bg-white/30')} />
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" disabled={currentIndex === total - 1} onClick={goNext}
                className="rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 gap-1.5">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Drawer ─── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#111113] border-l border-white/[0.06] flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">Test Cases</p>
                  <p className="text-[10px] text-white/40">{total} total · {untestedCount} remaining</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-3 py-2 border-b border-white/[0.04]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30" />
                </div>
              </div>
              <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04]">
                {[{ key: 'all', label: 'All' }, { key: 'Untested', label: 'Todo' }, { key: 'Pass', label: 'Pass' }, { key: 'fail', label: 'Fail' }].map(f => (
                  <button key={f.key} onClick={() => setFilterStatus(f.key)}
                    className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors',
                      filterStatus === f.key ? 'bg-violet-500/20 text-violet-300' : 'text-white/30 hover:text-white/50 hover:bg-white/5')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
                {testBeds.map(bed => {
                  const casesInBed = filteredCases.filter(t => (t.testBed || 'Uncategorized') === bed);
                  if (casesInBed.length === 0) return null;
                  return (
                    <div key={bed}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-2 py-1">{bed}</p>
                      {casesInBed.map(t => {
                        const idx = session.testCases.findIndex(x => x.id === t.id);
                        const active = idx === currentIndex;
                        const dot = t.status === 'Pass' ? 'bg-emerald-400' : t.status.includes('Fail') ? 'bg-red-400' : t.status === 'N/A' ? 'bg-white/30' : 'bg-white/10';
                        return (
                          <button key={t.id} onClick={() => { setCurrentIndex(idx); setDrawerOpen(false); }}
                            className={cn('w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                              active ? 'bg-violet-500/10 border border-violet-500/20' : 'hover:bg-white/[0.03] border border-transparent')}>
                            <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dot)} />
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-[11px] leading-snug line-clamp-2', active ? 'text-white font-medium' : 'text-white/50')}>{t.testCaseTitle}</p>
                            </div>
                            {active && <ArrowRight className="w-3 h-3 text-violet-400 shrink-0 mt-1" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Fail Dialog ─── */}
      <Dialog open={failOpen} onOpenChange={v => { setFailOpen(v); if (!v) { setJiraIssueKey(null); setJiraIssueLink(null); } }}>
        <DialogContent className="sm:max-w-md bg-[#141416] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <Bug className="w-3.5 h-3.5 text-red-400" />
              </div>
              Log Bug
            </DialogTitle>
            <DialogDescription className="text-white/40">Link an existing Jira issue or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50">Bug ID</label>
              <Input placeholder="e.g. SUN-1234" value={bugId}
                onChange={e => setBugId(e.target.value.toUpperCase())}
                className="h-10 text-sm font-mono bg-white/[0.03] border-white/[0.1] text-white placeholder:text-white/20 focus:border-violet-500/40 rounded-xl" />
              {bugFetching && <div className="flex items-center gap-2 text-[11px] text-white/40"><Loader2 className="w-3 h-3 animate-spin" />Looking up {bugId}...</div>}
              {bugTitle && !bugFetching && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{bugId} — {bugTitle}</span>
                </motion.div>
              )}
              {bugFetchError && !bugFetching && (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2">
                  <XCircle className="w-3 h-3 shrink-0" /><span>{bugFetchError}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-white/50">Notes</label>
              <Textarea placeholder="What went wrong..." value={bugDesc} onChange={e => setBugDesc(e.target.value)}
                className="resize-none h-20 text-sm bg-white/[0.03] border-white/[0.1] text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/40" />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">Jira</p>
              {jiraIssueKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-400">✓ {jiraIssueKey}</span>
                  {jiraIssueLink && <a href={jiraIssueLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-400 hover:underline flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></a>}
                </div>
              ) : (
                <Button size="sm" variant="outline" disabled={jiraPushing} onClick={pushToJira}
                  className="h-7 text-[11px] gap-1.5 bg-transparent border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                  {jiraPushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  Create in Jira
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setFailOpen(false)} className="text-white/50 hover:text-white hover:bg-white/5">Cancel</Button>
            <Button size="sm" onClick={() => markStatus('Fail', { bugId: bugId || undefined, bugDesc: bugDesc || undefined, bugTitle: bugTitle || undefined })}
              className="bg-red-500 hover:bg-red-600 text-white border-0 rounded-lg">
              Confirm Fail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── N/A Dialog ─── */}
      <Dialog open={naOpen} onOpenChange={setNaOpen}>
        <DialogContent className="sm:max-w-sm bg-[#141416] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Skip Test Case</DialogTitle>
            <DialogDescription className="text-white/40">Why is this not applicable?</DialogDescription>
          </DialogHeader>
          <Select onValueChange={setNaReason}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.1] text-white rounded-xl">
              <SelectValue placeholder="Select reason..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1d] border-white/[0.1]">
              {naReasonOptions.map(r => <SelectItem key={r} value={r} className="text-white/70 focus:text-white focus:bg-white/5">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNaOpen(false)} className="text-white/50 hover:text-white hover:bg-white/5">Cancel</Button>
            <Button size="sm" disabled={!naReason} onClick={() => markStatus('N/A', { naReason })}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-lg disabled:opacity-30">
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Complete Dialog ─── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-sm bg-[#141416] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{untestedCount === 0 ? 'Session Complete' : 'End Session?'}</DialogTitle>
            <DialogDescription className="text-white/40">
              {untestedCount === 0 ? 'All cases executed. Generate the report.' : `${untestedCount} cases remain untested.`}
            </DialogDescription>
          </DialogHeader>
          {untestedCount > 0 && (
            <Select onValueChange={setIncompleteReason}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.1] text-white rounded-xl">
                <SelectValue placeholder="Reason..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1d] border-white/[0.1]">
                {incompleteReasonOptions.map(r => <SelectItem key={r} value={r} className="text-white/70 focus:text-white focus:bg-white/5">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCompleteOpen(false)} className="text-white/50 hover:text-white hover:bg-white/5">Cancel</Button>
            <Button size="sm" onClick={() => handleComplete(incompleteReason)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 rounded-lg">
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
