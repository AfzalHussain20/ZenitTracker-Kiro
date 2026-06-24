"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ZenitLogo } from '@/components/brand/zenit-logo';
import { CURRENCIES, fmtPrice, annualPrice, currencyForCountry, type CurrencyCode } from '@/lib/pricing';
import type { HeroState } from '@/components/three/ZenitHero3D';
import {
    CheckCircle2, Smartphone, BarChart3, ClipboardCheck, Bug, Users, Zap,
    ArrowRight, Globe, ChevronDown,
} from 'lucide-react';

const ZenitHero3D = dynamic(() => import('@/components/three/ZenitHero3D'), { ssr: false });

const FEATURES = [
    { icon: ClipboardCheck, title: 'Test Management', desc: 'Plan, execute, and track suites with step-by-step run execution and live pass-rates.', span: 'lg:col-span-2' },
    { icon: Smartphone, title: 'Device Fleet — Keepr', desc: 'Know which phone every bug came from. QR checkout, weekly audits, real-time sync.', span: '' },
    { icon: Bug, title: 'Bug Tracking', desc: 'Jira sync, priority analytics, KPI dashboards.', span: '' },
    { icon: BarChart3, title: 'QA Analytics', desc: 'Pass rates, coverage, team performance and trend visualization in 3D.', span: 'lg:col-span-2' },
    { icon: Users, title: 'Team & Worklog', desc: 'Roles, capacity, and time tracking.', span: '' },
    { icon: Zap, title: 'Automation Runner', desc: 'Run and monitor automated suites with live telemetry.', span: '' },
];

const FAQS = [
    { q: 'How is Zenit different from TestRail or Zephyr?', a: 'Those tools only do test management. Zenit unifies test management, bug tracking, device fleet management, automation, and analytics in one platform — at a fraction of the price.' },
    { q: 'Can I import my existing test cases?', a: 'Yes. Create a plan, add cases manually or in bulk, and start running. Spreadsheet import is on the roadmap.' },
    { q: 'Is there a free plan?', a: 'Yes — 3 users, 5 test plans, and basic device tracking, free forever. Upgrade when your team grows.' },
    { q: 'Do you integrate with Jira?', a: 'Yes. Bug analytics and KPI dashboards sync directly with your Jira project on the Pro and Enterprise plans.' },
];

// ─── Loader (counts to 100, branded) ─────────────────────────────────────────
function Loader({ onDone }: { onDone: () => void }) {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        let raf = 0; const start = performance.now(); const dur = 1900;
        const ease = (x: number) => 1 - Math.pow(1 - x, 3);
        const tick = (t: number) => {
            const p = Math.min((t - start) / dur, 1);
            setPct(Math.round(ease(p) * 100));
            if (p < 1) raf = requestAnimationFrame(tick); else setTimeout(onDone, 250);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [onDone]);
    return (
        <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#05070f]">
            <ZenitLogo markClassName="w-10 h-10" className="text-2xl" />
            <div className="mt-8 w-56 h-px bg-white/10 relative overflow-hidden">
                <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#007BFF] to-[#00C6FF]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-xs tabular-nums tracking-[0.3em] text-white/40">{pct}%</p>
        </motion.div>
    );
}

// ─── Story beats: pinned captions that crossfade while the 3D choreographs ───
const BEATS = [
    {
        kicker: 'The problem',
        title: 'Your QA lives in five different tools.',
        body: 'Test cases in a spreadsheet. Bugs in Jira. Devices in a drawer. Reports built by hand at 11pm. Context lost in every handoff.',
    },
    {
        kicker: 'The shift',
        title: 'One source of truth — every signal in one orbit.',
        body: 'Plans, runs, bugs, devices and analytics share the same data. Click a failed test, see the exact phone it ran on, jump straight to the bug.',
    },
    {
        kicker: 'The payoff',
        title: 'Decisions in seconds, not spreadsheets.',
        body: 'Live pass-rates, fleet status and team velocity render the moment you open Zenit. No exports. No stale dashboards. Just trust.',
    },
];

// A single beat that fades + lifts as the stage scrolls through its slice
function Beat({ progress, index, total, beat }: { progress: MotionValue<number>; index: number; total: number; beat: typeof BEATS[number] }) {
    const seg = 1 / total;
    const start = index * seg;
    const inAt = start + seg * 0.12;
    const holdEnd = start + seg * 0.72;
    const end = start + seg;
    const opacity = useTransform(progress, [start, inAt, holdEnd, end], [0, 1, 1, 0]);
    const y = useTransform(progress, [start, inAt, holdEnd, end], [40, 0, 0, -40]);
    const blur = useTransform(progress, [start, inAt, holdEnd, end], [12, 0, 0, 12]);
    const filter = useTransform(blur, (b) => `blur(${b}px)`);
    return (
        <motion.div style={{ opacity, y, filter }} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-xs uppercase tracking-[0.4em] text-[#5cc8ff] mb-5">{beat.kicker}</span>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-0.02em] leading-[1.02] max-w-3xl">{beat.title}</h2>
            <p className="text-base md:text-lg text-white/55 max-w-xl mx-auto mt-6 leading-relaxed">{beat.body}</p>
        </motion.div>
    );
}

// Tall pinned scroll-stage: the 3D choreographs behind, captions crossfade through
function StoryStage() {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const railWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
    return (
        <section ref={ref} className="relative z-10" style={{ height: `${BEATS.length * 110}vh` }}>
            <div className="sticky top-0 h-screen overflow-hidden">
                {BEATS.map((b, i) => (
                    <Beat key={i} progress={scrollYProgress} index={i} total={BEATS.length} beat={b} />
                ))}
                {/* progress rail */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-40 h-px bg-white/10 overflow-hidden">
                    <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#007BFF] to-[#00C6FF]" style={{ width: railWidth }} />
                </div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    const [loading, setLoading] = useState(true);
    const [cur, setCur] = useState<CurrencyCode>('INR');
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // shared motion state for the 3D scene (no re-renders → smooth)
    const state = useRef<HeroState>({ scroll: 0, px: 0, py: 0 });

    // Lenis smooth inertia scroll + scroll progress
    useEffect(() => {
        let lenis: any;
        let raf = 0;
        (async () => {
            try {
                const Lenis = (await import('lenis')).default;
                lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
                const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
                raf = requestAnimationFrame(loop);
                lenis.on('scroll', ({ scroll, limit }: any) => {
                    state.current.scroll = limit > 0 ? scroll / limit : 0;
                });
            } catch { /* lenis unavailable — native scroll still works */ }
        })();
        const onScrollNative = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            state.current.scroll = max > 0 ? window.scrollY / max : 0;
        };
        window.addEventListener('scroll', onScrollNative, { passive: true });
        return () => { cancelAnimationFrame(raf); try { lenis?.destroy(); } catch {} window.removeEventListener('scroll', onScrollNative); };
    }, []);

    // pointer for 3D parallax
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            state.current.px = (e.clientX / window.innerWidth) * 2 - 1;
            state.current.py = -((e.clientY / window.innerHeight) * 2 - 1);
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
    }, []);

    // geo currency (works behind VPN)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/geo', { cache: 'no-store' });
                const d = await r.json();
                if (!cancelled && d?.country && d?.currency) { setCur(d.currency); return; }
            } catch {}
            try {
                const r2 = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
                const d2 = await r2.json();
                if (!cancelled && d2?.country_code) setCur(currencyForCountry(d2.country_code));
            } catch {}
        })();
        return () => { cancelled = true; };
    }, []);

    const cfg = CURRENCIES[cur];
    const proPrice = cycle === 'annual' ? annualPrice(cfg.pro) : cfg.pro;
    const entPrice = cycle === 'annual' ? annualPrice(cfg.enterprise) : cfg.enterprise;
    const per = cycle === 'annual' ? '/yr per user' : '/mo per user';

    const fade = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as any } } };
    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

    return (
        <div className="relative min-h-screen bg-[#05070f] text-white selection:bg-[#007BFF]/30">
            <AnimatePresence>{loading && <Loader onDone={() => setLoading(false)} />}</AnimatePresence>

            {/* Fixed 3D background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <ZenitHero3D state={state} />
            </div>
            {/* vignette + grain over the 3D */}
            <div className="fixed inset-0 z-[1] pointer-events-none" style={{ boxShadow: 'inset 0 0 240px 40px rgba(5,7,15,0.9)' }} />

            {/* ── Nav ── */}
            <nav className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-[#05070f]/50 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <ZenitLogo />
                    <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login"><Button variant="ghost" className="text-sm text-white/70 hover:text-white">Log in</Button></Link>
                        <Link href="/signup">
                            <Button className="text-sm bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-lg shadow-[#007BFF]/25">
                                Get Started <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero (3D shows behind) ── */}
            <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
                <motion.div initial="hidden" animate={loading ? 'hidden' : 'show'} variants={stagger}>
                    <motion.div variants={fade} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#5cc8ff] font-semibold mb-7 backdrop-blur-sm">
                        <Globe className="w-3.5 h-3.5" />The all-in-one QA platform
                    </motion.div>
                    <motion.h1 variants={fade} className="text-6xl md:text-8xl font-black tracking-[-0.03em] leading-[0.95]">
                        Ship quality
                    </motion.h1>
                    <motion.h1 variants={fade} className="text-6xl md:text-8xl font-black tracking-[-0.03em] leading-[0.95] text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] via-[#00C6FF] to-violet-400">
                        at the speed of trust.
                    </motion.h1>
                    <motion.p variants={fade} className="text-base md:text-lg text-white/50 max-w-xl mx-auto mt-8 leading-relaxed">
                        Test management, bug tracking, device fleet control, automation and analytics — unified in one breathtaking platform.
                    </motion.p>
                    <motion.div variants={fade} className="flex items-center justify-center gap-4 mt-10 flex-wrap">
                        <Link href="/signup">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-xl shadow-[#007BFF]/30">
                                Start Free — No Credit Card
                            </Button>
                        </Link>
                        <a href="#features">
                            <Button size="lg" className="h-12 px-8 text-sm font-bold bg-white/5 hover:bg-white/10 text-white border border-white/15 backdrop-blur-sm">
                                Explore
                            </Button>
                        </a>
                    </motion.div>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: loading ? 0 : 1 }} transition={{ delay: 1.2 }}
                    className="absolute bottom-8 flex flex-col items-center gap-2 text-white/30">
                    <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
                    <ChevronDown className="w-4 h-4 animate-bounce" />
                </motion.div>
            </section>

            {/* ── Cinematic scroll-stage: 3D choreographs behind crossfading beats ── */}
            <StoryStage />

            {/* ── Content (solid sections slide over the 3D) ── */}
            <div className="relative z-10 bg-gradient-to-b from-transparent via-[#05070f] to-[#05070f]">
                {/* spacer so hero 3D breathes */}
                <div className="h-[20vh]" />

                {/* Trust band */}
                <section className="py-10 px-6 border-y border-white/5 bg-[#05070f]/60 backdrop-blur-sm">
                    <p className="text-center text-xs uppercase tracking-[0.3em] text-white/30 mb-6">Replaces the tools you&apos;re already paying for</p>
                    <div className="flex items-center justify-center gap-6 md:gap-12 flex-wrap text-white/30 text-sm font-semibold">
                        <span>TestRail</span><span className="text-white/15">+</span><span>Zephyr</span><span className="text-white/15">+</span><span>Spreadsheets</span><span className="text-white/15">+</span><span>Device Drawer</span><span className="text-white/15">=</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF] font-black text-base">Zenit</span>
                    </div>
                </section>

                {/* Features bento */}
                <section id="features" className="py-28 px-6 bg-[#05070f]">
                    <div className="max-w-6xl mx-auto">
                        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
                            <motion.h2 variants={fade} className="text-4xl md:text-5xl font-black text-center tracking-tight mb-3">Everything your QA team needs</motion.h2>
                            <motion.p variants={fade} className="text-center text-white/40 mb-16">One platform. Zero context-switching.</motion.p>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {FEATURES.map((f, i) => (
                                    <motion.div key={i} variants={fade} className={`group p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#007BFF]/40 hover:bg-[#007BFF]/[0.04] transition-all duration-300 ${f.span}`}>
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007BFF]/20 to-[#00C6FF]/10 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                            <f.icon className="w-5 h-5 text-[#5cc8ff]" />
                                        </div>
                                        <h3 className="font-bold text-xl mb-2">{f.title}</h3>
                                        <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Stats */}
                <section className="py-20 px-6 border-y border-white/5 bg-white/[0.02]">
                    <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { v: '5-in-1', l: 'Tools unified' },
                            { v: '5 min', l: 'To first test run' },
                            { v: '3×', l: 'Cheaper than TestRail' },
                            { v: '100%', l: 'Web-based, no install' },
                        ].map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                                <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF]">{s.v}</p>
                                <p className="text-xs text-white/40 mt-2">{s.l}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Pricing */}
                <section id="pricing" className="py-28 px-6 bg-[#05070f]">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-4xl md:text-5xl font-black text-center tracking-tight mb-3">Simple, fair pricing</h2>
                        <p className="text-center text-white/40 mb-3">
                            Showing prices in <span className="text-white font-semibold">{cfg.code}</span>
                            <span className="text-white/30"> · auto-detected for your region</span>
                        </p>
                        <div className="flex justify-center mb-14">
                            <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                                <button onClick={() => setCycle('monthly')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'monthly' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Monthly</button>
                                <button onClick={() => setCycle('annual')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'annual' ? 'bg-white/10 text-white' : 'text-white/50'}`}>Annual <span className="text-emerald-400">−17%</span></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                                <h3 className="text-lg font-bold mb-1">Free</h3>
                                <div className="text-3xl font-black mb-1">{fmtPrice(0, cfg)}</div>
                                <p className="text-xs text-white/40 mb-6">Forever, for individuals</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['3 users', '5 test plans', '10 devices', 'Basic analytics'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/60"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{f}</li>
                                    ))}
                                </ul>
                                <Link href="/signup"><Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Start Free</Button></Link>
                            </div>
                            <div className="relative p-7 rounded-2xl border border-[#007BFF]/40 bg-gradient-to-b from-[#007BFF]/10 to-transparent ring-1 ring-[#007BFF]/20">
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#007BFF] to-[#00C6FF] text-white">Most Popular</span>
                                <h3 className="text-lg font-bold mb-1">Pro</h3>
                                <div className="flex items-baseline gap-1 mb-1"><span className="text-3xl font-black">{fmtPrice(proPrice, cfg)}</span><span className="text-sm text-white/40">{per}</span></div>
                                <p className="text-xs text-white/40 mb-6">For growing QA teams</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['Unlimited users', 'Unlimited plans', 'Unlimited devices', 'Jira integration', 'Advanced analytics', 'Priority support'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/70"><CheckCircle2 className="w-4 h-4 text-[#5cc8ff]" />{f}</li>
                                    ))}
                                </ul>
                                <Link href="/signup"><Button className="w-full bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0">Start Trial</Button></Link>
                            </div>
                            <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                                <h3 className="text-lg font-bold mb-1">Enterprise</h3>
                                <div className="flex items-baseline gap-1 mb-1"><span className="text-3xl font-black">{fmtPrice(entPrice, cfg)}</span><span className="text-sm text-white/40">{per}</span></div>
                                <p className="text-xs text-white/40 mb-6">For large QA departments</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/60"><CheckCircle2 className="w-4 h-4 text-violet-400" />{f}</li>
                                    ))}
                                </ul>
                                <Link href="/signup"><Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Get Started</Button></Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="py-28 px-6 bg-[#05070f]">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-5xl font-black text-center tracking-tight mb-14">Questions, answered</h2>
                        <div className="space-y-3">
                            {FAQS.map((f, i) => (
                                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                                        <span className="font-semibold text-sm">{f.q}</span>
                                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {openFaq === i && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <p className="px-5 pb-4 text-sm text-white/50 leading-relaxed">{f.a}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-28 px-6 bg-[#05070f]">
                    <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#007BFF]/15 via-[#00C6FF]/8 to-transparent p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#007BFF]/20 rounded-full blur-[100px]" />
                        <div className="relative">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Bring your QA into one place.</h2>
                            <p className="text-white/50 mb-8 max-w-lg mx-auto">Start free in minutes. No credit card, no migration headache.</p>
                            <Link href="/signup">
                                <Button size="lg" className="h-12 px-10 text-sm font-bold bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-xl shadow-[#007BFF]/30">
                                    Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-12 px-6 border-t border-white/10 bg-[#05070f]">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        <ZenitLogo markClassName="w-6 h-6" />
                        <div className="flex items-center gap-6 text-xs text-white/40">
                            <a href="#features" className="hover:text-white">Features</a>
                            <a href="#pricing" className="hover:text-white">Pricing</a>
                            <Link href="/login" className="hover:text-white">Log in</Link>
                        </div>
                        <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Zenit Antigravity</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}
