'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface AnalyticsTracker3DProps {
    eventCount: number;
}

// Wrapper to avoid JSX <line> conflicting with SVG line element
function ConnLine({ geometry }: { geometry: THREE.BufferGeometry }) {
    return (
        <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#f97316', opacity: 0.3, transparent: true }))} />
    );
}

function DataStream({ eventCount }: AnalyticsTracker3DProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Central sphere */}
            <mesh>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshStandardMaterial
                    color="#f97316"
                    emissive="#f97316"
                    emissiveIntensity={0.5}
                    wireframe
                />
            </mesh>

            {/* Orbiting data points */}
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const radius = 2;
                return (
                    <DataPoint
                        key={i}
                        position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
                        delay={i * 0.2}
                    />
                );
            })}

            {/* Connection lines */}
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const radius = 2;
                const points = [
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                return <ConnLine key={`line-${i}`} geometry={geometry} />;
            })}
        </group>
    );
}

function DataPoint({ position, delay }: { position: [number, number, number]; delay: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 + delay) * 0.5;
            meshRef.current.rotation.x = state.clock.elapsedTime + delay;
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.5 + delay;
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshStandardMaterial
                color="#f97316"
                emissive="#f97316"
                emissiveIntensity={0.8}
            />
        </mesh>
    );
}

export function AnalyticsTracker3D({ eventCount }: AnalyticsTracker3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#f97316" />
                <DataStream eventCount={eventCount} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={2} />
            </Canvas>
        </div>
    );
}
