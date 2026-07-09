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
import { Card } from '@/components/ui/card';
import {
  Loader2, ArrowRight, Search, Calendar, Clock, CheckCircle2,
  XCircle, ArrowLeft, Filter, Download
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 rounded-lg shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Session History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{sessions.length} total sessions</p>
          </div>
        </div>
        <Button asChild><Link href="/dashboard/new-session">+ New Session</Link></Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by platform or tester..."
            className="pl-9 h-9 rounded-lg" />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['all', 'In Progress', 'Completed', 'Aborted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        {filtered.map((s, i) => {
          const summary = s.summary || { pass: 0, fail: 0, na: 0, total: s.testCases?.length || 0, failKnown: 0 };
          const total = summary.total || s.testCases?.length || 0;
          const executed = summary.pass + summary.fail + (summary.failKnown || 0) + summary.na;
          const rate = total > 0 ? Math.round((summary.pass / total) * 100) : 0;
          const created = getValidDate(s.createdAt);
          const completed = getValidDate(s.completedAt);
          const canContinue = s.status === 'In Progress' || s.status === 'Aborted';

          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className="p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4">
                  {/* Platform + Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{s.platformDetails?.platformName || 'Unknown'}</p>
                      <Badge className={cn('text-[9px]',
                        s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                        s.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                      )}>{s.status}</Badge>
                      {s.platformDetails?.appVersion && <span className="text-[10px] text-muted-foreground">v{s.platformDetails.appVersion}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {created && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(created, 'MMM dd, h:mm a')}</span>}
                      {completed && created && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceStrict(completed, created)}</span>}
                      <span>{s.userName}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-3 text-xs tabular-nums">
                    <div className="text-center">
                      <p className="font-bold text-emerald-600">{summary.pass}</p>
                      <p className="text-[9px] text-muted-foreground">Pass</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-red-600">{summary.fail + (summary.failKnown || 0)}</p>
                      <p className="text-[9px] text-muted-foreground">Fail</p>
                    </div>
                    <div className="text-center">
                      <p className={cn('font-bold', rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600')}>{rate}%</p>
                      <p className="text-[9px] text-muted-foreground">Rate</p>
                    </div>
                  </div>

                  {/* Action */}
                  <Button variant="outline" size="sm" className="text-xs shrink-0" asChild>
                    <Link href={canContinue ? `/dashboard/session/${s.id}` : `/dashboard/session/${s.id}/results`}>
                      {canContinue ? 'Continue' : 'Report'} <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No sessions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
