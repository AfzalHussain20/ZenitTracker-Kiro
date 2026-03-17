'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface DeviceInspector3DProps {
    isConnected: boolean;
    isRecording: boolean;
}

function PhoneModel({ isConnected, isRecording }: DeviceInspector3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const screenRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
        }

        if (screenRef.current && isRecording) {
            const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.5 + 0.5;
            const mat = screenRef.current.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = pulse;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Phone body */}
            <mesh>
                <boxGeometry args={[1.5, 3, 0.2]} />
                <meshStandardMaterial
                    color={isConnected ? '#8b5cf6' : '#64748b'}
                    emissive={isConnected ? '#8b5cf6' : '#64748b'}
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Screen */}
            <mesh ref={screenRef} position={[0, 0, 0.11]}>
                <boxGeometry args={[1.3, 2.6, 0.01]} />
                <meshStandardMaterial
                    color={isRecording ? '#ef4444' : '#06b6d4'}
                    emissive={isRecording ? '#ef4444' : '#06b6d4'}
                    emissiveIntensity={isRecording ? 0.8 : 0.5}
                />
            </mesh>

            {/* Camera notch */}
            <mesh position={[0, 1.3, 0.11]}>
                <boxGeometry args={[0.3, 0.1, 0.02]} />
                <meshStandardMaterial color="#000000" />
            </mesh>

            {/* Scanning effect */}
            {isConnected && (
                <>
                    {Array.from({ length: 8 }).map((_, i) => {
                        const angle = (i / 8) * Math.PI * 2;
                        const radius = 2;
                        return (
                            <ScanParticle
                                key={i}
                                position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
                                delay={i * 0.2}
                            />
                        );
                    })}
                </>
            )}
        </group>
    );
}

function ScanParticle({ position, delay }: { position: [number, number, number]; delay: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const time = state.clock.elapsedTime + delay;
            meshRef.current.position.y = Math.sin(time * 2) * 1.5;
            meshRef.current.scale.setScalar(Math.sin(time * 2) * 0.5 + 0.5);
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
                color="#8b5cf6"
                emissive="#8b5cf6"
                emissiveIntensity={1}
                transparent
                opacity={0.6}
            />
        </mesh>
    );
}

export function DeviceInspector3D({ isConnected, isRecording }: DeviceInspector3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />
                <PhoneModel isConnected={isConnected} isRecording={isRecording} />
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
}
