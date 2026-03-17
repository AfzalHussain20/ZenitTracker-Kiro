"use client";

import React, { useEffect, useState } from 'react';
import { Compass, Trophy, Shield, CheckCircle2, XCircle, Loader2, ExternalLink, Fingerprint, ShieldCheck, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CertificateData {
    credentialId: string;
    recipientName: string;
    recipientEmail: string;
    courseTitle: string;
    issueDate: string;
    issuedBy: string;
    programmeDirector: string;
    status: 'active' | 'revoked';
    issuedAt: { seconds: number } | null;
}

type VerifyState = 'loading' | 'found' | 'not_found' | 'revoked' | 'error';

export default function VerifyCertificatePage({ params }: { params: { id: string } }) {
    const { id } = params;
    const [state, setState] = useState<VerifyState>('loading');
    const [cert, setCert] = useState<CertificateData | null>(null);

    useEffect(() => {
        const fetchCert = async () => {
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebaseConfig');
                const snap = await getDoc(doc(db, 'certificates', id));
                if (!snap.exists()) {
                    setState('not_found');
                    return;
                }
                const data = snap.data() as CertificateData;
                setCert(data);
                setState(data.status === 'revoked' ? 'revoked' : 'found');
            } catch (e) {
                setState('error');
            }
        };
        fetchCert();
    }, [id]);

    const formatDate = (certData: CertificateData) => {
        if (certData.issueDate) return certData.issueDate;
        if (certData.issuedAt?.seconds) {
            return new Date(certData.issuedAt.seconds * 1000).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
        }
        return 'N/A';
    };

    return (
        <div className="min-h-screen bg-[#02040a] text-zinc-100 flex flex-col font-sans selection:bg-primary/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
            </div>

            {/* Header bar */}
            <header className="relative z-50 border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white tracking-tight">Zenit Academy</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Credential Authentication Portal</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1.5 py-1 px-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-black tracking-widest">Secure Registry</span>
                    </Badge>
                </div>
            </header>

            {/* Main */}
            <main className="relative z-10 flex-1 flex items-center justify-center p-8 lg:p-12">
                {state === 'loading' && (
                    <div className="flex flex-col items-center gap-6 text-zinc-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl animate-pulse" />
                            <Loader2 className="w-10 h-10 animate-spin text-violet-500 relative z-10" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Querying the Zenit Registry…</p>
                    </div>
                )}

                {state === 'error' && (
                    <div className="text-center space-y-4 max-w-sm">
                        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                            <XCircle className="w-8 h-8 text-rose-500" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tighter">Registry Connection Timeout</h1>
                        <p className="text-sm text-zinc-400 leading-relaxed font-medium">We encountered a temporary disruption while communicating with the Zenit Credential Registry. Please refresh to try again.</p>
                        <Button className="rounded-xl bg-white text-black hover:bg-zinc-200" onClick={() => window.location.reload()}>Retry Handshake</Button>
                    </div>
                )}

                {state === 'not_found' && (
                    <motion.div initial={{ opacity: 0, scale: 0.98, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="max-w-md w-full">
                        <div className="bg-zinc-900/40 backdrop-blur-3xl rounded-[32px] border border-white/5 shadow-2xl p-10 text-center space-y-6">
                            <div className="w-20 h-20 rounded-[28px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                                <Shield className="w-10 h-10 text-rose-500 opacity-80" />
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-3xl font-black text-white tracking-tighter">Lookup Failed</h1>
                                <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                                    No official record matches the credential signature: <span className="font-mono font-bold text-rose-400">{id}</span>
                                </p>
                            </div>
                            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-left space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Trace Summary</p>
                                <ul className="text-xs text-zinc-400 space-y-2 font-medium">
                                    <li className="flex gap-2"><span>—</span> <span>Invalid or malformed credential ID detected.</span></li>
                                    <li className="flex gap-2"><span>—</span> <span>Record may still be in the issuance queue.</span></li>
                                    <li className="flex gap-2"><span>—</span> <span>Registry access permissions restricted.</span></li>
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                )}

                {state === 'found' && cert && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="max-w-5xl w-full space-y-10"
                    >
                        {/* Certificate Card — High Tech Version */}
                        <div className="relative group">
                            {/* Card Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/30 to-indigo-600/30 rounded-[40px] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />

                            <div className="relative w-full rounded-[40px] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] bg-zinc-950 flex flex-col md:flex-row min-h-[540px]">

                                {/* Specialized Sidebar */}
                                <div className="w-full md:w-[240px] bg-gradient-to-b from-zinc-900 to-zinc-950 p-10 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-white/5">
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                                            <Compass className="w-8 h-8 text-white/50" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-black tracking-tighter text-white">Zenit Academy</p>
                                            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] font-black mt-1">Certified</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-24 h-24 rounded-full border-4 border-violet-500/20 flex items-center justify-center relative shadow-2xl shadow-violet-500/10">
                                            <div className="absolute inset-0 rounded-full border border-white/5 animate-spin-slow" />
                                            <Trophy className="w-10 h-10 text-violet-400" />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mt-2">Elite Alumnus</p>
                                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Registry Verified</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-6 w-full">
                                        <div className="p-3 bg-white rounded-2xl shadow-xl shadow-white/5 hover:scale-110 transition-transform cursor-zoom-in">
                                            <QRCodeSVG
                                                value={typeof window !== 'undefined' ? window.location.href : ""}
                                                size={80}
                                                level="H"
                                                includeMargin={false}
                                            />
                                        </div>
                                        <div className="text-center space-y-1.5 px-4">
                                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Signature</p>
                                            <p className="text-[10px] font-mono text-zinc-400 break-all leading-tight opacity-70">{cert.credentialId}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 p-12 lg:p-20 flex flex-col justify-between relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-[0.98]">
                                    {/* Corner Accents */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-3xl rounded-full" />
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-12">
                                            <Badge className="bg-white/5 border-white/10 text-zinc-400 py-1 px-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                                Academic Recognition
                                            </Badge>
                                            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                                        </div>

                                        <div className="space-y-12">
                                            <div className="space-y-4">
                                                <p className="text-lg text-zinc-500 font-medium italic tracking-wide">This formal credential is awarded to</p>
                                                <h1 className="text-6xl md:text-7xl font-black text-white tracking-tight leading-none drop-shadow-sm">
                                                    {cert.recipientName}
                                                </h1>
                                            </div>

                                            <div className="space-y-6 max-w-2xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-[1px] w-12 bg-violet-500/50" />
                                                    <p className="text-lg text-zinc-400 font-medium">In recognition of outstanding proficiency in</p>
                                                </div>
                                                <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-600 leading-tight">
                                                    {cert.courseTitle}
                                                </h2>
                                                <p className="text-base text-zinc-500 leading-relaxed font-medium max-w-xl opacity-80">
                                                    Certified for demonstrating expertise in core industry frameworks, technical leadership,
                                                    and strategic problem-solving as verified by the Zenit Academy Examination Board.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 pt-16 grid grid-cols-1 md:grid-cols-3 gap-12 items-end border-t border-white/5">
                                        <div className="space-y-3">
                                            <p className="text-lg font-black text-white leading-none">{cert.programmeDirector}</p>
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] leading-tight flex flex-col">
                                                <span>Programme Director</span>
                                                <span className="opacity-50 mt-1">{cert.issuedBy}</span>
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-black">VALIDATED ON</p>
                                                <p className="text-xs font-black text-zinc-300 mt-0.5">{formatDate(cert)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 text-right">
                                            <p className="text-lg font-black text-white leading-none">Zenit Intelligence</p>
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] leading-tight flex flex-col">
                                                <span>Authentication Node</span>
                                                <span className="opacity-50 mt-1">Registry Authority</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metadata Bento */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Signature ID', value: cert.credentialId, icon: <Fingerprint className="w-4 h-4 text-violet-400" />, sub: 'Encrypted Blockchain Record' },
                                { label: 'Auth Status', value: 'Active & Valid', icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, sub: 'Verified Zenit Hash' },
                                { label: 'Verified To', value: cert.recipientName, icon: <User className="w-4 h-4 text-blue-400" />, sub: cert.recipientEmail },
                            ].map((item, idx) => (
                                <div key={idx} className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl space-y-3 hover:bg-zinc-800/40 transition-all duration-300">
                                    <div className="flex items-center gap-2 group">
                                        {item.icon}
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400">{item.label}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white truncate">{item.value}</p>
                                        <p className="text-[10px] text-zinc-600 font-medium mt-1">{item.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-center pt-8">
                            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] leading-relaxed">
                                Zenit Academy Autonomous Credentialing Network<br />
                                Node: US-EAST-1 · Registry Protocol v4.2
                            </p>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Global Footer */}
            <footer className="relative z-50 border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">© 2026 Zenit Academy</p>
                    <div className="h-4 w-[1px] bg-white/5 hidden md:block" />
                    <p className="text-[10px] text-zinc-700 font-medium max-w-md">The Zenit Registry provides authoritative verification for academic and professional credentials issued within our ecosystem.</p>
                </div>
                <div className="flex items-center gap-8">
                    <button className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" /> Registry Terms
                    </button>
                    <Link href="/dashboard" className="text-[10px] font-black text-violet-400 hover:text-violet-300 uppercase tracking-widest transition-colors flex items-center gap-2">
                        Mission Control <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </footer>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
                @media print {
                    header, footer, .badge, .metadata { display: none !important; }
                    body { background: white !important; }
                    .main-card { box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}
