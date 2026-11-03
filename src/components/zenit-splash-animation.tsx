'use client';

/**
 * ZenitSplashAnimation — cinematic title-card splash, elevated v2.
 *
 * One Framer Motion timeline drives everything end-to-end:
 *   1) The dot is the pen tip that draws the Z (one shared eased value, never stalls)
 *   2) It pauses, compresses, then launches on a Bezier arc while the Z un-draws
 *   3) "Zenit" writes itself letter-by-letter (hand-built "i" dot target)
 *   4) The dot lands exactly as the dot of the "i" (measured live via getBoundingClientRect)
 *   5) "Tracker" writes in with a violet→cyan gradient
 *   6) Tagline fades in, hold, then fade out
 *
 * Theme-fitted: blue-only palette (royal blue + cyan) that feels native to Zenit.
 *
 * Reduced-motion safe + 12s absolute failsafe so it can never trap the user.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

const ZENIT = ['Z', 'e', 'n', 'i', 't'];
// The Z as a polyline with cumulative arc-length fractions at each vertex.
const ZPTS: [number, number][] = [[15, 25], [80, 25], [30, 80], [65, 80]];
const SEG = [0, 0.373, 0.799, 1];

function polyline(p: number, pts: [number, number][]): [number, number] {
    const q = Math.max(0, Math.min(1, p));
    for (let i = 0; i < 3; i++) {
        if (q <= SEG[i + 1] || i === 2) {
            const t = Math.max(0, Math.min(1, (q - SEG[i]) / (SEG[i + 1] - SEG[i])));
            return [
                pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
            ];
        }
    }
    return pts[3];
}

// Blue-only palette — no violet. Deep royal blue + cyan accent.
const BLUE_BRIGHT = 'rgb(37 99 235)'; // blue-600
const CYAN = 'rgb(6 182 212)';        // cyan-500 accent

const ZenitSplashAnimation = ({ onComplete }: { onComplete?: () => void } = {}) => {
    const [show, setShow] = useState(true);
    const dismiss = useCallback(() => {
        setShow(false);
        onComplete?.();
    }, [onComplete]);

    // Absolute safety net — never leave the overlay stuck.
    useEffect(() => {
        const t = setTimeout(() => dismiss(), 12000);
        return () => clearTimeout(t);
    }, [dismiss]);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const iRef = useRef<HTMLSpanElement>(null);
    const targetRef = useRef<HTMLSpanElement>(null);
    const startedRef = useRef(false);
    const flyingRef = useRef(false);

    const [c, setC] = useState<{ pts: [number, number][]; tx: number; ty: number; ds: number } | null>(null);
    const geomRef = useRef<{ pts: [number, number][]; tx: number; ty: number; ds: number } | null>(null);
    const [ready, setReady] = useState(false);
    const [writeZenit, setWriteZenit] = useState(false);
    const [showTracker, setShowTracker] = useState(false);
    const [showTag, setShowTag] = useState(false);

    // Single source of truth — no re-renders drive these.
    const progress = useMotionValue(0);
    const x = useMotionValue(-9999);
    const y = useMotionValue(-9999);
    const scale = useMotionValue(1);
    const dash = useMotionValue(1); // pathLength-normalised: 1 → hidden, 0 → fully drawn
    const glow = useMotionValue(0);
    const boxShadow = useTransform(glow, (g) => `0 0 ${16 + g * 24}px ${4 + g * 8}px ${CYAN}`);

    const measure = useCallback(() => {
        const cont = containerRef.current, svg = svgRef.current, t = targetRef.current;
        if (!cont || !svg || !t) return;
        const cb = cont.getBoundingClientRect(), sb = svg.getBoundingClientRect(), tb = t.getBoundingClientRect();
        const pts = ZPTS.map(([vx, vy]) => [
            sb.left - cb.left + (vx / 100) * sb.width,
            sb.top - cb.top + (vy / 100) * sb.height,
        ] as [number, number]);
        let ds = 12;
        if (iRef.current) {
            const fs = parseFloat(getComputedStyle(iRef.current).fontSize);
            if (fs) ds = Math.max(8, Math.round(fs * 0.18));
        }
        const geom = { pts, tx: tb.left + tb.width / 2 - cb.left, ty: tb.top + tb.height / 2 - cb.top, ds };
        geomRef.current = geom;
        setC(geom);
        setReady(true);
    }, []);

    useEffect(() => {
        measure();
        let tries = 0;
        const id = setInterval(() => { if (geomRef.current || tries++ > 30) clearInterval(id); else measure(); }, 50);
        (document as any).fonts?.ready?.then?.(() => { if (!startedRef.current) measure(); });
        const onResize = () => { if (!startedRef.current) measure(); };
        window.addEventListener('resize', onResize);
        return () => { clearInterval(id); window.removeEventListener('resize', onResize); };
    }, [measure]);

    // Glue stroke + dot together during the draw (one eased progress value).
    useEffect(() => {
        if (!c) return;
        const start = polyline(0, c.pts);
        if (!flyingRef.current) { x.set(start[0]); y.set(start[1]); dash.set(1); }
        const unsub = progress.on('change', (p) => {
            if (flyingRef.current) return;
            dash.set(1 - p);
            const pt = polyline(p, c.pts);
            x.set(pt[0]); y.set(pt[1]);
        });
        return unsub;
    }, [c, progress, x, y, dash]);

    // Master timeline — runs ONCE when geometry is ready.
    useEffect(() => {
        if (!ready || startedRef.current) return;
        startedRef.current = true;

        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        let cancelled = false;
        const failSafe = setTimeout(() => { if (!cancelled) dismiss(); }, 9000);

        const seq = async () => {
            const g0 = geomRef.current!;
            if (reduce) {
                setWriteZenit(true); setShowTracker(true); setShowTag(true);
                x.set(g0.tx); y.set(g0.ty); dash.set(1); flyingRef.current = true;
                await new Promise((r) => setTimeout(r, 1200));
                clearTimeout(failSafe);
                if (!cancelled) dismiss();
                return;
            }
            // 1) DRAW — one continuous ease-out; dot is the pen tip.
            await animate(progress, 1, { duration: 1.9, ease: [0.35, 1, 0.7, 1] });
            if (cancelled) return;
            // 2) Anticipation — tiny pause + compression before launch.
            await new Promise((r) => setTimeout(r, 140));
            if (cancelled) return;
            await animate(scale, 0.72, { duration: 0.16, ease: 'easeOut' });
            if (cancelled) return;
            // 3) BREAK AWAY — launch on Bezier arc; Z un-draws; "Zenit" writes.
            flyingRef.current = true;
            setWriteZenit(true);
            animate(scale, 1, { duration: 0.3, ease: 'easeOut' });
            animate(dash, 1, { duration: 0.75, ease: [0.4, 0, 0.6, 1] });
            const g = geomRef.current ?? g0;
            const P3 = g.pts[3];
            const ctrlX = P3[0] + (g.tx - P3[0]) * 0.45;
            const ctrlY = Math.min(P3[1], g.ty) - 72;
            await Promise.all([
                animate(x, [P3[0], ctrlX, g.tx], { duration: 1.2, times: [0, 0.45, 1], ease: [0.45, 0, 0.2, 1] }),
                animate(y, [P3[1], ctrlY, g.ty], { duration: 1.2, times: [0, 0.45, 1], ease: [0.45, 0, 0.2, 1] }),
            ]);
            if (cancelled) return;
            // 4) LAND — seat as the dot of the "i": compression + glow pulse.
            setShowTracker(true);
            animate(glow, [0, 1, 0], { duration: 0.5, ease: 'easeOut' });
            await animate(scale, [1, 0.78, 1], { duration: 0.45, ease: 'easeOut' });
            if (cancelled) return;
            // 5) Tagline fades in, hold, then exit.
            setShowTag(true);
            await new Promise((r) => setTimeout(r, 1400));
            clearTimeout(failSafe);
            if (!cancelled) dismiss();
        };
        seq();
        return () => { cancelled = true; clearTimeout(failSafe); };
    }, [ready, progress, x, y, scale, dash, glow, dismiss]);

    const letterParent = { hide: {}, show: { transition: { staggerChildren: 0.105 } } };
    const letterChild = {
        hide: { clipPath: 'inset(0 100% 0 0)' },
        show: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.36, ease: [0.5, 0, 0.2, 1] as any } },
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="zenit-splash"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    onClick={() => dismiss()}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(var(--background))] cursor-pointer"
                >
                    <div ref={containerRef} className="relative flex flex-col items-center justify-center" style={{ width: 'min(92vw, 700px)', height: 340 }}>

                        {/* Soft glass panel behind the animation for depth */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--sidebar))/95] to-[hsl(var(--sidebar))/70] backdrop-blur-md border border-[hsl(var(--sidebar-border))/40] rounded-3xl shadow-2xl" />

                        {/* The Z — drawn by the dot, then un-drawn as the dot leaves */}
                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                            <svg ref={svgRef} viewBox="0 0 100 100" className="w-36 h-36 md:w-48 md:h-48 overflow-visible"
                                 style={{ filter: `drop-shadow(0 0 20px ${CYAN}40)` }}>
                                <defs>
                                    <linearGradient id="zenitSplashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={BLUE_BRIGHT} />
                                        <stop offset="100%" stopColor={CYAN} />
                                    </linearGradient>
                                </defs>
                                <motion.path d="M 15 25 H 80 L 30 80 H 65" stroke="url(#zenitSplashGrad)" strokeWidth="12" fill="none"
                                    strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1}
                                    style={{ strokeDashoffset: dash }} />
                            </svg>
                        </div>

                        {/* Wordmark — each letter writes itself; the "i" is hand-built */}
                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                            <div className="text-5xl md:text-7xl font-black tracking-tight leading-none select-none flex items-baseline">
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
                                    transition={{ duration: 0.55, ease: [0.5, 0, 0.2, 1] as any }}
                                    className="inline-block align-baseline text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400"
                                >&nbsp;Tracker</motion.span>
                            </div>
                        </div>

                        {/* Tagline — fades in only after the lockup settles */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={showTag ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            className="absolute left-1/2 -translate-x-1/2 text-xs sm:text-sm text-[hsl(var(--muted-foreground))] tracking-widest font-medium"
                            style={{ top: 'calc(50% + 2.9rem)' }}
                        >
                            Precision in Every Test.
                        </motion.p>

                        {/* The single dot: pen tip → droplet → the dot of the "i" */}
                        {c && (
                            <motion.div className="absolute rounded-full z-50"
                                style={{
                                    x, y, scale, boxShadow,
                                    width: c.ds, height: c.ds,
                                    marginLeft: -c.ds / 2, marginTop: -c.ds / 2,
                                    left: 0, top: 0,
                                    background: CYAN,
                                }} />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ZenitSplashAnimation;
