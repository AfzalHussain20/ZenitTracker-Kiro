"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, Trophy, Zap, Flame, ArrowLeft, Terminal, Activity,
    BrainCircuit, Layout, Globe2, Laptop, MonitorSmartphone,
    RefreshCcw, Maximize2, RotateCcw, ChevronRight, BookOpen,
    Code2, Lock, Target, Clock, Star, Layers, GraduationCap,
    CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
    Compass, BarChart3, Settings, Server, ExternalLink, Sparkles,
    Shield, Globe, Repeat, Briefcase, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COURSE_DATA, FRAMEWORKS, type Framework, type Lesson } from './courseData';
import { BLUEPRINT_DATA } from './academyContent';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AcademyView = 'dashboard' | 'syllabus' | 'lab' | 'blueprint' | 'certificate';

// ─── Constants ────────────────────────────────────────────────────────────────

const FW_ICONS: Record<Framework, React.ElementType> = {
    selenium: Globe2,
    playwright: Laptop,
    cypress: Layout,
    vibium: BrainCircuit,
    appium: MonitorSmartphone,
};

const ICON_MAP: Record<string, React.ElementType> = {
    MonitorSmartphone,
    Layers,
    Globe2,
    BrainCircuit,
};

const DIFFICULTY_STYLE: Record<string, string> = {
    Foundational: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    Advanced: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    Architect: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Divider = ({ className }: { className?: string }) => (
    <div className={cn("h-px w-full bg-border", className)} />
);

const StatPill = ({ label, value, icon: Icon, color = 'text-foreground' }: {
    label: string; value: string; icon: React.ElementType; color?: string;
}) => (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/60 border border-border">
        <Icon className={`w-4 h-4 ${color} shrink-0`} />
        <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">{label}</p>
            <p className={`text-sm font-bold ${color} leading-none`}>{value}</p>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

function ZenitAcademyContent() {
    const { user } = useAuth();
    const [view, setView] = useState<AcademyView>('dashboard');
    const [selectedFw, setSelectedFw] = useState<Framework | null>(null);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [userCode, setUserCode] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<boolean[]>([]);
    const [completed, setCompleted] = useState<string[]>([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [zenMode, setZenMode] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('theory');

    useEffect(() => {
        const viewParam = searchParams.get('view') as AcademyView | null;
        const tabParam = searchParams.get('tab');

        if (viewParam && ['dashboard', 'syllabus', 'lab', 'blueprint', 'certificate'].includes(viewParam)) {
            setView(viewParam);
        }
        if (tabParam) {
            setActiveTab(tabParam);
        }

        if (viewParam || tabParam) {
            // Clear the params after reading
            router.replace('/nexus');
        }
    }, [searchParams, router]);
    const [theoryIdx, setTheoryIdx] = useState(0);

    const totalXP = useMemo(() =>
        completed.reduce((sum, id) => {
            const l = COURSE_DATA.find(x => x.id === id);
            return sum + (l?.xp ?? 0);
        }, 0),
        [completed]);

    const launchLab = (lesson: Lesson) => {
        setActiveLesson(lesson);
        setUserCode(lesson.lab.starter);
        setProgress([]);
        setActiveTab('theory');
        setTheoryIdx(0);
        setView('lab');
    };

    const runCode = () => {
        setIsRunning(true);
        setTimeout(() => {
            const code = userCode.toLowerCase();
            const results = activeLesson!.lab.validation.map(v =>
                v.keywords.every(k => code.includes(k.toLowerCase()))
            );
            setProgress(results);
            if (results.every(Boolean) && !completed.includes(activeLesson!.id)) {
                setCompleted(prev => [...prev, activeLesson!.id]);
                setShowSuccess(true);
            }
            setIsRunning(false);
        }, 1600);
    };

    // Certificate

    const Certificate = ({ user: certUser }: { user: typeof user }) => {
        const recipientName = certUser?.displayName || certUser?.email?.split('@')[0] || 'Academy Graduate';

        const [courseTitle] = React.useState('Advanced AI & Automation Engineering');
        const [isEditing, setIsEditing] = React.useState(false);
        const [isSaving, setIsSaving] = React.useState(false);
        const [isSaved, setIsSaved] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [saveError, setSaveError] = React.useState('');

        const credentialId = React.useMemo(() => {
            if (!certUser) return 'ZEN-ACAD-2026-XXXX';
            // Generate a stable ID from the user uid + course
            const hash = certUser.uid.slice(-6).toUpperCase();
            return `ZEN-ACAD-2026-${hash}`;
        }, [certUser]);

        const issueDate = new Date().toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        const verifyUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/verify/${credentialId}`
            : `/verify/${credentialId}`;

        // Save certificate to Firestore
        const handleIssueCertificate = async () => {
            if (!certUser || isSaved) return;
            setIsSaving(true);
            setSaveError('');
            try {
                const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebaseConfig');
                await setDoc(doc(db, 'certificates', credentialId), {
                    credentialId,
                    recipientName,
                    recipientEmail: certUser.email,
                    recipientUid: certUser.uid,
                    courseTitle,
                    issueDate,
                    issuedBy: 'Zenit Academy',
                    programmeDirector: 'Afzal Hussain',
                    verifyUrl,
                    issuedAt: serverTimestamp(),
                    status: 'active',
                });
                setIsSaved(true);
            } catch (e: any) {
                setSaveError('Failed to issue certificate. Please try again.');
            } finally {
                setIsSaving(false);
            }
        };

        const handleCopyLink = () => {
            navigator.clipboard.writeText(verifyUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        };

        const handleLinkedIn = () => {
            const params = new URLSearchParams({
                startTask: 'CERTIFICATION_NAME',
                name: courseTitle,
                organizationName: 'Zenit Academy',
                issueYear: '2026',
                issueMonth: '2',
                certUrl: verifyUrl,
                certId: credentialId,
            });
            window.open(`https://www.linkedin.com/profile/add?${params.toString()}`, '_blank', 'noopener');
        };

        const handlePrint = () => {
            window.print();
        };

        return (
            <motion.div
                key="certificate"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="h-full overflow-y-auto flex flex-col gap-5 p-8"
            >
                {/* Top bar */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setView('blueprint')}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h2 className="text-base font-bold tracking-tight">Certificate of Completion</h2>
                            <p className="text-xs text-muted-foreground">Issued by Zenit Academy — Credential ID: <span className="font-mono">{credentialId}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-9 gap-2 text-xs font-semibold"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <Settings className="w-3.5 h-3.5" />
                            {isEditing ? 'Done' : 'Info'}
                        </Button>
                        {!isSaved ? (
                            <Button
                                size="sm"
                                className="rounded-xl h-9 gap-2 text-xs font-semibold shadow-lg shadow-primary/20"
                                onClick={handleIssueCertificate}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <><RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Issuing...</>
                                ) : (
                                    <><Shield className="w-3.5 h-3.5" /> Issue & Save</>
                                )}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl h-9 gap-2 text-xs font-semibold border-emerald-500/30 text-emerald-600"
                                disabled
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Issued to Registry
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="rounded-xl h-9 gap-2 text-xs font-semibold" onClick={handlePrint}>
                            <Download className="w-3.5 h-3.5" /> Print / PDF
                        </Button>
                    </div>
                </div>

                {/* Info / Error panel */}
                <AnimatePresence>
                    {(isEditing || saveError) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            {saveError && (
                                <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-600 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                                </div>
                            )}
                            {isEditing && (
                                <div className="p-5 rounded-2xl border bg-muted/30 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
                                        <p className="text-sm font-bold">{recipientName}</p>
                                        <p className="text-[10px] text-muted-foreground">{certUser?.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Credential ID</p>
                                        <p className="text-sm font-mono font-bold">{credentialId}</p>
                                        <p className="text-[10px] text-muted-foreground">Unique · Tamper-evident</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Verify URL</p>
                                        <p className="text-[10px] font-mono break-all text-primary">{verifyUrl}</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Certificate Canvas ── */}
                <div
                    id="cert-canvas-inner"
                    className="w-full flex-1 min-h-[520px] relative rounded-3xl overflow-hidden border border-border/60 shadow-2xl"
                    style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f7f5 100%)' }}
                >
                    {/* Top accent stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

                    {/* Left navy sidebar */}
                    <div className="absolute top-0 bottom-0 left-0 w-[200px] flex flex-col items-center justify-between py-10 px-6"
                        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
                    >
                        {/* Logo Mark */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                <Compass className="w-7 h-7 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em]">Zenit</p>
                                <p className="text-[8px] font-semibold text-white/40 uppercase tracking-widest mt-0.5">Academy</p>
                            </div>
                        </div>

                        {/* Seal */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-[72px] h-[72px] rounded-full border-2 border-primary/40 flex items-center justify-center relative">
                                <div className="absolute inset-1.5 rounded-full border border-primary/20" />
                                <Trophy className="w-6 h-6 text-primary relative z-10" />
                            </div>
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] text-center leading-relaxed">
                                {isSaved ? 'Registry\nVerified' : 'Verified\nExcellence'}
                            </p>
                        </div>

                        {/* QR Code & Credential ID */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-2 bg-white rounded-lg shadow-inner">
                                <QRCodeSVG
                                    value={verifyUrl}
                                    size={64}
                                    level="L"
                                    includeMargin={false}
                                    imageSettings={{
                                        src: "/logo.svg",
                                        x: undefined,
                                        y: undefined,
                                        height: 12,
                                        width: 12,
                                        excavate: true,
                                    }}
                                />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[7px] text-white/30 uppercase tracking-widest font-bold">Credential ID</p>
                                <p className="text-[9px] font-mono text-white/50 break-all">{credentialId}</p>
                            </div>
                        </div>
                    </div>

                    {/* Main content area */}
                    <div className="ml-[200px] h-full flex flex-col justify-between p-10">

                        {/* Header */}
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Certificate of Completion</p>
                            <div className="w-10 h-0.5 bg-primary/40 mt-2" />
                        </div>

                        {/* Main Copy */}
                        <div className="space-y-5 flex-1 flex flex-col justify-center">
                            <p className="text-sm text-slate-500 font-medium tracking-wide">This is to certify that</p>
                            <div>
                                <h1
                                    className="text-5xl font-black text-slate-900 tracking-tight leading-none"
                                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                                >
                                    {recipientName}
                                </h1>
                                <div className="mt-3 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent max-w-md" />
                            </div>
                            <div className="space-y-2 max-w-lg">
                                <p className="text-sm text-slate-500 font-medium tracking-wide">has successfully completed the certification program in</p>
                                <h2 className="text-xl font-bold text-slate-800 leading-snug">{courseTitle}</h2>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                    Demonstrating advanced proficiency in industry-standard practices,
                                    tools, and methodologies required for professional excellence.
                                </p>
                            </div>
                        </div>

                        {/* Footer row */}
                        <div className="border-t border-slate-200 pt-6 grid grid-cols-3 gap-6 items-end">
                            {/* Signature 1 — Programme Director */}
                            <div className="space-y-1.5">
                                <div className="h-px bg-slate-300 w-28 mb-2" />
                                <p className="text-sm font-black text-slate-800">Afzal Hussain</p>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Programme Director</p>
                                <p className="text-[9px] text-slate-300 uppercase tracking-widest">Zenit Academy</p>
                            </div>

                            {/* Center: Shield + Date */}
                            <div className="flex flex-col items-center gap-1.5">
                                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${isSaved ? 'border-emerald-500/50 bg-emerald-50' : 'border-primary/30 bg-primary/5'}`}>
                                    {isSaved
                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        : <Shield className="w-5 h-5 text-primary/60" />
                                    }
                                </div>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold text-center">Issued on</p>
                                <p className="text-[10px] font-bold text-slate-600">{issueDate}</p>
                            </div>

                            {/* Signature 2 — Zenit AI */}
                            <div className="space-y-1.5 text-right">
                                <div className="h-px bg-slate-300 w-28 mb-2 ml-auto" />
                                <p className="text-sm font-black text-slate-800">Zenit Core AI</p>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Chief Verification Officer</p>
                                <p className="text-[9px] text-slate-300 uppercase tracking-widest">Zenit Intelligence</p>
                            </div>
                        </div>
                    </div>

                    {/* Subtle crosshatch watermark */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.018]"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
                            backgroundSize: '18px 18px',
                            marginLeft: '200px'
                        }}
                    />

                    {/* Registry badge — shown when saved */}
                    <AnimatePresence>
                        {isSaved && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">In Registry</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between shrink-0 pt-1">
                    <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
                        {isSaved
                            ? <>✓ This credential is live and verifiable at <span className="font-mono text-primary">{verifyUrl}</span></>
                            : 'Click "Issue & Save" to register this credential in the Zenit Credential Registry.'}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-9 gap-2 text-xs font-semibold"
                            onClick={handleCopyLink}
                        >
                            {copied
                                ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Copied!</>
                                : <><ExternalLink className="w-3.5 h-3.5" /> Copy Verify Link</>
                            }
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-9 gap-2 text-xs font-semibold"
                            onClick={() => window.open(verifyUrl, '_blank', 'noopener')}
                            disabled={!isSaved}
                            title={!isSaved ? 'Issue the certificate first to enable verification' : ''}
                        >
                            <Shield className="w-3.5 h-3.5" /> Verify Online
                        </Button>
                        <Button
                            size="sm"
                            className="rounded-xl h-9 gap-2 text-xs font-semibold bg-[#0077B5] hover:bg-[#006295] text-white shadow-md"
                            onClick={handleLinkedIn}
                            disabled={!isSaved}
                            title={!isSaved ? 'Issue the certificate first' : ''}
                        >
                            <Briefcase className="w-3.5 h-3.5" /> Add to LinkedIn
                        </Button>
                    </div>
                </div>
            </motion.div>
        );
    };





    // ── Blueprint ──────────────────────────────────────────────────────────────

    const Blueprint = () => (
        <motion.div
            key="blueprint"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col gap-8 overflow-hidden"
        >
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setView('dashboard')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 leading-none">The Zenit Blueprint</h2>
                        <p className="text-xs text-muted-foreground mt-1">Market trends, implementation roadmap, and AI toolkit.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="h-9 rounded-xl text-xs gap-2 text-primary font-bold" onClick={() => setView('certificate')}>
                        <Trophy className="w-4 h-4" /> Preview Certification
                    </Button>
                    <Button variant="outline" className="h-9 rounded-xl text-xs gap-2" onClick={() => window.open('https://github.com', '_blank')}>
                        <ExternalLink className="w-4 h-4" /> Cloud Templates
                    </Button>
                </div>
            </div>

            <Divider />

            <div className="flex-1 overflow-y-auto pr-1 custom-scroll">
                <div className="space-y-12 pb-12">
                    {/* Goals Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        {BLUEPRINT_DATA.graduationGoals.map((g, i) => (
                            <div key={i} className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between group">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">Goal {i + 1}</p>
                                    <p className="text-sm font-bold">{g.goal}</p>
                                    <p className="text-[10px] text-muted-foreground">{g.check}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                    <Check className="w-4 h-4" />
                                </div>
                            </div>
                        ))}
                        <div className="p-4 bg-muted/30 border border-border rounded-2xl flex items-center justify-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-[11px] font-bold">Zenit Certification</span>
                        </div>
                    </div>

                    {/* Enterprise Strategy Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold">Enterprise Strategy & Longevity</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {BLUEPRINT_DATA.businessStrategy.map((item, i) => (
                                <div key={i} className="group p-6 bg-card border border-border rounded-[32px] hover:border-orange-500/40 transition-all relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors" />
                                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> {item.pillar}
                                    </p>
                                    <h4 className="text-sm font-bold mb-2">{item.description}</h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.impact}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-emerald-500"><Shield className="w-3 h-3" /> Security Standards</p>
                                <div className="flex flex-wrap gap-2">
                                    {BLUEPRINT_DATA.enterpriseSpecs.security.map((s, i) => <Badge key={i} variant="outline" className="text-[9px] border-none bg-emerald-500/10 text-emerald-500">{s}</Badge>)}
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-blue-500"><Globe className="w-3 h-3" /> Global Compliance</p>
                                <div className="flex flex-wrap gap-2">
                                    {BLUEPRINT_DATA.enterpriseSpecs.compliance.map((s, i) => <Badge key={i} variant="outline" className="text-[9px] border-none bg-blue-500/10 text-blue-500">{s}</Badge>)}
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-violet-500"><Repeat className="w-3 h-3" /> Longevity Protocols</p>
                                <div className="flex flex-wrap gap-2">
                                    {BLUEPRINT_DATA.enterpriseSpecs.longevity.map((s, i) => <Badge key={i} variant="outline" className="text-[9px] border-none bg-violet-500/10 text-violet-500">{s}</Badge>)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Roadmap Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Compass className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold">Engineering Roadmap</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {BLUEPRINT_DATA.roadmap.map((step, i) => {
                                const Icon = ICON_MAP[step.icon];
                                return (
                                    <div key={i} className="group p-5 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all relative">
                                        <div className="absolute top-4 right-4 text-[24px] font-bold text-muted-foreground/5 select-none transition-all group-hover:text-primary/10 group-hover:scale-125">
                                            0{i + 1}
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <h4 className="text-sm font-bold mb-2">{step.title}</h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">{step.description}</p>
                                        <ul className="space-y-1.5 border-t border-border/50 pt-4">
                                            {step.details.map((detail, j) => (
                                                <li key={j} className="text-[10px] text-muted-foreground flex items-start gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                                                    {detail}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Trends & AI Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <h3 className="text-xl font-bold">Market Dynamics</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {BLUEPRINT_DATA.marketTrends.map((trend, i) => (
                                        <div key={i} className="p-5 bg-card border border-border rounded-2xl relative overflow-hidden">
                                            <div className="absolute bottom-0 right-0 w-12 h-12 bg-emerald-500/5 -mr-4 -mb-4 rounded-full blur-xl" />
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{trend.label}</span>
                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[9px]">{trend.growth}</Badge>
                                            </div>
                                            <div className="text-2xl font-bold mb-1">{trend.value}</div>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">{trend.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-8 bg-gradient-to-br from-primary/[0.05] to-transparent border border-primary/20 rounded-3xl relative overflow-hidden group">
                                <Sparkles className="absolute -top-12 -right-12 w-48 h-48 text-primary/5 group-hover:rotate-12 transition-transform" />
                                <div className="max-w-xl space-y-4">
                                    <h4 className="text-md font-bold flex items-center gap-2">
                                        <BrainCircuit className="w-5 h-5 text-primary" /> Implementing MCP & AI Agents
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {BLUEPRINT_DATA.implementationGuide.map((guide, i) => (
                                            <div key={i} className="space-y-3">
                                                <p className="text-xs font-bold text-primary flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> {guide.tech}</p>
                                                <div className="space-y-2">
                                                    {guide.steps.map((step, j) => (
                                                        <p key={j} className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                                                            <span className="text-primary/40 font-bold">{j + 1}.</span> {step}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <Settings className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <h3 className="text-xl font-bold">IDE Setup Guide</h3>
                                </div>
                                <div className="space-y-3">
                                    {BLUEPRINT_DATA.setupGuide.steps.map((step, i) => (
                                        <div key={i} className="p-4 bg-muted/30 border border-border rounded-xl flex gap-3 group hover:border-amber-500/30 transition-all">
                                            <div className="w-6 h-6 rounded-lg bg-background border border-border flex items-center justify-center text-[10px] font-bold shrink-0 group-hover:scale-110 transition-transform">
                                                {i + 1}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold">{step.title}</p>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed">{step.action}</p>
                                                {step.link && (
                                                    <a href={step.link} target="_blank" className="text-[10px] text-primary flex items-center gap-1 hover:underline mt-1 font-bold">
                                                        <ExternalLink className="w-3 h-3" /> Get Starter Kit
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Resources Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                <Server className="w-5 h-5 text-violet-500" />
                            </div>
                            <h3 className="text-xl font-bold">Modern AI Toolkit</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {BLUEPRINT_DATA.aiResources.map((res, i) => (
                                <div key={i} className="p-6 bg-card border border-border rounded-3xl flex flex-col hover:border-violet-500/40 hover:shadow-xl transition-all group overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="w-4 h-4 text-violet-500" />
                                    </div>
                                    <h4 className="text-sm font-bold mb-2">{res.name}</h4>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-4 flex-1">{res.use}</p>

                                    <div className="mt-4 p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
                                        <p className="text-[9px] font-bold text-violet-500 uppercase tracking-widest mb-1">Daily AI Hack</p>
                                        <p className="text-[10px] text-foreground/80 leading-tight italic">&ldquo;{res.dailyHack}&rdquo;</p>
                                    </div>

                                    <a href={res.link} target="_blank" className="mt-4 text-[10px] text-primary font-bold flex items-center gap-1 group/link">
                                        Access Free Service <ChevronRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    // ── Dashboard ──────────────────────────────────────────────────────────────

    const Dashboard = () => (
        <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col gap-6 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-start justify-between shrink-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                            Zenit Academy · Automation Engineering
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Learning Paths</h1>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        University-level curriculum for SDET engineers. Structured labs, deep theory, and real code.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <StatPill label="Total XP" value={totalXP.toLocaleString()} icon={Zap} color="text-primary" />
                    <StatPill label="Streak" value="24 days" icon={Flame} color="text-orange-500" />
                    <StatPill label="Labs Done" value={`${completed.length}`} icon={CheckCircle2} color="text-emerald-500" />
                </div>
            </div>

            <Divider />

            {/* Blueprint CTA Banner */}
            <motion.button
                whileHover={{ scale: 1.01, y: -4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setView('blueprint')}
                className="shrink-0 p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between group overflow-hidden relative shadow-2xl shadow-primary/10 transition-shadow hover:shadow-primary/20"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform">
                        <Compass className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            Explore the Zenit Blueprint <Badge className="bg-primary text-primary-foreground border-none px-2 py-0 h-5 text-[9px] uppercase tracking-wider">New Content</Badge>
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Setup guides, market trends, and modern AI engineering pathways.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative z-10">
                    <span className="text-sm font-bold text-primary group-hover:mr-2 transition-all">Start Journey</span>
                    <ChevronRight className="w-5 h-5 text-primary" />
                </div>
            </motion.button>

            {/* Overall progress bar */}
            <div className="shrink-0 flex items-center gap-4">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${COURSE_DATA.length > 0 ? (completed.length / COURSE_DATA.length) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                    {completed.length}/{COURSE_DATA.length} lessons complete
                </span>
            </div>

            {/* Framework grid */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scroll">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
                    {(Object.entries(FRAMEWORKS) as [Framework, typeof FRAMEWORKS[Framework]][]).map(([key, fw]) => {
                        const Icon = FW_ICONS[key];
                        const fwLessons = COURSE_DATA.filter(l => l.framework === key);
                        const fwDone = fwLessons.filter(l => completed.includes(l.id)).length;
                        const pct = fwLessons.length > 0 ? Math.round((fwDone / fwLessons.length) * 100) : 0;
                        const fwXP = fwLessons.reduce((s, l) => s + l.xp, 0);

                        return (
                            <motion.button
                                key={key}
                                whileHover={{ y: -6, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelectedFw(key); setView('syllabus'); }}
                                className="group text-left bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${fw.accent}18` }}>
                                        <Icon className="w-5 h-5" style={{ color: fw.accent }} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {pct === 100 && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5">Complete</Badge>}
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>

                                <h3 className="text-sm font-semibold text-foreground mb-0.5 group-hover:text-primary transition-colors">{fw.name}</h3>
                                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{fw.tagline}</p>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{fwLessons.length} lessons</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fw.hours}</span>
                                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{fwXP.toLocaleString()} XP</span>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>{fwDone}/{fwLessons.length} complete</span>
                                        <span>{pct}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: fw.accent }} />
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );

    // ── Syllabus ───────────────────────────────────────────────────────────────

    const Syllabus = () => {
        const fw = selectedFw ? FRAMEWORKS[selectedFw] : null;
        const Icon = selectedFw ? FW_ICONS[selectedFw] : null;
        const lessons = selectedFw ? COURSE_DATA.filter(l => l.framework === selectedFw) : [];

        // Group by module
        const modules = useMemo(() => {
            const map = new Map<string, Lesson[]>();
            lessons.forEach(l => {
                if (!map.has(l.module)) map.set(l.module, []);
                map.get(l.module)!.push(l);
            });
            return map;
        }, [lessons]);

        if (!selectedFw || !fw || !Icon) return null;

        const fwDone = lessons.filter(l => completed.includes(l.id)).length;
        const fwXP = lessons.reduce((s, l) => s + l.xp, 0);

        return (
            <motion.div
                key="syllabus"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="h-full flex flex-col gap-5 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center gap-3 shrink-0">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setView('dashboard')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${fw.accent}18` }}>
                        <Icon className="w-4 h-4" style={{ color: fw.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-foreground leading-none">{fw.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{fw.tagline}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <StatPill label="Lessons" value={`${fwDone}/${lessons.length}`} icon={GraduationCap} />
                        <StatPill label="Total XP" value={fwXP.toLocaleString()} icon={Zap} color="text-primary" />
                    </div>
                </div>

                <Divider />

                {/* Module list */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scroll">
                    <div className="space-y-6 pb-6">
                        {Array.from(modules.entries()).map(([moduleName, moduleLessons]) => {
                            const modDone = moduleLessons.filter(l => completed.includes(l.id)).length;
                            return (
                                <div key={moduleName}>
                                    {/* Module header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${modDone === moduleLessons.length ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                            {modDone === moduleLessons.length ? <Check className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                                        </div>
                                        <span className="text-xs font-semibold text-foreground">{moduleName}</span>
                                        <span className="text-[10px] text-muted-foreground">{modDone}/{moduleLessons.length} complete</span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>

                                    {/* Lessons in module */}
                                    <div className="space-y-2 pl-8">
                                        {moduleLessons.map((lesson, idx) => {
                                            const isDone = completed.includes(lesson.id);
                                            return (
                                                <motion.button
                                                    key={lesson.id}
                                                    whileHover={{ x: 2 }}
                                                    whileTap={{ scale: 0.995 }}
                                                    onClick={() => launchLab(lesson)}
                                                    className="group w-full text-left bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                                            {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{lesson.title}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 h-4 border ${DIFFICULTY_STYLE[lesson.difficulty]}`}>
                                                                    {lesson.difficulty}
                                                                </Badge>
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="w-2.5 h-2.5" />{lesson.duration}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <BookOpen className="w-2.5 h-2.5" />{lesson.theory.length} sections
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs font-semibold text-primary">+{lesson.xp} XP</p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Locked placeholder */}
                        <div className="pl-8">
                            <div className="w-full text-left bg-muted/20 border border-dashed border-border rounded-xl px-4 py-3.5 opacity-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Lock className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground">More lessons coming soon</p>
                                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Complete current modules to unlock advanced content</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    // ── Lab ────────────────────────────────────────────────────────────────────

    const Lab = () => {
        if (!activeLesson) return null;
        const fw = FRAMEWORKS[activeLesson.framework];
        const Icon = FW_ICONS[activeLesson.framework];
        const allPassed = progress.length > 0 && progress.every(Boolean);
        const theory = activeLesson.theory;
        const currentTheory = theory[theoryIdx];

        return (
            <motion.div
                key="lab"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`h-full flex flex-col gap-4 overflow-hidden ${zenMode ? 'fixed inset-0 z-50 bg-background p-8' : ''}`}
            >
                {/* Lab header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => { setZenMode(false); setView('syllabus'); }}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${fw.accent}18` }}>
                            <Icon className="w-4 h-4" style={{ color: fw.accent }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground leading-none">{activeLesson.title}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{activeLesson.module}</span>
                                <span className="text-muted-foreground/30">·</span>
                                <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 h-4 border ${DIFFICULTY_STYLE[activeLesson.difficulty]}`}>
                                    {activeLesson.difficulty}
                                </Badge>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="text-[10px] font-medium text-primary">+{activeLesson.xp} XP</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className={`h-9 w-9 rounded-xl ${zenMode ? 'border-primary text-primary' : ''}`} onClick={() => setZenMode(z => !z)}>
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                        <Button onClick={runCode} disabled={isRunning} className="h-9 px-5 rounded-xl text-xs font-semibold gap-2">
                            {isRunning ? <><RefreshCcw className="w-3.5 h-3.5 animate-spin" />Validating…</> : <><Zap className="w-3.5 h-3.5" />Run & Validate</>}
                        </Button>
                    </div>
                </div>

                <Divider />

                {/* Main layout */}
                <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden min-h-0">

                    {/* Left panel */}
                    <div className={`col-span-4 flex flex-col overflow-hidden transition-all duration-300 ${zenMode ? 'hidden' : ''}`}>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                            <TabsList className="h-9 rounded-xl bg-muted/60 border border-border p-1 shrink-0 mb-3">
                                <TabsTrigger value="theory" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <BookOpen className="w-3 h-3 mr-1.5" />Theory
                                </TabsTrigger>
                                <TabsTrigger value="mission" className="flex-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <Target className="w-3 h-3 mr-1.5" />Mission
                                </TabsTrigger>
                            </TabsList>

                            {/* Theory tab */}
                            <TabsContent value="theory" className="flex-1 overflow-hidden flex flex-col mt-0">
                                {/* Theory navigation if multiple sections */}
                                {theory.length > 1 && (
                                    <div className="flex items-center justify-between mb-3 shrink-0">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            Section {theoryIdx + 1} of {theory.length}
                                        </span>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="icon" className="h-6 w-6 rounded-lg" disabled={theoryIdx === 0} onClick={() => setTheoryIdx(i => i - 1)}>
                                                <ChevronUp className="w-3 h-3" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-6 w-6 rounded-lg" disabled={theoryIdx === theory.length - 1} onClick={() => setTheoryIdx(i => i + 1)}>
                                                <ChevronDown className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto custom-scroll pr-1">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={theoryIdx}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-4 pb-6"
                                        >
                                            <div>
                                                <h3 className="text-sm font-semibold text-foreground mb-2">{currentTheory.title}</h3>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{currentTheory.content}</p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Key Concepts</p>
                                                {currentTheory.points.map((p, j) => (
                                                    <div key={j} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                                                        <span className="leading-relaxed">{p}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {currentTheory.syntax && (
                                                <div className="rounded-xl overflow-hidden border border-border">
                                                    <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
                                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{currentTheory.syntax.lang}</span>
                                                        <Code2 className="w-3 h-3 text-muted-foreground/50" />
                                                    </div>
                                                    <pre className="p-4 text-[11px] font-mono text-primary/80 leading-relaxed overflow-x-auto bg-[#0d1117] custom-scroll whitespace-pre-wrap">
                                                        {currentTheory.syntax.code}
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Section dots */}
                                            {theory.length > 1 && (
                                                <div className="flex items-center justify-center gap-1.5 pt-2">
                                                    {theory.map((_, i) => (
                                                        <button key={i} onClick={() => setTheoryIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === theoryIdx ? 'bg-primary w-4' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </TabsContent>

                            {/* Mission tab */}
                            <TabsContent value="mission" className="flex-1 overflow-y-auto custom-scroll pr-1 mt-0">
                                <div className="space-y-4 pb-6">
                                    <div className="rounded-xl border border-border bg-card p-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lab Objective</p>
                                        <p className="text-xs text-foreground leading-relaxed">{activeLesson.lab.mission}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Validation Checks ({progress.filter(Boolean).length}/{activeLesson.lab.validation.length})</p>
                                        {activeLesson.lab.validation.map((v, i) => (
                                            <div key={v.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${progress[i] === true ? 'border-emerald-500/30 bg-emerald-500/5' : progress[i] === false ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/30'}`}>
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${progress[i] === true ? 'bg-emerald-500 text-white' : progress[i] === false ? 'bg-red-500/20 text-red-500' : 'bg-muted border border-border'}`}>
                                                    {progress[i] === true && <Check className="w-3 h-3 stroke-[3]" />}
                                                    {progress[i] === false && <span className="text-[10px] font-bold">✕</span>}
                                                </div>
                                                <span className={`text-xs font-medium ${progress[i] === true ? 'text-emerald-600 dark:text-emerald-400' : progress[i] === false ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    {v.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {progress.length > 0 && (
                                        <div className={`rounded-xl border px-4 py-3 text-xs font-medium ${allPassed ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'}`}>
                                            {allPassed ? '✓ All checks passed — lab complete!' : `${progress.filter(Boolean).length}/${progress.length} checks passing. Review failing items above.`}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* IDE panel */}
                    <div className={`flex flex-col overflow-hidden ${zenMode ? 'col-span-12' : 'col-span-8'}`}>
                        <div className="flex-1 flex flex-col rounded-2xl border border-border overflow-hidden bg-[#0d1117]">
                            {/* IDE toolbar */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02] shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                                    </div>
                                    <div className="h-4 w-px bg-white/10" />
                                    <Terminal className="w-3.5 h-3.5 text-primary/60" />
                                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                                        {activeLesson.id.toUpperCase()}.java — Zenit IDE
                                    </span>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] text-white/30 hover:text-white/70 hover:bg-white/5 rounded-lg gap-1.5" onClick={() => setUserCode(activeLesson.lab.starter)}>
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </Button>
                            </div>

                            {/* Code area */}
                            <div className="flex-1 flex overflow-hidden relative">
                                {/* Line numbers */}
                                <div className="w-12 shrink-0 bg-white/[0.01] border-r border-white/5 py-4 flex flex-col items-end pr-3 select-none overflow-hidden">
                                    {userCode.split('\n').map((_, i) => (
                                        <span key={i} className="text-[11px] font-mono text-white/15 leading-[1.65rem]">{i + 1}</span>
                                    ))}
                                </div>
                                <textarea
                                    value={userCode}
                                    onChange={e => setUserCode(e.target.value)}
                                    className="flex-1 bg-transparent py-4 px-4 font-mono text-[13px] text-[#e6edf3] leading-[1.65rem] resize-none focus:outline-none custom-scroll caret-primary selection:bg-primary/30"
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />
                                <AnimatePresence>
                                    {isRunning && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0d1117]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                                            <RefreshCcw className="w-7 h-7 text-primary animate-spin" />
                                            <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Validating solution…</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Console */}
                            <div className="h-32 border-t border-white/5 bg-black/40 flex flex-col shrink-0">
                                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 shrink-0">
                                    <Activity className="w-3 h-3 text-primary/60" />
                                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Output</span>
                                    {progress.length > 0 && (
                                        <div className={`ml-auto flex items-center gap-1.5 text-[10px] font-semibold ${allPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${allPassed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                            {allPassed ? 'All checks passed' : `${progress.filter(Boolean).length}/${progress.length} passing`}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scroll px-4 py-3 font-mono text-[11px] space-y-1">
                                    {isRunning ? (
                                        <p className="text-primary/60 animate-pulse">{'>'} Running validation suite…</p>
                                    ) : progress.length > 0 ? (
                                        <>
                                            <p className="text-white/30">{'>'} Validation complete — {new Date().toLocaleTimeString()}</p>
                                            {activeLesson.lab.validation.map((v, i) => (
                                                <p key={v.id} className={progress[i] ? 'text-emerald-400' : 'text-red-400'}>
                                                    {progress[i] ? '  ✓' : '  ✗'} {v.label}
                                                </p>
                                            ))}
                                            {allPassed && <p className="text-emerald-400 font-semibold mt-1">{'>'} Lab complete! +{activeLesson.xp} XP awarded.</p>}
                                        </>
                                    ) : (
                                        <p className="text-white/15 italic">{'>'} Awaiting execution…</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success modal */}
                <AnimatePresence>
                    {showSuccess && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-md p-6">
                            <motion.div
                                initial={{ scale: 0.92, y: 24, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl text-center"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                                    <Trophy className="w-7 h-7 text-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground mb-1">Lab Complete</h2>
                                <p className="text-sm text-muted-foreground mb-6">All {activeLesson?.lab.validation.length} validation checks passed.</p>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="rounded-xl bg-muted/60 border border-border p-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">XP Earned</p>
                                        <p className="text-2xl font-bold text-primary">+{activeLesson?.xp}</p>
                                    </div>
                                    <div className="rounded-xl bg-muted/60 border border-border p-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total XP</p>
                                        <p className="text-2xl font-bold text-foreground">{(totalXP + (activeLesson?.xp ?? 0)).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowSuccess(false)}>Review Code</Button>
                                    <Button className="flex-1 rounded-xl" onClick={() => { setShowSuccess(false); setView('syllabus'); }}>Next Lesson</Button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    // ── Root ──────────────────────────────────────────────────────────────────

    return (
        <div className="h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden p-6 md:p-8 print-hide-nexus">
            <AnimatePresence mode="wait">
                {view === 'dashboard' && <Dashboard key="dash" />}
                {view === 'blueprint' && <Blueprint key="blue" />}
                {view === 'certificate' && <Certificate key="cert" user={user} />}
                {view === 'syllabus' && <Syllabus key="syll" />}
                {view === 'lab' && <Lab key="lab" />}
            </AnimatePresence>

            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 99px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.4); }

        @media print {
            /* Hide the entire app UI */
            .print-hide, nav, header, footer, aside, button { 
                display: none !important; 
            }
            
            body { 
                background: white !important; 
                margin: 0 !important; 
                padding: 0 !important;
            }

            /* The canvas is the only thing that should show */
            #cert-canvas-inner {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                z-index: 99999 !important;
                background: white !important;
                visibility: visible !important;
                display: flex !important;
                border: none !important;
                box-shadow: none !important;
                transform: none !important;
            }

            /* Hide everything else inside the nexus page */
            .print-hide-nexus > *:not(#cert-canvas-inner) {
                display: none !important;
            }
        }
      `}</style>
        </div>
    );
}

export default function ZenitAcademy() {
    return (
        <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                        <GraduationCap className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Initialising Nexus...</p>
                </div>
            </div>
        }>
            <ZenitAcademyContent />
        </React.Suspense>
    );
}
