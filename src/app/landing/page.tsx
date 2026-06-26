"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useMotionTemplate, type MotionValue } from 'framer-motion';
import { ZenitLogo } from '@/components/brand/zenit-logo';
import { CURRENCIES, fmtPrice, annualPrice, currencyForCountry, type CurrencyCode } from '@/lib/pricing';
import type { HeroState } from '@/components/three/ZenitHero3D';
import {
    CheckCircle2, Smartphone, BarChart3, ClipboardCheck, Zap,
    ArrowRight, Globe, ChevronDown,
} from 'lucide-react';

const ZenitHero3D = dynamic(() => import('@/components/three/ZenitHero3D'), { ssr: false });

const FEATURES = [
    { icon: ClipboardCheck, title: 'One platform, five tools retired', desc: 'Test management, bug tracking, device fleet, automation and analytics — consolidated. Cut licence sprawl and the cost that comes with it.', span: 'lg:col-span-2' },
    { icon: BarChart3, title: 'Decision-ready analytics', desc: 'Live pass-rates, coverage and team velocity — board-ready, no manual reporting.', span: '' },
    { icon: Smartphone, title: 'Full device traceability', desc: 'Every bug tied to the exact device it came from. QR checkout, audits, real-time sync.', span: '' },
    { icon: Zap, title: 'Live in an afternoon', desc: 'Web-based, zero install, Jira-ready. Your team is running real test cycles the same day.', span: 'lg:col-span-2' },
];

// ─── Cinematic brand splash (title-card transformation) ──────────────────────
// The dot is the pen tip that draws the Z; it then detaches, the Z un-draws in
// its wake, "Zenit" writes itself as the dot flies, and the dot lands as the dot
// of the hand-built "i". No particles, no splash — the transformation is the show.
type SplashPhase = 'draw' | 'anticip' | 'fly' | 'land' | 'complete';

const ZENIT = ['Z', 'e', 'n', 'i', 't'];
// Z polyline in viewBox units (the pen path) + segment-proportional timing
const ZPTS: [number, number][] = [[15, 25], [80, 25], [30, 80], [65, 80]];
const ZTIMES = [0, 0.373, 0.799, 1];
const GLOW = '0 0 16px 3px rgba(0,198,255,0.6)';
const GLOW_HI = '0 0 30px 9px rgba(0,198,255,0.9)';

function ZenitSplash({ onDone }: { onDone: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const iRef = useRef<HTMLSpanElement>(null);
    const targetRef = useRef<HTMLSpanElement>(null);
    const startedRef = useRef(false);
    const [c, setC] = useState<{ pts: [number, number][]; tx: number; ty: number; ds: number } | null>(null);
    const [phase, setPhase] = useState<SplashPhase>('draw');

    const measure = useCallback(() => {
        const cont = containerRef.current, svg = svgRef.current, t = targetRef.current;
        if (!cont || !svg || !t) return;
        const cb = cont.getBoundingClientRect(), sb = svg.getBoundingClientRect(), tb = t.getBoundingClientRect();
        const pts = ZPTS.map(([vx, vy]) => [
            sb.left - cb.left + (vx / 100) * sb.width,
            sb.top - cb.top + (vy / 100) * sb.height,
        ] as [number, number]);
        let ds = 12;
        if (iRef.current) { const fs = parseFloat(getComputedStyle(iRef.current).fontSize); if (fs) ds = Math.max(7, Math.round(fs * 0.2)); }
        setC({ pts, tx: tb.left + tb.width / 2 - cb.left, ty: tb.top + tb.height / 2 - cb.top, ds });
    }, []);

    useEffect(() => {
        measure();
        const id = setTimeout(measure, 250);
        (document as any).fonts?.ready?.then?.(measure);
        window.addEventListener('resize', measure);
        return () => { clearTimeout(id); window.removeEventListener('resize', measure); };
    }, [measure]);

    // start the choreography only once the geometry is known (deterministic + synced)
    useEffect(() => {
        if (!c || startedRef.current) return;
        startedRef.current = true;
        const timers = [
            setTimeout(() => setPhase('anticip'), 1700),  // Z drawn → dot eases at the edge
            setTimeout(() => setPhase('fly'), 1950),       // dot launches, Z un-draws, "Zenit" writes
            setTimeout(() => setPhase('land'), 3150),      // dot seats as the "i" dot
            setTimeout(() => setPhase('complete'), 3300),  // "Tracker" writes in
            setTimeout(onDone, 4600),
        ];
        return () => timers.forEach(clearTimeout);
    }, [c, onDone]);

    const drawn = phase !== 'draw';
    const erasing = phase === 'fly' || phase === 'land' || phase === 'complete';
    const writeZenit = phase === 'fly' || phase === 'land' || phase === 'complete';
    const showTracker = phase === 'land' || phase === 'complete';

    const letterParent = { hide: {}, show: { transition: { staggerChildren: 0.09 } } };
    const letterChild = {
        hide: { clipPath: 'inset(0 100% 0 0)' },
        show: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.34, ease: [0.5, 0, 0.2, 1] as any } },
    };

    // dot geometry
    const pts = c?.pts;
    const P3 = pts?.[3];
    const ctrlX = c && P3 ? P3[0] + (c.tx - P3[0]) * 0.4 : 0;
    const ctrlY = c && P3 ? Math.min(P3[1], c.ty) - 70 : 0;
    const ds = c?.ds ?? 12;

    return (
        <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070f]">
            <div ref={containerRef} className="relative flex items-center justify-center" style={{ width: 'min(92vw, 680px)', height: 300 }}>

                {/* ── The Z mark — drawn by the dot, then un-drawn as the dot leaves ── */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg ref={svgRef} viewBox="0 0 100 100" className="w-36 h-36 md:w-44 md:h-44 overflow-visible"
                        style={{ filter: 'drop-shadow(0 0 16px rgba(0,150,255,0.4))' }}>
                        <defs>
                            <linearGradient id="zspl" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#007BFF" />
                                <stop offset="100%" stopColor="#00C6FF" />
                            </linearGradient>
                        </defs>
                        <motion.path d="M 15 25 H 80 L 30 80 H 65" stroke="url(#zspl)" strokeWidth="12" fill="none"
                            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={240}
                            initial={{ strokeDashoffset: 240 }}
                            animate={{ strokeDashoffset: !c ? 240 : (erasing ? 240 : 0) }}
                            transition={!drawn ? { duration: 1.7, ease: 'linear' } : erasing ? { duration: 0.7, ease: [0.4, 0, 0.6, 1] as any } : { duration: 0 }}
                        />
                    </svg>
                </div>

                {/* ── The wordmark — each letter writes itself; the "i" is hand-built ── */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-4xl md:text-6xl font-black tracking-tight leading-none select-none flex items-baseline">
                        <motion.div variants={letterParent} initial="hide" animate={writeZenit ? 'show' : 'hide'} className="flex items-baseline">
                            {ZENIT.map((ch, i) => (
                                ch === 'i' ? (
                                    <span key={i} ref={iRef} className="relative inline-block align-baseline" style={{ width: '0.30em', height: '0.52em' }}>
                                        <motion.span variants={letterChild} className="absolute bottom-0 bg-white"
                                            style={{ left: '50%', marginLeft: '-0.07em', width: '0.14em', height: '0.52em', borderRadius: '0.06em' }} />
                                        <span ref={targetRef} className="absolute" style={{ left: '50%', top: '-0.18em', width: 0, height: 0 }} />
                                    </span>
                                ) : (
                                    <motion.span key={i} variants={letterChild} className="inline-block align-baseline text-white">{ch}</motion.span>
                                )
                            ))}
                        </motion.div>
                        <motion.span
                            initial={{ clipPath: 'inset(0 100% 0 0)' }}
                            animate={{ clipPath: showTracker ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)' }}
                            transition={{ duration: 0.5, ease: [0.5, 0, 0.2, 1] as any }}
                            className="inline-block align-baseline text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF]"
                        >&nbsp;Tracker</motion.span>
                    </div>
                </div>

                {/* ── The single dot: pen tip → droplet → the dot of the "i" ── */}
                {c && P3 && (
                    <motion.div
                        className="absolute rounded-full"
                        style={{ width: ds, height: ds, marginLeft: -ds / 2, marginTop: -ds / 2, left: 0, top: 0, background: '#00C6FF', boxShadow: GLOW, zIndex: 50 }}
                        initial={{ x: pts![0][0], y: pts![0][1], opacity: 1, scale: 1 }}
                        animate={
                            phase === 'draw' ? { x: pts!.map(p => p[0]), y: pts!.map(p => p[1]), scale: 1, opacity: 1 }
                                : phase === 'anticip' ? { x: P3[0], y: P3[1], scale: [1, 0.88], opacity: 1 }
                                    : phase === 'fly' ? { x: [P3[0], ctrlX, c.tx], y: [P3[1], ctrlY, c.ty], scale: 1, opacity: 1 }
                                        : phase === 'land' ? { x: c.tx, y: c.ty, scale: [1, 0.8, 1], boxShadow: [GLOW, GLOW_HI, GLOW] }
                                            : { x: c.tx, y: c.ty, scale: 1, opacity: 1 }
                        }
                        transition={
                            phase === 'draw' ? { duration: 1.7, ease: 'linear', times: ZTIMES }
                                : phase === 'anticip' ? { duration: 0.25, ease: 'easeOut' }
                                    : phase === 'fly' ? { duration: 1.2, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }
                                        : phase === 'land' ? { duration: 0.42, ease: 'easeOut' }
                                            : { duration: 0.3 }
                        }
                    />
                )}
            </div>
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
        <section ref={ref} className="relative z-10" style={{ height: `${BEATS.length * 95}vh` }}>
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

// ─── Interactive feature card: pointer-tracked spotlight + animated icon ──────
function FeatureCard({ f, variants }: { f: typeof FEATURES[number]; variants: any }) {
    const mx = useMotionValue(-200);
    const my = useMotionValue(-200);
    const [hover, setHover] = useState(false);
    const spotlight = useMotionTemplate`radial-gradient(240px circle at ${mx}px ${my}px, rgba(0,198,255,0.14), transparent 72%)`;
    return (
        <motion.div
            variants={variants}
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set(e.clientX - r.left); my.set(e.clientY - r.top); }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => { setHover(false); mx.set(-200); my.set(-200); }}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={`group relative p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#007BFF]/40 transition-colors duration-300 overflow-hidden ${f.span}`}
        >
            <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />
            <motion.div
                animate={hover ? { y: [0, -5, 0] } : { y: 0 }}
                transition={hover ? { duration: 2.0, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                className="relative w-12 h-12 mb-5"
            >
                {/* icon plate — gentle breathing + sway */}
                <motion.div
                    animate={hover ? { rotate: [0, 6, -6, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                    transition={hover ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 300, damping: 18 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#007BFF]/25 to-[#00C6FF]/10 border border-white/10 flex items-center justify-center"
                >
                    <f.icon className="w-5 h-5 text-[#5cc8ff]" />
                </motion.div>
                {/* orbiting accent particle */}
                <motion.div
                    className="absolute inset-0"
                    animate={hover ? { rotate: 360 } : { rotate: 0 }}
                    transition={hover ? { duration: 2.8, repeat: Infinity, ease: 'linear' } : { duration: 0.4 }}
                >
                    <motion.span
                        className="absolute left-1/2 -top-1 w-1.5 h-1.5 -ml-[3px] rounded-full bg-[#5cc8ff]"
                        style={{ boxShadow: '0 0 8px 2px rgba(0,198,255,0.7)' }}
                        animate={{ opacity: hover ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                    />
                </motion.div>
                {/* glow pulse */}
                <motion.span
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{ boxShadow: '0 0 22px 2px rgba(0,198,255,0.55)' }}
                    animate={hover ? { opacity: [0, 0.7, 0] } : { opacity: 0 }}
                    transition={{ duration: 1.6, repeat: hover ? Infinity : 0, ease: 'easeInOut' }}
                />
            </motion.div>
            <h3 className="relative font-bold text-xl mb-2">{f.title}</h3>
            <p className="relative text-sm text-white/45 leading-relaxed">{f.desc}</p>
        </motion.div>
    );
}

export default function LandingPage() {
    const [loading, setLoading] = useState(true);
    const [cur, setCur] = useState<CurrencyCode>('INR');
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

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
            <AnimatePresence>{loading && <ZenitSplash onDone={() => setLoading(false)} />}</AnimatePresence>

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
                        <a href="#features" className="hover:text-white transition-colors">Platform</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
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
                        <Globe className="w-3.5 h-3.5" />The QA platform that pays for itself
                    </motion.div>
                    <motion.h1 variants={fade} className="text-6xl md:text-8xl font-black tracking-[-0.03em] leading-[0.95]">
                        Ship quality
                    </motion.h1>
                    <motion.h1 variants={fade} className="text-6xl md:text-8xl font-black tracking-[-0.03em] leading-[0.95] text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] via-[#00C6FF] to-violet-400">
                        at the speed of trust.
                    </motion.h1>
                    <motion.p variants={fade} className="text-base md:text-lg text-white/50 max-w-xl mx-auto mt-8 leading-relaxed">
                        Retire five disconnected tools. Give your QA team — and your board — one place for testing, bugs, devices and analytics. Less spend, faster releases, clearer decisions.
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
                <section id="features" className="py-24 px-6 bg-[#05070f]">
                    <div className="max-w-6xl mx-auto">
                        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
                            <motion.h2 variants={fade} className="text-4xl md:text-5xl font-black text-center tracking-tight mb-3">Built for outcomes, not busywork</motion.h2>
                            <motion.p variants={fade} className="text-center text-white/40 mb-16">Consolidate the stack. Cut the cost. Ship with confidence.</motion.p>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {FEATURES.map((f, i) => (
                                    <FeatureCard key={i} f={f} variants={fade} />
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Pricing */}
                <section id="pricing" className="py-24 px-6 bg-[#05070f]">
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

                {/* CTA */}
                <section className="py-24 px-6 bg-[#05070f]">
                    <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#007BFF]/15 via-[#00C6FF]/8 to-transparent p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#007BFF]/20 rounded-full blur-[100px]" />
                        <div className="relative">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Consolidate your QA. Start today.</h2>
                            <p className="text-white/50 mb-8 max-w-lg mx-auto">Free to start, priced to scale. No credit card, no migration headache — your team is running by this afternoon.</p>
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
                            <a href="#features" className="hover:text-white">Platform</a>
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
