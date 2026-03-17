'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface DeviceFleet3DProps {
    available: number;
    inUse: number;
    maintenance: number;
}

// Floating device box
function DeviceBox({ position, color, delay, label }: {
    position: [number, number, number];
    color: string;
    delay: number;
    label?: string;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5 + delay) * 0.18;
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.6 + delay;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4 + delay) * 0.15;
        }
        if (glowRef.current) {
            const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.15;
            (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
        }
    });

    return (
        <group>
            {/* Glow sphere behind */}
            <mesh ref={glowRef} position={position}>
                <sphereGeometry args={[0.28, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.15} />
            </mesh>
            {/* Device body */}
            <mesh ref={meshRef} position={position}>
                <boxGeometry args={[0.28, 0.48, 0.06]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
            </mesh>
        </group>
    );
}

// Orbit ring
function OrbitRing({ radius, color }: { radius: number; color: string }) {
    const obj = useMemo(() => {
        const points = [];
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, opacity: 0.2, transparent: true });
        return new THREE.Line(geo, mat);
    }, [radius, color]);

    return <primitive object={obj} />;
}

// Central hub
function CentralHub() {
    const meshRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
        if (innerRef.current) innerRef.current.rotation.y = -state.clock.elapsedTime * 0.8;
    });

    return (
        <group>
            <mesh ref={meshRef}>
                <torusGeometry args={[0.5, 0.04, 16, 64]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.6} />
            </mesh>
            <mesh ref={innerRef}>
                <octahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} wireframe />
            </mesh>
        </group>
    );
}

function Scene({ available, inUse, maintenance }: DeviceFleet3DProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
        }
    });

    // Always show at least 5 devices for visual appeal
    const totalAvail = Math.max(available, 2);
    const totalInUse = Math.max(inUse, 1);
    const totalMaint = Math.max(maintenance, 1);
    const total = totalAvail + totalInUse + totalMaint;

    const devices = useMemo(() => {
        const result: { position: [number, number, number]; color: string; delay: number }[] = [];
        const radii = [1.8, 2.8, 3.6];

        let idx = 0;
        const addDevices = (count: number, color: string, radius: number) => {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + idx * 0.3;
                result.push({
                    position: [Math.cos(angle) * radius, Math.sin(idx * 0.7) * 0.3, Math.sin(angle) * radius],
                    color,
                    delay: idx * 0.4,
                });
                idx++;
            }
        };

        addDevices(totalAvail, '#10b981', radii[0]);
        addDevices(totalInUse, '#0ea5e9', radii[1]);
        addDevices(totalMaint, '#f59e0b', radii[2]);
        return result;
    }, [totalAvail, totalInUse, totalMaint]);

    return (
        <group ref={groupRef}>
            <CentralHub />
            <OrbitRing radius={1.8} color="#10b981" />
            <OrbitRing radius={2.8} color="#0ea5e9" />
            <OrbitRing radius={3.6} color="#f59e0b" />
            {devices.map((d, i) => (
                <DeviceBox key={i} position={d.position} color={d.color} delay={d.delay} />
            ))}
        </group>
    );
}

export function DeviceFleet3D({ available, inUse, maintenance }: DeviceFleet3DProps) {
    return (
        <div className="w-full h-full relative">
            {/* Legend */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-10 bg-background/60 backdrop-blur-sm px-4 py-2 rounded-full border border-border/50">
                {[
                    { color: '#10b981', label: `Available (${available})` },
                    { color: '#0ea5e9', label: `In Use (${inUse})` },
                    { color: '#f59e0b', label: `Maintenance (${maintenance})` },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-muted-foreground">{item.label}</span>
                    </div>
                ))}
            </div>
            <Canvas camera={{ position: [0, 3, 7], fov: 50 }}>
                <ambientLight intensity={0.4} />
                <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
                <pointLight position={[-5, -3, -5]} intensity={0.8} color="#0ea5e9" />
                <pointLight position={[0, -5, 0]} intensity={0.5} color="#10b981" />
                <Scene available={available} inUse={inUse} maintenance={maintenance} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
            </Canvas>
        </div>
    );
}
