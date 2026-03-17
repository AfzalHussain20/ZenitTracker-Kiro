'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

interface DataPoint {
    label: string;
    value: number;
}

interface AnimatedLineChart3DProps {
    data: DataPoint[];
    color?: string;
    title?: string;
}

function ChartLine({ data, color = '#6366f1' }: { data: DataPoint[]; color: string }) {
    const pointsRef = useRef<THREE.Group>(null);

    const points = useMemo(() => {
        const maxValue = Math.max(...data.map(d => d.value));
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * 8 - 4;
            const y = (d.value / maxValue) * 3;
            return new THREE.Vector3(x, y, 0);
        });
    }, [data]);

    useFrame((state) => {
        if (pointsRef.current) {
            pointsRef.current.children.forEach((child, i) => {
                const offset = Math.sin(state.clock.elapsedTime * 2 + i * 0.3) * 0.1;
                child.position.y = points[i].y + offset;
            });
        }
    });

    return (
        <group>
            {/* Line */}
            <Line
                points={points}
                color={color}
                lineWidth={3}
            />

            {/* Points */}
            <group ref={pointsRef}>
                {points.map((point, i) => (
                    <mesh key={i} position={[point.x, point.y, 0]}>
                        <sphereGeometry args={[0.15, 16, 16]} />
                        <meshStandardMaterial
                            color={color}
                            emissive={color}
                            emissiveIntensity={0.8}
                        />
                    </mesh>
                ))}
            </group>

            {/* Labels */}
            {data.map((d, i) => (
                <Text
                    key={i}
                    position={[points[i].x, -0.5, 0]}
                    fontSize={0.3}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    {d.label}
                </Text>
            ))}

            {/* Grid */}
            {Array.from({ length: 5 }).map((_, i) => {
                const y = (i / 4) * 3;
                return (
                    <Line
                        key={i}
                        points={[[-4, y, -0.1], [4, y, -0.1]]}
                        color="#ffffff"
                        lineWidth={0.5}
                        opacity={0.2}
                        transparent
                    />
                );
            })}
        </group>
    );
}

export function AnimatedLineChart3D({ data, color = '#6366f1', title }: AnimatedLineChart3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 2, 8], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color={color} />
                {title && (
                    <Text
                        position={[0, 4, 0]}
                        fontSize={0.5}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {title}
                    </Text>
                )}
                <ChartLine data={data} color={color} />
                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
}
