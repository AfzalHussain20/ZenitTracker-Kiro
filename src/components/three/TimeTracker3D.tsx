'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface TimeTracker3DProps {
    isTracking: boolean;
    currentTime: number;
}

function Clock({ isTracking, currentTime }: TimeTracker3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const hourHandRef = useRef<THREE.Mesh>(null);
    const minuteHandRef = useRef<THREE.Mesh>(null);
    const secondHandRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
        }

        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = currentTime % 60;

        if (hourHandRef.current) {
            hourHandRef.current.rotation.z = -(hours * Math.PI / 6 + minutes * Math.PI / 360);
        }
        if (minuteHandRef.current) {
            minuteHandRef.current.rotation.z = -(minutes * Math.PI / 30 + seconds * Math.PI / 1800);
        }
        if (secondHandRef.current) {
            secondHandRef.current.rotation.z = -(seconds * Math.PI / 30);
        }
    });

    return (
        <group ref={groupRef}>
            {/* Clock face */}
            <mesh>
                <cylinderGeometry args={[2, 2, 0.2, 32]} />
                <meshStandardMaterial
                    color={isTracking ? '#6366f1' : '#64748b'}
                    emissive={isTracking ? '#6366f1' : '#64748b'}
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* Hour markers */}
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * Math.PI) / 6;
                return (
                    <mesh key={i} position={[Math.sin(angle) * 1.6, 0.15, Math.cos(angle) * 1.6]}>
                        <boxGeometry args={[0.1, 0.1, 0.3]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                );
            })}

            {/* Hour hand */}
            <mesh ref={hourHandRef} position={[0, 0.2, 0]}>
                <boxGeometry args={[0.1, 0.1, 1]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
            </mesh>

            {/* Minute hand */}
            <mesh ref={minuteHandRef} position={[0, 0.25, 0]}>
                <boxGeometry args={[0.08, 0.08, 1.4]} />
                <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
            </mesh>

            {/* Second hand */}
            <mesh ref={secondHandRef} position={[0, 0.3, 0]}>
                <boxGeometry args={[0.05, 0.05, 1.6]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
            </mesh>

            {/* Center dot */}
            <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
            </mesh>
        </group>
    );
}

export function TimeTracker3D({ isTracking, currentTime }: TimeTracker3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
                <Clock isTracking={isTracking} currentTime={currentTime} />
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
}
