"use client";

/**
 * ZenitHero3D — a cinematic, reflective 3D centerpiece for the landing hero.
 *
 * Reliability-first (no EffectComposer, no external models/HDR):
 *  • A chrome extruded "Z" monolith + floating glass shards.
 *  • REAL reflections from an in-scene studio Environment built with Lightformers
 *    (procedural — no CDN HDR fetch, so it never blanks out).
 *  • ContactShadows for grounding, Sparkles for atmosphere.
 *  • Mouse parallax + scroll-driven motion via a shared ref (no per-frame React
 *    state → buttery smooth, zero re-render lag).
 */

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, ContactShadows, Float, Sparkles, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

export interface HeroState { scroll: number; px: number; py: number } // page scroll 0..1 + pointer −1..1

// ─── The Zenit "Z" — extruded, chrome ────────────────────────────────────────
function ZMonolith() {
    const geo = useMemo(() => {
        // Build the Z stroke as a flat shape, then extrude it
        const s = new THREE.Shape();
        // outer outline of a bold Z (in a ~3 x 3.6 box), drawn clockwise
        const t = 0.62; // stroke thickness
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

// the signature dot, as a glass sphere
function BrandDot() {
    return (
        <mesh position={[2.0, 1.7, 0.1]}>
            <sphereGeometry args={[0.36, 48, 48]} />
            <MeshTransmissionMaterial
                thickness={0.6} roughness={0.05} transmission={1} ior={1.4}
                chromaticAberration={0.06} anisotropy={0.2} distortion={0.2} distortionScale={0.3}
                temporalDistortion={0.1} color="#00C6FF" background={new THREE.Color('#05070f')}
            />
        </mesh>
    );
}

// floating glass shards around the monolith
function Shards() {
    const items = useMemo(() => [
        { p: [-3.2, 1.4, -1.5], s: 0.5, r: [0.4, 0.8, 0.2] },
        { p: [3.4, -1.2, -1.0], s: 0.7, r: [1.0, 0.3, 0.6] },
        { p: [-2.6, -1.8, 0.6], s: 0.4, r: [0.2, 1.2, 0.4] },
        { p: [2.8, 2.2, -2.0], s: 0.55, r: [0.6, 0.5, 1.0] },
    ], []);
    return (
        <>
            {items.map((it, i) => (
                <Float key={i} speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
                    <mesh position={it.p as [number, number, number]} rotation={it.r as [number, number, number]} scale={it.s}>
                        <icosahedronGeometry args={[1, 0]} />
                        <meshStandardMaterial color="#9fd8ff" metalness={0.9} roughness={0.08} envMapIntensity={1.2} />
                    </mesh>
                </Float>
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
                {/* moving softbox for living reflections */}
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

// ─── group that reacts to mouse + scroll ─────────────────────────────────────
function Rig({ state }: { state: { current: HeroState } }) {
    const group = useRef<THREE.Group>(null);
    const { camera } = useThree();
    useFrame((_, dt) => {
        if (!group.current) return;
        const { scroll: p, px, py } = state.current;
        // gentle continuous spin + mouse parallax tilt
        group.current.rotation.y += dt * 0.25;
        const targetX = py * 0.25 + p * 0.6;
        const targetZrot = px * 0.15;
        group.current.rotation.x += (targetX - group.current.rotation.x) * 0.06;
        group.current.rotation.z += (targetZrot - group.current.rotation.z) * 0.06;
        // scroll: push the object back + down as the user scrolls into content
        const targetY = -p * 2.2;
        const targetScale = 1 - p * 0.25;
        group.current.position.y += (targetY - group.current.position.y) * 0.08;
        const sc = group.current.scale.x + (targetScale - group.current.scale.x) * 0.08;
        group.current.scale.setScalar(sc);
        // subtle camera dolly with cursor
        camera.position.x += (px * 0.6 - camera.position.x) * 0.04;
        camera.position.y += (py * 0.4 + 0.2 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
    });
    return (
        <group ref={group}>
            <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.6}>
                <ZMonolith />
                <BrandDot />
            </Float>
            <Shards />
        </group>
    );
}

export default function ZenitHero3D({ state }: { state: { current: HeroState } }) {
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
                <Sparkles count={60} scale={14} size={2} speed={0.25} opacity={0.5} color="#9fd8ff" />
            </Suspense>
        </Canvas>
    );
}
