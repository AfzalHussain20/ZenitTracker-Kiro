"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Platform, PlatformDetails, TestCase, TestSession } from '@/types';
import { db } from '@/lib/firebaseConfig';
import { doc, collection, setDoc, Timestamp } from 'firebase/firestore';
import {
  Loader2, UploadCloud, ChevronRight, CheckCircle2,
  Rocket, Tv, Smartphone, Monitor, Globe, Gamepad2,
  Laptop, ArrowLeft, FileSpreadsheet, X, Sparkles, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const platformOptions: Platform[] = [
  "Android TV", "Apple TV", "Fire TV", "LG TV", "Samsung TV",
  "Roku", "Web", "Mobile (Android)", "Mobile (iOS)", "Other"
];

const platformDetailsSchema = z.object({
  platformName: z.custom<Platform>(val => platformOptions.includes(val as Platform), { message: "Select a platform" }),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  browserName: z.string().optional(),
  browserVersion: z.string().optional(),
  customPlatformName: z.string().optional(),
}).refine(data => data.platformName !== "Other" || (data.customPlatformName && data.customPlatformName.trim() !== ''), {
  message: "Custom platform name required.",
  path: ["customPlatformName"],
});

type PlatformFormValues = z.infer<typeof platformDetailsSchema>;

const getPlatformIcon = (p: string) => {
  if (["Android TV", "LG TV", "Samsung TV", "Fire TV"].includes(p)) return Tv;
  if (p === "Apple TV") return Monitor;
  if (p === "Roku") return Gamepad2;
  if (p === "Web") return Laptop;
  if (["Mobile (Android)", "Mobile (iOS)"].includes(p)) return Smartphone;
  return Globe;
};

const PLATFORM_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  "Android TV": { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-600' },
  "Apple TV": { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', icon: 'text-slate-600' },
  "Fire TV": { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-600' },
  "LG TV": { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', icon: 'text-red-600' },
  "Samsung TV": { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-600' },
  "Roku": { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-600' },
  "Web": { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', icon: 'text-cyan-600' },
  "Mobile (Android)": { bg: 'bg-lime-50 dark:bg-lime-950/30', border: 'border-lime-200 dark:border-lime-800', text: 'text-lime-700 dark:text-lime-300', icon: 'text-lime-600' },
  "Mobile (iOS)": { bg: 'bg-gray-50 dark:bg-gray-950/30', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: 'text-gray-600' },
  "Other": { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-300', icon: 'text-pink-600' },
};

const STEPS = ['Platform', 'Test Cases', 'Review'];

export default function NewTestSessionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, displayName } = useAuth();

  const [step, setStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PlatformFormValues>({
    resolver: zodResolver(platformDetailsSchema),
  });
  const watchedPlatform = watch('platformName');

  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [parsedTestCases, setParsedTestCases] = useState<Omit<TestCase, 'id' | 'lastModified'>[]>([]);
  const [testBeds, setTestBeds] = useState<string[]>([]);
  const [selectedTestBed, setSelectedTestBed] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [platformDetails, setPlatformDetails] = useState<PlatformDetails | null>(null);

  const handlePlatformSubmit = (data: PlatformFormValues) => {
    setPlatformDetails(data as PlatformDetails);
    setStep(2);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxFile(file);
    setIsParsingFile(true);
    setParsedTestCases([]); setTestBeds([]); setSelectedTestBed(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const cases: Omit<TestCase, 'id' | 'lastModified'>[] = rows.map((row, idx) => ({
        orderIndex: idx,
        testBed: String(row['Test Bed'] || row['testBed'] || 'General'),
        testCaseTitle: String(row['Test Case'] || row['testCaseTitle'] || `Test Case ${idx + 1}`),
        testSteps: String(row['Test Steps'] || row['testSteps'] || ''),
        expectedResult: String(row['Expected Result'] || row['expectedResult'] || ''),
        actualResult: '', notes: '', status: 'Untested',
        priority: (row['Priority'] as TestCase['priority']) || 'Medium',
      }));
      const beds = [...new Set(cases.map(c => c.testBed))];
      setParsedTestCases(cases); setTestBeds(beds);
      if (beds.length === 1) setSelectedTestBed(beds[0]);
    } catch {
      toast({ title: 'Parse Error', description: 'Could not read the XLSX file.', variant: 'destructive' });
    } finally { setIsParsingFile(false); }
  };

  const handleCreateSession = async () => {
    if (!user || !platformDetails || !db) return;
    setIsCreating(true);
    try {
      const filteredCases = selectedTestBed
        ? parsedTestCases.filter(c => c.testBed === selectedTestBed)
        : parsedTestCases;
      const sessionsCol = collection(db, 'sessions');
      const sessionRef = doc(sessionsCol);
      const now = Timestamp.now();
      const testCasesWithIds: TestCase[] = filteredCases.map((tc, i) => ({
        ...tc, id: `${sessionRef.id}-tc-${i}`, lastModified: now,
      }));
      const session: TestSession = {
        id: sessionRef.id, userId: user.uid,
        userName: displayName || user.email?.split('@')[0] || 'Tester',
        platformDetails, testCases: testCasesWithIds, status: 'In Progress',
        createdAt: now, updatedAt: now,
        summary: { total: testCasesWithIds.length, pass: 0, fail: 0, na: 0, untested: testCasesWithIds.length, failKnown: 0 },
      };
      await setDoc(sessionRef, session);

      // Also save to Test Repository (library) for future re-use
      if (xlsxFile) {
        try {
          const suiteRef = doc(collection(db, 'testSuites'));
          const suiteName = xlsxFile.name.replace(/\.(xlsx|xls)$/i, '');
          await setDoc(suiteRef, {
            id: suiteRef.id,
            name: suiteName,
            platform: platformDetails.platformName,
            testBeds: [...new Set(filteredCases.map(c => c.testBed))],
            totalCases: filteredCases.length,
            uploadedBy: displayName || user.email?.split('@')[0] || 'User',
            uploadedByUid: user.uid,
            createdAt: now,
            testCases: filteredCases,
          });
        } catch { /* Silent — don't block session creation if library save fails */ }
      }

      toast({ title: 'Session created', description: `${testCasesWithIds.length} test cases loaded.` });
      router.push(`/dashboard/session/${sessionRef.id}`);
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message || 'Could not create session.', variant: 'destructive' });
      setIsCreating(false);
    }
  };

  const caseCount = selectedTestBed
    ? parsedTestCases.filter(c => c.testBed === selectedTestBed).length
    : parsedTestCases.length;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-muted/30 flex flex-col overflow-hidden">

      {/* ── Minimal Header ── */}
      <header className="shrink-0 h-16 flex items-center px-6 z-10">
        <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/dashboard')}
          className="h-9 w-9 rounded-xl shrink-0 hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1" />

        {/* Step indicator — minimal dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => {
            const s = i + 1;
            const done = s < step;
            const active = s === step;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300',
                  done ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : active ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 text-center">{s}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-8 h-px transition-colors', done ? 'bg-emerald-400' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="w-9" /> {/* Spacer to balance the back button */}
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">

            {/* ══════ STEP 1: Platform Selection ══════ */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8">
                <form onSubmit={handleSubmit(handlePlatformSubmit)} className="space-y-8">

                  {/* Hero */}
                  <div className="text-center space-y-2">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                      className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Choose Platform</h1>
                    <p className="text-sm text-muted-foreground">What are you testing today?</p>
                  </div>

                  {/* Platform grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {platformOptions.map((p, idx) => {
                      const Icon = getPlatformIcon(p);
                      const selected = watchedPlatform === p;
                      const colors = PLATFORM_COLORS[p];
                      return (
                        <motion.button key={p} type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          onClick={() => { setValue('platformName', p); setSelectedPlatform(p); }}
                          className={cn(
                            'relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200',
                            selected
                              ? cn(colors.bg, colors.border, 'shadow-sm scale-[1.02]')
                              : 'border-border bg-card hover:border-muted-foreground/20 hover:shadow-sm hover:scale-[1.01]'
                          )}>
                          {selected && (
                            <motion.div layoutId="platform-check"
                              className="absolute top-2 right-2">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            </motion.div>
                          )}
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                            selected ? cn(colors.bg, colors.border, 'border') : 'bg-muted border border-border')}>
                            <Icon className={cn('w-5 h-5', selected ? colors.icon : 'text-muted-foreground')} />
                          </div>
                          <span className={cn('text-xs font-medium', selected ? colors.text : 'text-foreground')}>{p}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  {errors.platformName && <p className="text-destructive text-xs text-center">{errors.platformName.message}</p>}

                  {/* Platform details — collapsible section */}
                  <AnimatePresence>
                    {watchedPlatform && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden">
                        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Details</p>
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">optional</span>
                          </div>
                          {watchedPlatform === 'Other' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Custom Platform Name *</Label>
                              <Input {...register('customPlatformName')} placeholder="e.g. Smart Fridge OS" className="rounded-xl h-10" />
                              {errors.customPlatformName && <p className="text-destructive text-xs">{errors.customPlatformName.message}</p>}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground">Device Model</Label>
                              <Input {...register('deviceModel')} placeholder="e.g. Mi Box 4K" className="rounded-xl h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground">OS Version</Label>
                              <Input {...register('osVersion')} placeholder="e.g. Android 12" className="rounded-xl h-9 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-muted-foreground">App Version</Label>
                              <Input {...register('appVersion')} placeholder="e.g. 5.1.3" className="rounded-xl h-9 text-sm" />
                            </div>
                            {watchedPlatform === 'Web' && (
                              <>
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] text-muted-foreground">Browser</Label>
                                  <Input {...register('browserName')} placeholder="e.g. Chrome" className="rounded-xl h-9 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] text-muted-foreground">Browser Version</Label>
                                  <Input {...register('browserVersion')} placeholder="e.g. 126" className="rounded-xl h-9 text-sm" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Continue button */}
                  <Button type="submit" disabled={!watchedPlatform}
                    className="w-full h-12 rounded-2xl font-semibold text-sm gap-2 shadow-sm transition-all disabled:opacity-40">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ══════ STEP 2: Upload Test Cases ══════ */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8">

                {/* Hero */}
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                    className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Upload Test Cases</h1>
                  <p className="text-sm text-muted-foreground">Import your test suite from an Excel file</p>
                </div>

                {/* Drop zone */}
                <label className={cn(
                  'group relative flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300',
                  xlsxFile
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5'
                )}>
                  <motion.div
                    animate={isParsingFile ? { rotate: 360 } : {}}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className={cn('w-16 h-16 rounded-2xl flex items-center justify-center border transition-all',
                      xlsxFile
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800'
                        : 'bg-muted border-border group-hover:bg-primary/10 group-hover:border-primary/20'
                    )}>
                    {isParsingFile
                      ? <Loader2 className="w-7 h-7 text-primary animate-spin" />
                      : xlsxFile
                        ? <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        : <UploadCloud className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />}
                  </motion.div>
                  <div className="text-center">
                    {xlsxFile ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">{xlsxFile.name}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                          {isParsingFile ? 'Parsing file...' : `✓ ${parsedTestCases.length} test cases found`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">Drop your XLSX file here</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          or click to browse · Columns: <span className="font-mono text-[10px]">Test Bed, Test Case, Test Steps, Expected Result</span>
                        </p>
                      </>
                    )}
                  </div>
                  {xlsxFile && !isParsingFile && (
                    <button type="button" onClick={(e) => { e.preventDefault(); setXlsxFile(null); setParsedTestCases([]); setTestBeds([]); }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>

                {/* Test bed selector */}
                <AnimatePresence>
                  {testBeds.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">Choose Test Bed</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {parsedTestCases.length} total
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setSelectedTestBed(null)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                            !selectedTestBed ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/20'
                          )}>
                          <div>
                            <p className="text-xs font-semibold text-foreground">All Beds</p>
                            <p className="text-[10px] text-muted-foreground">{parsedTestCases.length} cases</p>
                          </div>
                          {!selectedTestBed && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </button>
                        {testBeds.map(bed => {
                          const count = parsedTestCases.filter(c => c.testBed === bed).length;
                          const selected = selectedTestBed === bed;
                          return (
                            <button key={bed} type="button" onClick={() => setSelectedTestBed(bed)}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                                selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/20'
                              )}>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{bed}</p>
                                <p className="text-[10px] text-muted-foreground">{count} cases</p>
                              </div>
                              {selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-2xl font-medium">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!xlsxFile || parsedTestCases.length === 0}
                    className="flex-1 h-12 rounded-2xl font-semibold gap-2 shadow-sm disabled:opacity-40">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ══════ STEP 3: Review & Launch ══════ */}
            {step === 3 && platformDetails && (
              <motion.div key="step3"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-8">

                {/* Hero */}
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                    className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Ready to Launch</h1>
                  <p className="text-sm text-muted-foreground">Review your session before starting</p>
                </div>

                {/* Summary card */}
                <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                  {[
                    { label: 'Platform', value: platformDetails.platformName === 'Other' ? platformDetails.customPlatformName : platformDetails.platformName, icon: getPlatformIcon(platformDetails.platformName) },
                    platformDetails.deviceModel ? { label: 'Device', value: platformDetails.deviceModel } : null,
                    platformDetails.appVersion ? { label: 'App Version', value: `v${platformDetails.appVersion}` } : null,
                    { label: 'Test Bed', value: selectedTestBed || 'All beds' },
                    { label: 'Test Cases', value: String(caseCount), highlight: true },
                    { label: 'Tester', value: displayName || user?.email?.split('@')[0] || 'Tester' },
                  ].filter(Boolean).map((row, i, arr) => (
                    <motion.div key={row!.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn('flex items-center justify-between px-5 py-4', i < arr.length - 1 ? 'border-b border-border/60' : '')}>
                      <span className="text-sm text-muted-foreground">{row!.label}</span>
                      <span className={cn('text-sm font-semibold', row!.highlight ? 'text-primary text-base' : 'text-foreground')}>
                        {row!.value}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Test case preview */}
                {caseCount > 0 && (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preview — First 3 cases</p>
                    {(selectedTestBed ? parsedTestCases.filter(c => c.testBed === selectedTestBed) : parsedTestCases)
                      .slice(0, 3).map((tc, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border/50">
                          <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                          <p className="text-xs text-foreground truncate">{tc.testCaseTitle}</p>
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                            tc.priority === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                            tc.priority === 'Medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          )}>{tc.priority}</span>
                        </div>
                      ))}
                    {caseCount > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center pt-1">+{caseCount - 3} more cases</p>
                    )}
                  </div>
                )}

                {/* Launch button */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} disabled={isCreating}
                    className="flex-1 h-12 rounded-2xl font-medium">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={handleCreateSession} disabled={isCreating}
                    className="flex-[2] h-12 rounded-2xl font-semibold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 transition-all">
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {isCreating ? 'Launching...' : 'Launch Session'}
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
