'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface TestCaseLibrary3DProps {
    high: number;
    medium: number;
    low: number;
}

function FloatingBooks({ high, medium, low }: TestCaseLibrary3DProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
        }
    });

    const books = [
        { count: high, color: '#ef4444', label: 'High', yOffset: 1 },
        { count: medium, color: '#f59e0b', label: 'Med', yOffset: 0 },
        { count: low, color: '#10b981', label: 'Low', yOffset: -1 },
    ];

    return (
        <group ref={groupRef}>
            {books.map((book, stackIndex) => (
                <group key={stackIndex} position={[stackIndex * 2 - 2, book.yOffset, 0]}>
                    {Array.from({ length: Math.min(book.count, 10) }).map((_, i) => (
                        <Book key={i} position={[0, i * 0.15, 0]} color={book.color} delay={i * 0.1} />
                    ))}
                    <Text
                        position={[0, -0.5, 0]}
                        fontSize={0.3}
                        color={book.color}
                        anchorX="center"
                        anchorY="middle"
                    >
                        {book.label}
                    </Text>
                </group>
            ))}
        </group>
    );
}

function Book({ position, color, delay }: { position: [number, number, number]; color: string; delay: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime + delay) * 0.1;
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <boxGeometry args={[0.6, 0.1, 0.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
        </mesh>
    );
}

export function TestCaseLibrary3D({ high, medium, low }: TestCaseLibrary3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 2, 6], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />
                <FloatingBooks high={high} medium={medium} low={low} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
            </Canvas>
        </div>
    );
}
