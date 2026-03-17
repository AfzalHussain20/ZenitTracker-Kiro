'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface SessionActivity3DProps {
    sessions: Array<{ month: string; count: number }>;
}

function ActivityBars({ sessions }: SessionActivity3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const maxCount = Math.max(...sessions.map(s => s.count));

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
            {sessions.map((session, i) => {
                const height = (session.count / maxCount) * 3;
                const x = (i - sessions.length / 2) * 1.2;
                return (
                    <Bar
                        key={i}
                        position={[x, height / 2, 0]}
                        height={height}
                        label={session.month}
                        value={session.count}
                        delay={i * 0.1}
                    />
                );
            })}
        </group>
    );
}

function Bar({ position, height, label, value, delay }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetHeight = useRef(height);

    useFrame((state) => {
        if (meshRef.current) {
            // Smooth height animation
            const currentScale = meshRef.current.scale.y;
            meshRef.current.scale.y = THREE.MathUtils.lerp(currentScale, targetHeight.current, 0.1);
            
            // Gentle pulse
            const pulse = Math.sin(state.clock.elapsedTime * 2 + delay) * 0.05 + 1;
            meshRef.current.scale.x = pulse;
            meshRef.current.scale.z = pulse;
        }
    });

    return (
        <group position={position}>
            <mesh ref={meshRef} scale={[1, 0, 1]}>
                <boxGeometry args={[0.8, 1, 0.8]} />
                <meshStandardMaterial
                    color="#6366f1"
                    emissive="#6366f1"
                    emissiveIntensity={0.3}
                />
            </mesh>
            <Text
                position={[0, -height / 2 - 0.5, 0]}
                fontSize={0.25}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
            <Text
                position={[0, height / 2 + 0.3, 0]}
                fontSize={0.3}
                color="#6366f1"
                anchorX="center"
                anchorY="middle"
            >
                {value}
            </Text>
        </group>
    );
}

export function SessionActivity3D({ sessions }: SessionActivity3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 3, 8], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
                <ActivityBars sessions={sessions} />
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
}
