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
  Laptop, ArrowLeft, FileSpreadsheet, X
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

const PLATFORM_COLORS: Record<string, string> = {
  "Android TV": "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400",
  "Apple TV": "bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400",
  "Fire TV": "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
  "LG TV": "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
  "Samsung TV": "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
  "Roku": "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
  "Web": "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
  "Mobile (Android)": "bg-lime-500/10 border-lime-500/30 text-lime-600 dark:text-lime-400",
  "Mobile (iOS)": "bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400",
  "Other": "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400",
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
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur-md flex items-center px-4 md:px-6 gap-4 z-10">
        <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/dashboard')}
          className="h-9 w-9 rounded-xl shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">New Test Session</p>
          <p className="text-[11px] text-muted-foreground">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
        </div>
        {/* Step pills */}
        <div className="hidden sm:flex items-center gap-1.5">
          {STEPS.map((label, i) => {
            const s = i + 1;
            const done = s < step;
            const active = s === step;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all',
                  done ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : active ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-border text-muted-foreground')}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : <span>{s}</span>}
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={cn('w-4 h-px', done ? 'bg-emerald-500/50' : 'bg-border')} />}
              </div>
            );
          })}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Platform ── */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5">
                <form onSubmit={handleSubmit(handlePlatformSubmit)} className="space-y-5">

                  {/* Platform grid */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">Select Platform</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Choose the platform you&apos;re testing on</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {platformOptions.map(p => {
                        const Icon = getPlatformIcon(p);
                        const selected = watchedPlatform === p;
                        const colorCls = PLATFORM_COLORS[p];
                        return (
                          <button key={p} type="button"
                            onClick={() => { setValue('platformName', p); setSelectedPlatform(p); }}
                            className={cn(
                              'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 text-center',
                              selected
                                ? cn('border-primary bg-primary/10 shadow-sm', colorCls)
                                : 'border-border bg-card hover:border-border/80 hover:bg-muted/50'
                            )}>
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border', selected ? colorCls : 'bg-muted border-border')}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-medium leading-tight text-foreground">{p}</span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.platformName && <p className="text-destructive text-xs">{errors.platformName.message}</p>}
                  </div>

                  {/* Platform details */}
                  {watchedPlatform && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border bg-card p-5 space-y-4">
                      <p className="text-sm font-bold text-foreground">Platform Details <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
                      {watchedPlatform === 'Other' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Custom Platform Name *</Label>
                          <Input {...register('customPlatformName')} placeholder="e.g. Smart Fridge OS" className="rounded-xl" />
                          {errors.customPlatformName && <p className="text-destructive text-xs">{errors.customPlatformName.message}</p>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Device Model</Label>
                          <Input {...register('deviceModel')} placeholder="e.g. Pixel 7" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">OS Version</Label>
                          <Input {...register('osVersion')} placeholder="e.g. Android 14" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">App Version</Label>
                          <Input {...register('appVersion')} placeholder="e.g. 3.2.1" className="rounded-xl" />
                        </div>
                        {watchedPlatform === 'Web' && (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Browser</Label>
                              <Input {...register('browserName')} placeholder="e.g. Chrome" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Browser Version</Label>
                              <Input {...register('browserVersion')} placeholder="e.g. 120" className="rounded-xl" />
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full h-11 rounded-xl font-bold gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ── STEP 2: Upload ── */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5">

                <div>
                  <p className="text-sm font-bold text-foreground">Upload Test Cases</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Import from an Excel file (.xlsx)</p>
                </div>

                {/* Drop zone */}
                <label className={cn(
                  'flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                  xlsxFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
                )}>
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center border',
                    xlsxFile ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border')}>
                    {isParsingFile
                      ? <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      : xlsxFile
                        ? <FileSpreadsheet className="w-6 h-6 text-primary" />
                        : <UploadCloud className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="text-center">
                    {xlsxFile ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">{xlsxFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isParsingFile ? 'Parsing...' : `${parsedTestCases.length} test cases found`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">Click to upload XLSX</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Columns: Test Bed · Test Case · Test Steps · Expected Result</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>

                {/* Test bed selector */}
                {testBeds.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-foreground">Select Test Bed</p>
                      <span className="text-xs text-muted-foreground">{parsedTestCases.length} total cases</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {testBeds.map(bed => {
                        const count = parsedTestCases.filter(c => c.testBed === bed).length;
                        const selected = selectedTestBed === bed;
                        return (
                          <button key={bed} type="button" onClick={() => setSelectedTestBed(bed)}
                            className={cn(
                              'flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all',
                              selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-border/80 hover:bg-muted/40'
                            )}>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{bed}</p>
                              <p className="text-[11px] text-muted-foreground">{count} cases</p>
                            </div>
                            {selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!xlsxFile || parsedTestCases.length === 0}
                    className="flex-1 h-11 rounded-xl font-bold gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Review ── */}
            {step === 3 && platformDetails && (
              <motion.div key="step3"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5">

                <div>
                  <p className="text-sm font-bold text-foreground">Review & Launch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirm your session configuration</p>
                </div>

                {/* Summary card */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {[
                    { label: 'Platform', value: platformDetails.platformName === 'Other' ? platformDetails.customPlatformName : platformDetails.platformName },
                    platformDetails.deviceModel ? { label: 'Device', value: platformDetails.deviceModel } : null,
                    platformDetails.osVersion ? { label: 'OS Version', value: platformDetails.osVersion } : null,
                    platformDetails.appVersion ? { label: 'App Version', value: platformDetails.appVersion } : null,
                    { label: 'Test Bed', value: selectedTestBed || 'All beds' },
                    { label: 'Test Cases', value: String(caseCount), highlight: true },
                    { label: 'Tester', value: displayName || user?.email?.split('@')[0] || 'Tester' },
                  ].filter(Boolean).map((row, i, arr) => (
                    <div key={row!.label}
                      className={cn('flex items-center justify-between px-5 py-3.5', i < arr.length - 1 ? 'border-b border-border/60' : '')}>
                      <span className="text-xs text-muted-foreground">{row!.label}</span>
                      <span className={cn('text-sm font-semibold', row!.highlight ? 'text-primary' : 'text-foreground')}>
                        {row!.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Launch CTA */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Rocket className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Ready to launch</p>
                    <p className="text-xs text-muted-foreground">{caseCount} test cases will be loaded into your session</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} disabled={isCreating} className="flex-1 h-11 rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={handleCreateSession} disabled={isCreating}
                    className="flex-1 h-11 rounded-xl font-bold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {isCreating ? 'Creating...' : 'Launch Session'}
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
