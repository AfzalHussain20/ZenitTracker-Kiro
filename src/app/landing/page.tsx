"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    motion, AnimatePresence, useScroll, useTransform,
    useMotionValue, useMotionTemplate, animate, type MotionValue,
} from 'framer-motion';
import { ZenitLogo } from '@/components/brand/zenit-logo';
import { CURRENCIES, fmtPrice, annualPrice, currencyForCountry, type CurrencyCode } from '@/lib/pricing';
import type { HeroState } from '@/components/three/ZenitHero3D';
import {
    CheckCircle2, Smartphone, BarChart3, ClipboardCheck, Zap,
    ArrowRight, Globe, ChevronDown,
} from 'lucide-react';

const ZenitHero3D = dynamic(() => import('@/components/three/ZenitHero3D'), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURES
// ─────────────────────────────────────────────────────────────────────────────
const FEATURES = [
    { icon: ClipboardCheck, title: 'One platform, five tools retired',  desc: 'Test management, bug tracking, device fleet, automation and analytics — consolidated. Cut licence sprawl and the cost that comes with it.', span: 'lg:col-span-2' },
    { icon: BarChart3,      title: 'Decision-ready analytics',           desc: 'Live pass-rates, coverage and team velocity — board-ready, no manual reporting.',                                                           span: '' },
    { icon: Smartphone,     title: 'Full device traceability',           desc: 'Every bug tied to the exact device it came from. QR checkout, audits, real-time sync.',                                                     span: '' },
    { icon: Zap,            title: 'Live in an afternoon',               desc: 'Web-based, zero install, Jira-ready. Your team is running real test cycles the same day.',                                                  span: 'lg:col-span-2' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Z GEOMETRY
//  P0 = top-left   P1 = top-right
//  P2 = bot-left   P3 = bot-right
//
//  Draw path  : P0 → P1 → P2 → P3   (the Z stroke, left-to-right)
//  Ride back  : P3 → P2 → P1         (roller-coaster reverse, Z stays drawn)
//  Pop        : P1 → i-dot           (launch left across screen)
// ─────────────────────────────────────────────────────────────────────────────
const ZPTS: [number, number][] = [
    [15, 25],  // P0 top-left
    [80, 25],  // P1 top-right
    [30, 80],  // P2 bot-left
    [65, 80],  // P3 bot-right
];

// Build cumulative arc-length segments for a polyline
function buildSegs(pts: [number, number][]): number[] {
    let total = 0;
    const lens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i+1][0] - pts[i][0];
        const dy = pts[i+1][1] - pts[i][1];
        lens.push(Math.sqrt(dx*dx + dy*dy));
        total += lens[i];
    }
    let acc = 0;
    const cum = [0];
    for (const l of lens) { acc += l; cum.push(acc / total); }
    return cum;
}
const Z_SEG = buildSegs(ZPTS);

// Evaluate position at t ∈ [0,1] along a polyline
function polyline(t: number, pts: [number, number][], segs: number[]): [number, number] {
    const q = Math.max(0, Math.min(1, t));
    for (let i = 0; i < pts.length - 1; i++) {
        if (q <= segs[i+1] || i === pts.length - 2) {
            const span = segs[i+1] - segs[i];
            const local = span > 0 ? (q - segs[i]) / span : 0;
            const tt = Math.max(0, Math.min(1, local));
            return [
                pts[i][0] + (pts[i+1][0] - pts[i][0]) * tt,
                pts[i][1] + (pts[i+1][1] - pts[i][1]) * tt,
            ];
        }
    }
    return pts[pts.length - 1];
}

// Quadratic bezier
function qbez(t: number, p0: [number,number], cp: [number,number], p1: [number,number]): [number,number] {
    const mt = 1 - t;
    return [
        mt*mt*p0[0] + 2*mt*t*cp[0] + t*t*p1[0],
        mt*mt*p0[1] + 2*mt*t*cp[1] + t*t*p1[1],
    ];
}

// Cubic bezier easing — Newton's method, CSS-compatible
function cbez(x1: number, y1: number, x2: number, y2: number, t: number): number {
    const cx = 3*x1, bx = 3*(x2-x1)-cx, ax = 1-cx-bx;
    const cy = 3*y1, by = 3*(y2-y1)-cy, ay = 1-cy-by;
    const sx = (u: number) => ((ax*u + bx)*u + cx)*u;
    const sy = (u: number) => ((ay*u + by)*u + cy)*u;
    let u = t;
    for (let i = 0; i < 8; i++) {
        const dx = (3*ax*u + 2*bx)*u + cx;
        if (Math.abs(dx) < 1e-6) break;
        u -= (sx(u) - t) / dx;
    }
    return sy(Math.max(0, Math.min(1, u)));
}

// RAF phase driver — pure requestAnimationFrame, no Framer scheduler.
// Resolves when complete or when cancelledRef becomes true.
function rafPhase(
    durationSec: number,
    ease: [number,number,number,number],
    onTick: (eased: number, raw: number) => void,
    cancelledRef: React.MutableRefObject<boolean>,
): Promise<void> {
    return new Promise(resolve => {
        const ms = durationSec * 1000;
        const t0 = performance.now();
        const tick = (now: number) => {
            if (cancelledRef.current) { resolve(); return; }
            const raw = Math.min(1, (now - t0) / ms);
            onTick(cbez(ease[0], ease[1], ease[2], ease[3], raw), raw);
            if (raw < 1) requestAnimationFrame(tick);
            else { onTick(1, 1); resolve(); }
        };
        requestAnimationFrame(tick);
    });
}

function wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

const FAILSAFE_MS     = 9000;
const MEASURE_POLL_MS = 32;
const MEASURE_TIMEOUT = 2500;

// ─────────────────────────────────────────────────────────────────────────────
//  LetterReveal — SLAM MATERIALISE.
//
//  The word doesn't "appear" — it ARRIVES. Like a heavyweight title stamped
//  onto the screen in one brutal instant. Each letter starts at 3× scale,
//  fully blurred, behind the viewer plane — then SLAMS into final position
//  in 0.26s. A white-hot flash sears the background on impact. The speed +
//  scale drop + instant deblur produces a visual "freeze" — the brain needs
//  a beat to register what just happened. That pause IS the masterpiece.
// ─────────────────────────────────────────────────────────────────────────────
function LetterReveal({ visible, char, delay = 0 }: { visible: boolean; char: string; delay?: number }) {
    return (
        <span className="relative inline-block align-baseline" style={{ perspective: 1000 }}>
            {/* IMPACT FLASH — white-hot sear that flares on contact */}
            <motion.span
                aria-hidden
                className="absolute -inset-4 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(180,230,255,0.9) 25%, transparent 65%)',
                    filter: 'blur(3px)',
                    mixBlendMode: 'screen',
                }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={visible
                    ? { opacity: [0, 1, 0], scale: [0.2, 1.8, 2.6] }
                    : { opacity: 0, scale: 0.2 }
                }
                transition={{ duration: 0.20, ease: [0.12, 1, 0.2, 1], delay }}
            />
            {/* THE LETTER — slams from huge/blurred to native/crisp: one violent motion */}
            <motion.span
                className="relative inline-block align-baseline text-white"
                style={{ willChange: 'transform, opacity, filter', transformStyle: 'preserve-3d', textShadow: '0 0 0px rgba(255,255,255,0)' }}
                initial={{ opacity: 0, scale: 3.2, rotateX: -40, y: '-0.25em', filter: 'blur(22px)' }}
                animate={visible
                    ? { opacity: [0, 1, 1], scale: [3.2, 0.92, 1], rotateX: [-40, 4, 0], y: ['-0.25em', '0.015em', '0em'], filter: ['blur(22px)', 'blur(0px)', 'blur(0px)'] }
                    : { opacity: 0, scale: 3.2, rotateX: -40, y: '-0.25em', filter: 'blur(22px)' }
                }
                transition={{ duration: 0.26, ease: [0.08, 0.95, 0.15, 1], times: [0, 0.72, 1], delay }}
            >
                {char}
            </motion.span>
            {/* HEAT SHIMMER — brief glow lingering under the settled letter */}
            <motion.span
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(180deg, rgba(0,198,255,0.6), rgba(255,255,255,0.2))',
                    filter: 'blur(10px)',
                    mixBlendMode: 'screen',
                }}
                initial={{ opacity: 0 }}
                animate={visible ? { opacity: [0, 0.9, 0] } : { opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut', delay: delay + 0.06 }}
            />
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ZenitSplash
//
//  CINEMATIC SEQUENCE — total ~4.7s before fade:
//
//  ① APPEAR      0.00–0.20   Particle materialises at P0 (top-left)
//  ② DRAW Z      0.20–1.10   P0→P1→P2→P3, stroke paints in as dot moves
//                             Easing: ease-in on each segment start, ease-out on each end
//                             → fast on the top horizontal & diagonal, slower into corners
//  ③ ROLLER-COAST 1.10–2.00  Reverse ride: P3→P2→P1 (no erasing, Z stays fully lit)
//                             P3→P2 (bottom stroke) : slow deceleration into bot-left corner
//                             P2→P1 (diagonal up)   : FAST climb, decelerates hard into P1
//                             Feels like: gravity-assisted drop then a rocket climb
//  ④ COIL        2.00–2.18   At P1 (top-right): compress + pull-back opposite launch dir
//  ⑤ POP & Z FADE 2.18–2.72  Dot launches LEFT from P1, arcs to i-dot position
//                             Z begins fading the instant the dot leaves P1
//  ⑥ LAND        2.72–2.90   Glow bloom, 1-frame freeze
//  ⑦ TRANSFORM   2.90        Particle crossfades → i-dot (same pixel, same size)
//  ⑧ STEM        2.90–3.08   i-stem grows downward from dot
//  ⑨ LETTERS     3.08–3.40   Z e n … t tip up into frame, left-to-right
//  ⑩ TRACKER     3.45–3.87   "Tracker" wipes in
//  ⑪ SHINE       3.95–4.55   Light sweep crosses the finished wordmark
//  ⑫ HOLD+FADE   4.55–5.10   Hold, then exit
// ─────────────────────────────────────────────────────────────────────────────
function ZenitSplash({ onDone }: { onDone: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef       = useRef<SVGSVGElement>(null);
    const iDotRef      = useRef<HTMLDivElement>(null);

    const seqStarted   = useRef(false);
    const cancelRef    = useRef(false);
    const onDoneRef    = useRef(onDone);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    const [zGeom, setZGeom] = useState<{ pts: [number,number][]; ds: number } | null>(null);

    // Causal reveal flags — set exactly once each, in sequence
    const [showIDot,  setShowIDot]  = useState(false);
    const [showIStem, setShowIStem] = useState(false);
    const [letZ,  setLetZ]  = useState(false);
    const [letE,  setLetE]  = useState(false);
    const [letN,  setLetN]  = useState(false);
    const [letT,  setLetT]  = useState(false);
    const [tracker,   setTracker]   = useState(false);
    const [shine,     setShine]     = useState(false);
    const [ptDone,    setPtDone]    = useState(false);

    // Motion values
    const dotX   = useMotionValue(-9999);
    const dotY   = useMotionValue(-9999);
    const dotSc  = useMotionValue(0);
    const dotOp  = useMotionValue(0);
    const glowR  = useMotionValue(8);
    const dash   = useMotionValue(1);   // 1=hidden, 0=fully drawn
    const zOp    = useMotionValue(1);
    // i-dot scale — drives the ripple pulse that "causes" letter reveals
    const iDotSc = useMotionValue(1);

    const dotShadow = useTransform(
        glowR,
        (r) => `0 0 ${r}px ${(r*0.45).toFixed(1)}px rgba(0,198,255,${Math.min(0.92, 0.15 + r*0.022).toFixed(3)})`
    );

    // Failsafe
    useEffect(() => {
        const t = setTimeout(() => onDoneRef.current(), FAILSAFE_MS);
        return () => clearTimeout(t);
    }, []);

    // Measure SVG-space geometry — no font dependency
    const measureZ = useCallback((): { pts: [number,number][]; ds: number } | null => {
        const svg  = svgRef.current;
        const cont = containerRef.current;
        if (!svg || !cont) return null;
        const cb = cont.getBoundingClientRect();
        const sb = svg.getBoundingClientRect();
        if (sb.width === 0 || sb.height === 0) return null;
        const pts: [number,number][] = ZPTS.map(([vx, vy]) => [
            sb.left - cb.left + (vx / 100) * sb.width,
            sb.top  - cb.top  + (vy / 100) * sb.height,
        ]);
        const ds = Math.max(7, Math.round(sb.width * 0.095));
        return { pts, ds };
    }, []);

    useLayoutEffect(() => {
        let done = false;
        const tryM = () => {
            if (done) return;
            const z = measureZ();
            if (z) { done = true; setZGeom(z); }
        };
        const id = setInterval(tryM, MEASURE_POLL_MS);
        tryM();
        window.addEventListener('resize', tryM);
        return () => { clearInterval(id); window.removeEventListener('resize', tryM); };
    }, [measureZ]);

    // Wait for actual rendered i-dot position
    const waitForIDot = useCallback((fallback: [number,number]): Promise<[number,number]> => {
        return new Promise(resolve => {
            const cont = containerRef.current;
            if (!cont) { resolve(fallback); return; }
            const measure = (): [number,number] | null => {
                const el = iDotRef.current;
                if (!el) return null;
                const cb = cont.getBoundingClientRect();
                const eb = el.getBoundingClientRect();
                if (eb.width === 0 && eb.height === 0) return null;
                return [eb.left + eb.width / 2 - cb.left, eb.top + eb.height / 2 - cb.top];
            };
            const imm = measure();
            if (imm) { resolve(imm); return; }
            let settled = false;
            let best: [number,number] | null = null;
            const t0 = performance.now();
            const finish = (v: [number,number]) => {
                if (settled) return;
                settled = true;
                clearInterval(id);
                resolve(v);
            };
            const id = setInterval(() => {
                const r = measure();
                if (r) best = r;
                const el = performance.now() - t0;
                if (r && el > 80)         finish(r);
                else if (el > MEASURE_TIMEOUT) finish(best ?? fallback);
            }, MEASURE_POLL_MS);
            (document as any).fonts?.ready?.then?.(() => {
                const r = measure();
                if (r) finish(r);
            });
        });
    }, []);

    // ─── MAIN SEQUENCE ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!zGeom || seqStarted.current) return;
        seqStarted.current = true;
        cancelRef.current  = false;

        const { pts, ds } = zGeom;
        const P0 = pts[0]; // top-left
        const P1 = pts[1]; // top-right   ← launch point
        const P2 = pts[2]; // bot-left
        const P3 = pts[3]; // bot-right   ← end of draw, start of reverse ride

        // Reverse ride path: P3 → P2 → P1 (3 points, 2 segments)
        const RIDE_PTS: [number,number][] = [P3, P2, P1];
        const RIDE_SEG = buildSegs(RIDE_PTS);

        const run = async () => {

            // ──────────────────────────────────────────────────────────────────
            // ① APPEAR  (0.20s)
            // ──────────────────────────────────────────────────────────────────
            dotX.set(P0[0]);
            dotY.set(P0[1]);
            await animate(dotOp, 1, { duration: 0.18, ease: 'easeOut' });
            await animate(dotSc, 1, { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] });
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ② DRAW Z  (0.90s)   P0 → P1 → P2 → P3
            //
            //    Easing per-segment feel:
            //    Top horizontal (P0→P1) : starts fast, eases out into P1 corner
            //    Diagonal (P1→P2)       : ease-in (accelerates), peaks mid-stroke
            //    Bot horizontal (P2→P3) : eases into final P3
            //
            //    Achieved via a single global ease on the full path:
            //    [0.25, 0, 0.35, 1] — gentle ease-in, strong ease-out at end.
            //    Within that, the polyline's arc-length distribution naturally
            //    makes the diagonal (longest segment) feel fastest.
            // ──────────────────────────────────────────────────────────────────
            await rafPhase(0.90, [0.25, 0, 0.35, 1], (eased) => {
                const pt = polyline(eased, pts, Z_SEG);
                dotX.set(pt[0]);
                dotY.set(pt[1]);
                dash.set(1 - eased);  // stroke reveals as dot moves
            }, cancelRef);
            if (cancelRef.current) return;

            // Tiny beat at P3 — the dot has finished drawing and "lands"
            await animate(dotSc, 0.82, { duration: 0.08, ease: [0.36, 0, 0.66, 0] });
            await animate(dotSc, 1.0,  { duration: 0.08, ease: [0.34, 1.56, 0.64, 1] });
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ③ ROLLER-COASTER REVERSE RIDE  P3 → P2 → P1  (0.85s total)
            //
            //    This is split into TWO sub-phases for independent easing:
            //
            //    P3 → P2  (bottom stroke, short):
            //      Ease: [0.5, 0, 0.8, 0.6]
            //      Starts at medium pace, decelerates into the P2 corner.
            //      Feels like the dot is swinging around the bottom-left turn.
            //      Duration: 0.28s
            //
            //    P2 → P1  (diagonal, long):
            //      Ease: [0.2, 0, 0.1, 1]  ← strong ease-in (starts slow),
            //      then near-linear, then a hard deceleration into P1.
            //      The acceleration phase IS the roller-coaster "drop".
            //      The deceleration into P1 is the braking at the top.
            //      Duration: 0.57s
            //
            //    Z stroke stays FULLY DRAWN throughout — no erasing.
            //    The dot travels OVER the existing stroke.
            // ──────────────────────────────────────────────────────────────────

            // Sub-phase A: P3 → P2  (swing around bottom corner)
            await rafPhase(0.28, [0.5, 0, 0.75, 0.6], (eased) => {
                dotX.set(P3[0] + (P2[0] - P3[0]) * eased);
                dotY.set(P3[1] + (P2[1] - P3[1]) * eased);
            }, cancelRef);
            if (cancelRef.current) return;

            // Corner beat at P2 — momentary micro-compress (roller coaster
            // banking into the curve) then releases for the climb
            await Promise.all([
                animate(dotSc, 0.75, { duration: 0.09, ease: [0.36, 0, 0.66, 0] }),
            ]);
            if (cancelRef.current) return;

            // Sub-phase B: P2 → P1  (rocket climb up the diagonal)
            // ease [0.18, 0, 0.06, 1] = very slow start (coil energy from corner),
            // then rapid acceleration (the "drop" feeling), strong brake into P1
            await Promise.all([
                animate(dotSc, 1.0, { duration: 0.10, ease: [0.34, 1.56, 0.64, 1] }),
                rafPhase(0.57, [0.18, 0, 0.06, 1], (eased) => {
                    dotX.set(P2[0] + (P1[0] - P2[0]) * eased);
                    dotY.set(P2[1] + (P1[1] - P2[1]) * eased);
                }, cancelRef),
            ]);
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ④ COIL at P1  (0.18s)
            //    Dot pulls back AWAY from the launch direction (i.e. rightward,
            //    since it will launch left), compresses, then snaps to P1.
            //    This is the "winding up" before the pop.
            // ──────────────────────────────────────────────────────────────────
            // The launch direction is LEFT (toward i-dot).
            // Pull-back is therefore rightward (+x).
            const coilX = P1[0] + 6;
            const coilY = P1[1] + 2;
            await Promise.all([
                animate(dotSc, 0.62, { duration: 0.11, ease: [0.36, 0, 0.66, 0] }),
                animate(dotX,  coilX, { duration: 0.11, ease: [0.36, 0, 0.66, 0] }),
                animate(dotY,  coilY, { duration: 0.11, ease: [0.36, 0, 0.66, 0] }),
            ]);
            if (cancelRef.current) return;
            // Snap back to exact P1 with overshoot
            await Promise.all([
                animate(dotSc, 1.18, { duration: 0.07, ease: [0.34, 1.56, 0.64, 1] }),
                animate(dotX,  P1[0], { duration: 0.07, ease: [0.34, 1.56, 0.64, 1] }),
                animate(dotY,  P1[1], { duration: 0.07, ease: [0.34, 1.56, 0.64, 1] }),
            ]);
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ⑤ POP & Z FADE  (0.54s)
            //    Dot launches LEFT from P1 on an arcing path to the i-dot.
            //    Z begins fading the INSTANT the dot leaves P1.
            //    Nothing else moves — dot is the only focal point.
            // ──────────────────────────────────────────────────────────────────

            // Measure real i-dot position (in DOM already, hidden)
            await new Promise<void>(r => requestAnimationFrame(() => r()));
            const iTarget = await waitForIDot(P1);
            if (cancelRef.current) return;

            // Arc: lift above the Z top edge, curve leftward and down to i-dot
            const cb   = containerRef.current!.getBoundingClientRect();
            const svgB = svgRef.current!.getBoundingClientRect();
            const topY = svgB.top - cb.top;
            const lift = Math.max(30, (svgB.height || 144) * 0.35);
            // Control point: horizontally between P1 and target, above the Z
            const cp: [number,number] = [
                P1[0] + (iTarget[0] - P1[0]) * 0.3,
                topY - lift,
            ];

            // Z fades as dot departs — simultaneous with flight
            animate(zOp, 0, { duration: 0.42, ease: [0.4, 0, 0.8, 1] });
            // Dot scale returns to 1 during flight
            animate(dotSc, 1, { duration: 0.12, ease: 'easeOut' });

            // Flight: [0.32, 0, 0.06, 1] = fast initial burst, smooth arrival
            await rafPhase(0.54, [0.32, 0, 0.06, 1], (eased) => {
                const pt = qbez(eased, P1, cp, iTarget);
                dotX.set(pt[0]);
                dotY.set(pt[1]);
                // Subtle scale breathe — elongates mid-arc, normal at land
                dotSc.set(1 + Math.sin(eased * Math.PI) * 0.12);
            }, cancelRef);
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ⑥ LAND  (0.18s)
            //    Snap to exact coords, glow bloom, 1-frame freeze.
            // ──────────────────────────────────────────────────────────────────
            dotX.set(iTarget[0]);
            dotY.set(iTarget[1]);
            await animate(dotSc, 1.0, { duration: 0.05, ease: 'easeOut' });
            if (cancelRef.current) return;

            // Glow bloom — energy transfers, particle "ignites" the i-dot
            await animate(glowR, 28, { duration: 0.13, ease: [0.2, 1, 0.3, 1] });
            if (cancelRef.current) return;
            await animate(glowR, 8,  { duration: 0.10, ease: 'easeIn' });
            if (cancelRef.current) return;

            // One-frame recognition freeze — the psychological "ohhhh" moment
            await wait(40);
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ⑦ TRANSFORM — particle becomes the i-dot  (0.14s xfade)
            //    Same pixel, same size. Viewer sees one continuous object.
            // ──────────────────────────────────────────────────────────────────
            setShowIDot(true);  // i-dot appears at exact particle location
            await animate(dotOp, 0, { duration: 0.14, ease: 'easeIn' });
            if (cancelRef.current) return;
            setPtDone(true);  // unmount particle — it has become the dot

            // ──────────────────────────────────────────────────────────────────
            // ⑧ i-STEM grows DOWN from the dot  (0.22s)
            //    Feels like the particle is generating the letter.
            // ──────────────────────────────────────────────────────────────────
            setShowIStem(true);
            await wait(240);
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ⑨ RIPPLE PULSE — i-dot scales out like a shockwave.
            //    This single visual event is what "causes" the letters to appear.
            //    The scale pulse radiates outward; letters materialise in the
            //    expanding ring, closest-to-i first.
            //    Sequence (ms from ripple start, not absolute):
            //      0ms   — i-dot scale: 1 → 1.55 (bloom)
            //      80ms  — i-dot scale: 1.55 → 0.92 (snap back)
            //      140ms — i-dot scale: 0.92 → 1.0  (settle)
            //      + glow expands simultaneously then contracts
            //
            //    Letter order — radiates outward from i (distance in letters):
            //      n  (dist 1, left)   → appears at ripple 0ms
            //      t  (dist 1, right)  → appears at ripple 55ms
            //      e  (dist 2, left)   → appears at ripple 110ms
            //      Z  (dist 3, left)   → appears at ripple 175ms
            //    Each letter's 0.48s materialise animation overlaps the next.
            // ──────────────────────────────────────────────────────────────────

            // Fire ripple — don't await, letters launch simultaneously
            animate(iDotSc, 1.55, { duration: 0.12, ease: [0.2, 1, 0.3, 1] });
            animate(glowR,  22,   { duration: 0.12, ease: [0.2, 1, 0.3, 1] });

            // n appears immediately as ripple blooms
            setLetN(true);
            await wait(55);  if (cancelRef.current) return;

            // Ripple peak → snap back, t appears
            animate(iDotSc, 0.92, { duration: 0.10, ease: [0.36, 0, 0.66, 0] });
            animate(glowR,  14,   { duration: 0.10, ease: 'easeIn' });
            setLetT(true);
            await wait(55);  if (cancelRef.current) return;

            // Ripple settles, e appears
            animate(iDotSc, 1.0,  { duration: 0.14, ease: [0.34, 1.56, 0.64, 1] });
            animate(glowR,  8,    { duration: 0.14, ease: 'easeOut' });
            setLetE(true);
            await wait(65);  if (cancelRef.current) return;

            // Z — furthest from i, arrives last
            setLetZ(true);
            await wait(420);  // wait for all letters to finish materialising (0.48s reveal)
            if (cancelRef.current) return;

            // ──────────────────────────────────────────────────────────────────
            // ⑩ TRACKER — arrives as a cinematic subtitle card.
            //    Different character from "Zenit": it slides in from the right
            //    with a blur dissolve — like a film title card dropping into frame.
            //    Not a letter-by-letter reveal. The whole word arrives together.
            // ──────────────────────────────────────────────────────────────────
            await wait(80);  // breath before "Tracker" so "Zenit" reads complete
            if (cancelRef.current) return;
            setTracker(true);

            // ──────────────────────────────────────────────────────────────────
            // ⑪ SHINE — one last cinematic beat. A sheen of light sweeps across
            //    the finished wordmark, like the light-catch on a freshly struck
            //    title card. This is the single, bold finishing gesture.
            // ──────────────────────────────────────────────────────────────────
            await wait(300);  // let "Tracker" mostly land before the light catches it
            if (cancelRef.current) return;
            setShine(true);
            await wait(900);  // sweep duration + hold on the complete "Zenit Tracker" logo
            if (cancelRef.current) return;

            // ⑫ HAND OFF to landing page
            onDoneRef.current();
        };

        run().catch(() => { if (!cancelRef.current) onDoneRef.current(); });
        return () => { cancelRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zGeom]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <motion.div
            exit={{ opacity: 0, transition: { duration: 0.60, ease: [0.4, 0, 0.2, 1] as any } }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070f]"
        >
            <div
                ref={containerRef}
                className="relative flex items-center justify-center"
                style={{ width: 'min(92vw, 680px)', height: 300 }}
            >

                {/* ── Z SVG ──────────────────────────────────────────────────── */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.svg
                        ref={svgRef}
                        viewBox="0 0 100 100"
                        className="w-36 h-36 md:w-44 md:h-44 overflow-visible"
                        style={{ opacity: zOp, willChange: 'opacity' }}
                    >
                        <defs>
                            <linearGradient id="zgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%"   stopColor="#007BFF" />
                                <stop offset="100%" stopColor="#00C6FF" />
                            </linearGradient>
                        </defs>
                        <motion.path
                            d="M 15 25 H 80 L 30 80 H 65"
                            stroke="url(#zgrad)"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength={1}
                            strokeDasharray={1}
                            style={{ strokeDashoffset: dash }}
                        />
                    </motion.svg>
                </div>

                {/* ── WORD: Zenit Tracker ────────────────────────────────────── */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                        className="select-none flex items-baseline relative overflow-hidden"
                        style={{
                            fontSize:      'clamp(2rem, 8vw, 3.75rem)',
                            fontWeight:    600,
                            letterSpacing: '-0.02em',
                            lineHeight:    1,
                            paddingInline: '0.06em',
                        }}
                    >
                        <LetterReveal visible={letZ} char="Z" />
                        <LetterReveal visible={letE} char="e" />
                        <LetterReveal visible={letN} char="n" />

                        {/* i — dot + stem, revealed causally by the particle */}
                        <span
                            className="relative inline-block align-baseline"
                            style={{ width: '0.30em', height: '0.52em' }}
                        >
                            {/* Actual rendered i-dot — particle crossfades INTO this.
                                iDotSc drives the ripple pulse that launches the letters. */}
                            <motion.div
                                ref={iDotRef}
                                className="absolute rounded-full bg-white"
                                style={{
                                    left:        '50%',
                                    top:         '-0.18em',
                                    width:       '0.14em',
                                    height:      '0.14em',
                                    marginLeft:  '-0.07em',
                                    scale:       iDotSc,
                                    opacity:     showIDot ? 1 : 0,
                                    willChange:  'transform, opacity',
                                    // No CSS transition on opacity — synced with particle fade
                                }}
                            />
                            {/* i-stem: grows downward from dot */}
                            <motion.span
                                className="absolute bg-white"
                                style={{
                                    left:            '50%',
                                    marginLeft:      '-0.055em',
                                    width:           '0.11em',
                                    borderRadius:    '0.05em',
                                    bottom:          0,
                                    height:          '0.52em',
                                    transformOrigin: 'top center',
                                }}
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: showIStem ? 1 : 0 }}
                                transition={{ duration: 0.20, ease: [0.4, 0, 0.2, 1] as any }}
                            />
                        </span>

                        <LetterReveal visible={letT} char="t" />

                        {/* Tracker — SLAM SUBTITLE.
                            The whole word hits at once — massive scale drop with a horizontal
                            streak of light that flares across on impact. Different character
                            from Zenit (which hits letter-by-letter) — this is ONE punch. */}
                        <span className="relative inline-block align-baseline" style={{ perspective: 900 }}>
                            {/* horizontal impact streak */}
                            <motion.span
                                aria-hidden
                                className="absolute inset-y-0 -inset-x-4 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(0,198,255,0.8) 35%, rgba(255,255,255,1) 50%, rgba(0,198,255,0.8) 65%, transparent 100%)',
                                    filter: 'blur(3px)',
                                    mixBlendMode: 'screen',
                                }}
                                initial={{ opacity: 0, scaleX: 0.1, scaleY: 3 }}
                                animate={tracker
                                    ? { opacity: [0, 1, 0], scaleX: [0.1, 1.8, 3], scaleY: [3, 1, 0.5] }
                                    : { opacity: 0, scaleX: 0.1, scaleY: 3 }
                                }
                                transition={{ duration: 0.28, ease: [0.12, 1, 0.2, 1] }}
                            />
                            {/* the word — slams from oversized/blurred to crisp */}
                            <motion.span
                                className="relative inline-block align-baseline text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF]"
                                style={{ willChange: 'transform, opacity, filter', transformStyle: 'preserve-3d' }}
                                initial={{ opacity: 0, scale: 2.6, y: '-0.1em', filter: 'blur(18px)' }}
                                animate={tracker
                                    ? { opacity: [0, 1, 1], scale: [2.6, 0.95, 1], y: ['-0.1em', '0.01em', '0em'], filter: ['blur(18px)', 'blur(0px)', 'blur(0px)'] }
                                    : { opacity: 0, scale: 2.6, y: '-0.1em', filter: 'blur(18px)' }
                                }
                                transition={{ duration: 0.30, ease: [0.08, 0.95, 0.15, 1], times: [0, 0.7, 1] }}
                            >
                                &nbsp;Tracker
                            </motion.span>
                            {/* residual glow */}
                            <motion.span
                                aria-hidden
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: 'linear-gradient(90deg, rgba(0,123,255,0.5), rgba(0,198,255,0.4))', filter: 'blur(10px)', mixBlendMode: 'screen' }}
                                initial={{ opacity: 0 }}
                                animate={tracker ? { opacity: [0, 0.8, 0] } : { opacity: 0 }}
                                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                            />
                        </span>

                        {/* ── SHINE SWEEP ──────────────────────────────────────
                            Cinematic light-catch across the finished wordmark —
                            fires once, after "Tracker" lands. Screen-blended so
                            it brightens the letters/gradient it crosses instead
                            of sitting on top as a flat highlight. */}
                        <motion.span
                            aria-hidden
                            className="absolute inset-y-0 pointer-events-none"
                            style={{
                                left:  0,
                                width: '45%',
                                background: 'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,255,255,0.95) 50%, transparent 62%, transparent 100%)',
                                mixBlendMode: 'screen',
                                filter: 'blur(3px)',
                            }}
                            initial={{ x: '-120%', opacity: 0 }}
                            animate={shine
                                ? { x: '240%', opacity: [0, 1, 1, 0] }
                                : { x: '-120%', opacity: 0 }
                            }
                            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1], times: [0, 0.15, 0.7, 1] }}
                        />
                    </div>
                </div>

                {/* ── PARTICLE ───────────────────────────────────────────────── */}
                {zGeom && !ptDone && (
                    <motion.div
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            x:          dotX,
                            y:          dotY,
                            scale:      dotSc,
                            opacity:    dotOp,
                            width:      zGeom.ds,
                            height:     zGeom.ds,
                            marginLeft: -zGeom.ds / 2,
                            marginTop:  -zGeom.ds / 2,
                            left:       0,
                            top:        0,
                            background: '#00C6FF',
                            zIndex:     50,
                            willChange: 'transform, opacity',
                            boxShadow:  dotShadow,
                        }}
                    />
                )}

            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STORY BEATS
// ─────────────────────────────────────────────────────────────────────────────
const BEATS = [
    {
        kicker: 'The problem',
        title:  'Your QA lives in five different tools.',
        body:   'Test cases in a spreadsheet. Bugs in Jira. Devices in a drawer. Reports built by hand at 11pm. Context lost in every handoff.',
    },
    {
        kicker: 'The shift',
        title:  'One source of truth — every signal in one orbit.',
        body:   'Plans, runs, bugs, devices and analytics share the same data. Click a failed test, see the exact phone it ran on, jump straight to the bug.',
    },
    {
        kicker: 'The payoff',
        title:  'Decisions in seconds, not spreadsheets.',
        body:   'Live pass-rates, fleet status and team velocity render the moment you open Zenit. No exports. No stale dashboards. Just trust.',
    },
];

function Beat({ progress, index, total, beat }: {
    progress: MotionValue<number>; index: number; total: number; beat: typeof BEATS[number];
}) {
    const seg     = 1 / total;
    const start   = index * seg;
    const inAt    = start + seg * 0.12;
    const holdEnd = start + seg * 0.72;
    const end     = start + seg;
    const opacity = useTransform(progress, [start, inAt, holdEnd, end], [0, 1, 1, 0]);
    const y       = useTransform(progress, [start, inAt, holdEnd, end], [40, 0, 0, -40]);
    const blur    = useTransform(progress, [start, inAt, holdEnd, end], [12, 0, 0, 12]);
    const filter  = useTransform(blur, (b) => `blur(${b}px)`);
    return (
        <motion.div
            style={{ opacity, y, filter }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        >
            <span className="text-xs uppercase tracking-[0.4em] text-[#5cc8ff] mb-5">{beat.kicker}</span>
            <h2 className="text-4xl md:text-6xl font-bold tracking-[-0.02em] leading-[1.02] max-w-3xl">{beat.title}</h2>
            <p className="text-base md:text-lg text-white/55 max-w-xl mx-auto mt-6 leading-relaxed">{beat.body}</p>
        </motion.div>
    );
}

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
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-40 h-px bg-white/10 overflow-hidden">
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#007BFF] to-[#00C6FF]"
                        style={{ width: railWidth }}
                    />
                </div>
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────
function FeatureCard({ f, variants }: { f: typeof FEATURES[number]; variants: any }) {
    const mx = useMotionValue(-200);
    const my = useMotionValue(-200);
    const [hover, setHover] = useState(false);
    const spotlight = useMotionTemplate`radial-gradient(240px circle at ${mx}px ${my}px, rgba(0,198,255,0.14), transparent 72%)`;
    return (
        <motion.div
            variants={variants}
            onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                mx.set(e.clientX - r.left);
                my.set(e.clientY - r.top);
            }}
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
                <motion.div
                    animate={hover ? { rotate: [0, 6, -6, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                    transition={hover ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 300, damping: 18 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#007BFF]/25 to-[#00C6FF]/10 border border-white/10 flex items-center justify-center"
                >
                    <f.icon className="w-5 h-5 text-[#5cc8ff]" />
                </motion.div>
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

// ─────────────────────────────────────────────────────────────────────────────
//  LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
    const [loading, setLoading] = useState(true);
    const [cur,     setCur]     = useState<CurrencyCode>('INR');
    const [cycle,   setCycle]   = useState<'monthly' | 'annual'>('monthly');

    const state            = useRef<HeroState>({ scroll: 0, px: 0, py: 0 });
    const handleSplashDone = useCallback(() => setLoading(false), []);

    // Lenis smooth scroll
    useEffect(() => {
        if (loading) return;
        let lenis: any, raf = 0;
        (async () => {
            try {
                const Lenis = (await import('lenis')).default;
                lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
                const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
                raf = requestAnimationFrame(loop);
                lenis.on('scroll', ({ scroll, limit }: any) => {
                    state.current.scroll = limit > 0 ? scroll / limit : 0;
                });
            } catch {}
        })();
        const onS = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            state.current.scroll = max > 0 ? window.scrollY / max : 0;
        };
        window.addEventListener('scroll', onS, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            try { lenis?.destroy(); } catch {}
            window.removeEventListener('scroll', onS);
        };
    }, [loading]);

    // Pointer tracking for 3D canvas — click+drag orbits the scene like
    // OrbitControls (drag = rotate, release = coast to a stop with momentum).
    // Idle mouse movement still drives the subtle ambient parallax via px/py.
    // Dragging suspends text selection for the duration of the gesture so a
    // click-drag spins the model instead of highlighting the page.
    useEffect(() => {
        if (loading) return;

        const ROT_SPEED = 0.006;  // radians of rotation per pixel dragged
        const DAMPING   = 0.93;   // velocity decay per frame after release

        let dragging = false;
        let lastX = 0, lastY = 0;
        let coastRaf = 0;

        const stopCoast = () => { if (coastRaf) cancelAnimationFrame(coastRaf); coastRaf = 0; };

        const coast = () => {
            const s = state.current as any;
            s.velX = (s.velX ?? 0) * DAMPING;
            s.velY = (s.velY ?? 0) * DAMPING;
            s.rotY = (s.rotY ?? 0) + s.velX;
            s.rotX = (s.rotX ?? 0) + s.velY;
            if (Math.abs(s.velX) > 0.0002 || Math.abs(s.velY) > 0.0002) {
                coastRaf = requestAnimationFrame(coast);
            } else {
                coastRaf = 0;
            }
        };

        const onDown = (e: PointerEvent) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            (state.current as any).dragging = true;
            stopCoast();
            // Kill any selection that may have already started, then suspend
            // selection for the rest of the drag.
            window.getSelection()?.removeAllRanges();
            document.documentElement.classList.add('zenit-dragging');
        };

        const onMove = (e: PointerEvent) => {
            const s = state.current as any;
            s.px =  (e.clientX / window.innerWidth)  * 2 - 1;
            s.py = -((e.clientY / window.innerHeight) * 2 - 1);
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            s.rotY = (s.rotY ?? 0) + dx * ROT_SPEED;
            s.rotX = (s.rotX ?? 0) + dy * ROT_SPEED;
            s.velX = dx * ROT_SPEED;
            s.velY = dy * ROT_SPEED;
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            (state.current as any).dragging = false;
            document.documentElement.classList.remove('zenit-dragging');
            coastRaf = requestAnimationFrame(coast);
        };

        window.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointerleave', onUp);
        return () => {
            stopCoast();
            document.documentElement.classList.remove('zenit-dragging');
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointerleave', onUp);
        };
    }, [loading]);

    // Geo-based currency
    useEffect(() => {
        if (loading) return;
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch('/api/geo', { cache: 'no-store' });
                const d = await r.json();
                if (!cancelled && d?.currency) { setCur(d.currency); return; }
            } catch {}
            try {
                const r2 = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
                const d2 = await r2.json();
                if (!cancelled && d2?.country_code) setCur(currencyForCountry(d2.country_code));
            } catch {}
        })();
        return () => { cancelled = true; };
    }, [loading]);

    const cfg      = CURRENCIES[cur];
    const proPrice = cycle === 'annual' ? annualPrice(cfg.pro)        : cfg.pro;
    const entPrice = cycle === 'annual' ? annualPrice(cfg.enterprise) : cfg.enterprise;
    const per      = cycle === 'annual' ? '/yr per user' : '/mo per user';

    const fade    = {
        hidden: { opacity: 0, y: 28 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as any } },
    };
    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

    return (
        <div className="relative min-h-screen bg-[#05070f] text-white selection:bg-[#007BFF]/30">
            {/* Suspends text selection only for the duration of an active
                click-drag gesture, so dragging spins the 3D scene instead of
                highlighting page text. */}
            <style>{`
                .zenit-dragging, .zenit-dragging * {
                    user-select: none !important;
                    cursor: grabbing !important;
                }
            `}</style>

            <AnimatePresence>
                {loading && <ZenitSplash onDone={handleSplashDone} />}
            </AnimatePresence>

            <div className="fixed inset-0 z-0 pointer-events-none">
                {!loading && <ZenitHero3D state={state} />}
            </div>
            <div
                className="fixed inset-0 z-[1] pointer-events-none"
                style={{ boxShadow: 'inset 0 0 240px 40px rgba(5,7,15,0.9)' }}
            />

            {/* ── Nav ── */}
            <nav className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-[#05070f]/50 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <ZenitLogo />
                    <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
                        <a href="#features" className="hover:text-white transition-colors">Platform</a>
                        <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login">
                            <Button variant="ghost" className="text-sm text-white/70 hover:text-white">Log in</Button>
                        </Link>
                        <Link href="/signup">
                            <Button className="text-sm bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0 shadow-lg shadow-[#007BFF]/25">
                                Get Started <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
                <motion.div initial="hidden" animate={loading ? 'hidden' : 'show'} variants={stagger}>
                    <motion.div
                        variants={fade}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#5cc8ff] font-semibold mb-7 backdrop-blur-sm"
                    >
                        <Globe className="w-3.5 h-3.5" />
                        The QA platform that pays for itself
                    </motion.div>
                    <motion.h1 variants={fade} className="text-6xl md:text-8xl font-bold tracking-[-0.04em] leading-[0.95]">
                        Ship quality
                    </motion.h1>
                    <motion.h1
                        variants={fade}
                        className="text-6xl md:text-8xl font-bold tracking-[-0.04em] leading-[0.95] text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] via-[#00C6FF] to-violet-400"
                    >
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
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: loading ? 0 : 1 }}
                    transition={{ delay: 1.2 }}
                    className="absolute bottom-8 flex flex-col items-center gap-2 text-white/30"
                >
                    <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
                    <ChevronDown className="w-4 h-4 animate-bounce" />
                </motion.div>
            </section>

            {/* ── Story ── */}
            <StoryStage />

            {/* ── Below-fold ── */}
            <div className="relative z-10 bg-gradient-to-b from-transparent via-[#05070f] to-[#05070f]">
                <div className="h-[20vh]" />

                {/* Logo strip */}
                <section className="py-10 px-6 border-y border-white/5 bg-[#05070f]/60 backdrop-blur-sm">
                    <p className="text-center text-xs uppercase tracking-[0.3em] text-white/30 mb-6">
                        Replaces the tools you&apos;re already paying for
                    </p>
                    <div className="flex items-center justify-center gap-6 md:gap-12 flex-wrap text-white/30 text-sm font-semibold">
                        <span>TestRail</span>
                        <span className="text-white/15">+</span>
                        <span>Zephyr</span>
                        <span className="text-white/15">+</span>
                        <span>Spreadsheets</span>
                        <span className="text-white/15">+</span>
                        <span>Device Drawer</span>
                        <span className="text-white/15">=</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007BFF] to-[#00C6FF] font-bold text-base">Zenit</span>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="py-24 px-6 bg-[#05070f]">
                    <div className="max-w-6xl mx-auto">
                        <motion.div
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, margin: '-100px' }}
                            variants={stagger}
                        >
                            <motion.h2 variants={fade} className="text-4xl md:text-5xl font-bold text-center tracking-tight mb-3">
                                Built for outcomes, not busywork
                            </motion.h2>
                            <motion.p variants={fade} className="text-center text-white/40 mb-16">
                                Consolidate the stack. Cut the cost. Ship with confidence.
                            </motion.p>
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
                        <h2 className="text-4xl md:text-5xl font-bold text-center tracking-tight mb-3">Simple, fair pricing</h2>
                        <p className="text-center text-white/40 mb-3">
                            Showing prices in{' '}
                            <span className="text-white font-semibold">{cfg.code}</span>
                            <span className="text-white/30"> · auto-detected for your region</span>
                        </p>
                        <div className="flex justify-center mb-14">
                            <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                                <button
                                    onClick={() => setCycle('monthly')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'monthly' ? 'bg-white/10 text-white' : 'text-white/50'}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setCycle('annual')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${cycle === 'annual' ? 'bg-white/10 text-white' : 'text-white/50'}`}
                                >
                                    Annual <span className="text-emerald-400">−17%</span>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Free */}
                            <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                                <h3 className="text-lg font-bold mb-1">Free</h3>
                                <div className="text-3xl font-bold mb-1">{fmtPrice(0, cfg)}</div>
                                <p className="text-xs text-white/40 mb-6">Forever, for individuals</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['3 users', '5 test plans', '10 devices', 'Basic analytics'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />{item}
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/signup">
                                    <Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Start Free</Button>
                                </Link>
                            </div>
                            {/* Pro */}
                            <div className="relative p-7 rounded-2xl border border-[#007BFF]/40 bg-gradient-to-b from-[#007BFF]/10 to-transparent ring-1 ring-[#007BFF]/20">
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#007BFF] to-[#00C6FF] text-white">
                                    Most Popular
                                </span>
                                <h3 className="text-lg font-bold mb-1">Pro</h3>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-3xl font-bold">{fmtPrice(proPrice, cfg)}</span>
                                    <span className="text-sm text-white/40">{per}</span>
                                </div>
                                <p className="text-xs text-white/40 mb-6">For growing QA teams</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['Unlimited users', 'Unlimited plans', 'Unlimited devices', 'Jira integration', 'Advanced analytics', 'Priority support'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                                            <CheckCircle2 className="w-4 h-4 text-[#5cc8ff]" />{item}
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/signup">
                                    <Button className="w-full bg-gradient-to-r from-[#007BFF] to-[#00C6FF] hover:opacity-90 text-white border-0">
                                        Start Trial
                                    </Button>
                                </Link>
                            </div>
                            {/* Enterprise */}
                            <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                                <h3 className="text-lg font-bold mb-1">Enterprise</h3>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-3xl font-bold">{fmtPrice(entPrice, cfg)}</span>
                                    <span className="text-sm text-white/40">{per}</span>
                                </div>
                                <p className="text-xs text-white/40 mb-6">For large QA departments</p>
                                <ul className="space-y-2.5 mb-7">
                                    {['Everything in Pro', 'SSO / SAML', 'API access', 'Custom integrations', 'Dedicated support'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                                            <CheckCircle2 className="w-4 h-4 text-violet-400" />{item}
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/signup">
                                    <Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">Get Started</Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 bg-[#05070f]">
                    <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#007BFF]/15 via-[#00C6FF]/8 to-transparent p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#007BFF]/20 rounded-full blur-[100px]" />
                        <div className="relative">
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                                Consolidate your QA. Start today.
                            </h2>
                            <p className="text-white/50 mb-8 max-w-lg mx-auto">
                                Free to start, priced to scale. No credit card, no migration headache — your team is running by this afternoon.
                            </p>
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
                            <a href="#pricing"  className="hover:text-white">Pricing</a>
                            <Link href="/login" className="hover:text-white">Log in</Link>
                        </div>
                        <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Zenit Antigravity</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}