'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface LocatorScan3DProps {
    isScanning: boolean;
    elementCount: number;
}

function ScanningGrid({ isScanning, elementCount }: LocatorScan3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const scanLineRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
        }

        if (scanLineRef.current && isScanning) {
            scanLineRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 2;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Grid plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[4, 4, 10, 10]} />
                <meshStandardMaterial
                    color="#06b6d4"
                    wireframe
                    emissive="#06b6d4"
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Scanning line */}
            {isScanning && (
                <mesh ref={scanLineRef} position={[0, 0, 0]}>
                    <boxGeometry args={[4, 0.05, 4]} />
                    <meshStandardMaterial
                        color="#06b6d4"
                        emissive="#06b6d4"
                        emissiveIntensity={1}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            )}

            {/* Found elements */}
            {Array.from({ length: Math.min(elementCount, 20) }).map((_, i) => {
                const angle = (i / elementCount) * Math.PI * 2;
                const radius = 1.5;
                return (
                    <Element
                        key={i}
                        position={[Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius]}
                        delay={i * 0.1}
                    />
                );
            })}
        </group>
    );
}

function Element({ position, delay }: { position: [number, number, number]; delay: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.2;
            meshRef.current.rotation.y = state.clock.elapsedTime + delay;
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <octahedronGeometry args={[0.2]} />
            <meshStandardMaterial
                color="#06b6d4"
                emissive="#06b6d4"
                emissiveIntensity={0.5}
            />
        </mesh>
    );
}

export function LocatorScan3D({ isScanning, elementCount }: LocatorScan3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 4, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />
                <ScanningGrid isScanning={isScanning} elementCount={elementCount} />
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
}
