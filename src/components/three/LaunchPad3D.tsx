'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export interface LaunchPad3DProps {
    step: number;
    isLaunching?: boolean;
}

// Orbit ring
function Ring({ radius, color, speed, tilt = 0 }: { radius: number; color: string; speed: number; tilt?: number }) {
    const ref = useRef<THREE.Line>(null!);
    const geo = useMemo(() => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, [radius]);
    const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }), [color]);
    useFrame((_, d) => { ref.current.rotation.y += d * speed; });
    return <line ref={ref} geometry={geo} material={mat} rotation={[tilt, 0, 0]} />;
}

// Detailed rocket
function Rocket({ isLaunching }: { isLaunching: boolean }) {
    const groupRef = useRef<THREE.Group>(null!);
    const flameRef = useRef<THREE.Group>(null!);
    const yRef = useRef(0);
    const timeRef = useRef(0);

    useFrame((state, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;

        if (isLaunching) {
            yRef.current += delta * 3.5;
            groupRef.current.position.y = yRef.current;
            groupRef.current.rotation.y += delta * 2;
        } else {
            groupRef.current.position.y = Math.sin(t * 1.1) * 0.1;
            groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
        }

        if (flameRef.current) {
            const flicker = isLaunching
                ? 1.0 + Math.sin(t * 30) * 0.25
                : 0.55 + Math.sin(t * 10) * 0.2;
            flameRef.current.scale.set(flicker, flicker, flicker);
        }
    });

    const stepColors = ['#6366f1', '#f97316', '#10b981'];

    return (
        <group ref={groupRef} position={[0, 0.2, 0]}>
            {/* Main body */}
            <mesh>
                <cylinderGeometry args={[0.22, 0.26, 1.4, 24]} />
                <meshStandardMaterial color="#dde3f0" metalness={0.85} roughness={0.12} />
            </mesh>

            {/* Upper body taper */}
            <mesh position={[0, 0.9, 0]}>
                <cylinderGeometry args={[0.16, 0.22, 0.4, 24]} />
                <meshStandardMaterial color="#c8d0e8" metalness={0.85} roughness={0.12} />
            </mesh>

            {/* Nose cone */}
            <mesh position={[0, 1.35, 0]}>
                <coneGeometry args={[0.16, 0.6, 24]} />
                <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.5} metalness={0.8} roughness={0.1} />
            </mesh>

            {/* Nose tip glow */}
            <mesh position={[0, 1.65, 0]}>
                <sphereGeometry args={[0.04, 12, 12]} />
                <meshStandardMaterial color="#a5b4fc" emissive="#a5b4fc" emissiveIntensity={3} toneMapped={false} />
            </mesh>

            {/* Porthole window */}
            <mesh position={[0, 0.35, 0.23]}>
                <circleGeometry args={[0.09, 20]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.8} />
            </mesh>
            {/* Window rim */}
            <mesh position={[0, 0.35, 0.225]}>
                <ringGeometry args={[0.09, 0.115, 20]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Body stripe band */}
            <mesh position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.265, 0.265, 0.06, 24]} />
                <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.265, 0.265, 0.04, 24]} />
                <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} />
            </mesh>

            {/* 4 delta fins */}
            {[0, 1, 2, 3].map(i => {
                const angle = (i / 4) * Math.PI * 2;
                const x = Math.cos(angle) * 0.26;
                const z = Math.sin(angle) * 0.26;
                return (
                    <group key={i} position={[x, -0.55, z]} rotation={[0, angle, 0]}>
                        {/* Main fin shape */}
                        <mesh>
                            <boxGeometry args={[0.07, 0.55, 0.28]} />
                            <meshStandardMaterial color="#818cf8" metalness={0.75} roughness={0.2} />
                        </mesh>
                        {/* Fin leading edge glow */}
                        <mesh position={[0, 0.28, 0.14]}>
                            <boxGeometry args={[0.04, 0.06, 0.06]} />
                            <meshStandardMaterial color="#a5b4fc" emissive="#a5b4fc" emissiveIntensity={1} />
                        </mesh>
                    </group>
                );
            })}

            {/* Engine bell */}
            <mesh position={[0, -0.88, 0]}>
                <cylinderGeometry args={[0.18, 0.26, 0.22, 20]} />
                <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.05} />
            </mesh>
            {/* Engine nozzle inner */}
            <mesh position={[0, -1.0, 0]}>
                <cylinderGeometry args={[0.1, 0.18, 0.1, 20]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Flame group */}
            <group ref={flameRef} position={[0, -1.08, 0]}>
                {/* Outer flame */}
                <mesh>
                    <coneGeometry args={[0.18, 0.55, 16]} />
                    <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={2.5} transparent opacity={0.85} toneMapped={false} />
                </mesh>
                {/* Mid flame */}
                <mesh position={[0, -0.12, 0]}>
                    <coneGeometry args={[0.1, 0.38, 12]} />
                    <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={3} transparent opacity={0.9} toneMapped={false} />
                </mesh>
                {/* Core */}
                <mesh position={[0, -0.18, 0]}>
                    <coneGeometry args={[0.05, 0.22, 10]} />
                    <meshStandardMaterial color="#fef9c3" emissive="#fef9c3" emissiveIntensity={5} transparent opacity={0.95} toneMapped={false} />
                </mesh>
            </group>
        </group>
    );
}

// Launch platform base
function LaunchPlatform({ step }: { step: number }) {
    const ref = useRef<THREE.Group>(null!);
    useFrame((_, d) => { ref.current.rotation.y += d * 0.12; });

    const stepColor = step === 1 ? '#6366f1' : step === 2 ? '#f97316' : '#10b981';

    return (
        <group ref={ref}>
            {/* Outer base ring */}
            <mesh position={[0, -1.05, 0]}>
                <cylinderGeometry args={[1.6, 1.8, 0.1, 40]} />
                <meshStandardMaterial color={stepColor} emissive={stepColor} emissiveIntensity={0.25} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Inner platform */}
            <mesh position={[0, -0.98, 0]}>
                <cylinderGeometry args={[0.7, 0.8, 0.12, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Glow ring */}
            <mesh position={[0, -0.99, 0]}>
                <torusGeometry args={[1.55, 0.045, 8, 60]} />
                <meshStandardMaterial color={stepColor} emissive={stepColor} emissiveIntensity={2.5} toneMapped={false} />
            </mesh>
            {/* Inner glow ring */}
            <mesh position={[0, -0.97, 0]}>
                <torusGeometry args={[0.72, 0.03, 8, 40]} />
                <meshStandardMaterial color={stepColor} emissive={stepColor} emissiveIntensity={2} toneMapped={false} />
            </mesh>
            {/* 4 support struts */}
            {[0, 1, 2, 3].map(i => {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
                return (
                    <mesh key={i} position={[Math.cos(a) * 1.0, -0.6, Math.sin(a) * 1.0]} rotation={[0, a, 0.35]}>
                        <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
                        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
                    </mesh>
                );
            })}
            {/* Step indicator dots on base */}
            {[1, 2, 3].map(s => {
                const a = ((s - 1) / 3) * Math.PI * 2;
                const active = s <= step;
                return (
                    <mesh key={s} position={[Math.cos(a) * 1.2, -0.96, Math.sin(a) * 1.2]}>
                        <sphereGeometry args={[0.07, 14, 14]} />
                        <meshStandardMaterial
                            color={active ? stepColor : '#1e293b'}
                            emissive={active ? stepColor : '#0f172a'}
                            emissiveIntensity={active ? 2.5 : 0.1}
                            toneMapped={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

// Orbiting data fragments
function DataOrbit({ step }: { step: number }) {
    const ref = useRef<THREE.Group>(null!);
    useFrame((state) => { ref.current.rotation.y = state.clock.elapsedTime * 0.45; });

    const count = step * 3 + 3;
    const color = step === 1 ? '#818cf8' : step === 2 ? '#fb923c' : '#34d399';

    return (
        <group ref={ref}>
            {Array.from({ length: count }).map((_, i) => {
                const a = (i / count) * Math.PI * 2;
                const r = 2.4;
                const yOff = Math.sin(i * 1.3) * 0.4;
                return (
                    <mesh key={i} position={[Math.cos(a) * r, yOff, Math.sin(a) * r]}>
                        <octahedronGeometry args={[0.065, 0]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} toneMapped={false} />
                    </mesh>
                );
            })}
        </group>
    );
}

function Scene({ step, isLaunching }: LaunchPad3DProps) {
    const stepColor = step === 1 ? '#6366f1' : step === 2 ? '#f97316' : '#10b981';
    return (
        <>
            <ambientLight intensity={0.25} />
            <pointLight position={[4, 6, 4]} intensity={1.8} color="#ffffff" />
            <pointLight position={[-3, 2, -3]} intensity={1.2} color={stepColor} />
            <pointLight position={[0, -1, 3]} intensity={0.8} color="#f97316" />
            <Ring radius={1.9} color="#6366f1" speed={0.28} tilt={0.15} />
            <Ring radius={2.6} color="#f97316" speed={-0.18} tilt={-0.1} />
            <Ring radius={3.2} color="#10b981" speed={0.12} tilt={0.25} />
            <LaunchPlatform step={step} />
            <Rocket isLaunching={!!isLaunching} />
            <DataOrbit step={step} />
            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.4}
                minPolarAngle={Math.PI / 3.5}
                maxPolarAngle={Math.PI / 2.1}
            />
        </>
    );
}

export function LaunchPad3D({ step, isLaunching = false }: LaunchPad3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas
                camera={{ position: [0, 2.2, 6.5], fov: 46 }}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                dpr={[1, 1.5]}
            >
                <Scene step={step} isLaunching={isLaunching} />
            </Canvas>
        </div>
    );
}
