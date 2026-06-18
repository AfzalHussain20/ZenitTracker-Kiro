"use client";

/**
 * RocketLaunch3D — a cinematic launch sequence that plays when entering the
 * Constellation view. Countdown → ignition → liftoff → warp into space, then
 * calls onComplete so the people map can take over.
 *
 * Procedural, polished rocket (no external model needed). Reliable: primitives,
 * additive plume/embers, billowing smoke, camera follow + shake, warp streaks.
 */

import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// timeline (seconds)
const T_IGNITE = 1.4;
const T_LIFT = 2.0;
const T_WARP = 3.4;
const T_END = 4.8;

// ─── soft sprite texture for smoke / embers / glow ───────────────────────────
let _soft: THREE.Texture | null = null;
function softTex(): THREE.Texture {
    if (_soft) return _soft;
    const s = 128; const c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _soft = new THREE.CanvasTexture(c); return _soft;
}

// ─── The rocket (procedural, clean modern look) ──────────────────────────────
function Rocket() {
    return (
        <group>
            {/* body */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.42, 0.46, 3, 48]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.55} roughness={0.32} />
            </mesh>
            {/* nose cone */}
            <mesh position={[0, 3.45, 0]}>
                <coneGeometry args={[0.42, 1.1, 48]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.28} />
            </mesh>
            {/* accent band */}
            <mesh position={[0, 2.55, 0]}>
                <cylinderGeometry args={[0.44, 0.44, 0.34, 48]} />
                <meshStandardMaterial color="#ef4444" metalness={0.4} roughness={0.4} emissive="#7f1d1d" emissiveIntensity={0.3} />
            </mesh>
            {/* window */}
            <mesh position={[0, 2.95, 0.43]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.12, 24]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.4} toneMapped={false} />
            </mesh>
            {/* engine skirt */}
            <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.46, 0.5, 0.4, 48]} />
                <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
            </mesh>
            {/* nozzle */}
            <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[0.5, 0.32, 0.42, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.35} />
            </mesh>
            {/* fins */}
            {[0, 1, 2, 3].map(i => (
                <mesh key={i} position={[Math.cos((i / 4) * Math.PI * 2) * 0.5, 0.25, Math.sin((i / 4) * Math.PI * 2) * 0.5]} rotation={[0, -(i / 4) * Math.PI * 2, 0]}>
                    <boxGeometry args={[0.06, 0.8, 0.55]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ─── Exhaust plume (additive cones, flickering) ──────────────────────────────
function Plume({ power }: { power: number }) {
    const outer = useRef<THREE.Mesh>(null);
    const inner = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        const f = 0.85 + Math.sin(state.clock.elapsedTime * 40) * 0.15;
        const len = power * (1.6 + f * 0.6);
        if (outer.current) {
            outer.current.scale.set(1, Math.max(len, 0.001), 1);
            (outer.current.material as THREE.Material & { opacity: number }).opacity = power * 0.55;
        }
        if (inner.current) {
            inner.current.scale.set(1, Math.max(len * 0.7, 0.001), 1);
            (inner.current.material as THREE.Material & { opacity: number }).opacity = power * 0.9;
        }
    });
    if (power <= 0.01) return null;
    return (
        <group position={[0, -0.72, 0]}>
            <mesh ref={outer} position={[0, -0.8, 0]}>
                <coneGeometry args={[0.34, 1.6, 24, 1, true]} />
                <meshBasicMaterial color="#fb923c" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh ref={inner} position={[0, -0.55, 0]}>
                <coneGeometry args={[0.2, 1.1, 20, 1, true]} />
                <meshBasicMaterial color="#fde68a" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            <pointLight position={[0, -0.6, 0]} color="#fb923c" intensity={power * 6} distance={6} />
        </group>
    );
}

// ─── Embers streaming from the nozzle (follow the rocket) ────────────────────
function Embers({ power }: { power: number }) {
    const N = 160;
    const ref = useRef<THREE.Points>(null);
    const data = useMemo(() => {
        const pos = new Float32Array(N * 3);
        const vel = new Float32Array(N * 3);
        const life = new Float32Array(N);
        for (let i = 0; i < N; i++) { life[i] = Math.random(); pos[i * 3 + 1] = -0.7; }
        return { pos, vel, life };
    }, []);
    const tex = useMemo(() => softTex(), []);
    useFrame((_, dt) => {
        if (!ref.current) return;
        const { pos, vel, life } = data;
        for (let i = 0; i < N; i++) {
            life[i] -= dt * 1.3;
            if (life[i] <= 0) {
                if (power > 0.05 && Math.random() < power) {
                    pos[i * 3] = (Math.random() - 0.5) * 0.25;
                    pos[i * 3 + 1] = -0.7;
                    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
                    vel[i * 3] = (Math.random() - 0.5) * 1.2;
                    vel[i * 3 + 1] = -(2 + Math.random() * 4) * (0.5 + power);
                    vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
                    life[i] = 0.3 + Math.random() * 0.5;
                } else { life[i] = 0; pos[i * 3 + 1] = -999; }
            } else {
                pos[i * 3] += vel[i * 3] * dt;
                pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
                pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            }
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });
    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={N} array={data.pos} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial map={tex} color="#fdba74" size={0.18} transparent opacity={0.9} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
    );
}

// ─── Smoke billowing at the pad (world space, stays on the ground) ───────────
function Smoke({ igniteAt, now }: { igniteAt: number; now: React.MutableRefObject<number> }) {
    const N = 16;
    const tex = useMemo(() => softTex(), []);
    const puffs = useMemo(() => Array.from({ length: N }, (_, i) => ({
        angle: (i / N) * Math.PI * 2 + Math.random(),
        dist: 0.4 + Math.random() * 0.6,
        delay: Math.random() * 0.5,
        speed: 0.5 + Math.random() * 0.8,
        rise: 0.2 + Math.random() * 0.4,
    })), []);
    const refs = useRef<(THREE.Sprite | null)[]>([]);
    useFrame(() => {
        const t = now.current - igniteAt;
        puffs.forEach((p, i) => {
            const s = refs.current[i];
            if (!s) return;
            const lt = t - p.delay;
            if (lt <= 0) { s.visible = false; return; }
            s.visible = true;
            const grow = Math.min(lt * p.speed, 3);
            const scale = 0.6 + grow * 1.1;
            s.scale.setScalar(scale);
            s.position.set(Math.cos(p.angle) * (p.dist + grow * 0.5), -0.4 + lt * p.rise, Math.sin(p.angle) * (p.dist + grow * 0.5));
            (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.5 - lt * 0.12);
        });
    });
    return (
        <group>
            {puffs.map((_, i) => (
                <sprite key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
                    <spriteMaterial map={tex} color="#94a3b8" transparent opacity={0} depthWrite={false} />
                </sprite>
            ))}
        </group>
    );
}

// ─── Warp streaks (kick in during ascent for speed) ──────────────────────────
function Warp({ intensity }: { intensity: number }) {
    const N = 220;
    const ref = useRef<THREE.Points>(null);
    const data = useMemo(() => {
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 30;
            pos[i * 3 + 1] = Math.random() * 60 - 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 6;
        }
        return pos;
    }, []);
    const tex = useMemo(() => softTex(), []);
    useFrame((_, dt) => {
        if (!ref.current || intensity <= 0.01) return;
        const arr = ref.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < N; i++) {
            arr[i * 3 + 1] -= dt * (20 + 90 * intensity);
            if (arr[i * 3 + 1] < -25) arr[i * 3 + 1] += 70;
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });
    if (intensity <= 0.01) return null;
    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={N} array={data} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial map={tex} color="#bae6fd" size={0.25 + intensity * 0.5} transparent opacity={0.5 * intensity} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
    );
}

// ─── Launch pad + gantry ─────────────────────────────────────────────────────
function Pad() {
    return (
        <group position={[0, -1, 0]}>
            <mesh receiveShadow>
                <cylinderGeometry args={[2.2, 2.6, 0.4, 32]} />
                <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.21, 0]}>
                <torusGeometry args={[1.4, 0.05, 8, 48]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} toneMapped={false} />
            </mesh>
            {/* gantry tower */}
            <group position={[1.6, 0, 0]}>
                {[0, 1, 2, 3].map(i => (
                    <mesh key={i} position={[0, 0.8 + i * 1.1, 0]}>
                        <boxGeometry args={[0.1, 1.1, 0.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.5} />
                    </mesh>
                ))}
                {[0, 1, 2].map(i => (
                    <mesh key={`a${i}`} position={[-0.5, 1.3 + i * 1.1, 0]}>
                        <boxGeometry args={[1, 0.08, 0.08]} />
                        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.5} />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ─── Sequence controller ─────────────────────────────────────────────────────
function Sequence({ onPhase, onDone, skipRef }: {
    onPhase: (label: string) => void; onDone: () => void; skipRef: React.MutableRefObject<boolean>;
}) {
    const { camera } = useThree();
    const rocket = useRef<THREE.Group>(null);
    const now = useRef(0);
    const start = useRef(-1);
    const lastPhase = useRef('');
    const done = useRef(false);
    const [power, setPower] = useState(0);
    const [warp, setWarp] = useState(0);

    useFrame((state) => {
        if (start.current < 0) start.current = state.clock.elapsedTime;
        const t = state.clock.elapsedTime - start.current;
        now.current = t;

        if (skipRef.current && !done.current) { done.current = true; onDone(); return; }

        // phase labels
        let label = '';
        if (t < 1) label = '3';
        else if (t < T_IGNITE) label = '2';
        else if (t < T_LIFT) label = '1';
        else if (t < T_WARP) label = 'LIFTOFF';
        else label = '';
        if (label !== lastPhase.current) { lastPhase.current = label; onPhase(label); }

        // engine power ramps at ignition
        const pw = t < T_IGNITE ? 0 : Math.min((t - T_IGNITE) / 0.5, 1);
        setPower(pw);

        // rocket altitude — accelerating after liftoff
        let y = 0;
        if (t > T_LIFT) {
            const dt = t - T_LIFT;
            y = Math.pow(dt, 2.3) * 3.2;
        } else if (t > T_IGNITE) {
            y = Math.sin(t * 50) * 0.015; // vibration on the pad
        }
        if (rocket.current) rocket.current.position.y = y;

        // camera follow + shake
        const shake = (t > T_IGNITE && t < T_LIFT + 0.8) ? (1 - Math.max(0, (t - T_LIFT) / 0.8)) * 0.06 : 0;
        const camY = 2 + y * 0.82;
        const camZ = 9 + Math.min(y * 0.15, 4);
        camera.position.set(
            Math.sin(t * 0.3) * 0.4 + (Math.random() - 0.5) * shake,
            camY + (Math.random() - 0.5) * shake,
            camZ
        );
        camera.lookAt(0, 1.5 + y, 0);

        // warp ramps up late
        const w = t > T_WARP ? Math.min((t - T_WARP) / 0.8, 1) : 0;
        setWarp(w);

        if (t >= T_END && !done.current) { done.current = true; onDone(); }
    });

    return (
        <>
            <group ref={rocket}>
                <Rocket />
                <Plume power={power} />
                <Embers power={power} />
            </group>
            <Pad />
            <Smoke igniteAt={T_IGNITE} now={now} />
            <Warp intensity={warp} />
        </>
    );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function RocketLaunch3D({ onComplete }: { onComplete: () => void }) {
    const [phase, setPhase] = useState('');
    const [fading, setFading] = useState(false);
    const skipRef = useRef(false);
    const completedRef = useRef(false);

    const finish = () => {
        if (completedRef.current) return;
        completedRef.current = true;
        setFading(true);
        setTimeout(onComplete, 650);
    };

    // safety timeout in case the loop never fires
    useEffect(() => {
        const id = setTimeout(finish, 7000);
        return () => clearTimeout(id);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`absolute inset-0 z-30 transition-opacity duration-700 ${fading ? 'opacity-0' : 'opacity-100'}`}>
            <Canvas
                camera={{ position: [0, 2, 9], fov: 55 }}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            >
                <color attach="background" args={['#05070f']} />
                <fog attach="fog" args={['#05070f', 14, 44]} />
                <ambientLight intensity={0.45} />
                <directionalLight position={[5, 10, 6]} intensity={1.1} />
                <pointLight position={[-6, 4, 4]} intensity={0.5} color="#6366f1" />
                <Stars radius={80} depth={60} count={2600} factor={4} saturation={0} fade speed={1.5} />
                <Suspense fallback={null}>
                    <Sequence onPhase={setPhase} onDone={finish} skipRef={skipRef} />
                </Suspense>
            </Canvas>

            {/* HUD overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {phase && (
                    <div
                        key={phase}
                        className={`font-black tracking-[0.15em] drop-shadow-[0_0_24px_rgba(99,102,241,0.6)] ${phase === 'LIFTOFF' ? 'text-4xl text-indigo-300 animate-pulse' : 'text-8xl text-white'}`}
                        style={{ animation: 'kpop 0.5s ease-out' }}
                    >
                        {phase}
                    </div>
                )}
            </div>

            {/* top status + skip */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] tracking-widest text-white/80 font-semibold">
                ⬢ KEEPR LAUNCH SEQUENCE
            </div>
            <button
                onClick={() => { skipRef.current = true; }}
                className="absolute bottom-5 right-5 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90 hover:bg-white/20 transition-colors"
            >
                Skip →
            </button>

            <style>{`@keyframes kpop { 0% { transform: scale(2.2); opacity: 0 } 40% { opacity: 1 } 100% { transform: scale(1); opacity: 0.95 } }`}</style>
        </div>
    );
}
