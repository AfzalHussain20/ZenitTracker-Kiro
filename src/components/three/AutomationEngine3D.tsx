'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface AutomationEngine3DProps {
    isRunning?: boolean;
    successCount?: number;
}

// ── Gear mesh (torus + spokes) ──────────────────────────────────────────────
function Gear({
    position,
    radius,
    color,
    speed,
    toothCount = 10,
}: {
    position: [number, number, number];
    radius: number;
    color: string;
    speed: number;
    toothCount?: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((_, delta) => {
        if (groupRef.current) groupRef.current.rotation.z += delta * speed;
    });

    const toothGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.22, 0.08), []);
    const toothMat = useMemo(
        () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2 }),
        [color]
    );
    const ringGeo = useMemo(() => new THREE.TorusGeometry(radius, 0.07, 12, 48), [radius]);
    const ringMat = useMemo(
        () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.15 }),
        [color]
    );
    const hubGeo = useMemo(() => new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.1, 24), [radius]);

    return (
        <group ref={groupRef} position={position}>
            {/* Ring */}
            <mesh geometry={ringGeo} material={ringMat} />
            {/* Hub */}
            <mesh geometry={hubGeo} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Teeth */}
            {Array.from({ length: toothCount }).map((_, i) => {
                const angle = (i / toothCount) * Math.PI * 2;
                return (
                    <mesh
                        key={i}
                        geometry={toothGeo}
                        material={toothMat}
                        position={[Math.cos(angle) * (radius + 0.1), Math.sin(angle) * (radius + 0.1), 0]}
                        rotation={[0, 0, angle]}
                    />
                );
            })}
            {/* Spokes */}
            {[0, 1, 2].map((i) => {
                const angle = (i / 3) * Math.PI * 2;
                const spokeGeo = new THREE.CylinderGeometry(0.03, 0.03, radius * 0.85, 8);
                return (
                    <mesh key={`spoke-${i}`} geometry={spokeGeo} rotation={[0, 0, angle + Math.PI / 2]}>
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
                    </mesh>
                );
            })}
        </group>
    );
}

// ── Pipeline node ────────────────────────────────────────────────────────────
function PipelineNode({
    position,
    color,
    delay,
    isRunning,
}: {
    position: [number, number, number];
    color: string;
    delay: number;
    isRunning: boolean;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!meshRef.current || !glowRef.current) return;
        const t = state.clock.elapsedTime;
        meshRef.current.position.y = position[1] + Math.sin(t * 1.8 + delay) * 0.12;
        meshRef.current.rotation.y = t * 0.8 + delay;
        const pulse = isRunning
            ? 0.6 + Math.sin(t * 4 + delay) * 0.4
            : 0.2 + Math.sin(t * 1.2 + delay) * 0.1;
        (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    });

    return (
        <group>
            <mesh ref={glowRef} position={position}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.18} />
            </mesh>
            <mesh ref={meshRef} position={position}>
                <octahedronGeometry args={[0.14, 0]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} metalness={0.6} roughness={0.2} />
            </mesh>
        </group>
    );
}

// ── Flowing particle along a path ────────────────────────────────────────────
function FlowParticle({ path, color, offset }: { path: THREE.CatmullRomCurve3; color: string; offset: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const progressRef = useRef(offset);

    useFrame((_, delta) => {
        progressRef.current = (progressRef.current + delta * 0.35) % 1;
        if (meshRef.current) {
            const pos = path.getPoint(progressRef.current);
            meshRef.current.position.copy(pos);
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
    );
}

// ── Pipeline connector line ──────────────────────────────────────────────────
function PipelineLine({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
    const obj = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const mat = new THREE.LineBasicMaterial({ color, opacity: 0.35, transparent: true });
        return new THREE.Line(geo, mat);
    }, [from, to, color]);
    return <primitive object={obj} />;
}

// ── Main scene ───────────────────────────────────────────────────────────────
function Scene({ isRunning, successCount }: AutomationEngine3DProps) {
    const rootRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (rootRef.current) {
            rootRef.current.rotation.y = state.clock.elapsedTime * 0.06;
        }
    });

    // Pipeline nodes arranged in a horizontal chain
    const nodePositions: [number, number, number][] = [
        [-3.2, 0, 0],
        [-1.6, 0.4, 0.4],
        [0, 0, 0],
        [1.6, 0.4, -0.4],
        [3.2, 0, 0],
    ];
    const nodeColors = ['#06b6d4', '#8b5cf6', '#f97316', '#10b981', '#3b82f6'];

    // Catmull-Rom path through nodes for particles
    const flowPath = useMemo(
        () => new THREE.CatmullRomCurve3(nodePositions.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
        []
    );

    return (
        <group ref={rootRef}>
            {/* Three interlocked gears — center stage */}
            <Gear position={[0, 0.1, -1.2]} radius={0.72} color="#f97316" speed={0.9} toothCount={12} />
            <Gear position={[-1.38, 0.1, -1.2]} radius={0.48} color="#8b5cf6" speed={-1.35} toothCount={8} />
            <Gear position={[1.38, 0.1, -1.2]} radius={0.48} color="#06b6d4" speed={-1.35} toothCount={8} />

            {/* Pipeline nodes */}
            {nodePositions.map((pos, i) => (
                <PipelineNode key={i} position={pos} color={nodeColors[i]} delay={i * 0.6} isRunning={!!isRunning} />
            ))}

            {/* Connector lines between nodes */}
            {nodePositions.slice(0, -1).map((pos, i) => (
                <PipelineLine
                    key={`conn-${i}`}
                    from={new THREE.Vector3(...pos)}
                    to={new THREE.Vector3(...nodePositions[i + 1])}
                    color={nodeColors[i]}
                />
            ))}

            {/* Flowing particles along pipeline */}
            {[0, 0.33, 0.66].map((offset, i) => (
                <FlowParticle key={`fp-${i}`} path={flowPath} color={nodeColors[i % nodeColors.length]} offset={offset} />
            ))}
        </group>
    );
}

// ── Export ───────────────────────────────────────────────────────────────────
export function AutomationEngine3D({ isRunning = false, successCount = 0 }: AutomationEngine3DProps) {
    return (
        <div className="w-full h-full">
            <Canvas camera={{ position: [0, 2.5, 7], fov: 52 }}>
                <ambientLight intensity={0.35} />
                <pointLight position={[4, 6, 4]} intensity={1.4} color="#ffffff" />
                <pointLight position={[-4, -4, 2]} intensity={0.8} color="#8b5cf6" />
                <pointLight position={[0, 0, 5]} intensity={0.6} color="#f97316" />
                <Scene isRunning={isRunning} successCount={successCount} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} />
            </Canvas>
        </div>
    );
}
