"use client";

/**
 * PeopleOrbit3D — a smooth, cinematic 3D "fleet command center".
 *
 * Reliability-first design (no EffectComposer / no raw GLSL — both caused the
 * blank screen + flash on recent three versions):
 *  • Glow is faked with additive radial-gradient sprites stacked behind every
 *    emissive object — bulletproof "bloom" that renders on every GPU.
 *  • Connections use drei <Line> (already proven elsewhere in this app).
 *  • The camera only EASES THE ORBIT TARGET for ~1s after a selection, then
 *    hands full control back to OrbitControls — so drag/rotate always works.
 *
 * Fully self-contained. Safe to remove without touching the rest of Keepr.
 */

import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Stars, Trail, Line } from '@react-three/drei';
import * as THREE from 'three';

// ─── Public data shapes ─────────────────────────────────────────────────────
export interface OrbitDevice {
    id: string;
    name: string;
    type: string;
    active: boolean;
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

// ─── helpers ──────────────────────────────────────────────────────────────────
function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h;
}
function personColor(name: string): THREE.Color {
    return new THREE.Color().setHSL((hashStr(name) % 360) / 360, 0.85, 0.62);
}
function deviceTypeColor(type: string): THREE.Color {
    switch (type) {
        case 'phone':   return new THREE.Color('#38bdf8');
        case 'tablet':  return new THREE.Color('#a78bfa');
        case 'laptop':  return new THREE.Color('#94a3b8');
        case 'tv':      return new THREE.Color('#fb7185');
        case 'monitor': return new THREE.Color('#2dd4bf');
        default:        return new THREE.Color('#fbbf24');
    }
}
function satellitePositions(count: number, seed: number): THREE.Vector3[] {
    const pattern = seed % 4;
    const out: THREE.Vector3[] = [];
    const R = 1.7 + Math.min(count, 8) * 0.13;
    for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / count : 0;
        let v: THREE.Vector3;
        if (pattern === 0) {
            const a = t * Math.PI * 2;
            v = new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 2) * 0.5, Math.sin(a) * R);
        } else if (pattern === 1) {
            const a = t * Math.PI * 4;
            v = new THREE.Vector3(Math.cos(a) * R, (t - 0.5) * R * 1.7, Math.sin(a) * R);
        } else if (pattern === 2) {
            const y = 1 - (i / Math.max(count - 1, 1)) * 2;
            const r = Math.sqrt(Math.max(1 - y * y, 0));
            const phi = i * 2.399963229728653;
            v = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(R);
        } else {
            const a = t * Math.PI * 2;
            const tilt = i % 2 === 0 ? 0.6 : -0.6;
            v = new THREE.Vector3(Math.cos(a) * R, tilt + Math.sin(a) * 0.35, Math.sin(a) * R);
        }
        out.push(v);
    }
    return out;
}

// ─── Soft glow sprite texture (built once) ───────────────────────────────────
let _glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
    if (_glowTex) return _glowTex;
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    _glowTex = new THREE.CanvasTexture(c);
    return _glowTex;
}

// Stacked additive glow sprites behind an object — the "bloom" bleed
function Glow({ color, scale, opacity = 1 }: { color: THREE.Color; scale: number; opacity?: number }) {
    const tex = useMemo(() => glowTexture(), []);
    return (
        <>
            <sprite scale={[scale, scale, scale]}>
                <spriteMaterial map={tex} color={color} blending={THREE.AdditiveBlending} transparent opacity={0.55 * opacity} depthWrite={false} />
            </sprite>
            <sprite scale={[scale * 1.9, scale * 1.9, scale * 1.9]}>
                <spriteMaterial map={tex} color={color} blending={THREE.AdditiveBlending} transparent opacity={0.22 * opacity} depthWrite={false} />
            </sprite>
        </>
    );
}

// ─── Reactor core ─────────────────────────────────────────────────────────────
function Core() {
    const inner = useRef<THREE.Mesh>(null);
    const shell = useRef<THREE.Mesh>(null);
    const ringA = useRef<THREE.Mesh>(null);
    const ringB = useRef<THREE.Mesh>(null);
    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (inner.current) {
            inner.current.rotation.y += dt * 0.5;
            inner.current.rotation.x += dt * 0.2;
            inner.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
        }
        if (shell.current) { shell.current.rotation.y -= dt * 0.25; shell.current.rotation.z += dt * 0.12; }
        if (ringA.current) ringA.current.rotation.z += dt * 0.7;
        if (ringB.current) ringB.current.rotation.x += dt * 0.55;
    });
    return (
        <group>
            <Glow color={new THREE.Color('#818cf8')} scale={6} />
            <mesh ref={inner}>
                <icosahedronGeometry args={[0.8, 2]} />
                <meshStandardMaterial color="#c7d2fe" emissive="#6366f1" emissiveIntensity={2.4} roughness={0.2} metalness={0.7} />
            </mesh>
            <mesh ref={shell}>
                <icosahedronGeometry args={[1.3, 1]} />
                <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.35} />
            </mesh>
            <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.7, 0.02, 8, 96]} />
                <meshBasicMaterial color="#a5b4fc" />
            </mesh>
            <mesh ref={ringB} rotation={[0, 0, Math.PI / 3]}>
                <torusGeometry args={[2.0, 0.015, 8, 96]} />
                <meshBasicMaterial color="#c4b5fd" />
            </mesh>
            <pointLight color="#818cf8" intensity={2.5} distance={14} />
        </group>
    );
}

// ─── Device crystal w/ motion trail ──────────────────────────────────────────
function Satellite({ device, position, onClick, isSelected }: {
    device: OrbitDevice; position: THREE.Vector3; onClick: () => void; isSelected: boolean;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const ring = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => deviceTypeColor(device.type), [device.type]);

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.y += dt * 1.2;
            ref.current.rotation.x += dt * 0.5;
            const target = (isSelected ? 1.5 : hovered ? 1.25 : 1) * 0.24;
            const cur = ref.current.scale.x;
            const next = cur + (target - cur) * 0.2 + (isSelected ? Math.sin(t * 6) * 0.01 : 0);
            ref.current.scale.setScalar(next);
        }
        if (ring.current) { ring.current.rotation.z += dt * 3; ring.current.rotation.x = Math.PI / 2; }
    });

    const crystal = (
        <mesh
            ref={ref}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={device.active ? 1.8 : 0.9} roughness={0.15} metalness={0.6} />
        </mesh>
    );

    return (
        <group position={position}>
            <Glow color={color} scale={device.active ? 1.5 : 1.1} opacity={device.active ? 1 : 0.7} />
            {device.active
                ? <Trail width={1.1} length={4} color={color} attenuation={(w) => w * w}>{crystal}</Trail>
                : crystal}
            {isSelected && (
                <mesh ref={ring}>
                    <torusGeometry args={[0.55, 0.022, 8, 48]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            )}
            {(hovered || isSelected) && (
                <Billboard position={[0, 0.55, 0]}>
                    <Text fontSize={0.2} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.014} outlineColor="#000000">
                        {device.name}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}

// ─── A person's device cluster ───────────────────────────────────────────────
function DeviceCluster({ person, onSelectDevice, selectedDeviceId }: {
    person: OrbitPerson; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const seed = useMemo(() => hashStr(person.name), [person.name]);
    const positions = useMemo(() => satellitePositions(person.devices.length, seed), [person.devices.length, seed]);
    useFrame((_, dt) => { if (groupRef.current) groupRef.current.rotation.y += dt * 0.2; });

    return (
        <group ref={groupRef}>
            {person.devices.map((d, i) => (
                <group key={d.id}>
                    <Line
                        points={[[0, 0, 0], [positions[i].x, positions[i].y, positions[i].z]]}
                        color={d.active ? '#e0f2fe' : '#475569'}
                        lineWidth={d.active ? 1.6 : 0.9}
                        transparent
                        opacity={d.active ? 0.7 : 0.3}
                    />
                    <Satellite device={d} position={positions[i]} onClick={() => onSelectDevice(d)} isSelected={selectedDeviceId === d.id} />
                </group>
            ))}
        </group>
    );
}

// ─── Person node ─────────────────────────────────────────────────────────────
function PersonNode({ person, position, isSelected, anySelected, onSelect, onSelectDevice, selectedDeviceId }: {
    person: OrbitPerson; position: THREE.Vector3; isSelected: boolean; anySelected: boolean;
    onSelect: () => void; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    const grpRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const halo = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => personColor(person.name), [person.name]);
    const baseSize = 0.45 + Math.min(person.currentlyHolding, 6) * 0.06;
    const dim = anySelected && !isSelected;

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (grpRef.current) {
            const target = (isSelected ? 1.3 : hovered ? 1.12 : 1) * baseSize;
            const cur = grpRef.current.scale.x;
            grpRef.current.scale.setScalar(cur + (target - cur) * 0.12);
        }
        if (coreRef.current) coreRef.current.rotation.y += dt * 0.5;
        if (halo.current && isSelected) {
            halo.current.rotation.z += dt * 0.9;
            halo.current.scale.setScalar(2.0 + Math.sin(t * 2) * 0.1);
        }
    });

    return (
        <group position={position}>
            {/* glow halo (dimmed when another is selected) */}
            <Glow color={color} scale={baseSize * 3} opacity={dim ? 0.3 : isSelected ? 1.3 : 0.9} />

            <group ref={grpRef}>
                {/* emissive heart */}
                <mesh ref={coreRef}
                    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(); }}
                    onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                    onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
                >
                    <icosahedronGeometry args={[0.6, 3]} />
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={dim ? 0.5 : isSelected ? 2.2 : 1.3}
                        roughness={0.2}
                        metalness={0.5}
                        transparent
                        opacity={dim ? 0.5 : 1}
                    />
                </mesh>
                {/* wireframe energy shell */}
                <mesh scale={1.25}>
                    <icosahedronGeometry args={[0.6, 1]} />
                    <meshBasicMaterial color={color} wireframe transparent opacity={dim ? 0.08 : 0.25} />
                </mesh>
                {isSelected && (
                    <mesh ref={halo} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.55, 0.025, 8, 64]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                )}
            </group>

            {/* name label */}
            <Billboard position={[0, baseSize + 0.45, 0]}>
                <Text fontSize={isSelected ? 0.34 : 0.26} color={dim ? '#475569' : '#ffffff'} anchorX="center" anchorY="bottom" outlineWidth={0.016} outlineColor="#000000">
                    {person.name}
                </Text>
                {isSelected && (
                    <Text position={[0, -0.06, 0]} fontSize={0.15} color="#cbd5e1" anchorX="center" anchorY="top">
                        {`${person.currentlyHolding} held · ${person.uniqueDevices} used`}
                    </Text>
                )}
            </Billboard>

            {/* connection to core + device cluster when selected */}
            {isSelected && (
                <>
                    <Line
                        points={[[0, 0, 0], [-position.x, -position.y, -position.z]]}
                        color={color.getStyle()}
                        lineWidth={1.3}
                        transparent
                        opacity={0.4}
                        dashed
                        dashScale={4}
                        dashSize={0.3}
                        gapSize={0.15}
                    />
                    <DeviceCluster person={person} onSelectDevice={onSelectDevice} selectedDeviceId={selectedDeviceId} />
                </>
            )}
        </group>
    );
}

// ─── Camera focus — eases ORBIT TARGET only, briefly, never fights the user ──
function FocusController({ targetPos, controlsRef, selectionToken }: {
    targetPos: THREE.Vector3 | null; controlsRef: React.MutableRefObject<any>; selectionToken: string;
}) {
    const animating = useRef(false);
    const dest = useRef(new THREE.Vector3(0, 0, 0));

    useEffect(() => {
        dest.current.copy(targetPos ?? new THREE.Vector3(0, 0, 0));
        animating.current = true;
        const id = setTimeout(() => { animating.current = false; }, 1000);
        return () => clearTimeout(id);
    }, [selectionToken]); // eslint-disable-line react-hooks/exhaustive-deps

    useFrame(() => {
        if (animating.current && controlsRef.current) {
            controlsRef.current.target.lerp(dest.current, 0.09);
        }
    });
    return null;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    const controlsRef = useRef<any>(null);
    const positions = useMemo(() => {
        const n = people.length;
        const R = 4.5 + Math.min(n, 14) * 0.42;
        return people.map((_, i) => {
            const a = (i / Math.max(n, 1)) * Math.PI * 2;
            const y = (i % 3 - 1) * 1.2;
            return new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
        });
    }, [people]);

    const selectedIdx = people.findIndex(p => p.key === selectedKey);
    const focusTarget = selectedIdx >= 0 ? positions[selectedIdx] : null;

    return (
        <>
            <color attach="background" args={['#04060f']} />
            <fog attach="fog" args={['#04060f', 18, 48]} />
            <ambientLight intensity={0.35} />
            <pointLight position={[12, 10, 10]} intensity={1.3} />
            <pointLight position={[-12, -8, -10]} intensity={0.7} color="#8b5cf6" />
            <pointLight position={[0, 14, 0]} intensity={0.6} color="#38bdf8" />
            <Stars radius={70} depth={50} count={2200} factor={4} saturation={0} fade speed={1} />

            <Core />

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
                />
            ))}

            <FocusController targetPos={focusTarget} controlsRef={controlsRef} selectionToken={selectedKey ?? '__none__'} />

            <OrbitControls
                ref={controlsRef}
                makeDefault
                enablePan={false}
                minDistance={5}
                maxDistance={34}
                autoRotate={selectedKey === null}
                autoRotateSpeed={0.45}
                enableDamping
                dampingFactor={0.08}
                rotateSpeed={0.8}
                zoomSpeed={0.8}
            />
        </>
    );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function PeopleOrbit3D({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    return (
        <Canvas
            camera={{ position: [0, 3, 15], fov: 55 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
            onPointerMissed={() => onSelectPerson(null)}
        >
            <Suspense fallback={null}>
                <Scene
                    people={people}
                    selectedKey={selectedKey}
                    onSelectPerson={onSelectPerson}
                    onSelectDevice={onSelectDevice}
                    selectedDeviceId={selectedDeviceId}
                />
            </Suspense>
        </Canvas>
    );
}
