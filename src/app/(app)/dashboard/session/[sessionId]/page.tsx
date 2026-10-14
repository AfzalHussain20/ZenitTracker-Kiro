"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { TestSession, TestCase } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Menu, X, Loader2, Search, Bug, ExternalLink,
  ArrowRight, Zap, ListChecks, Target, Keyboard,
  SkipForward, Clock, Plus, Users
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
import { SessionTeamDialog } from '@/components/session/SessionTeamDialog';
import {
  buildAssignRangePatch, buildUnassignRangePatch, buildCasePatch,
  canAccessSession, computeSummary, findNextUnassigned, isSessionOwner,
  mergeTesters, parseSessionDoc, removeTester, splitEvenRanges,
  type SessionTester,
} from '@/lib/session-collab';

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

// Isolated so the 1 Hz tick re-renders only the clock, not the entire session page.
const SessionClock = memo(function SessionClock({ resetKey }: { resetKey: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const intervalId = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(intervalId);
  }, [resetKey]);
  return (
    <span className="text-[11px] font-mono tabular-nums">
      {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
    </span>
  );
});

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
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      dx > 0 ? onRight() : onLeft();
    }
    touchStart.current = null;
  };
  return { onTouchStart, onTouchEnd };
}

// Keeps the "Actual" text in local state so typing doesn't re-render the whole
// session page; commits to Firestore only on blur.
const ActualField = memo(function ActualField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  return (
    <Textarea
      placeholder="What happened..."
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      rows={2}
      className="resize-none text-[13px] bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 rounded-lg focus:border-primary/30 focus:ring-1 focus:ring-primary/20 min-h-0"
    />
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TestSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user, loading: authLoading, userRole, displayName: authDisplayName } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<TestSession | null>(null);
  const [sessionCollection, setSessionCollection] = useState<'sessions' | 'testSessions'>('sessions');
  const [isLoading, setIsLoading] = useState(true);
  const [showEntrance, setShowEntrance] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [failOpen, setFailOpen] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [bugId, setBugId] = useState('');
  const [linkedBugs, setLinkedBugs] = useState<{id: string; title: string | null}[]>([]);
  const [bugDesc, setBugDesc] = useState('');
  const [incompleteReason, setIncompleteReason] = useState('');
  const [naReason, setNaReason] = useState('');
  const [jiraPushing, setJiraPushing] = useState(false);
  const [jiraIssueKey, setJiraIssueKey] = useState<string | null>(null);
  const [jiraIssueLink, setJiraIssueLink] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'Pass' | 'Fail' | 'N/A' | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showJiraForm, setShowJiraForm] = useState(false);
  const [jiraSummary, setJiraSummary] = useState('');
  const [jiraSeverity, setJiraSeverity] = useState('High');
  const [jiraEnv, setJiraEnv] = useState('Staging');
  const [jiraAssignee, setJiraAssignee] = useState('');
  const [jiraExistingInLive, setJiraExistingInLive] = useState('No');
  const [jiraActual, setJiraActual] = useState('');
  const [jiraUsers, setJiraUsers] = useState<{accountId: string; displayName: string}[]>([]);
  const [jiraComponents, setJiraComponents] = useState<{id: string; name: string}[]>([]);
  const [jiraComponent, setJiraComponent] = useState('');
  const [jiraAssigneeSearch, setJiraAssigneeSearch] = useState('');
  const [assigneeHighlight, setAssigneeHighlight] = useState(-1);
  const [jiraComponentSearch, setJiraComponentSearch] = useState('');
  const [componentHighlight, setComponentHighlight] = useState(-1);
  const [jiraEnvironments, setJiraEnvironments] = useState<string[]>([]);
  const [jiraPriorities, setJiraPriorities] = useState<{id: string; name: string}[]>([]);

  const { bugTitle, fetching: bugFetching, fetchError: bugFetchError } = useJiraFetch(bugId);
  const anyDialogOpen = failOpen || naOpen || completeOpen || drawerOpen;

  // ─── Memoized derived data (avoids rescanning 500+ cases on every render) ───
  const stats = useMemo(() => {
    const cases = session?.testCases ?? [];
    let pass = 0, fail = 0, na = 0, untested = 0;
    for (const t of cases) {
      const s = t.status;
      if (s === 'Pass') pass++;
      else if (s?.includes('Fail')) fail++;
      else if (s === 'N/A') na++;
      else if (s === 'Untested') untested++;
    }
    const total = cases.length;
    return { pass, fail, na, untested, total, progress: total > 0 ? Math.round(((total - untested) / total) * 100) : 0 };
  }, [session]);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    (session?.testCases ?? []).forEach((t, i) => map.set(t.id, i));
    return map;
  }, [session]);

  // Identity / permissions for shared-session collaboration.
  const myUid = user?.uid || '';
  const myName = myUid && session?.userId === myUid
    ? session.userName
    : (user?.displayName || authDisplayName || user?.email?.split('@')[0] || 'Tester');
  const canManage = !!session && (isSessionOwner(session, myUid) || userRole === 'lead');

  const matchesAssignee = useCallback((t: TestCase) => {
    if (assigneeFilter === 'mine') return t.assignedToUid === myUid;
    if (assigneeFilter === 'unassigned') return !t.assignedToUid;
    return true;
  }, [assigneeFilter, myUid]);

  const drawerGroups = useMemo(() => {
    if (!drawerOpen) return [] as { bed: string; cases: TestCase[] }[];
    const q = searchQuery.toLowerCase();
    const byBed = new Map<string, TestCase[]>();
    for (const t of session?.testCases ?? []) {
      if (q && !(t.testCaseTitle || '').toLowerCase().includes(q)) continue;
      if (!matchesAssignee(t)) continue;
      if (filterStatus !== 'all') {
        if (filterStatus === 'fail') { if (!t.status?.includes('Fail')) continue; }
        else if (t.status !== filterStatus) continue;
      }
      const bed = t.testBed || 'Uncategorized';
      const list = byBed.get(bed);
      if (list) list.push(t);
      else byBed.set(bed, [t]);
    }
    return Array.from(byBed.entries()).map(([bed, cases]) => ({ bed, cases }));
  }, [drawerOpen, session, searchQuery, filterStatus, matchesAssignee]);

  // Fetch ALL Jira data from single endpoint when form opens
  useEffect(() => {
    if (showJiraForm && jiraUsers.length === 0) {
      // Teams API is only a fallback when the project exposes no components —
      // fetching both concurrently races, and whichever resolves last overwrites
      // the dropdown list.
      const loadTeamComponents = () => {
        fetch('/api/jira/teams').then(r => r.json()).then(d => {
          if (d.teams?.length) setJiraComponents(d.teams.map((t: any) => ({ id: t.id, name: t.name })));
        }).catch(() => {});
      };
      // Fetch fields (users, envs, priorities, components)
      fetch('/api/jira/fields').then(r => r.json()).then(d => {
        if (d.users) setJiraUsers(d.users);
        if (d.environments?.length) setJiraEnvironments(d.environments);
        if (d.priorities?.length) setJiraPriorities(d.priorities);
        if (d.components?.length) setJiraComponents(d.components);
        else loadTeamComponents();
      }).catch(loadTeamComponents);
    }
  }, [showJiraForm, jiraUsers.length]);

  // Pre-populate Jira form when it opens
  useEffect(() => {
    if (showJiraForm && session) {
      const currentTc = session.testCases[currentIndex];
      if (currentTc) {
        setJiraActual(bugDesc || currentTc.actualResult || '');
        setJiraSeverity(currentTc.priority === 'High' ? 'High' : currentTc.priority === 'Low' ? 'Low' : 'Medium');
      }
    }
  }, [showJiraForm]);

  // Auto-generate summary (reactive to env changes)
  useEffect(() => {
    if (showJiraForm && session) {
      const currentTc = session.testCases[currentIndex];
      if (currentTc) {
        const platform = session.platformDetails.platformName;
        const version = session.platformDetails.appVersion ? `V${session.platformDetails.appVersion}` : '';
        const env = jiraEnv || 'Staging';
        const module = currentTc.testBed || 'General';
        setJiraSummary(`${platform}${version ? ` | ${version}` : ''} | ${env} | ${module} : ${currentTc.testCaseTitle}`);
      }
    }
  }, [showJiraForm, jiraEnv]);

  const goNext = useCallback(() => {
    if (session && currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1);
    // If already at last, do nothing — completion dialog handles it via markStatus
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
        body: JSON.stringify({
          testCaseName: tc.testCaseTitle, testerName: session.userName,
          steps: tc.testSteps, expected: tc.expectedResult,
          actual: bugDesc || tc.actualResult || 'Not recorded',
          platform: session.platformDetails.platformName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Jira error');
      setJiraIssueKey(data.issueKey);
      setJiraIssueLink(data.issueLink);
      setBugId(data.issueKey);
      setLinkedBugs(prev => [...prev, { id: data.issueKey, title: tc.testCaseTitle }]);
      toast({ title: `Created ${data.issueKey}` });
    } catch (e: any) {
      toast({ title: 'Jira Error', description: e.message, variant: 'destructive' });
    } finally { setJiraPushing(false); }
  };

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setShowEntrance(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // Load session + live sync for shared (multi-tester) sessions.
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve
    if (!sessionId || !user) { router.replace('/dashboard'); return; }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      setIsLoading(true);
      try {
        // Locate the session in either collection (current `sessions` vs legacy
        // `testSessions`). Read each independently because getDoc for a missing
        // document is rejected by the rules and must not abort the fallback.
        let ref: any = null;
        let snap: any = null;
        for (const col of ['sessions', 'testSessions'] as const) {
          try {
            const r = doc(db, col, sessionId);
            const s = await getDoc(r);
            if (s.exists()) { ref = r; snap = s; break; }
          } catch { /* denied / missing — try the next collection */ }
        }
        if (cancelled) return;
        if (!snap || !snap.exists() || !canAccessSession(snap.data(), { uid: user.uid, isLead: userRole === 'lead' })) {
          router.replace('/dashboard'); return;
        }
        setSessionCollection(ref.path.startsWith('sessions/') ? 'sessions' : 'testSessions');
        const parsed = parseSessionDoc(snap.id, snap.data());
        if (parsed.status === 'Completed') { router.replace(`/dashboard/session/${sessionId}/results`); return; }
        setSession(parsed);
        const first = parsed.testCases.findIndex(tc => tc.status === 'Untested');
        setCurrentIndex(first !== -1 ? first : 0);

        // Live sync: other testers' verdicts/claims appear without a refresh.
        unsub = onSnapshot(ref, s => {
          if (s.exists()) setSession(parseSessionDoc(s.id, s.data()));
        }, () => {});
      } catch { toast({ title: 'Error', description: 'Failed to load session.', variant: 'destructive' }); }
      finally { if (!cancelled) setIsLoading(false); }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [sessionId, user, authLoading, userRole, router, toast]);

  // Reset on index change
  useEffect(() => {
    setVerdict(null); setJiraIssueKey(null); setJiraIssueLink(null);
    setBugId(''); setLinkedBugs([]); setBugDesc(''); setNaReason('');
  }, [currentIndex]);

  // Firestore sync (session-level fields: status, testers, …)
  const handleUpdate = useCallback(async (data: Partial<TestSession>) => {
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), JSON.parse(JSON.stringify(data)));
      setSession(prev => prev ? { ...prev, ...data, updatedAt: new Date() } as TestSession : null);
    } catch { toast({ title: 'Sync Error', description: 'Cloud save failed.', variant: 'destructive' }); }
  }, [sessionId, sessionCollection, toast]);

  // Atomic per-case write. Never rewrites the whole array, so concurrent testers
  // editing different cases don't clobber each other. `onSnapshot` reconciles.
  const writeCasePatch = useCallback(async (index: number, patch: Partial<TestCase>) => {
    const merged = session ? [...session.testCases] : [];
    if (merged[index]) merged[index] = { ...merged[index], ...patch } as TestCase;
    const payload: Record<string, unknown> = {
      ...buildCasePatch(index, patch),
      summary: computeSummary(merged),
      updatedAt: new Date(),
    };
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), payload as any);
      setSession(prev => {
        if (!prev) return prev;
        const cases = [...prev.testCases];
        if (cases[index]) cases[index] = { ...cases[index], ...patch } as TestCase;
        return { ...prev, testCases: cases, summary: computeSummary(cases), updatedAt: new Date() };
      });
    } catch { toast({ title: 'Sync Error', description: 'Cloud save failed.', variant: 'destructive' }); }
  }, [session, sessionCollection, sessionId, toast]);

  // Claim a case inside a transaction so two testers can't grab the same one.
  const claimCase = useCallback(async (index: number) => {
    if (!user) return false;
    const ref = doc(db, sessionCollection, sessionId);
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const cases = (snap.data()?.testCases || []) as TestCase[];
        const c = cases[index];
        if (!c) return;
        if (c.assignedToUid && c.assignedToUid !== user.uid) {
          throw new Error(`Already claimed by ${c.assignedToName || 'another tester'}`);
        }
        if (c.assignedToUid === user.uid) return;
        tx.update(ref, buildCasePatch(index, { assignedToUid: user.uid, assignedToName: myName }) as any);
      });
      return true;
    } catch (e: any) {
      toast({ title: 'Cannot claim', description: e.message, variant: 'destructive' });
      return false;
    }
  }, [user, sessionCollection, sessionId, myName, toast]);

  const claimNext = useCallback(async () => {
    if (!session) return;
    const idx = findNextUnassigned(session.testCases, currentIndex);
    if (idx === -1) { toast({ title: 'Nothing to claim', description: 'Every case is assigned.' }); return; }
    if (await claimCase(idx)) setCurrentIndex(idx);
  }, [session, currentIndex, claimCase, toast]);

  const assignRange = useCallback(async (start: number, end: number, tester: SessionTester) => {
    if (!session) return;
    try {
      await updateDoc(doc(db, sessionCollection, sessionId),
        buildAssignRangePatch(start - 1, end - 1, tester, session.testCases.length) as any);
      toast({ title: `Assigned ${start}–${end} to ${tester.name}` });
    } catch { toast({ title: 'Sync Error', description: 'Could not assign cases.', variant: 'destructive' }); }
  }, [session, sessionCollection, sessionId, toast]);

  const unassignRange = useCallback(async (start: number, end: number) => {
    if (!session) return;
    try {
      await updateDoc(doc(db, sessionCollection, sessionId),
        buildUnassignRangePatch(start - 1, end - 1, session.testCases.length) as any);
    } catch { toast({ title: 'Sync Error', description: 'Could not clear assignment.', variant: 'destructive' }); }
  }, [session, sessionCollection, sessionId, toast]);

  const evenSplit = useCallback(async () => {
    if (!session) return;
    const participants = mergeTesters([{ uid: session.userId, name: session.userName }], session.testers || []);
    const ranges = splitEvenRanges(session.testCases.length, participants.length);
    const patch: Record<string, unknown> = {};
    ranges.forEach((r, i) => Object.assign(patch, buildAssignRangePatch(r.start, r.end, participants[i], session.testCases.length)));
    try {
      await updateDoc(doc(db, sessionCollection, sessionId), patch as any);
      toast({ title: `Split across ${participants.length} tester${participants.length === 1 ? '' : 's'}` });
    } catch { toast({ title: 'Sync Error', description: 'Could not distribute cases.', variant: 'destructive' }); }
  }, [session, sessionCollection, sessionId, toast]);

  const inviteTester = useCallback(async (tester: SessionTester) => {
    if (!session) return;
    const testers = mergeTesters(session.testers, [tester]);
    await handleUpdate({ testers, testerIds: testers.map(t => t.uid) });
  }, [session, handleUpdate]);

  const removeTesterCb = useCallback(async (uid: string) => {
    if (!session) return;
    const testers = removeTester(session.testers, uid);
    await handleUpdate({ testers, testerIds: testers.map(t => t.uid) });
  }, [session, handleUpdate]);

  const handleComplete = async (reason?: string) => {
    if (!session) return;
    const remaining = session.testCases.filter(t => t.status === 'Untested').length;
    await handleUpdate({
      status: remaining > 0 ? 'Aborted' : 'Completed',
      updatedAt: new Date(), completedAt: new Date(), reasonForIncompletion: reason,
    });
    router.replace(`/dashboard/session/${sessionId}/results`);
  };

  // Mark verdict — writes only this case's fields (concurrency-safe).
  const [isMarking, setIsMarking] = useState(false);
  const markStatus = useCallback(async (base: 'Pass' | 'Fail' | 'N/A', details?: any) => {
    if (!session || isMarking) return;
    const currentTc = session.testCases[currentIndex];
    if (!currentTc) return;
    setIsMarking(true);
    setVerdict(base);

    // Brief success toast for Pass
    if (base === 'Pass') toast({ title: '✓ Passed' });

    const patch: Partial<TestCase> = {
      status: base,
      lastModified: new Date(),
      bugId: details?.bugId || null,
      bugTitle: details?.bugTitle || null,
      linkedBugs: details?.linkedBugs || [],
      naReason: details?.naReason || null,
      notes: details?.bugDesc ? (currentTc.notes || '') + `\nBug: ${details.bugDesc}` : currentTc.notes,
      actualResult: base === 'Pass' ? currentTc.expectedResult : (currentTc.actualResult || ''),
      executedByUid: myUid || null,
      executedByName: myName,
    };
    await writeCasePatch(currentIndex, patch);
    setTimeout(() => {
      if (currentIndex < session.testCases.length - 1) setCurrentIndex(i => i + 1);
      else setCompleteOpen(true);
      setIsMarking(false);
    }, 300);
    setFailOpen(false); setNaOpen(false);
  }, [session, currentIndex, writeCasePatch, isMarking, toast, myUid, myName]);

  // Keyboard shortcuts — FIXED: preventDefault BEFORE action, check anyDialogOpen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block ALL shortcuts when any dialog/drawer is open
      if (anyDialogOpen) return;

      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'p':
          e.preventDefault();
          markStatus('Pass');
          break;
        case 'f':
          e.preventDefault();
          setFailOpen(true);
          break;
        case 'n':
          e.preventDefault();
          setNaOpen(true);
          break;
        case 'arrowleft':
          e.preventDefault();
          goPrev();
          break;
        case 'arrowright':
          e.preventDefault();
          goNext();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [anyDialogOpen, markStatus, goPrev, goNext]);

  const commitActual = useCallback((value: string) => {
    if (!session) return;
    writeCasePatch(currentIndex, { actualResult: value });
  }, [session, currentIndex, writeCasePatch]);

  // Loading state
  if (isLoading || authLoading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
      </motion.div>
    </div>
  );
  if (!session) return null;

  // Handle empty session
  if (session.testCases.length === 0) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-lg font-semibold">No test cases in this session</p>
        <p className="text-sm text-muted-foreground">This session has no test cases loaded.</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    </div>
  );

  // Derived data
  const tc = session.testCases[currentIndex];
  const { pass: passCount, fail: failCount, na: naCount, untested: untestedCount, total, progress } = stats;
  const steps = (tc?.testSteps || '').split('\n').filter(Boolean);

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">

      {/* ─── Entrance Animation ─── */}
      <AnimatePresence>
        {showEntrance && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="flex flex-col items-center gap-5">
              <div className="relative">
                <motion.div
                  className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                  animate={{ boxShadow: ['0 0 30px hsl(var(--primary)/0.1)', '0 0 60px hsl(var(--primary)/0.2)', '0 0 30px hsl(var(--primary)/0.1)'] }}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <Zap className="w-9 h-9 text-primary" />
                </motion.div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground">{session.platformDetails.platformName}</h2>
                <p className="text-sm text-muted-foreground mt-1">{total} test cases ready</p>
              </div>
              <motion.div className="w-48 h-0.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }} animate={{ width: '100%' }}
                  transition={{ duration: 1.4, ease: 'easeInOut' }} />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header ─── */}
      <header className="shrink-0 h-14 border-b border-border bg-background/95 backdrop-blur-xl z-30 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground/80 truncate hidden sm:block">
            {session.platformDetails.platformName}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-3 mx-4">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-sm">
            <motion.div className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{progress}%</span>
        </div>

        {/* Stats pills */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{passCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tabular-nums">{failCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted border border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{naCount}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/5 border border-primary/20">
            <span className="text-[10px] font-bold text-primary tabular-nums">{untestedCount} left</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setTeamOpen(true)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted relative">
            <Users className="w-4 h-4" />
            {((session.testers?.length || 0) + 1) > 1 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                {(session.testers?.length || 0) + 1}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(s => !s)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted hidden sm:flex">
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <Menu className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setCompleteOpen(true)}
            className={cn('rounded-lg px-3 text-[11px] font-semibold h-7 ml-1',
              untestedCount === 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border')}>
            {untestedCount === 0 ? 'Finish' : 'End'}
          </Button>
        </div>
      </header>

      {/* Shortcuts tooltip */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="absolute top-16 right-4 z-40 bg-card border border-border rounded-xl p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
              {[['P', 'Pass'], ['F', 'Fail'], ['N', 'N/A'], ['←', 'Prev'], ['→', 'Next']].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-muted-foreground">{k}</kbd>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Card Area ─── */}
      <div className="flex-1 flex flex-col items-center min-h-0 px-4 py-4" {...swipeHandlers}>
        <AnimatePresence mode="wait">
          <motion.div key={tc?.id || currentIndex}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[680px] flex flex-col min-h-0 flex-1">

            {/* Card — scrollable body, fixed footer */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">

              {/* Card header — always visible */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                    {currentIndex + 1}/{total}
                  </span>
                  {tc?.priority && (
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md',
                      tc.priority === 'High' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20' :
                      tc.priority === 'Medium' ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                      'bg-muted text-muted-foreground border border-border'
                    )}>{tc.priority}</span>
                  )}
                  {tc?.testBed && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">{tc.testBed}</span>
                  )}
                  {tc?.assignedToName ? (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1',
                      tc.assignedToUid === myUid
                        ? 'bg-primary/5 text-primary border-primary/20'
                        : 'bg-muted text-muted-foreground border-border')}>
                      <Users className="w-2.5 h-2.5" />{tc.assignedToUid === myUid ? 'You' : tc.assignedToName}
                    </span>
                  ) : (
                    <button onClick={() => claimCase(currentIndex)}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1 transition-colors">
                      <Users className="w-2.5 h-2.5" />Claim
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <SessionClock resetKey={currentIndex} />
                </div>
              </div>

              {/* Card body — scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
                <h2 className="text-base font-semibold text-foreground leading-snug">
                  {tc?.testCaseTitle}
                  {tc?.status && tc.status !== 'Untested' && (
                    <Badge className={cn('ml-2 text-[9px] align-middle',
                      tc.status === 'Pass' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                      tc.status?.includes('Fail') ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    )}>{tc.status === 'Pass' ? '✓ Passed' : tc.status?.includes('Fail') ? '✗ Failed' : 'Skipped'}</Badge>
                  )}
                </h2>

                {steps.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Steps</span>
                    </div>
                    <div className="space-y-1">
                      {steps.map((step, i) => (
                        <div key={i} className="flex gap-2.5 items-start py-1.5 px-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <span className="shrink-0 w-4 h-4 rounded bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <p className="text-[13px] text-foreground/70 leading-relaxed">{step.replace(/^\d+[\.\)]\s*/, '')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expected</span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/15 bg-emerald-50 dark:bg-emerald-500/[0.04] px-3 py-2">
                    <p className="text-[13px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{tc?.expectedResult || 'Not defined'}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actual</span>
                  </div>
                  <ActualField key={tc?.id || currentIndex} value={tc?.actualResult || ''} onCommit={commitActual} />
                </div>

                {/* Linked Bugs Display */}
                {tc?.linkedBugs && tc.linkedBugs.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Bug className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Linked Bugs</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tc.linkedBugs.map((bugKey: string) => (
                        <span key={bugKey} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[11px] font-mono text-red-600 dark:text-red-400">
                          <Bug className="w-2.5 h-2.5" />
                          {bugKey}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Verdict buttons — always visible at bottom */}
              <div className={cn('px-5 py-3 border-t border-border bg-muted/30 shrink-0', isMarking && 'opacity-50 pointer-events-none')}>
                <div className="grid grid-cols-3 gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => markStatus('Pass')}
                    className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all',
                      verdict === 'Pass' ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10' : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/50')}>
                    <CheckCircle2 className={cn('w-4 h-4', verdict === 'Pass' ? 'text-emerald-600' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-semibold', verdict === 'Pass' ? 'text-emerald-600' : 'text-muted-foreground')}>Pass</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFailOpen(true)}
                    className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all',
                      verdict === 'Fail' ? 'border-red-500/50 bg-red-50 dark:bg-red-500/10' : 'border-border bg-card hover:border-red-300 hover:bg-red-50/50')}>
                    <XCircle className={cn('w-4 h-4', verdict === 'Fail' ? 'text-red-600' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-semibold', verdict === 'Fail' ? 'text-red-600' : 'text-muted-foreground')}>Fail</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setNaOpen(true)}
                    className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all',
                      verdict === 'N/A' ? 'border-border bg-muted/80' : 'border-border bg-card hover:bg-muted/50')}>
                    <SkipForward className={cn('w-4 h-4', verdict === 'N/A' ? 'text-foreground/60' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-semibold', verdict === 'N/A' ? 'text-foreground/60' : 'text-muted-foreground')}>Skip</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Navigation — always visible below card */}
            <div className="flex items-center justify-between mt-3 px-1 shrink-0">
              <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={goPrev}
                className="rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <span className="text-[11px] text-muted-foreground tabular-nums">{currentIndex + 1} of {total}</span>
              <Button variant="ghost" size="sm" disabled={currentIndex === total - 1} onClick={goNext}
                className="rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 gap-1">
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
              className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-card border-l border-border flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Test Cases</p>
                  <p className="text-[10px] text-muted-foreground">{total} total · {untestedCount} remaining</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-3 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30" />
                </div>
              </div>

              <div className="flex gap-1 px-3 py-2 border-b border-border">
                {[{ key: 'all', label: 'All' }, { key: 'Untested', label: 'Todo' }, { key: 'Pass', label: 'Pass' }, { key: 'fail', label: 'Fail' }].map(f => (
                  <button key={f.key} onClick={() => setFilterStatus(f.key)}
                    className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors',
                      filterStatus === f.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 px-3 py-2 border-b border-border">
                {([
                  { key: 'all', label: 'Everyone' },
                  { key: 'mine', label: 'Assigned to me' },
                  { key: 'unassigned', label: 'Unassigned' },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setAssigneeFilter(f.key)}
                    className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors flex items-center gap-1',
                      assigneeFilter === f.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                    {f.key !== 'all' && <Users className="w-2.5 h-2.5" />}{f.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
                {drawerGroups.map(({ bed, cases: casesInBed }) => {
                  return (
                    <div key={bed}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 py-1">{bed}</p>
                      {casesInBed.map(t => {
                        const idx = indexById.get(t.id) ?? -1;
                        const active = idx === currentIndex;
                        const dot = t.status === 'Pass' ? 'bg-emerald-500' : t.status?.includes('Fail') ? 'bg-red-500' : t.status === 'N/A' ? 'bg-muted-foreground/40' : 'bg-muted-foreground/15';
                        return (
                          <button key={t.id} onClick={() => { setCurrentIndex(idx); setDrawerOpen(false); }}
                            className={cn('w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                              active ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent')}>
                            <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dot)} />
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-[11px] leading-snug line-clamp-2',
                                active ? 'text-foreground font-medium' : 'text-muted-foreground')}>{t.testCaseTitle}</p>
                            </div>
                            {active && <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-1" />}
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
      <Dialog open={failOpen} onOpenChange={v => { setFailOpen(v); if (!v) { setJiraIssueKey(null); setJiraIssueLink(null); setShowJiraForm(false); setBugId(''); setLinkedBugs([]); setBugDesc(''); } }}>
        <DialogContent className="sm:max-w-[480px] lg:max-w-[560px] bg-card border-border text-foreground rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-5 pt-5 pb-3 shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-foreground text-base">
                <div className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 flex items-center justify-center">
                  <Bug className="w-3 h-3 text-red-600 dark:text-red-400" />
                </div>
                {showJiraForm ? 'Create Jira Bug' : 'Log Bug'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {showJiraForm ? 'Professional bug report — all fields auto-populated from test case.' : 'Link existing or create a new Jira issue.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3 min-h-0">
            {!showJiraForm ? (
              <>
                {/* Quick mode: Bug ID + Notes + Multi-bug mapping */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Link Bug (type ID and press Enter)</label>
                  <div className="flex gap-2">
                    <Input placeholder="e.g. SUN-1234" value={bugId}
                      onChange={e => setBugId(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && bugId.trim() && /^[A-Z]{2,10}-\d+$/.test(bugId.trim())) {
                          e.preventDefault();
                          if (!linkedBugs.find(b => b.id === bugId.trim())) {
                            setLinkedBugs(prev => [...prev, { id: bugId.trim(), title: bugTitle || null }]);
                          }
                          setBugId('');
                        }
                      }}
                      className="h-9 text-sm font-mono bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 rounded-lg" />
                    <Button variant="outline" size="sm" disabled={!bugId.trim() || !/^[A-Z]{2,10}-\d+$/.test(bugId.trim())}
                      onClick={() => {
                        if (bugId.trim() && !linkedBugs.find(b => b.id === bugId.trim())) {
                          setLinkedBugs(prev => [...prev, { id: bugId.trim(), title: bugTitle || null }]);
                        }
                        setBugId('');
                      }}
                      className="h-9 px-3 shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {bugFetching && <p className="text-[10px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Fetching...</p>}
                  {bugTitle && !bugFetching && bugId && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /><span className="truncate">{bugId} — {bugTitle}</span>
                    </div>
                  )}
                  {bugFetchError && !bugFetching && <p className="text-[10px] text-amber-600 flex items-center gap-1.5"><XCircle className="w-3 h-3" />{bugFetchError}</p>}
                </div>

                {/* Linked bugs list */}
                {linkedBugs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Linked Bugs ({linkedBugs.length})</label>
                    <div className="space-y-1">
                      {linkedBugs.map((bug, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/[0.06] border border-red-200 dark:border-red-500/20">
                          <Bug className="w-3 h-3 text-red-500 shrink-0" />
                          <span className="text-[11px] font-mono text-foreground flex-1 truncate">
                            {bug.id}{bug.title ? ` — ${bug.title}` : ''}
                          </span>
                          <button onClick={() => setLinkedBugs(prev => prev.filter((_, i) => i !== idx))}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-500/20">
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
                  <Textarea placeholder="What went wrong..." value={bugDesc} onChange={e => setBugDesc(e.target.value)}
                    rows={2} className="resize-none text-sm bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 rounded-lg focus:border-primary/40 min-h-0" />
                </div>
                {/* Create in Jira button */}
                {!jiraIssueKey ? (
                  <Button variant="outline" size="sm" onClick={() => setShowJiraForm(true)}
                    className="w-full h-9 text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                    <ExternalLink className="w-3.5 h-3.5" /> Create New Bug in Jira (Professional)
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200 dark:border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-semibold text-emerald-600">{jiraIssueKey} created</span>
                    {jiraIssueLink && <a href={jiraIssueLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline ml-auto">Open</a>}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Professional Jira Form */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Summary *</label>
                    <Input value={jiraSummary} onChange={e => setJiraSummary(e.target.value)}
                      className="h-9 text-sm bg-muted/50 border-border rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Severity</label>
                    <select value={jiraSeverity} onChange={e => setJiraSeverity(e.target.value)}
                      className="w-full h-9 text-sm bg-muted/50 border border-border rounded-lg px-2 text-foreground">
                      {jiraPriorities.length > 0 ? (
                        jiraPriorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                      ) : (
                        <>
                          <option value="Highest">P1 — Highest</option>
                          <option value="High">P2 — High</option>
                          <option value="Medium">P3 — Medium</option>
                          <option value="Low">P4 — Low</option>
                          <option value="Lowest">P5 — Lowest</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Environment</label>
                    <select value={jiraEnv} onChange={e => setJiraEnv(e.target.value)}
                      className="w-full h-9 text-sm bg-muted/50 border border-border rounded-lg px-2 text-foreground">
                      {jiraEnvironments.length > 0 ? (
                        jiraEnvironments.map(env => <option key={env} value={env}>{env}</option>)
                      ) : (
                        <>
                          <option value="Dev">Dev</option>
                          <option value="QA">QA</option>
                          <option value="Staging">Staging</option>
                          <option value="Preprod">Preprod</option>
                          <option value="UAT">UAT</option>
                          <option value="Production">Production</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Assignee</label>
                    <div className="relative">
                      <Input
                        placeholder="Search assignee..."
                        value={jiraAssigneeSearch}
                        onChange={e => { setJiraAssigneeSearch(e.target.value); setJiraAssignee(''); setAssigneeHighlight(-1); }}
                        onKeyDown={e => {
                          const filtered = jiraUsers.filter(u => u.displayName.toLowerCase().includes(jiraAssigneeSearch.toLowerCase())).slice(0, 8);
                          if (e.key === 'ArrowDown') { e.preventDefault(); setAssigneeHighlight(h => Math.min(h + 1, filtered.length - 1)); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setAssigneeHighlight(h => Math.max(h - 1, 0)); }
                          else if (e.key === 'Enter' && assigneeHighlight >= 0 && filtered[assigneeHighlight]) {
                            e.preventDefault();
                            setJiraAssignee(filtered[assigneeHighlight].accountId);
                            setJiraAssigneeSearch(filtered[assigneeHighlight].displayName);
                            setAssigneeHighlight(-1);
                          }
                        }}
                        className="h-9 text-sm bg-muted/50 border-border rounded-lg"
                      />
                      {jiraAssigneeSearch && !jiraAssignee && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                          {jiraUsers
                            .filter(u => u.displayName.toLowerCase().includes(jiraAssigneeSearch.toLowerCase()))
                            .slice(0, 8)
                            .map((u, idx) => (
                              <button key={u.accountId} type="button"
                                onClick={() => { setJiraAssignee(u.accountId); setJiraAssigneeSearch(u.displayName); setAssigneeHighlight(-1); }}
                                className={cn('w-full text-left px-3 py-2 text-xs transition-colors truncate', idx === assigneeHighlight ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                                {u.displayName}
                              </button>
                            ))}
                          {jiraUsers.filter(u => u.displayName.toLowerCase().includes(jiraAssigneeSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                          )}
                        </div>
                      )}
                      {jiraAssignee && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600">✓</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Existing in Live?</label>
                    <select value={jiraExistingInLive} onChange={e => setJiraExistingInLive(e.target.value)}
                      className="w-full h-9 text-sm bg-muted/50 border border-border rounded-lg px-2 text-foreground">
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="Not Checked">Not Checked</option>
                    </select>
                  </div>
                  {jiraComponents.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Team / Component</label>
                      <div className="relative">
                        <Input
                          placeholder="Search team..."
                          value={jiraComponentSearch}
                          onChange={e => { setJiraComponentSearch(e.target.value); setJiraComponent(''); setComponentHighlight(-1); }}
                          onKeyDown={e => {
                            const filtered = jiraComponents.filter(c => c.name.toLowerCase().includes(jiraComponentSearch.toLowerCase())).slice(0, 8);
                            if (e.key === 'ArrowDown') { e.preventDefault(); setComponentHighlight(h => Math.min(h + 1, filtered.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setComponentHighlight(h => Math.max(h - 1, 0)); }
                            else if (e.key === 'Enter' && componentHighlight >= 0 && filtered[componentHighlight]) {
                              e.preventDefault();
                              setJiraComponent(filtered[componentHighlight].id);
                              setJiraComponentSearch(filtered[componentHighlight].name);
                              setComponentHighlight(-1);
                            }
                          }}
                          className="h-9 text-sm bg-muted/50 border-border rounded-lg"
                        />
                        {jiraComponentSearch && !jiraComponent && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                            {jiraComponents
                              .filter(c => c.name.toLowerCase().includes(jiraComponentSearch.toLowerCase()))
                              .slice(0, 8)
                              .map((c, idx) => (
                                <button key={c.id} type="button"
                                  onClick={() => { setJiraComponent(c.id); setJiraComponentSearch(c.name); setComponentHighlight(-1); }}
                                  className={cn('w-full text-left px-3 py-2 text-xs transition-colors truncate', idx === componentHighlight ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                                  {c.name}
                                </button>
                              ))}
                            {jiraComponents.filter(c => c.name.toLowerCase().includes(jiraComponentSearch.toLowerCase())).length === 0 && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                            )}
                          </div>
                        )}
                        {jiraComponent && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600">✓</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Actual Result *</label>
                    <Textarea value={jiraActual} onChange={e => setJiraActual(e.target.value)} rows={2}
                      className="resize-none text-sm bg-muted/50 border-border rounded-lg min-h-0" />
                  </div>
                </div>
                {/* Preview */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Preview</p>
                  <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Platform:</span> {session.platformDetails.platformName} {session.platformDetails.appVersion ? `v${session.platformDetails.appVersion}` : ''}</p>
                  <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Module:</span> {tc?.testBed || 'General'}</p>
                  <p className="text-[11px] text-foreground"><span className="text-muted-foreground">Reported by:</span> {session.userName}</p>
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 px-5 py-3 border-t border-border flex justify-end gap-2">
            {showJiraForm && (
              <Button variant="ghost" size="sm" onClick={() => setShowJiraForm(false)} className="h-8 text-xs text-muted-foreground mr-auto">← Back</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFailOpen(false)} className="h-8 text-xs text-muted-foreground hover:text-foreground">Cancel</Button>
            {showJiraForm ? (
              <Button size="sm" disabled={jiraPushing || !jiraSummary}
                onClick={async () => {
                  setJiraPushing(true);
                  try {
                    const res = await fetch('/api/jira/create-issue', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: jiraSummary,
                        description: `Test case "${tc?.testCaseTitle}" failed during ${session.platformDetails.platformName} testing session.`,
                        stepsToReproduce: tc?.testSteps || '',
                        expectedResult: tc?.expectedResult || '',
                        actualResult: jiraActual,
                        severity: jiraSeverity,
                        platform: session.platformDetails.platformName,
                        appVersion: session.platformDetails.appVersion || '',
                        environment: jiraEnv,
                        existingInLive: jiraExistingInLive,
                        assigneeAccountId: jiraAssignee || undefined,
                        componentId: jiraComponent || undefined,
                        reportedByName: session.userName,
                        labels: ['zenit-session', tc?.testBed?.toLowerCase().replace(/\s+/g, '-') || 'general'],
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Jira error');
                    setJiraIssueKey(data.issueKey); setJiraIssueLink(data.issueLink); setBugId(data.issueKey);
                    setLinkedBugs(prev => [...prev, { id: data.issueKey, title: jiraSummary }]);
                    setShowJiraForm(false);
                    toast({ title: `${data.issueKey} created in Jira` });
                  } catch (e: any) { toast({ title: 'Jira Error', description: e.message, variant: 'destructive' }); }
                  finally { setJiraPushing(false); }
                }}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-white border-0 rounded-lg px-4">
                {jiraPushing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
                Create Issue
              </Button>
            ) : (
              <Button size="sm"
                onClick={() => markStatus('Fail', { bugId: bugId || linkedBugs[0]?.id || undefined, bugDesc: bugDesc || undefined, bugTitle: bugTitle || undefined, linkedBugs: linkedBugs.map(b => b.id) })}
                className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0 rounded-lg px-4">
                Confirm Fail
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── N/A Dialog ─── */}
      <Dialog open={naOpen} onOpenChange={v => { setNaOpen(v); if (!v) setNaReason(''); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border text-foreground max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Skip Test Case</DialogTitle>
            <DialogDescription className="text-muted-foreground">Why is this not applicable?</DialogDescription>
          </DialogHeader>
          {naOpen && (
            <Select value={naReason} onValueChange={setNaReason}>
              <SelectTrigger className="bg-muted/50 border-border text-foreground rounded-xl">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {naReasonOptions.map(r => (
                  <SelectItem key={r} value={r} className="text-foreground/70 focus:text-foreground focus:bg-muted">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNaOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</Button>
            <Button size="sm" disabled={!naReason}
              onClick={() => markStatus('N/A', { naReason })}
              className="bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg disabled:opacity-30">
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Complete Dialog ─── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border text-foreground max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {untestedCount === 0 ? 'Session Complete' : 'End Session?'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {untestedCount === 0
                ? 'All cases executed. Generate the report.'
                : `${untestedCount} cases remain untested.`}
            </DialogDescription>
          </DialogHeader>
          {untestedCount > 0 && (
            <Select onValueChange={setIncompleteReason}>
              <SelectTrigger className="bg-muted/50 border-border text-foreground rounded-xl">
                <SelectValue placeholder="Reason..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {incompleteReasonOptions.map(r => (
                  <SelectItem key={r} value={r} className="text-foreground/70 focus:text-foreground focus:bg-muted">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCompleteOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</Button>
            <Button size="sm" onClick={() => handleComplete(incompleteReason)}
              disabled={untestedCount > 0 && !incompleteReason}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-lg">
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Session Team (invite / assign / claim) ─── */}
      <SessionTeamDialog
        open={teamOpen}
        onOpenChange={setTeamOpen}
        testers={session.testers || []}
        cases={session.testCases}
        currentUid={myUid}
        currentName={myName}
        canManage={canManage}
        onInvite={inviteTester}
        onRemove={removeTesterCb}
        onAssignRange={assignRange}
        onUnassignRange={unassignRange}
        onEvenSplit={evenSplit}
        onClaimNext={claimNext}
      />
    </div>
  );
}
