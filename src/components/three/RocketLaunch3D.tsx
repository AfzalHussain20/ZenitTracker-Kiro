"use client";

/**
 * RocketLaunch3D — a cinematic, film-grade launch sequence.
 *
 * Dawn skydome + god rays · lathe-built rocket w/ engine cluster · layered
 * turbulent exhaust with Mach diamonds · rolling smoke cloud · sparks · ground
 * scorch · hero camera choreography (push-in → ignition flash → track-up with
 * FOV breathing & roll → warp) · letterbox / grain / color-grade / title card.
 *
 * Reliable: primitives + additive sprites/points only (no GLSL, no composer).
 */

import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

const T_IGNITE = 1.5;
const T_LIFT = 2.1;
const T_WARP = 3.8;
const T_END = 5.4;

interface Sim { power: number; clearance: number; rocketY: number; warp: number; t: number }

// ─── shared soft sprite ──────────────────────────────────────────────────────
let _soft: THREE.Texture | null = null;
function softTex(): THREE.Texture {
    if (_soft) return _soft;
    const s = 128; const c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _soft = new THREE.CanvasTexture(c); return _soft;
}

// ─── dawn skydome ────────────────────────────────────────────────────────────
function SkyDome() {
    const tex = useMemo(() => {
        const w = 16, h = 256;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d')!;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, '#05070f');   // zenith
        g.addColorStop(0.4, '#161433');
        g.addColorStop(0.62, '#3b1f53');
        g.addColorStop(0.78, '#b4471f');   // horizon ember
        g.addColorStop(0.9, '#f0a97e');
        g.addColorStop(1.0, '#1c0f0a');   // ground haze
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
    }, []);
    return (
        <mesh scale={[-1, 1, 1]}>
            <sphereGeometry args={[80, 32, 32]} />
            <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} />
        </mesh>
    );
}

// ─── sun glow + god rays ─────────────────────────────────────────────────────
function SunRays() {
    const grp = useRef<THREE.Group>(null);
    const tex = useMemo(() => softTex(), []);
    useFrame((_, dt) => { if (grp.current) grp.current.rotation.z += dt * 0.03; });
    return (
        <group position={[-6, -2.5, -22]}>
            <sprite scale={[14, 14, 14]}>
                <spriteMaterial map={tex} color="#ffb24d" blending={THREE.AdditiveBlending} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
            </sprite>
            <sprite scale={[7, 7, 7]}>
                <spriteMaterial map={tex} color="#fff1c9" blending={THREE.AdditiveBlending} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
            </sprite>
            <group ref={grp}>
                {Array.from({ length: 7 }).map((_, i) => (
                    <mesh key={i} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
                        <planeGeometry args={[0.6, 60]} />
                        <meshBasicMaterial color="#ffcf8a" blending={THREE.AdditiveBlending} transparent opacity={0.06} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ─── detailed rocket ─────────────────────────────────────────────────────────
function Rocket({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const beacon = useRef<THREE.MeshStandardMaterial>(null);
    const bells = useRef<THREE.MeshStandardMaterial[]>([]);
    const bodyGeo = useMemo(() => {
        const pts = [
            [0.0, -0.55], [0.5, -0.5], [0.5, 0.0], [0.5, 2.5],
            [0.47, 2.95], [0.36, 3.4], [0.18, 3.85], [0.0, 4.05],
        ].map(p => new THREE.Vector2(p[0], p[1]));
        return new THREE.LatheGeometry(pts, 64);
    }, []);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (beacon.current) beacon.current.emissiveIntensity = 0.5 + (Math.sin(t * 6) > 0.7 ? 2.5 : 0);
        const glow = 0.3 + sim.current.power * 2.6;
        bells.current.forEach(m => { if (m) m.emissiveIntensity = glow; });
    });
    return (
        <group>
            {/* fuselage */}
            <mesh geometry={bodyGeo}>
                <meshStandardMaterial color="#eef2f7" metalness={0.62} roughness={0.3} />
            </mesh>
            {/* panel rings */}
            {[0.4, 1.2, 2.0].map((y, i) => (
                <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.505, 0.012, 6, 64]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
                </mesh>
            ))}
            {/* accent band */}
            <mesh position={[0, 2.35, 0]}>
                <cylinderGeometry args={[0.485, 0.485, 0.28, 64]} />
                <meshStandardMaterial color="#ef4444" metalness={0.4} roughness={0.45} emissive="#7f1d1d" emissiveIntensity={0.3} />
            </mesh>
            {/* mission stripe */}
            <mesh position={[0, 1.6, 0]}>
                <cylinderGeometry args={[0.502, 0.502, 0.08, 64]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* cockpit window */}
            <mesh position={[0, 3.0, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.12, 24]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.6} toneMapped={false} />
            </mesh>
            {/* nose beacon */}
            <mesh position={[0, 4.1, 0]}>
                <sphereGeometry args={[0.05, 12, 12]} />
                <meshStandardMaterial ref={beacon} color="#ff3b3b" emissive="#ff2d2d" emissiveIntensity={0.5} toneMapped={false} />
            </mesh>
            {/* engine skirt */}
            <mesh position={[0, -0.62, 0]}>
                <cylinderGeometry args={[0.5, 0.54, 0.3, 48]} />
                <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
            </mesh>
            {/* engine bells (cluster of 3) */}
            {[0, 1, 2].map(i => {
                const a = (i / 3) * Math.PI * 2;
                return (
                    <mesh key={i} position={[Math.cos(a) * 0.22, -0.92, Math.sin(a) * 0.22]}>
                        <coneGeometry args={[0.16, 0.34, 20, 1, true]} />
                        <meshStandardMaterial ref={(m) => { if (m) bells.current[i] = m; }} color="#0f172a" emissive="#ff7a18" emissiveIntensity={0.3} metalness={0.9} roughness={0.35} side={THREE.DoubleSide} toneMapped={false} />
                    </mesh>
                );
            })}
            {/* fins */}
            {[0, 1, 2, 3].map(i => {
                const a = (i / 4) * Math.PI * 2;
                return (
                    <mesh key={i} position={[Math.cos(a) * 0.52, 0.05, Math.sin(a) * 0.52]} rotation={[0, -a, 0.04]}>
                        <boxGeometry args={[0.05, 0.7, 0.5]} />
                        <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.4} />
                    </mesh>
                );
            })}
        </group>
    );
}

// ─── layered turbulent plume + Mach diamonds (child of rocket) ───────────────
function Plume({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const outer = useRef<THREE.Mesh>(null);
    const mid = useRef<THREE.Mesh>(null);
    const core = useRef<THREE.Mesh>(null);
    const diamonds = useRef<THREE.Group>(null);
    const light = useRef<THREE.PointLight>(null);
    useFrame((state) => {
        const p = sim.current.power;
        const flick = 0.82 + Math.sin(state.clock.elapsedTime * 47) * 0.1 + Math.sin(state.clock.elapsedTime * 23) * 0.08;
        const len = p * flick;
        const set = (m: THREE.Mesh | null, base: number, op: number) => {
            if (!m) return;
            m.scale.set(1, Math.max(len * base, 0.001), 1);
            (m.material as THREE.Material & { opacity: number }).opacity = p * op;
        };
        set(outer.current, 2.4, 0.5);
        set(mid.current, 1.7, 0.7);
        set(core.current, 1.05, 0.95);
        if (diamonds.current) {
            diamonds.current.visible = p > 0.6;
            diamonds.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 30) * 0.12);
        }
        if (light.current) light.current.intensity = p * 9;
    });
    return (
        <group position={[0, -0.95, 0]}>
            <mesh ref={outer} position={[0, -1.3, 0]}>
                <coneGeometry args={[0.4, 2.6, 28, 1, true]} />
                <meshBasicMaterial color="#f97316" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh ref={mid} position={[0, -0.95, 0]}>
                <coneGeometry args={[0.26, 1.9, 24, 1, true]} />
                <meshBasicMaterial color="#fbbf24" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh ref={core} position={[0, -0.6, 0]}>
                <coneGeometry args={[0.14, 1.2, 20, 1, true]} />
                <meshBasicMaterial color="#e0f2ff" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* Mach diamonds */}
            <group ref={diamonds}>
                {[-0.5, -0.95, -1.4].map((y, i) => (
                    <mesh key={i} position={[0, y, 0]}>
                        <sphereGeometry args={[0.07 - i * 0.012, 10, 10]} />
                        <meshBasicMaterial color="#cfeaff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                    </mesh>
                ))}
            </group>
            <pointLight ref={light} position={[0, -1, 0]} color="#fb923c" intensity={0} distance={8} />
        </group>
    );
}

// ─── embers (child of rocket) ────────────────────────────────────────────────
function Embers({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const N = 180;
    const ref = useRef<THREE.Points>(null);
    const tex = useMemo(() => softTex(), []);
    const d = useMemo(() => ({ pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N) }), []);
    useFrame((_, dt) => {
        if (!ref.current) return;
        const p = sim.current.power;
        const { pos, vel, life } = d;
        for (let i = 0; i < N; i++) {
            life[i] -= dt * 1.4;
            if (life[i] <= 0) {
                if (p > 0.05 && Math.random() < p) {
                    pos[i * 3] = (Math.random() - 0.5) * 0.3; pos[i * 3 + 1] = -0.9; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
                    vel[i * 3] = (Math.random() - 0.5) * 1.4; vel[i * 3 + 1] = -(2.5 + Math.random() * 4.5) * (0.5 + p); vel[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
                    life[i] = 0.3 + Math.random() * 0.5;
                } else { pos[i * 3 + 1] = -999; }
            } else {
                pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            }
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });
    return (
        <points ref={ref}>
            <bufferGeometry><bufferAttribute attach="attributes-position" count={N} array={d.pos} itemSize={3} /></bufferGeometry>
            <pointsMaterial map={tex} color="#fdba74" size={0.2} transparent opacity={0.95} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
    );
}

// ─── rolling smoke cloud (world, at pad) ─────────────────────────────────────
function Smoke({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const N = 50;
    const tex = useMemo(() => softTex(), []);
    const puffs = useMemo(() => Array.from({ length: N }, (_, i) => ({
        angle: Math.random() * Math.PI * 2,
        dist: 0.3 + Math.random() * 1.2,
        delay: Math.random() * 1.4,
        grow: 0.6 + Math.random() * 1.2,
        rise: 0.15 + Math.random() * 0.5,
        spin: (Math.random() - 0.5) * 0.6,
        warm: Math.random(),
        phase: Math.random() * 10,
    })), []);
    const refs = useRef<(THREE.Sprite | null)[]>([]);
    useFrame((state) => {
        const t = sim.current.t - T_IGNITE;
        const ct = state.clock.elapsedTime;
        puffs.forEach((p, i) => {
            const s = refs.current[i]; if (!s) return;
            const lt = t - p.delay;
            if (lt <= 0) { s.visible = false; return; }
            s.visible = true;
            const grow = lt * p.grow;
            s.scale.setScalar(0.8 + grow * 1.6);
            const wob = Math.sin(ct * 0.8 + p.phase) * 0.3;
            s.position.set(
                Math.cos(p.angle + p.spin * lt) * (p.dist + grow * 0.7) + wob,
                -0.7 + lt * p.rise + Math.sin(ct * 0.5 + p.phase) * 0.1,
                Math.sin(p.angle + p.spin * lt) * (p.dist + grow * 0.7) + wob,
            );
            const warmth = Math.max(0, p.warm - lt * 0.5);
            (s.material as THREE.SpriteMaterial).color.setRGB(0.55 + warmth * 0.45, 0.55 + warmth * 0.18, 0.55);
            (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.55 - lt * 0.09);
        });
    });
    return (
        <group>
            {puffs.map((_, i) => (
                <sprite key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
                    <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} />
                </sprite>
            ))}
        </group>
    );
}

// ─── sparks / debris (world) ─────────────────────────────────────────────────
function Sparks({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const N = 110;
    const ref = useRef<THREE.Points>(null);
    const tex = useMemo(() => softTex(), []);
    const d = useMemo(() => ({ pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N) }), []);
    useFrame((_, dt) => {
        if (!ref.current) return;
        const t = sim.current.t; const burst = t > T_IGNITE && t < T_IGNITE + 1.0;
        const { pos, vel, life } = d;
        for (let i = 0; i < N; i++) {
            life[i] -= dt * 1.1;
            if (life[i] <= 0) {
                if (burst && Math.random() < 0.5) {
                    pos[i * 3] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 1] = -0.8; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
                    const ang = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 5;
                    vel[i * 3] = Math.cos(ang) * sp; vel[i * 3 + 1] = 1 + Math.random() * 4; vel[i * 3 + 2] = Math.sin(ang) * sp;
                    life[i] = 0.5 + Math.random() * 0.7;
                } else { pos[i * 3 + 1] = -999; }
            } else {
                vel[i * 3 + 1] -= dt * 9; // gravity
                pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            }
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });
    return (
        <points ref={ref}>
            <bufferGeometry><bufferAttribute attach="attributes-position" count={N} array={d.pos} itemSize={3} /></bufferGeometry>
            <pointsMaterial map={tex} color="#fff1a8" size={0.12} transparent opacity={1} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
    );
}

// ─── launch pad + gantry + scorch glow ───────────────────────────────────────
function Pad({ sim }: { sim: React.MutableRefObject<Sim> }) {
    const scorch = useRef<THREE.Sprite>(null);
    const tex = useMemo(() => softTex(), []);
    useFrame(() => {
        if (scorch.current) {
            const intensity = sim.current.power * Math.max(0, 1 - sim.current.clearance);
            (scorch.current.material as THREE.SpriteMaterial).opacity = intensity * 0.9;
            scorch.current.scale.setScalar(2 + intensity * 3);
        }
    });
    return (
        <group position={[0, -1, 0]}>
            <mesh receiveShadow>
                <cylinderGeometry args={[2.4, 2.8, 0.4, 40]} />
                <meshStandardMaterial color="#0b1220" metalness={0.6} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.21, 0]}>
                <torusGeometry args={[1.5, 0.04, 8, 56]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} toneMapped={false} />
            </mesh>
            <sprite ref={scorch} position={[0, 0.25, 0]} scale={2}>
                <spriteMaterial map={tex} color="#ff7a18" blending={THREE.AdditiveBlending} transparent opacity={0} depthWrite={false} toneMapped={false} />
            </sprite>
            {/* gantry */}
            <group position={[1.7, 0, 0]}>
                {[0, 1, 2, 3, 4].map(i => (
                    <mesh key={i} position={[0, 0.9 + i * 1.05, 0]}>
                        <boxGeometry args={[0.1, 1.05, 0.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.5} />
                    </mesh>
                ))}
                {[0, 1, 2, 3].map(i => (
                    <mesh key={`a${i}`} position={[-0.55, 1.4 + i * 1.05, 0]}>
                        <boxGeometry args={[1.1, 0.07, 0.07]} />
                        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.5} />
                    </mesh>
                ))}
                {/* gantry beacon */}
                <mesh position={[0.1, 5.2, 0]}>
                    <sphereGeometry args={[0.06, 10, 10]} />
                    <meshStandardMaterial color="#ff3b3b" emissive="#ff2d2d" emissiveIntensity={1.5} toneMapped={false} />
                </mesh>
            </group>
        </group>
    );
}

// ─── sequence controller (drives sim + camera) ───────────────────────────────
function Sequence({ sim, onPhase, onIgnite, onDone, skipRef }: {
    sim: React.MutableRefObject<Sim>; onPhase: (l: string) => void; onIgnite: () => void; onDone: () => void; skipRef: React.MutableRefObject<boolean>;
}) {
    const { camera } = useThree();
    const rocket = useRef<THREE.Group>(null);
    const start = useRef(-1);
    const lastPhase = useRef('');
    const ignited = useRef(false);
    const done = useRef(false);

    useFrame((state) => {
        if (start.current < 0) start.current = state.clock.elapsedTime;
        const t = state.clock.elapsedTime - start.current;
        sim.current.t = t;

        if (skipRef.current && !done.current) { done.current = true; onDone(); return; }

        // phase labels
        let label = '';
        if (t < 1.0) label = '3';
        else if (t < T_IGNITE) label = '2';
        else if (t < T_LIFT) label = '1';
        else if (t < T_WARP) label = 'LIFTOFF';
        if (label !== lastPhase.current) { lastPhase.current = label; onPhase(label); }

        if (t >= T_IGNITE && !ignited.current) { ignited.current = true; onIgnite(); }

        // engine power
        sim.current.power = t < T_IGNITE ? 0 : Math.min((t - T_IGNITE) / 0.55, 1);

        // altitude
        let y = 0;
        if (t > T_LIFT) y = Math.pow(t - T_LIFT, 2.3) * 3.3;
        else if (t > T_IGNITE) y = Math.sin(t * 52) * 0.02;
        sim.current.rocketY = y;
        sim.current.clearance = Math.min(y / 3, 1);
        if (rocket.current) rocket.current.position.y = y;

        // warp
        sim.current.warp = t > T_WARP ? Math.min((t - T_WARP) / 0.9, 1) : 0;

        // ── hero camera choreography ──
        const shakeAmp = (t > T_IGNITE && t < T_LIFT + 1.0) ? (1 - Math.max(0, (t - T_LIFT) / 1.0)) * 0.08 : 0;
        const sx = (Math.random() - 0.5) * shakeAmp;
        const sy = (Math.random() - 0.5) * shakeAmp;
        let camY: number, camZ: number, fov: number, roll: number;
        if (t < T_LIFT) {
            // low hero push-in
            const k = Math.min(t / T_LIFT, 1);
            camY = 0.8 + k * 0.5;
            camZ = 8.5 - k * 1.6;
            fov = 48;
            roll = 0;
        } else {
            const dt = t - T_LIFT;
            camY = 1.4 + y * 0.8;
            camZ = 6.8 + Math.min(y * 0.18, 5);
            fov = 50 + Math.min(dt * 8, 16);   // widen as it powers up
            roll = Math.sin(dt * 0.7) * 0.05;
        }
        camera.position.set(Math.sin(t * 0.25) * 0.5 + sx, camY + sy, camZ);
        camera.lookAt(0, 1.7 + y * 0.96, 0);
        camera.rotation.z += roll;
        const cam = camera as THREE.PerspectiveCamera;
        if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }

        if (t >= T_END && !done.current) { done.current = true; onDone(); }
    });

    return (
        <>
            <group ref={rocket}>
                <Rocket sim={sim} />
                <Plume sim={sim} />
                <Embers sim={sim} />
            </group>
            <Pad sim={sim} />
            <Smoke sim={sim} />
            <Sparks sim={sim} />
        </>
    );
}

// ─── public component ────────────────────────────────────────────────────────
export default function RocketLaunch3D({ onComplete }: { onComplete: () => void }) {
    const sim = useRef<Sim>({ power: 0, clearance: 0, rocketY: 0, warp: 0, t: 0 });
    const [phase, setPhase] = useState('');
    const [flash, setFlash] = useState(false);
    const [fading, setFading] = useState(false);
    const skipRef = useRef(false);
    const doneRef = useRef(false);

    const finish = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        setFading(true);
        setTimeout(onComplete, 700);
    };
    const ignite = () => { setFlash(true); setTimeout(() => setFlash(false), 380); };

    useEffect(() => { const id = setTimeout(finish, 8000); return () => clearTimeout(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`absolute inset-0 z-30 overflow-hidden bg-black transition-opacity duration-700 ${fading ? 'opacity-0' : 'opacity-100'}`}>
            <Canvas camera={{ position: [0, 0.9, 8.5], fov: 48 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
                <fog attach="fog" args={['#0a0a16', 18, 60]} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[-6, 6, 4]} intensity={1.4} color="#ffd9a8" />
                <pointLight position={[6, 4, 6]} intensity={0.5} color="#6366f1" />
                <SkyDome />
                <SunRays />
                <Stars radius={90} depth={60} count={2600} factor={4} saturation={0} fade speed={1.5} />
                <Suspense fallback={null}>
                    <Sequence sim={sim} onPhase={setPhase} onIgnite={ignite} onDone={finish} skipRef={skipRef} />
                </Suspense>
            </Canvas>

            {/* warm color grade */}
            <div className="absolute inset-0 pointer-events-none mix-blend-soft-light" style={{ background: 'radial-gradient(120% 90% at 30% 80%, rgba(251,146,60,0.25), transparent 60%)' }} />
            {/* vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 220px 40px rgba(0,0,0,0.85)' }} />
            {/* film grain */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }} />
            {/* ignition flash */}
            <div className={`absolute inset-0 pointer-events-none bg-white transition-opacity duration-300 ${flash ? 'opacity-80' : 'opacity-0'}`} />
            {/* letterbox bars */}
            <div className="absolute top-0 left-0 right-0 h-[8%] bg-black" />
            <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black" />

            {/* title card */}
            {sim.current.t < 1.3 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-5xl font-black tracking-[0.3em] text-white drop-shadow-[0_0_30px_rgba(99,102,241,0.7)]">KEEPR</p>
                    <p className="mt-2 text-[11px] tracking-[0.5em] text-indigo-300/80 font-semibold">LAUNCH SEQUENCE</p>
                </div>
            )}

            {/* countdown / liftoff */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {phase && (
                    <div
                        key={phase}
                        className={phase === 'LIFTOFF'
                            ? 'text-5xl font-black tracking-[0.2em] text-orange-300 drop-shadow-[0_0_30px_rgba(251,146,60,0.8)]'
                            : 'text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)]'}
                        style={{ animation: 'kcount 0.55s ease-out' }}
                    >
                        {phase}
                    </div>
                )}
            </div>

            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] tracking-[0.3em] text-white/80 font-semibold">
                ⬢ ZENIT // KEEPR ORBITAL
            </div>
            <button
                onClick={() => { skipRef.current = true; }}
                className="absolute bottom-[10%] right-6 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90 hover:bg-white/20 transition-colors"
            >
                Skip →
            </button>

            <style>{`@keyframes kcount { 0% { transform: scale(2.6); opacity: 0 } 35% { opacity: 1 } 100% { transform: scale(1); opacity: 0.95 } }`}</style>
        </div>
    );
}
