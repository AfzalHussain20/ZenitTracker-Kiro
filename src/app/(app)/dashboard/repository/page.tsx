"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, getDocs, orderBy, doc, setDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { TestCase, TestSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Upload, Play, Trash2, Search, FileSpreadsheet,
  Layers, Calendar, Users, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface TestSuite {
  id: string;
  name: string;
  platform: string;
  testBeds: string[];
  totalCases: number;
  uploadedBy: string;
  uploadedByUid: string;
  createdAt: Date;
  testCases: Omit<TestCase, 'id' | 'lastModified'>[];
}

export default function RepositoryPage() {
  const { user, displayName, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addModule, setAddModule] = useState('');
  const [addSteps, setAddSteps] = useState('');
  const [addExpected, setAddExpected] = useState('');

  // Fetch all suites
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'testSuites'), orderBy('createdAt', 'desc')));
        setSuites(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() } as TestSuite;
        }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user, authLoading]);

  // Upload XLSX as a new suite
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const cases = rows.map((row, idx) => ({
        orderIndex: idx,
        testBed: String(row['Test Bed'] || row['testBed'] || 'General'),
        testCaseTitle: String(row['Test Case'] || row['testCaseTitle'] || `Test Case ${idx + 1}`),
        testSteps: String(row['Test Steps'] || row['testSteps'] || ''),
        expectedResult: String(row['Expected Result'] || row['expectedResult'] || ''),
        actualResult: '', notes: '', status: 'Untested' as const,
        priority: (row['Priority'] as 'High' | 'Medium' | 'Low') || 'Medium',
      }));

      const testBeds = [...new Set(cases.map(c => c.testBed))];
      const suiteName = file.name.replace(/\.(xlsx|xls)$/i, '');
      const suiteRef = doc(collection(db, 'testSuites'));

      await setDoc(suiteRef, {
        id: suiteRef.id,
        name: suiteName,
        platform: 'All',
        testBeds,
        totalCases: cases.length,
        uploadedBy: displayName || user.email?.split('@')[0] || 'User',
        uploadedByUid: user.uid,
        createdAt: Timestamp.now(),
        testCases: cases,
      });

      toast({ title: 'Suite uploaded', description: `${cases.length} test cases stored in repository.` });
      // Refresh
      const snap = await getDocs(query(collection(db, 'testSuites'), orderBy('createdAt', 'desc')));
      setSuites(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as TestSuite)));
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); e.target.value = ''; }
  };

  // Launch session from suite
  const launchSession = async (suite: TestSuite) => {
    if (!user) return;
    const platform = suite.platform !== 'All' ? suite.platform : prompt('Enter platform (e.g., Android TV, Fire TV, Web):') || 'Other';
    try {
      const sessionsCol = collection(db, 'sessions');
      const sessionRef = doc(sessionsCol);
      const now = Timestamp.now();
      const testCases: TestCase[] = suite.testCases.map((tc, i) => ({
        ...tc, id: `${sessionRef.id}-tc-${i}`, lastModified: now, status: 'Untested',
        actualResult: '', notes: '', bugId: undefined, bugTitle: undefined, naReason: undefined,
      }));
      const session: TestSession = {
        id: sessionRef.id, userId: user.uid,
        userName: displayName || user.email?.split('@')[0] || 'Tester',
        platformDetails: { platformName: platform as any },
        testCases, status: 'In Progress',
        createdAt: now, updatedAt: now,
        summary: { total: testCases.length, pass: 0, fail: 0, na: 0, untested: testCases.length, failKnown: 0 },
      };
      await setDoc(sessionRef, session);
      toast({ title: 'Session launched', description: `${testCases.length} test cases loaded.` });
      router.push(`/dashboard/session/${sessionRef.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Delete suite
  const deleteSuite = async (id: string) => {
    if (!confirm('Delete this test suite?')) return;
    try {
      await deleteDoc(doc(db, 'testSuites', id));
      setSuites(s => s.filter(x => x.id !== id));
      toast({ title: 'Suite deleted' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const filtered = suites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.testBeds.some(b => b.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading || authLoading) return (
    <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Repository</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{suites.length} test suites · Available for all team members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddForm(v => !v)} className="gap-2 text-sm">
            + Add Case
          </Button>
          <label className="cursor-pointer">
            <Button disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload XLSX
            </Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {/* Quick Add Form */}
      {showAddForm && (
        <Card className="p-4 space-y-3 border-primary/20">
          <p className="text-sm font-semibold">Add Test Case</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Test Case Title *" value={addTitle} onChange={e => setAddTitle(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Module / Test Bed" value={addModule} onChange={e => setAddModule(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Test Steps (one per line)" value={addSteps} onChange={e => setAddSteps(e.target.value)} className="h-9 text-sm col-span-full" />
            <Input placeholder="Expected Result" value={addExpected} onChange={e => setAddExpected(e.target.value)} className="h-9 text-sm col-span-full" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!addTitle} onClick={async () => {
              if (!user || !addTitle) return;
              try {
                // Find or create "Manual Cases" suite
                const manualSuiteQuery = suites.find(s => s.name === 'Manual Cases' && s.uploadedByUid === user.uid);
                if (manualSuiteQuery) {
                  // Add to existing suite (re-save entire doc with new case appended)
                  const updated = [...manualSuiteQuery.testCases, {
                    orderIndex: manualSuiteQuery.totalCases,
                    testBed: addModule || 'General', testCaseTitle: addTitle,
                    testSteps: addSteps, expectedResult: addExpected,
                    actualResult: '', notes: '', status: 'Untested' as const, priority: 'Medium' as const,
                  }];
                  const ref = doc(db, 'testSuites', manualSuiteQuery.id);
                  await updateDoc(ref, { testCases: updated, totalCases: updated.length, testBeds: [...new Set(updated.map(c => c.testBed))] });
                } else {
                  // Create new "Manual Cases" suite
                  const ref = doc(collection(db, 'testSuites'));
                  await setDoc(ref, {
                    id: ref.id, name: 'Manual Cases', platform: 'All',
                    testBeds: [addModule || 'General'], totalCases: 1,
                    uploadedBy: displayName || 'User', uploadedByUid: user.uid,
                    createdAt: Timestamp.now(),
                    testCases: [{ orderIndex: 0, testBed: addModule || 'General', testCaseTitle: addTitle, testSteps: addSteps, expectedResult: addExpected, actualResult: '', notes: '', status: 'Untested', priority: 'Medium' }],
                  });
                }
                toast({ title: 'Test case added' });
                setAddTitle(''); setAddModule(''); setAddSteps(''); setAddExpected(''); setShowAddForm(false);
                // Refresh
                const snap = await getDocs(query(collection(db, 'testSuites'), orderBy('createdAt', 'desc')));
                setSuites(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() } as TestSuite)));
              } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
            }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suites..." className="pl-9 h-9 rounded-lg" />
      </div>

      {/* Suites List */}
      <div className="space-y-3">
        {filtered.map((suite, i) => (
          <motion.div key={suite.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{suite.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{suite.totalCases} cases</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{suite.uploadedBy}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(suite.createdAt, 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {suite.testBeds.slice(0, 4).map(bed => (
                      <Badge key={bed} variant="outline" className="text-[9px] px-1.5 py-0">{bed}</Badge>
                    ))}
                    {suite.testBeds.length > 4 && <Badge variant="outline" className="text-[9px]">+{suite.testBeds.length - 4}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => launchSession(suite)} className="gap-1.5 text-xs">
                    <Play className="w-3 h-3" /> Execute
                  </Button>
                  {suite.uploadedByUid === user?.uid && (
                    <Button size="sm" variant="ghost" onClick={() => deleteSuite(suite.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No test suites yet. Upload an XLSX to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
