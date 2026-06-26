'use client';

/**
 * ZenitSplashAnimation — cinematic title-card splash, ONE animation engine.
 *
 * A single Framer Motion timeline (useMotionValue + animate, sequenced with
 * async/await) drives everything. No SMIL, no CSS keyframes, no hardcoded
 * setTimeout races, no key-based remounting.
 *
 * Story:  the dot is the pen tip that draws the Z (stroke + dot share ONE eased
 * value, so the draw never stalls) → it pauses, compresses, then launches on a
 * Bezier arc → the Z un-draws in its wake → "Zenit" writes itself → the same dot
 * lands as the dot of the hand-built "i" → "Tracker" writes in → hold → fade out.
 *
 * The landing point is measured live with getBoundingClientRect(), so the dot
 * lands exactly on the "i" at any size or font scale.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

const ZENIT = ['Z', 'e', 'n', 'i', 't'];
const ZPTS: [number, number][] = [[15, 25], [80, 25], [30, 80], [65, 80]];
const SEG = [0, 0.373, 0.799, 1]; // cumulative arc-length fraction at each Z point

function polyline(p: number, pts: [number, number][]): [number, number] {
    const q = Math.max(0, Math.min(1, p));
    for (let i = 0; i < 3; i++) {
        if (q <= SEG[i + 1] || i === 2) {
            const t = Math.max(0, Math.min(1, (q - SEG[i]) / (SEG[i + 1] - SEG[i])));
            return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
        }
    }
    return pts[3];
}

const ZenitSplashAnimation = () => {
    const [show, setShow] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const iRef = useRef<HTMLSpanElement>(null);
    const targetRef = useRef<HTMLSpanElement>(null);
    const startedRef = useRef(false);
    const flyingRef = useRef(false);

    const [c, setC] = useState<{ pts: [number, number][]; tx: number; ty: number; ds: number } | null>(null);
    const [writeZenit, setWriteZenit] = useState(false);
    const [showTracker, setShowTracker] = useState(false);
    const [showTag, setShowTag] = useState(false);

    // single source of truth — no re-renders drive these
    const progress = useMotionValue(0);
    const x = useMotionValue(-9999);
    const y = useMotionValue(-9999);
    const scale = useMotionValue(1);
    const dash = useMotionValue(1); // pathLength-normalised: 1 → hidden, 0 → fully drawn
    const glow = useMotionValue(0);
    const boxShadow = useTransform(glow, (g) => `0 0 ${16 + g * 16}px ${3 + g * 6}px rgba(0,198,255,${0.6 + g * 0.32})`);

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
        const id = setTimeout(measure, 200);
        (document as any).fonts?.ready?.then?.(measure);
        const onResize = () => { if (!startedRef.current) measure(); };
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(id); window.removeEventListener('resize', onResize); };
    }, [measure]);

    // glue the stroke + dot together during the draw (one eased progress value)
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

    // the master timeline — starts once geometry is known, dismisses when finished
    useEffect(() => {
        if (!c || startedRef.current) return;
        startedRef.current = true;

        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        let cancelled = false;

        const seq = async () => {
            if (reduce) {
                setWriteZenit(true); setShowTracker(true); setShowTag(true);
                x.set(c.tx); y.set(c.ty); dash.set(1); flyingRef.current = true;
                await new Promise((r) => setTimeout(r, 1400));
                if (!cancelled) setShow(false);
                return;
            }
            // 1) DRAW — one continuous ease-out; the dot is the pen tip
            await animate(progress, 1, { duration: 1.8, ease: [0.33, 1, 0.68, 1] });
            if (cancelled) return;
            // 2) HOLD + ANTICIPATION
            await new Promise((r) => setTimeout(r, 160));
            if (cancelled) return;
            await animate(scale, 0.85, { duration: 0.18, ease: 'easeOut' });
            if (cancelled) return;
            // 3) BREAK AWAY — launch on a Bezier arc; Z un-draws; "Zenit" writes
            flyingRef.current = true;
            setWriteZenit(true);
            animate(scale, 1, { duration: 0.3, ease: 'easeOut' });
            animate(dash, 1, { duration: 0.7, ease: [0.4, 0, 0.6, 1] });
            const P3 = c.pts[3];
            const ctrlX = P3[0] + (c.tx - P3[0]) * 0.4;
            const ctrlY = Math.min(P3[1], c.ty) - 70;
            await Promise.all([
                animate(x, [P3[0], ctrlX, c.tx], { duration: 1.15, times: [0, 0.45, 1], ease: [0.45, 0, 0.2, 1] }),
                animate(y, [P3[1], ctrlY, c.ty], { duration: 1.15, times: [0, 0.45, 1], ease: [0.45, 0, 0.2, 1] }),
            ]);
            if (cancelled) return;
            // 4) LAND — seat as the "i" dot: tiny compression + subtle glow pulse
            setShowTracker(true);
            animate(glow, [0, 1, 0], { duration: 0.5, ease: 'easeOut' });
            await animate(scale, [1, 0.8, 1], { duration: 0.42, ease: 'easeOut' });
            if (cancelled) return;
            // 5) tagline + hold, then exit (dismiss only AFTER the sequence finishes)
            setShowTag(true);
            await new Promise((r) => setTimeout(r, 1300));
            if (!cancelled) setShow(false);
        };
        seq();
        return () => { cancelled = true; };
    }, [c, progress, x, y, scale, dash, glow]);

    const letterParent = { hide: {}, show: { transition: { staggerChildren: 0.09 } } };
    const letterChild = {
        hide: { clipPath: 'inset(0 100% 0 0)' },
        show: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.34, ease: [0.5, 0, 0.2, 1] as any } },
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="zenit-splash"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    onClick={() => setShow(false)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070f] cursor-pointer"
                >
                    <div ref={containerRef} className="relative flex flex-col items-center justify-center" style={{ width: 'min(92vw, 680px)', height: 320 }}>

                        {/* The Z — drawn by the dot, then un-drawn as the dot leaves */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg ref={svgRef} viewBox="0 0 100 100" className="w-36 h-36 md:w-44 md:h-44 overflow-visible"
                                style={{ filter: 'drop-shadow(0 0 16px rgba(0,150,255,0.4))' }}>
                                <defs>
                                    <linearGradient id="zenitSplashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#007BFF" />
                                        <stop offset="100%" stopColor="#00C6FF" />
                                    </linearGradient>
                                </defs>
                                <motion.path d="M 15 25 H 80 L 30 80 H 65" stroke="url(#zenitSplashGrad)" strokeWidth="12" fill="none"
                                    strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1}
                                    style={{ strokeDashoffset: dash }} />
                            </svg>
                        </div>

                        {/* Wordmark — each letter writes itself; the "i" is hand-built */}
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

                        {/* tagline — fades in only after the lockup settles */}
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={showTag ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="absolute left-1/2 -translate-x-1/2 text-sm text-white/45 tracking-wide"
                            style={{ top: 'calc(50% + 2.6rem)' }}
                        >
                            Precision in Every Test.
                        </motion.p>

                        {/* the single dot: pen tip → droplet → the dot of the "i" */}
                        {c && (
                            <motion.div className="absolute rounded-full"
                                style={{ x, y, scale, boxShadow, width: c.ds, height: c.ds, marginLeft: -c.ds / 2, marginTop: -c.ds / 2, left: 0, top: 0, background: '#00C6FF', zIndex: 50 }} />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ZenitSplashAnimation;
