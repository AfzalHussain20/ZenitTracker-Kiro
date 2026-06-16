"use client";

/**
 * PeopleOrbit3D — an interactive 3D "fleet constellation".
 *
 * • People orbit a glowing central core.
 * • Drag to orbit the whole scene (OrbitControls).
 * • Click a person → their devices bloom into orbit around them, connected by
 *   light trails. Arrangement pattern + hue are seeded per-person, so every
 *   person looks different.
 * • Click a device satellite → it pulses with a fresh burst (different every
 *   click) and notifies the parent to show that device's tracking detail.
 *
 * Fully self-contained. Safe to remove without touching the rest of Keepr.
 */

import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Line, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── Public data shapes ─────────────────────────────────────────────────────
export interface OrbitDevice {
    id: string;
    name: string;
    type: string;
    active: boolean;   // currently held
}

export interface OrbitPerson {
    key: string;
    name: string;
    team: string;
    currentlyHolding: number;
    sessions: number;
    uniqueDevices: number;
    devices: OrbitDevice[];
}

// ─── Color + seed helpers ────────────────────────────────────────────────────
function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h;
}

// Vivid hue per person (HSL → THREE.Color)
function personColor(name: string): THREE.Color {
    const hue = (hashStr(name) % 360) / 360;
    return new THREE.Color().setHSL(hue, 0.7, 0.6);
}

function deviceTypeColor(type: string): THREE.Color {
    switch (type) {
        case 'phone':   return new THREE.Color('#3b82f6');
        case 'tablet':  return new THREE.Color('#8b5cf6');
        case 'laptop':  return new THREE.Color('#64748b');
        case 'tv':      return new THREE.Color('#f43f5e');
        case 'monitor': return new THREE.Color('#14b8a6');
        default:        return new THREE.Color('#f59e0b');
    }
}

// Local positions for a person's device satellites — pattern seeded per person
function satellitePositions(count: number, seed: number): THREE.Vector3[] {
    const pattern = seed % 4;
    const out: THREE.Vector3[] = [];
    const R = 1.6 + Math.min(count, 8) * 0.12;

    for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / count : 0;
        let v: THREE.Vector3;
        if (pattern === 0) {
            // ring
            const a = t * Math.PI * 2;
            v = new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 2) * 0.4, Math.sin(a) * R);
        } else if (pattern === 1) {
            // helix
            const a = t * Math.PI * 4;
            v = new THREE.Vector3(Math.cos(a) * R, (t - 0.5) * R * 1.6, Math.sin(a) * R);
        } else if (pattern === 2) {
            // fibonacci sphere shell
            const y = 1 - (i / Math.max(count - 1, 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const phi = i * 2.399963229728653; // golden angle
            v = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(R);
        } else {
            // tilted double-ring
            const a = t * Math.PI * 2;
            const tilt = i % 2 === 0 ? 0.5 : -0.5;
            v = new THREE.Vector3(Math.cos(a) * R, tilt + Math.sin(a) * 0.3, Math.sin(a) * R);
        }
        out.push(v);
    }
    return out;
}

// ─── Central core ────────────────────────────────────────────────────────────
function Core({ active }: { active: boolean }) {
    const inner = useRef<THREE.Mesh>(null);
    const outer = useRef<THREE.Mesh>(null);
    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (inner.current) {
            inner.current.rotation.y += dt * 0.4;
            inner.current.rotation.x += dt * 0.15;
            const s = 1 + Math.sin(t * 1.5) * 0.06;
            inner.current.scale.setScalar(s);
        }
        if (outer.current) {
            outer.current.rotation.y -= dt * 0.2;
            outer.current.rotation.z += dt * 0.1;
        }
    });
    return (
        <group>
            <mesh ref={inner}>
                <icosahedronGeometry args={[0.85, 1]} />
                <meshStandardMaterial color="#6366f1" emissive="#4f46e5" emissiveIntensity={active ? 1.4 : 0.8} roughness={0.2} metalness={0.6} />
            </mesh>
            <mesh ref={outer}>
                <icosahedronGeometry args={[1.25, 1]} />
                <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.25} />
            </mesh>
            <pointLight color="#818cf8" intensity={2} distance={8} />
            <Sparkles count={30} scale={3} size={2} speed={0.3} color="#a5b4fc" />
        </group>
    );
}

// ─── A device satellite ──────────────────────────────────────────────────────
function Satellite({ device, position, onClick, isSelected, burstSeed }: {
    device: OrbitDevice;
    position: THREE.Vector3;
    onClick: () => void;
    isSelected: boolean;
    burstSeed: number;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => deviceTypeColor(device.type), [device.type]);

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.y += dt * 1.2;
            const base = isSelected ? 0.34 : hovered ? 0.28 : 0.22;
            const pulse = isSelected ? Math.sin(t * 6) * 0.05 : 0;
            ref.current.scale.setScalar(base + pulse);
        }
        if (ringRef.current) {
            ringRef.current.rotation.z += dt * (isSelected ? 3 : 1);
            ringRef.current.rotation.x = Math.PI / 2;
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={ref}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
            >
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={device.active ? 1.2 : 0.5}
                    roughness={0.3}
                    metalness={0.5}
                />
            </mesh>

            {/* data ring around selected device */}
            {isSelected && (
                <mesh ref={ringRef}>
                    <torusGeometry args={[0.5, 0.02, 8, 48]} />
                    <meshBasicMaterial color={color} transparent opacity={0.8} />
                </mesh>
            )}

            {/* fresh burst on each selection — seeded so it looks different each click */}
            {isSelected && (
                <Sparkles
                    key={burstSeed}
                    count={18}
                    scale={1.4}
                    size={3}
                    speed={1.2}
                    color={new THREE.Color().setHSL((burstSeed % 100) / 100, 0.8, 0.65)}
                />
            )}

            {/* active indicator halo */}
            {device.active && !isSelected && (
                <mesh scale={0.32}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial color={color} transparent opacity={0.12} />
                </mesh>
            )}

            {(hovered || isSelected) && (
                <Billboard position={[0, 0.5, 0]}>
                    <Text fontSize={0.22} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor="#000000">
                        {device.name}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}

// ─── A person's device cluster (only rendered when selected) ─────────────────
function DeviceCluster({ person, onSelectDevice, selectedDeviceId, burstSeed }: {
    person: OrbitPerson;
    onSelectDevice: (d: OrbitDevice) => void;
    selectedDeviceId: string | null;
    burstSeed: number;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const seed = useMemo(() => hashStr(person.name), [person.name]);
    const positions = useMemo(() => satellitePositions(person.devices.length, seed), [person.devices.length, seed]);

    useFrame((_, dt) => {
        if (groupRef.current) groupRef.current.rotation.y += dt * 0.25;
    });

    return (
        <group ref={groupRef}>
            {person.devices.map((d, i) => (
                <group key={d.id}>
                    {/* light trail from person centre to satellite */}
                    <Line
                        points={[[0, 0, 0], [positions[i].x, positions[i].y, positions[i].z]]}
                        color={d.active ? '#ffffff' : '#64748b'}
                        lineWidth={d.active ? 1.4 : 0.8}
                        transparent
                        opacity={d.active ? 0.55 : 0.25}
                    />
                    <Satellite
                        device={d}
                        position={positions[i]}
                        onClick={() => onSelectDevice(d)}
                        isSelected={selectedDeviceId === d.id}
                        burstSeed={burstSeed}
                    />
                </group>
            ))}
        </group>
    );
}

// ─── A person node ───────────────────────────────────────────────────────────
function PersonNode({ person, position, isSelected, anySelected, onSelect, onSelectDevice, selectedDeviceId, burstSeed }: {
    person: OrbitPerson;
    position: THREE.Vector3;
    isSelected: boolean;
    anySelected: boolean;
    onSelect: () => void;
    onSelectDevice: (d: OrbitDevice) => void;
    selectedDeviceId: string | null;
    burstSeed: number;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => personColor(person.name), [person.name]);
    const baseSize = 0.4 + Math.min(person.currentlyHolding, 6) * 0.06;

    // dim non-selected people when something is selected
    const dim = anySelected && !isSelected;

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.y += dt * 0.5;
            const target = (isSelected ? 1.35 : hovered ? 1.18 : 1) * baseSize;
            const cur = ref.current.scale.x;
            ref.current.scale.setScalar(cur + (target - cur) * 0.15);
        }
        if (haloRef.current && isSelected) {
            haloRef.current.rotation.z += dt * 0.8;
            const s = baseSize * (2.1 + Math.sin(t * 2) * 0.12);
            haloRef.current.scale.setScalar(s);
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={ref}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
            >
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={dim ? 0.2 : isSelected ? 1.3 : 0.7}
                    roughness={0.25}
                    metalness={0.5}
                    transparent
                    opacity={dim ? 0.35 : 1}
                />
            </mesh>

            {/* selection halo ring */}
            {isSelected && (
                <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1, 0.03, 8, 64]} />
                    <meshBasicMaterial color={color} transparent opacity={0.85} />
                </mesh>
            )}

            {/* held-device count badge as small orbiters when NOT selected */}
            {!isSelected && person.currentlyHolding > 0 && (
                <Sparkles count={person.currentlyHolding * 2} scale={baseSize * 3} size={2} speed={0.4} color={color} />
            )}

            {/* name label */}
            <Billboard position={[0, baseSize + 0.35, 0]}>
                <Text
                    fontSize={isSelected ? 0.34 : 0.26}
                    color={dim ? '#64748b' : '#ffffff'}
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.014}
                    outlineColor="#000000"
                >
                    {person.name}
                </Text>
                {isSelected && (
                    <Text position={[0, -0.05, 0]} fontSize={0.16} color={'#cbd5e1'} anchorX="center" anchorY="top">
                        {`${person.currentlyHolding} held · ${person.uniqueDevices} used`}
                    </Text>
                )}
            </Billboard>

            {/* connection from core to this person */}
            {isSelected && (
                <Line
                    points={[[0, 0, 0], [-position.x, -position.y, -position.z]]}
                    color={color.getStyle()}
                    lineWidth={1.2}
                    transparent
                    opacity={0.4}
                    dashed
                    dashScale={3}
                />
            )}

            {/* device cluster blooms when selected */}
            {isSelected && (
                <DeviceCluster
                    person={person}
                    onSelectDevice={onSelectDevice}
                    selectedDeviceId={selectedDeviceId}
                    burstSeed={burstSeed}
                />
            )}
        </group>
    );
}

// ─── Camera focus controller ─────────────────────────────────────────────────
function FocusRig({ target, controlsRef }: { target: THREE.Vector3 | null; controlsRef: React.MutableRefObject<any> }) {
    const { camera } = useThree();
    const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
    const desiredCam = useRef(new THREE.Vector3(0, 2, 12));

    useFrame(() => {
        if (target) {
            desiredTarget.current.copy(target);
            // camera sits a bit outside the person, looking inward
            const dir = target.clone().normalize();
            desiredCam.current.copy(target).add(dir.multiplyScalar(4.5)).add(new THREE.Vector3(0, 1.5, 0));
        } else {
            desiredTarget.current.set(0, 0, 0);
            desiredCam.current.set(0, 2, 12);
        }
        camera.position.lerp(desiredCam.current, 0.06);
        if (controlsRef.current) {
            controlsRef.current.target.lerp(desiredTarget.current, 0.08);
            controlsRef.current.update();
        }
    });
    return null;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId, burstSeed }: {
    people: OrbitPerson[];
    selectedKey: string | null;
    onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void;
    selectedDeviceId: string | null;
    burstSeed: number;
}) {
    const controlsRef = useRef<any>(null);

    // Distribute people on a tilted ring; radius grows with count
    const positions = useMemo(() => {
        const n = people.length;
        const R = 4 + Math.min(n, 14) * 0.45;
        return people.map((_, i) => {
            const a = (i / Math.max(n, 1)) * Math.PI * 2;
            const y = (i % 3 - 1) * 1.1; // 3-level vertical spread
            return new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
        });
    }, [people]);

    const selectedIdx = people.findIndex(p => p.key === selectedKey);
    const focusTarget = selectedIdx >= 0 ? positions[selectedIdx] : null;

    return (
        <>
            <color attach="background" args={['#070b1a']} />
            <fog attach="fog" args={['#070b1a', 14, 34]} />
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -8, -10]} intensity={0.5} color="#8b5cf6" />
            <Stars radius={60} depth={40} count={1800} factor={4} saturation={0} fade speed={1} />

            <Core active={selectedKey !== null} />

            {people.map((p, i) => (
                <PersonNode
                    key={p.key}
                    person={p}
                    position={positions[i]}
                    isSelected={p.key === selectedKey}
                    anySelected={selectedKey !== null}
                    onSelect={() => onSelectPerson(p.key === selectedKey ? null : p.key)}
                    onSelectDevice={onSelectDevice}
                    selectedDeviceId={selectedDeviceId}
                    burstSeed={burstSeed}
                />
            ))}

            <FocusRig target={focusTarget} controlsRef={controlsRef} />

            <OrbitControls
                ref={controlsRef}
                enablePan={false}
                minDistance={4}
                maxDistance={28}
                autoRotate={selectedKey === null}
                autoRotateSpeed={0.4}
                enableDamping
                dampingFactor={0.08}
            />
        </>
    );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function PeopleOrbit3D({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId }: {
    people: OrbitPerson[];
    selectedKey: string | null;
    onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void;
    selectedDeviceId: string | null;
}) {
    // Bump a seed whenever a device is selected so each burst looks fresh
    const [burstSeed, setBurstSeed] = useState(1);
    const handleSelectDevice = (d: OrbitDevice) => {
        setBurstSeed(s => s + Math.floor(Math.random() * 37) + 1);
        onSelectDevice(d);
    };

    return (
        <Canvas
            camera={{ position: [0, 2, 12], fov: 55 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: false }}
            onPointerMissed={() => onSelectPerson(null)}
        >
            <Scene
                people={people}
                selectedKey={selectedKey}
                onSelectPerson={onSelectPerson}
                onSelectDevice={handleSelectDevice}
                selectedDeviceId={selectedDeviceId}
                burstSeed={burstSeed}
            />
        </Canvas>
    );
}
