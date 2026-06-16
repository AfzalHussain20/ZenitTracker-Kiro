"use client";

/**
 * PeopleOrbit3D — a cinematic 3D "fleet command center".
 *
 * Techniques used for the high-end look:
 *  • Selective Bloom (EffectComposer) so emissive surfaces bleed light
 *  • HDR environment for real metallic reflections
 *  • Custom fresnel/rim shader on person nodes (holographic energy spheres)
 *  • Animated energy-beam tubes (uv-scrolling shader) instead of flat lines
 *  • Motion trails on orbiting device crystals (light streaks)
 *  • Layered reactor core (glass shell + wireframe + energy rings)
 *  • Cinematic camera easing on focus + idle drift
 *
 * Fully self-contained. Safe to remove without touching the rest of Keepr.
 */

import { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Sparkles, Stars, Trail } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
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
    const hue = (hashStr(name) % 360) / 360;
    return new THREE.Color().setHSL(hue, 0.85, 0.6);
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
            const r = Math.sqrt(1 - y * y);
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

// ─── Holographic fresnel material for person nodes ───────────────────────────
const HoloMaterial = ({ color, intensity }: { color: THREE.Color; intensity: number }) => {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({
        uColor: { value: color.clone() },
        uTime: { value: 0 },
        uIntensity: { value: intensity },
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    useFrame((state) => {
        if (matRef.current) {
            matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            matRef.current.uniforms.uColor.value.copy(color);
            matRef.current.uniforms.uIntensity.value = intensity;
        }
    });

    return (
        <shaderMaterial
            ref={matRef}
            transparent
            uniforms={uniforms}
            vertexShader={`
                varying vec3 vNormal;
                varying vec3 vView;
                varying vec3 vPos;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vView = normalize(-mv.xyz);
                    vPos = position;
                    gl_Position = projectionMatrix * mv;
                }
            `}
            fragmentShader={`
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uIntensity;
                varying vec3 vNormal;
                varying vec3 vView;
                varying vec3 vPos;
                void main() {
                    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
                    // energy scanlines sweeping across the sphere
                    float scan = 0.5 + 0.5 * sin(vPos.y * 14.0 - uTime * 3.0);
                    float core = 0.25 + 0.75 * fres;
                    vec3 col = uColor * (core * uIntensity + scan * 0.25 * uIntensity);
                    float alpha = clamp(fres * 1.3 + 0.18, 0.0, 1.0);
                    gl_FragColor = vec4(col, alpha);
                }
            `}
        />
    );
};

// ─── Animated energy beam (curved glowing tube w/ scrolling flow) ────────────
function EnergyBeam({ from, to, color, active }: { from: THREE.Vector3; to: THREE.Vector3; color: THREE.Color; active: boolean }) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const geo = useMemo(() => {
        const mid = from.clone().add(to).multiplyScalar(0.5);
        // bow the curve outward from origin for a graceful arc
        mid.add(mid.clone().normalize().multiplyScalar(0.6));
        const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
        return new THREE.TubeGeometry(curve, 32, active ? 0.035 : 0.018, 8, false);
    }, [from, to, active]);

    const uniforms = useMemo(() => ({
        uColor: { value: color.clone() },
        uTime: { value: 0 },
        uActive: { value: active ? 1 : 0 },
    }), [color, active]);

    useFrame((state) => {
        if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    });

    return (
        <mesh geometry={geo}>
            <shaderMaterial
                ref={matRef}
                transparent
                uniforms={uniforms}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform vec3 uColor;
                    uniform float uTime;
                    uniform float uActive;
                    varying vec2 vUv;
                    void main() {
                        float flow = fract(vUv.x * 3.0 - uTime * (0.6 + uActive));
                        float pulse = smoothstep(0.0, 0.5, flow) * smoothstep(1.0, 0.5, flow);
                        float base = 0.18 + 0.5 * uActive;
                        float a = base + pulse * (0.6 + uActive * 0.4);
                        gl_FragColor = vec4(uColor * (1.0 + pulse * 1.5), a);
                    }
                `}
            />
        </mesh>
    );
}

// ─── Reactor core ─────────────────────────────────────────────────────────────
function Core({ active }: { active: boolean }) {
    const inner = useRef<THREE.Mesh>(null);
    const shell = useRef<THREE.Mesh>(null);
    const ringA = useRef<THREE.Mesh>(null);
    const ringB = useRef<THREE.Mesh>(null);
    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (inner.current) {
            inner.current.rotation.y += dt * 0.5;
            inner.current.rotation.x += dt * 0.2;
            inner.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.07);
        }
        if (shell.current) { shell.current.rotation.y -= dt * 0.25; shell.current.rotation.z += dt * 0.12; }
        if (ringA.current) ringA.current.rotation.z += dt * 0.8;
        if (ringB.current) ringB.current.rotation.x += dt * 0.6;
    });
    return (
        <group>
            <mesh ref={inner}>
                <icosahedronGeometry args={[0.8, 2]} />
                <meshStandardMaterial color="#c7d2fe" emissive="#6366f1" emissiveIntensity={active ? 3.2 : 2.2} roughness={0.15} metalness={0.9} toneMapped={false} />
            </mesh>
            <mesh ref={shell}>
                <icosahedronGeometry args={[1.3, 1]} />
                <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.3} toneMapped={false} />
            </mesh>
            <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.7, 0.025, 8, 96]} />
                <meshBasicMaterial color="#a5b4fc" toneMapped={false} />
            </mesh>
            <mesh ref={ringB} rotation={[0, 0, Math.PI / 3]}>
                <torusGeometry args={[2.0, 0.018, 8, 96]} />
                <meshBasicMaterial color="#c4b5fd" toneMapped={false} />
            </mesh>
            <pointLight color="#818cf8" intensity={3} distance={12} />
            <Sparkles count={40} scale={4} size={3} speed={0.25} color="#a5b4fc" />
        </group>
    );
}

// ─── Device crystal w/ motion trail ──────────────────────────────────────────
function Satellite({ device, position, onClick, isSelected, burstSeed }: {
    device: OrbitDevice; position: THREE.Vector3; onClick: () => void; isSelected: boolean; burstSeed: number;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => deviceTypeColor(device.type), [device.type]);

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.y += dt * 1.4;
            ref.current.rotation.x += dt * 0.6;
            const base = isSelected ? 0.36 : hovered ? 0.3 : 0.24;
            ref.current.scale.setScalar(base + (isSelected ? Math.sin(t * 6) * 0.05 : 0));
        }
        if (ringRef.current) { ringRef.current.rotation.z += dt * 3; ringRef.current.rotation.x = Math.PI / 2; }
    });

    const crystal = (
        <mesh
            ref={ref}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={device.active ? 2.4 : 1.1} roughness={0.1} metalness={0.7} toneMapped={false} />
        </mesh>
    );

    return (
        <group position={position}>
            {device.active
                ? <Trail width={1.2} length={4} color={color} attenuation={(w) => w * w}>{crystal}</Trail>
                : crystal}

            {isSelected && (
                <mesh ref={ringRef}>
                    <torusGeometry args={[0.55, 0.025, 8, 48]} />
                    <meshBasicMaterial color={color} toneMapped={false} />
                </mesh>
            )}
            {isSelected && (
                <Sparkles key={burstSeed} count={24} scale={1.6} size={4} speed={1.4}
                    color={new THREE.Color().setHSL((burstSeed % 100) / 100, 0.85, 0.65)} />
            )}
            {(hovered || isSelected) && (
                <Billboard position={[0, 0.55, 0]}>
                    <Text fontSize={0.22} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.014} outlineColor="#000000">
                        {device.name}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}

// ─── A person's device cluster ───────────────────────────────────────────────
function DeviceCluster({ person, onSelectDevice, selectedDeviceId, burstSeed }: {
    person: OrbitPerson; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null; burstSeed: number;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const seed = useMemo(() => hashStr(person.name), [person.name]);
    const positions = useMemo(() => satellitePositions(person.devices.length, seed), [person.devices.length, seed]);
    useFrame((_, dt) => { if (groupRef.current) groupRef.current.rotation.y += dt * 0.22; });

    return (
        <group ref={groupRef}>
            {person.devices.map((d, i) => (
                <group key={d.id}>
                    <EnergyBeam from={new THREE.Vector3(0, 0, 0)} to={positions[i]} color={deviceTypeColor(d.type)} active={d.active} />
                    <Satellite device={d} position={positions[i]} onClick={() => onSelectDevice(d)} isSelected={selectedDeviceId === d.id} burstSeed={burstSeed} />
                </group>
            ))}
        </group>
    );
}

// ─── Person node ─────────────────────────────────────────────────────────────
function PersonNode({ person, position, isSelected, anySelected, onSelect, onSelectDevice, selectedDeviceId, burstSeed }: {
    person: OrbitPerson; position: THREE.Vector3; isSelected: boolean; anySelected: boolean;
    onSelect: () => void; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null; burstSeed: number;
}) {
    const grpRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    const beamRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const color = useMemo(() => personColor(person.name), [person.name]);
    const baseSize = 0.42 + Math.min(person.currentlyHolding, 6) * 0.06;
    const dim = anySelected && !isSelected;
    const intensity = dim ? 0.5 : isSelected ? 2.2 : 1.2;

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (grpRef.current) {
            const target = isSelected ? 1.3 : hovered ? 1.14 : 1;
            const cur = grpRef.current.scale.x;
            grpRef.current.scale.setScalar(cur + (target - cur) * 0.15);
        }
        if (coreRef.current) coreRef.current.rotation.y += dt * 0.6;
        if (haloRef.current && isSelected) {
            haloRef.current.rotation.z += dt * 0.9;
            haloRef.current.scale.setScalar(2.0 + Math.sin(t * 2) * 0.12);
        }
        if (beamRef.current) {
            const m = beamRef.current.material as THREE.Material & { opacity: number };
            m.opacity = (dim ? 0.05 : 0.18) + (isSelected ? 0.15 : 0) + Math.sin(t * 3) * 0.04;
        }
    });

    return (
        <group position={position}>
            <group ref={grpRef} scale={baseSize}>
                {/* inner emissive heart */}
                <mesh>
                    <sphereGeometry args={[0.55, 24, 24]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.2} metalness={0.6} toneMapped={false} />
                </mesh>
                {/* holographic shell */}
                <mesh ref={coreRef}>
                    <sphereGeometry args={[1, 48, 48]} />
                    <HoloMaterial color={color} intensity={intensity} />
                </mesh>
                {isSelected && (
                    <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[1, 0.035, 8, 64]} />
                        <meshBasicMaterial color={color} toneMapped={false} />
                    </mesh>
                )}
            </group>

            {/* vertical light beam pillar */}
            <mesh ref={beamRef} position={[0, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.12, 16, 12, 1, true]} />
                <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>

            {!isSelected && person.currentlyHolding > 0 && (
                <Sparkles count={person.currentlyHolding * 3} scale={baseSize * 3.5} size={2.5} speed={0.4} color={color} />
            )}

            <Billboard position={[0, baseSize + 0.4, 0]}>
                <Text fontSize={isSelected ? 0.36 : 0.27} color={dim ? '#475569' : '#ffffff'} anchorX="center" anchorY="bottom" outlineWidth={0.016} outlineColor="#000000">
                    {person.name}
                </Text>
                {isSelected && (
                    <Text position={[0, -0.06, 0]} fontSize={0.16} color="#cbd5e1" anchorX="center" anchorY="top">
                        {`${person.currentlyHolding} held · ${person.uniqueDevices} used`}
                    </Text>
                )}
            </Billboard>

            {isSelected && (
                <EnergyBeam from={new THREE.Vector3(0, 0, 0)} to={new THREE.Vector3(-position.x, -position.y, -position.z)} color={color} active />
            )}

            {isSelected && (
                <DeviceCluster person={person} onSelectDevice={onSelectDevice} selectedDeviceId={selectedDeviceId} burstSeed={burstSeed} />
            )}
        </group>
    );
}

// ─── Cinematic camera rig ─────────────────────────────────────────────────────
function FocusRig({ target, controlsRef }: { target: THREE.Vector3 | null; controlsRef: React.MutableRefObject<any> }) {
    const { camera } = useThree();
    const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
    const desiredCam = useRef(new THREE.Vector3(0, 2, 13));
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (target) {
            desiredTarget.current.copy(target);
            const dir = target.clone().normalize();
            desiredCam.current.copy(target).add(dir.multiplyScalar(4.8)).add(new THREE.Vector3(0, 1.6, 0));
        } else {
            desiredTarget.current.set(0, 0, 0);
            // gentle idle drift when nothing selected
            desiredCam.current.set(Math.sin(t * 0.12) * 2, 2.5, 13);
        }
        camera.position.lerp(desiredCam.current, 0.05);
        if (controlsRef.current) {
            controlsRef.current.target.lerp(desiredTarget.current, 0.07);
            controlsRef.current.update();
        }
    });
    return null;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId, burstSeed }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null; burstSeed: number;
}) {
    const controlsRef = useRef<any>(null);
    const positions = useMemo(() => {
        const n = people.length;
        const R = 4.5 + Math.min(n, 14) * 0.45;
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
            <fog attach="fog" args={['#04060f', 16, 40]} />
            <ambientLight intensity={0.3} />
            <pointLight position={[12, 10, 10]} intensity={1.4} />
            <pointLight position={[-12, -8, -10]} intensity={0.7} color="#8b5cf6" />
            <pointLight position={[0, 14, 0]} intensity={0.6} color="#38bdf8" />
            <spotLight position={[0, 0, 18]} angle={0.6} penumbra={1} intensity={0.8} color="#a5b4fc" />
            <Stars radius={70} depth={50} count={2600} factor={4} saturation={0} fade speed={1} />

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

            <OrbitControls ref={controlsRef} enablePan={false} minDistance={4} maxDistance={32}
                autoRotate={selectedKey === null} autoRotateSpeed={0.35} enableDamping dampingFactor={0.07} />

            <EffectComposer>
                <Bloom mipmapBlur intensity={1.5} luminanceThreshold={0.25} luminanceSmoothing={0.9} radius={0.8} />
                <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0006, 0.0006]} radialModulation={false} modulationOffset={0} />
                <Vignette eskil={false} offset={0.25} darkness={0.85} />
            </EffectComposer>
        </>
    );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function PeopleOrbit3D({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    const [burstSeed, setBurstSeed] = useState(1);
    const handleSelectDevice = (d: OrbitDevice) => {
        setBurstSeed(s => s + Math.floor(Math.random() * 37) + 1);
        onSelectDevice(d);
    };
    return (
        <Canvas
            camera={{ position: [0, 2.5, 13], fov: 55 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
            onPointerMissed={() => onSelectPerson(null)}
        >
            <Suspense fallback={null}>
                <Scene
                    people={people}
                    selectedKey={selectedKey}
                    onSelectPerson={onSelectPerson}
                    onSelectDevice={handleSelectDevice}
                    selectedDeviceId={selectedDeviceId}
                    burstSeed={burstSeed}
                />
            </Suspense>
        </Canvas>
    );
}
