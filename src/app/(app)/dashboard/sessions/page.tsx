"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { TestSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ArrowRight, Search, Calendar, Clock,
  CheckCircle2, XCircle, ArrowLeft, Plus
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const getValidDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

export default function SessionHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'In Progress' | 'Completed' | 'Aborted'>('all');

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      setLoading(true);
      try {
        const [s1, s2] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'testSessions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))),
        ]);
        const map = new Map<string, TestSession>();
        [...s1.docs, ...s2.docs].forEach(doc => {
          if (map.has(doc.id)) return;
          const data = doc.data();
          map.set(doc.id, { id: doc.id, ...data, createdAt: getValidDate(data.createdAt), completedAt: getValidDate(data.completedAt), testCases: data.testCases || [] } as TestSession);
        });
        setSessions(Array.from(map.values()).sort((a, b) => {
          const da = getValidDate(a.createdAt)?.getTime() || 0;
          const db2 = getValidDate(b.createdAt)?.getTime() || 0;
          return db2 - da;
        }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user, authLoading]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const matchSearch = !search || s.platformDetails?.platformName?.toLowerCase().includes(search.toLowerCase()) || s.userName?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [sessions, search, statusFilter]);

  if (loading || authLoading) return (
    <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Sessions</h1>
            <p className="text-xs text-muted-foreground">{sessions.length} total</p>
          </div>
        </div>
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/dashboard/new-session"><Plus className="w-3.5 h-3.5" />New</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search platform or tester..."
            className="pl-9 h-8 text-xs rounded-lg" />
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {(['all', 'In Progress', 'Completed', 'Aborted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors',
                statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {s === 'all' ? 'All' : s === 'In Progress' ? 'Active' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Platform</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Results</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const summary = s.summary || { pass: 0, fail: 0, na: 0, total: s.testCases?.length || 0, failKnown: 0 };
              const total = summary.total || s.testCases?.length || 0;
              const rate = total > 0 ? Math.round((summary.pass / total) * 100) : 0;
              const created = getValidDate(s.createdAt);
              const completed = getValidDate(s.completedAt);
              const canContinue = s.status === 'In Progress' || s.status === 'Aborted';

              return (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-2 h-2 rounded-full shrink-0',
                        s.status === 'Completed' ? 'bg-emerald-500' : s.status === 'In Progress' ? 'bg-blue-500' : 'bg-amber-500')} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.platformDetails?.platformName || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.platformDetails?.appVersion ? `v${s.platformDetails.appVersion}` : ''} {s.userName && `· ${s.userName}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <p className="text-xs text-muted-foreground">{created ? format(created, 'MMM dd, h:mm a') : '—'}</p>
                    {completed && created && <p className="text-[10px] text-muted-foreground/60">{formatDistanceStrict(completed, created)}</p>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge className={cn('text-[9px] px-1.5',
                      s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                      s.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    )}>{s.status === 'In Progress' ? 'Active' : s.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-[11px] tabular-nums">
                      <span className="text-emerald-600 font-semibold">{summary.pass}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="text-red-600 font-semibold">{summary.fail + (summary.failKnown || 0)}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className={cn('font-bold', rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={canContinue ? `/dashboard/session/${s.id}` : `/dashboard/session/${s.id}/results`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                      {canContinue ? 'Continue' : 'Report'}<ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No sessions found</div>
        )}
      </div>
    </div>
  );
}
