"use client";

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import type { TestCase, UserProfile } from '@/types';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Trash2, Shuffle, Hand, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarBg } from '@/components/leads/shared';
import type { SessionTester } from '@/lib/session-collab';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  testers: SessionTester[];
  cases: TestCase[];
  currentUid: string;
  currentName: string;
  canManage: boolean;
  onInvite: (tester: SessionTester) => Promise<void> | void;
  onRemove: (uid: string) => Promise<void> | void;
  onAssignRange: (start: number, end: number, tester: SessionTester) => Promise<void> | void;
  onUnassignRange: (start: number, end: number) => Promise<void> | void;
  onEvenSplit: () => Promise<void> | void;
  onClaimNext: () => Promise<void> | void;
}

export function SessionTeamDialog({
  open, onOpenChange, testers, cases, currentUid, currentName,
  canManage, onInvite, onRemove, onAssignRange, onUnassignRange, onEvenSplit, onClaimNext,
}: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addUid, setAddUid] = useState('');
  const [assignUid, setAssignUid] = useState('');
  const [startRange, setStartRange] = useState('1');
  const [endRange, setEndRange] = useState('');

  const total = cases.length;

  useEffect(() => {
    if (!open || !canManage || users.length > 0) return;
    setLoadingUsers(true);
    getDocs(collection(db, 'users'))
      .then(snap => setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as UserProfile))))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [open, canManage, users.length]);

  // Reset transient inputs when the dialog closes.
  useEffect(() => {
    if (!open) { setAddUid(''); setAssignUid(''); setStartRange('1'); setEndRange(''); setBusy(false); }
  }, [open]);

  const testerIds = useMemo(() => new Set(testers.map(t => t.uid)), [testers]);
  const addable = users.filter(u => u.uid && !testerIds.has(u.uid));

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const start = Math.max(1, parseInt(startRange || '1', 10) || 1);
  const end = endRange ? Math.max(1, parseInt(endRange, 10) || 1) : total;
  const rangeCount = Math.max(0, Math.min(total, end) - Math.max(1, start) + 1);

  const assignTarget = testers.find(t => t.uid === assignUid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Session Team
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Invite testers and split the {total} cases. Everyone edits one shared session live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Testers ── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Testers ({testers.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                {cases.filter(c => !c.assignedToUid).length} unassigned
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', getAvatarBg(currentName))}>
                  {currentName.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{currentName}</span>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">You{canManage ? ' · Owner' : ''}</Badge>
              </div>

              {testers.map(t => (
                <div key={t.uid} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                  <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', getAvatarBg(t.name))}>
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {cases.filter(c => c.assignedToUid === t.uid).length} cases
                  </span>
                  {canManage && (
                    <Button variant="ghost" size="icon" disabled={busy}
                      onClick={() => run(() => onRemove(t.uid))}
                      className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <div className="flex items-center gap-2 pt-1">
                <Select value={addUid} onValueChange={setAddUid}>
                  <SelectTrigger className="h-9 text-sm bg-muted/50 border-border rounded-lg flex-1">
                    <SelectValue placeholder={loadingUsers ? 'Loading users…' : 'Add a tester…'} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {addable.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No users to add</div>
                    ) : addable.map(u => (
                      <SelectItem key={u.uid} value={u.uid} className="text-foreground/80 focus:text-foreground">
                        {u.displayName || u.email || u.uid}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={busy || !addUid} className="h-9 text-xs gap-1.5"
                  onClick={() => {
                    const u = users.find(x => x.uid === addUid);
                    if (!u) return;
                    run(async () => {
                      await onInvite({ uid: u.uid, name: u.displayName || u.email || u.uid });
                      setAddUid('');
                    });
                  }}>
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            )}
          </section>

          {/* ── Assign ranges (owner/lead only) ── */}
          {canManage && (
            <section className="space-y-2 border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign a range</h4>
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Tester</label>
                  <Select value={assignUid} onValueChange={setAssignUid}>
                    <SelectTrigger className="h-9 text-sm bg-muted/50 border-border rounded-lg">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value={currentUid} className="text-foreground/80 focus:text-foreground">{currentName} (you)</SelectItem>
                      {testers.map(t => (
                        <SelectItem key={t.uid} value={t.uid} className="text-foreground/80 focus:text-foreground">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-16">
                  <label className="text-[10px] text-muted-foreground">From</label>
                  <Input inputMode="numeric" value={startRange} onChange={e => setStartRange(e.target.value)}
                    className="h-9 text-sm bg-muted/50 border-border rounded-lg text-center" />
                </div>
                <div className="space-y-1 w-16">
                  <label className="text-[10px] text-muted-foreground">To</label>
                  <Input inputMode="numeric" value={endRange} onChange={e => setEndRange(e.target.value)}
                    placeholder={String(total)} className="h-9 text-sm bg-muted/50 border-border rounded-lg text-center" />
                </div>
                <Button size="sm" disabled={busy || !assignTarget || rangeCount <= 0} className="h-9 text-xs"
                  onClick={() => assignTarget && run(() => onAssignRange(start, end, assignTarget))}>
                  Assign
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={busy || testers.length === 0} className="h-8 text-xs gap-1.5"
                  onClick={() => run(() => onEvenSplit())}>
                  <Shuffle className="w-3.5 h-3.5" /> Split evenly
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => run(() => onUnassignRange(start, end))}>
                  Clear {start}–{end}
                </Button>
                <span className="text-[10px] text-muted-foreground ml-auto">{rangeCount} case{rangeCount === 1 ? '' : 's'}</span>
              </div>
            </section>
          )}

          {/* ── Self-claim ── */}
          <section className="border-t border-border pt-4">
            <Button variant="outline" size="sm" disabled={busy} className="w-full h-9 text-xs gap-1.5"
              onClick={() => run(() => onClaimNext())}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hand className="w-3.5 h-3.5" />}
              Claim next unassigned case
            </Button>
          </section>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
