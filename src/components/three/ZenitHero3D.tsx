"use client";

/**
 * ZenitHero3D — a cinematic, reflective 3D centerpiece with scroll choreography.
 *
 * Reliability-first (no EffectComposer, no external models/HDR):
 *  • Chrome extruded "Z" monolith + a glass dot that detaches and orbits +
 *    glass/metal shards that disperse as you scroll.
 *  • REAL reflections from an in-scene studio Environment built with Lightformers
 *    (procedural — no CDN HDR fetch, so it never blanks out).
 *  • Camera ARCS around the monolith as you scroll (scrollytelling) while every
 *    transform is lerped toward scroll-derived targets → buttery, no re-renders.
 */

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, ContactShadows, Float, Sparkles, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

export interface HeroState { scroll: number; px: number; py: number }
type StateRef = { current: HeroState };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ─── The Zenit "Z" — extruded, chrome ────────────────────────────────────────
function ZMonolith() {
    const geo = useMemo(() => {
        const s = new THREE.Shape();
        const t = 0.62;
        s.moveTo(-1.5, 1.8);
        s.lineTo(1.5, 1.8);
        s.lineTo(1.5, 1.8 - t);
        s.lineTo(-0.55, 1.8 - t);
        s.lineTo(1.5, -1.8 + t);
        s.lineTo(1.5, -1.8);
        s.lineTo(-1.5, -1.8);
        s.lineTo(-1.5, -1.8 + t);
        s.lineTo(0.55, -1.8 + t);
        s.lineTo(-1.5, 1.8 - t);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4, curveSegments: 24 });
        g.center();
        return g;
    }, []);
    return (
        <mesh geometry={geo} castShadow>
            <meshStandardMaterial color="#dfe9ff" metalness={1} roughness={0.12} envMapIntensity={1.4} />
        </mesh>
    );
}

// the signature dot — detaches and orbits the monolith with scroll
function BrandDot({ state }: { state: StateRef }) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((s) => {
        if (!ref.current) return;
        const p = state.current.scroll;
        // p<0.12: attached at top-right of the Z; beyond that, orbit outward
        const detach = clamp01((p - 0.1) / 0.5);
        const ang = s.clock.elapsedTime * 0.6 + detach * Math.PI * 2;
        const radius = lerp(0.0, 3.4, detach);
        const homeX = 2.0, homeY = 1.7;
        const tx = lerp(homeX, Math.cos(ang) * radius, detach);
        const ty = lerp(homeY, Math.sin(ang) * radius * 0.6, detach);
        const tz = lerp(0.1, Math.sin(ang) * radius * 0.5, detach);
        ref.current.position.x = lerp(ref.current.position.x, tx, 0.08);
        ref.current.position.y = lerp(ref.current.position.y, ty, 0.08);
        ref.current.position.z = lerp(ref.current.position.z, tz, 0.08);
    });
    return (
        <mesh ref={ref} position={[2.0, 1.7, 0.1]}>
            <sphereGeometry args={[0.34, 48, 48]} />
            <MeshTransmissionMaterial
                thickness={0.6} roughness={0.05} transmission={1} ior={1.4}
                chromaticAberration={0.06} anisotropy={0.2} distortion={0.2} distortionScale={0.3}
                temporalDistortion={0.1} color="#00C6FF" background={new THREE.Color('#05070f')}
            />
        </mesh>
    );
}

// floating glass/metal shards that disperse outward with scroll
function Shards({ state }: { state: StateRef }) {
    const items = useMemo(() => [
        { base: [-3.2, 1.4, -1.5], s: 0.5, r: [0.4, 0.8, 0.2] },
        { base: [3.4, -1.2, -1.0], s: 0.7, r: [1.0, 0.3, 0.6] },
        { base: [-2.6, -1.8, 0.6], s: 0.4, r: [0.2, 1.2, 0.4] },
        { base: [2.8, 2.2, -2.0], s: 0.55, r: [0.6, 0.5, 1.0] },
        { base: [-3.8, -0.4, -2.4], s: 0.45, r: [0.9, 0.2, 0.7] },
        { base: [3.9, 1.0, 0.4], s: 0.5, r: [0.3, 0.9, 0.5] },
    ], []);
    const refs = useRef<(THREE.Group | null)[]>([]);
    useFrame(() => {
        const p = state.current.scroll;
        const spread = 1 + p * 1.1;
        items.forEach((it, i) => {
            const g = refs.current[i]; if (!g) return;
            g.position.x = lerp(g.position.x, it.base[0] * spread, 0.06);
            g.position.y = lerp(g.position.y, it.base[1] * spread, 0.06);
            g.position.z = lerp(g.position.z, it.base[2] * spread, 0.06);
        });
    });
    return (
        <>
            {items.map((it, i) => (
                <group key={i} ref={(el) => { refs.current[i] = el; }} position={it.base as [number, number, number]}>
                    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
                        <mesh rotation={it.r as [number, number, number]} scale={it.s}>
                            <icosahedronGeometry args={[1, 0]} />
                            <meshStandardMaterial color="#9fd8ff" metalness={0.9} roughness={0.08} envMapIntensity={1.2} />
                        </mesh>
                    </Float>
                </group>
            ))}
        </>
    );
}

// ─── studio environment built from light shapes (procedural, no network) ─────
function StudioEnv() {
    return (
        <Environment resolution={256}>
            <group rotation={[0, 0, 1]}>
                <Lightformer form="circle" intensity={6} position={[0, 5, -9]} scale={8} color="#a9d4ff" />
                <Lightformer form="circle" intensity={3} position={[-5, 1, -6]} scale={5} color="#ffffff" />
                <Lightformer form="ring" intensity={3} position={[6, -2, -5]} scale={4} color="#00C6FF" />
                <Lightformer form="rect" intensity={2} position={[0, -6, -4]} scale={[12, 4, 1]} color="#1b3a8f" />
                <SpinningLight />
            </group>
        </Environment>
    );
}
function SpinningLight() {
    const ref = useRef<any>(null);
    useFrame((s) => {
        if (ref.current) {
            const t = s.clock.elapsedTime * 0.4;
            ref.current.position.x = Math.sin(t) * 6;
            ref.current.position.z = Math.cos(t) * 6 - 4;
            ref.current.lookAt?.(0, 0, 0);
        }
    });
    return <Lightformer ref={ref} form="rect" intensity={3} scale={[3, 6, 1]} color="#7fb6ff" />;
}

// ─── rig: camera arcs around the monolith as you scroll ──────────────────────
function Rig({ state }: { state: StateRef }) {
    const group = useRef<THREE.Group>(null);
    const { camera } = useThree();
    const camTarget = useRef(new THREE.Vector3(0, 0.2, 9));
    const look = useRef(new THREE.Vector3(0, 0, 0));
    useFrame((_, dt) => {
        if (!group.current) return;
        const { scroll: p, px, py } = state.current;
        const arc = clamp01(p / 0.55);          // most camera motion happens early
        // monolith: continuous spin + scroll tilt + mouse parallax
        group.current.rotation.y += dt * 0.25;
        const tiltX = py * 0.2 + arc * 0.5;
        const tiltZ = px * 0.12;
        group.current.rotation.x = lerp(group.current.rotation.x, tiltX, 0.06);
        group.current.rotation.z = lerp(group.current.rotation.z, tiltZ, 0.06);
        group.current.position.y = lerp(group.current.position.y, -arc * 1.4, 0.06);

        // camera arcs on a circle around the Z + dollies in, then settles
        const ang = -0.25 + arc * 1.15 + px * 0.25;
        const rad = lerp(9, 6.8, arc);
        camTarget.current.set(
            Math.sin(ang) * rad,
            lerp(0.2, 1.6, arc) + py * 0.4,
            Math.cos(ang) * rad
        );
        camera.position.lerp(camTarget.current, 0.045);
        look.current.set(0, lerp(0, -0.6, arc), 0);
        camera.lookAt(look.current);
    });
    return (
        <group ref={group}>
            <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.6}>
                <ZMonolith />
            </Float>
            <BrandDot state={state} />
            <Shards state={state} />
        </group>
    );
}

export default function ZenitHero3D({ state }: { state: StateRef }) {
    return (
        <Canvas
            camera={{ position: [0, 0.2, 9], fov: 42 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
            <Suspense fallback={null}>
                <ambientLight intensity={0.4} />
                <spotLight position={[8, 10, 8]} angle={0.3} penumbra={1} intensity={2.2} color="#ffffff" castShadow />
                <spotLight position={[-8, -4, -6]} angle={0.5} penumbra={1} intensity={1.2} color="#00C6FF" />
                <StudioEnv />
                <Rig state={state} />
                <ContactShadows position={[0, -2.6, 0]} opacity={0.5} scale={16} blur={2.6} far={5} color="#0a1530" />
                <Sparkles count={70} scale={16} size={2} speed={0.25} opacity={0.5} color="#9fd8ff" />
            </Suspense>
        </Canvas>
    );
}
