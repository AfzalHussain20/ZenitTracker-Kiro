"use client";

/**
 * PeopleOrbit3D — an interactive 3D "fleet map" of people and the devices they hold.
 *
 * It reads as PEOPLE + DEVICES (not abstract planets):
 *  • Each person is an avatar token (initials in their colour).
 *  • Each device is a tile with its real device-type icon, name and status.
 *
 * Precision-first picking:
 *  • Only avatar tokens + device tiles are raycastable. Every decorative thing
 *    (glow, rings, beams, labels, stars, core) has raycast disabled — so clicks
 *    land on exactly what you see, on mouse AND touch.
 *  • A drag-guard means rotating the view never accidentally deselects.
 *  • Camera only eases the orbit target briefly on selection; you always keep
 *    full drag/rotate/zoom control.
 *
 * Self-contained. No EffectComposer / no raw GLSL (both caused earlier blanks).
 */

import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Stars, Line, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';

const NO_RAYCAST = () => null; // disables picking on decorative meshes

// ─── Public data shapes ─────────────────────────────────────────────────────
export interface OrbitDevice { id: string; name: string; type: string; active: boolean; }
export interface OrbitPerson {
    key: string; name: string; team: string;
    currentlyHolding: number; sessions: number; uniqueDevices: number;
    devices: OrbitDevice[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h;
}
function personHex(name: string): string {
    return '#' + new THREE.Color().setHSL((hashStr(name) % 360) / 360, 0.7, 0.58).getHexString();
}
function deviceHex(type: string): string {
    switch (type) {
        case 'phone':   return '#38bdf8';
        case 'tablet':  return '#a78bfa';
        case 'laptop':  return '#cbd5e1';
        case 'tv':      return '#fb7185';
        case 'monitor': return '#2dd4bf';
        default:        return '#fbbf24';
    }
}
function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}
function lightenHex(hex: string, amt = 0.18): string {
    const c = new THREE.Color(hex); const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + amt)); return '#' + c.getHexString();
}
function satellitePositions(count: number, seed: number): THREE.Vector3[] {
    const pattern = seed % 4;
    const out: THREE.Vector3[] = [];
    const R = 1.8 + Math.min(count, 8) * 0.14;
    for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / count : 0;
        let v: THREE.Vector3;
        if (pattern === 0) {
            const a = t * Math.PI * 2;
            v = new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 2) * 0.5, Math.sin(a) * R);
        } else if (pattern === 1) {
            const a = t * Math.PI * 4;
            v = new THREE.Vector3(Math.cos(a) * R, (t - 0.5) * R * 1.6, Math.sin(a) * R);
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

// ─── Canvas-texture builders (cached) ────────────────────────────────────────
const _texCache = new Map<string, THREE.Texture>();
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function personAvatarTexture(name: string): THREE.Texture {
    const hex = personHex(name);
    const key = `p:${name}`;
    const hit = _texCache.get(key); if (hit) return hit;
    const s = 256;
    const c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const cx = s / 2, cy = s / 2, r = 92;
    // soft outer glow ring
    ctx.beginPath(); ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
    ctx.strokeStyle = hex; ctx.globalAlpha = 0.55; ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = 1;
    // disc
    const g = ctx.createRadialGradient(cx, cy - 26, 8, cx, cy, r);
    g.addColorStop(0, lightenHex(hex, 0.22)); g.addColorStop(1, hex);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    // rim highlight
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.stroke();
    // initials
    ctx.fillStyle = '#ffffff'; ctx.font = '700 88px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), cx, cy + 4);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.needsUpdate = true;
    _texCache.set(key, t); return t;
}

function drawDeviceGlyph(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, hex: string) {
    ctx.save();
    ctx.strokeStyle = hex; ctx.fillStyle = hex; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const stroke = (fn: () => void) => { fn(); ctx.stroke(); };
    if (type === 'phone') {
        rrect(ctx, cx - 22, cy - 36, 44, 72, 9); ctx.stroke();
        rrect(ctx, cx - 15, cy - 28, 30, 50, 3); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
    } else if (type === 'tablet') {
        rrect(ctx, cx - 32, cy - 40, 64, 80, 9); ctx.stroke();
        rrect(ctx, cx - 24, cy - 30, 48, 60, 3); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
    } else if (type === 'laptop') {
        rrect(ctx, cx - 36, cy - 30, 72, 46, 5); ctx.stroke();
        rrect(ctx, cx - 28, cy - 23, 56, 32, 3); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx - 48, cy + 26); ctx.lineTo(cx + 48, cy + 26); });
    } else if (type === 'tv') {
        rrect(ctx, cx - 42, cy - 34, 84, 52, 6); ctx.stroke();
        rrect(ctx, cx - 34, cy - 27, 68, 38, 3); ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx, cy + 18); ctx.lineTo(cx, cy + 30); });
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx - 16, cy + 32); ctx.lineTo(cx + 16, cy + 32); });
    } else if (type === 'monitor') {
        rrect(ctx, cx - 40, cy - 34, 80, 50, 6); ctx.stroke();
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy + 30); });
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx - 18, cy + 32); ctx.lineTo(cx + 18, cy + 32); });
    } else { // accessory / cable
        stroke(() => { ctx.beginPath(); ctx.arc(cx - 16, cy - 12, 12, 0, Math.PI * 2); });
        stroke(() => { ctx.beginPath(); ctx.moveTo(cx - 8, cy - 2); ctx.quadraticCurveTo(cx + 6, cy + 18, cx + 18, cy + 6); });
        rrect(ctx, cx + 12, cy - 4, 18, 22, 4); ctx.stroke();
    }
    ctx.restore();
}

function deviceTileTexture(device: OrbitDevice): THREE.Texture {
    const hex = deviceHex(device.type);
    const key = `d:${device.type}:${device.name}:${device.active ? 1 : 0}`;
    const hit = _texCache.get(key); if (hit) return hit;
    const W = 256, H = 256;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    // panel
    rrect(ctx, 22, 22, 212, 212, 26);
    ctx.fillStyle = 'rgba(10,15,28,0.92)'; ctx.fill();
    ctx.strokeStyle = hex; ctx.globalAlpha = device.active ? 0.95 : 0.55; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1;
    // glyph (upper area)
    drawDeviceGlyph(ctx, device.type, 128, 90, hex);
    // name — strip any "(owner)" suffix, wrap to max 2 lines
    const clean = device.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || device.name;
    ctx.fillStyle = '#ffffff'; ctx.font = '600 23px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = clean.split(' '); const lines: string[] = []; let cur = '';
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > 184 && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 2);
    if (lines.length > 2) shown[1] = shown[1].slice(0, 11) + '…';
    // keep names clear of the pill row
    const nameY = shown.length === 1 ? 156 : 148;
    shown.forEach((ln, i) => ctx.fillText(ln, 128, nameY + i * 26));
    // status pill pinned to the bottom
    if (device.active) {
        rrect(ctx, 90, 200, 76, 24, 12); ctx.fillStyle = 'rgba(56,189,248,0.30)'; ctx.fill();
        ctx.fillStyle = '#7dd3fc'; ctx.font = '700 13px Inter, system-ui, sans-serif';
        ctx.fillText('IN USE', 128, 213);
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.needsUpdate = true;
    _texCache.set(key, t); return t;
}

// crisp, readable name plate (dark rounded panel + name + meta)
function nameplateTexture(name: string, meta: string): THREE.Texture {
    const key = `n:${name}|${meta}`;
    const hit = _texCache.get(key); if (hit) return hit;
    const W = 360, H = 120;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    rrect(ctx, 6, 10, W - 12, H - 22, 22);
    ctx.fillStyle = 'rgba(8,12,24,0.82)'; ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.28)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = '700 34px Inter, system-ui, sans-serif';
    let nm = name;
    while (ctx.measureText(nm).width > W - 44 && nm.length > 3) nm = nm.slice(0, -2);
    if (nm !== name) nm += '…';
    ctx.fillText(nm, W / 2, 46);
    ctx.fillStyle = '#94a3b8'; ctx.font = '500 22px Inter, system-ui, sans-serif';
    ctx.fillText(meta, W / 2, 86);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.needsUpdate = true;
    _texCache.set(key, t); return t;
}

// soft round glow sprite (decoration only — never raycast)
let _glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
    if (_glowTex) return _glowTex;
    const s = 128; const c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _glowTex = new THREE.CanvasTexture(c); return _glowTex;
}
function Glow({ color, scale, opacity = 1 }: { color: string; scale: number; opacity?: number }) {
    const tex = useMemo(() => glowTexture(), []);
    return (
        <sprite scale={[scale, scale, scale]} raycast={NO_RAYCAST}>
            <spriteMaterial map={tex} color={color} blending={THREE.AdditiveBlending} transparent opacity={opacity} depthWrite={false} />
        </sprite>
    );
}

// ─── Flowing energy line (decoration — raycast off) ──────────────────────────
function EnergyLine({ from, to, color, active, speed = 1 }: {
    from: [number, number, number]; to: [number, number, number]; color: string; active: boolean; speed?: number;
}) {
    const ref = useRef<any>(null);
    useEffect(() => { if (ref.current) ref.current.raycast = NO_RAYCAST; });
    useFrame((_, dt) => {
        const mat = ref.current?.material;
        if (mat && 'dashOffset' in mat) mat.dashOffset -= dt * (active ? 1.6 : 0.7) * speed;
    });
    return (
        <Line ref={ref} points={[from, to]} color={color} lineWidth={active ? 2 : 1.1}
            transparent opacity={active ? 0.9 : 0.4} dashed dashSize={0.28} gapSize={0.14} />
    );
}

// ─── Selection pulse ring ────────────────────────────────────────────────────
function PulseRing({ color, token }: { color: string; token: string }) {
    const ref = useRef<THREE.Mesh>(null);
    const startT = useRef(-1);
    const seen = useRef('');
    useFrame((state) => {
        if (token !== seen.current) { seen.current = token; startT.current = state.clock.elapsedTime; }
        if (!ref.current || startT.current < 0) return;
        const p = Math.min((state.clock.elapsedTime - startT.current) / 0.8, 1);
        const s = 0.6 + p * 3.0;
        ref.current.scale.setScalar(s);
        (ref.current.material as THREE.Material & { opacity: number }).opacity = (1 - p) * 0.7;
        ref.current.visible = p < 1;
    });
    return (
        <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
            <torusGeometry args={[1, 0.05, 8, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
    );
}

// ─── Reactor core (decoration) ───────────────────────────────────────────────
function Core({ label, sub }: { label: string; sub: string }) {
    const inner = useRef<THREE.Mesh>(null);
    const shell = useRef<THREE.Mesh>(null);
    const ringA = useRef<THREE.Mesh>(null);
    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (inner.current) { inner.current.rotation.y += dt * 0.5; inner.current.rotation.x += dt * 0.2; inner.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06); }
        if (shell.current) { shell.current.rotation.y -= dt * 0.25; shell.current.rotation.z += dt * 0.12; }
        if (ringA.current) ringA.current.rotation.z += dt * 0.7;
    });
    return (
        <group>
            <Glow color="#818cf8" scale={5.5} opacity={0.5} />
            <mesh ref={inner} raycast={NO_RAYCAST}>
                <icosahedronGeometry args={[0.7, 2]} />
                <meshStandardMaterial color="#c7d2fe" emissive="#6366f1" emissiveIntensity={2.2} roughness={0.2} metalness={0.7} />
            </mesh>
            <mesh ref={shell} raycast={NO_RAYCAST}>
                <icosahedronGeometry args={[1.15, 1]} />
                <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.3} />
            </mesh>
            <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
                <torusGeometry args={[1.6, 0.018, 8, 96]} />
                <meshBasicMaterial color="#a5b4fc" />
            </mesh>
            <pointLight color="#818cf8" intensity={2.2} distance={14} />
            <Billboard position={[0, 2.15, 0]}>
                <Text fontSize={0.3} color="#e0e7ff" anchorX="center" anchorY="middle" outlineWidth={0.014} outlineColor="#000000" raycast={NO_RAYCAST}>
                    {label}
                </Text>
                <Text position={[0, -0.32, 0]} fontSize={0.16} color="#94a3b8" anchorX="center" anchorY="middle" raycast={NO_RAYCAST}>
                    {sub}
                </Text>
            </Billboard>
        </group>
    );
}

// ─── All-flows overlay — beams from the hub to everyone holding devices ───────
function AllFlows({ people, positions }: { people: OrbitPerson[]; positions: THREE.Vector3[] }) {
    return (
        <group>
            {people.map((p, i) => p.currentlyHolding > 0 && (
                <EnergyLine
                    key={p.key}
                    from={[0, 0, 0]}
                    to={[positions[i].x, positions[i].y, positions[i].z]}
                    color={personHex(p.name)}
                    active
                    speed={0.7}
                />
            ))}
        </group>
    );
}

// ─── Device tile token ───────────────────────────────────────────────────────
function DeviceTile({ device, position, onClick, isSelected }: {
    device: OrbitDevice; position: THREE.Vector3; onClick: () => void; isSelected: boolean;
}) {
    const grp = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const tex = useMemo(() => deviceTileTexture(device), [device]);
    const hex = deviceHex(device.type);

    useFrame((_, dt) => {
        if (grp.current) {
            const target = isSelected ? 1.35 : hovered ? 1.16 : 1;
            const cur = grp.current.scale.x;
            grp.current.scale.setScalar(cur + (target - cur) * 0.18);
        }
    });

    return (
        <group position={position}>
            <Glow color={hex} scale={device.active ? 1.9 : 1.4} opacity={device.active ? 0.6 : 0.32} />
            <Billboard>
                <group ref={grp}>
                    {/* clickable tile */}
                    <mesh
                        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
                        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
                    >
                        <planeGeometry args={[0.95, 0.95]} />
                        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
                    </mesh>
                </group>
            </Billboard>
        </group>
    );
}

// ─── Device cluster (animated entrance) ──────────────────────────────────────
function DeviceCluster({ person, onSelectDevice, selectedDeviceId }: {
    person: OrbitPerson; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const grow = useRef(0);
    const seed = useMemo(() => hashStr(person.name), [person.name]);
    const positions = useMemo(() => satellitePositions(person.devices.length, seed), [person.devices.length, seed]);
    useFrame((_, dt) => {
        grow.current = Math.min(grow.current + dt * 2.4, 1);
        if (groupRef.current) {
            groupRef.current.rotation.y += dt * 0.18;
            groupRef.current.scale.setScalar(easeOutCubic(grow.current));
        }
    });
    return (
        <group ref={groupRef} scale={0.001}>
            {person.devices.map((d, i) => (
                <group key={d.id}>
                    <EnergyLine from={[0, 0, 0]} to={[positions[i].x, positions[i].y, positions[i].z]} color={d.active ? '#e0f2fe' : '#64748b'} active={d.active} />
                    <DeviceTile device={d} position={positions[i]} onClick={() => onSelectDevice(d)} isSelected={selectedDeviceId === d.id} />
                </group>
            ))}
        </group>
    );
}

// ─── Person avatar token ─────────────────────────────────────────────────────
function PersonNode({ person, position, isSelected, anySelected, onSelect, onSelectDevice, selectedDeviceId, selToken, onHover }: {
    person: OrbitPerson; position: THREE.Vector3; isSelected: boolean; anySelected: boolean;
    onSelect: () => void; onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null; selToken: string;
    onHover: (key: string | null, x: number, y: number) => void;
}) {
    const grp = useRef<THREE.Group>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const hex = useMemo(() => personHex(person.name), [person.name]);
    const tex = useMemo(() => personAvatarTexture(person.name), [person.name]);
    const plate = useMemo(
        () => nameplateTexture(person.name, `${person.currentlyHolding} held · ${person.uniqueDevices} used`),
        [person.name, person.currentlyHolding, person.uniqueDevices]
    );
    const baseSize = 1.05 + Math.min(person.currentlyHolding, 6) * 0.06;
    const dim = anySelected && !isSelected;

    useFrame((state, dt) => {
        const t = state.clock.elapsedTime;
        if (grp.current) {
            const target = (isSelected ? 1.3 : hovered ? 1.12 : 1) * baseSize;
            const cur = grp.current.scale.x;
            grp.current.scale.setScalar(cur + (target - cur) * 0.14);
        }
        if (ringRef.current) {
            ringRef.current.rotation.z += dt * (isSelected ? 1.2 : 0.4);
            const pulse = isSelected ? 1 + Math.sin(t * 3) * 0.04 : 1;
            ringRef.current.scale.setScalar(pulse);
        }
    });

    return (
        <group position={position}>
            <Glow color={hex} scale={baseSize * 2.4} opacity={dim ? 0.18 : isSelected ? 0.9 : 0.5} />
            {isSelected && <PulseRing color={hex} token={selToken} />}

            <Billboard>
                <group ref={grp}>
                    {/* spinning accent ring (decoration) */}
                    <mesh ref={ringRef} raycast={NO_RAYCAST} position={[0, 0, -0.02]}>
                        <ringGeometry args={[0.62, 0.7, 48]} />
                        <meshBasicMaterial color={hex} transparent opacity={dim ? 0.15 : 0.8} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                    {/* clickable avatar */}
                    <mesh
                        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(); }}
                        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; onHover(person.key, e.nativeEvent.clientX, e.nativeEvent.clientY); }}
                        onPointerMove={(e) => { if (hovered) onHover(person.key, e.nativeEvent.clientX, e.nativeEvent.clientY); }}
                        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; onHover(null, 0, 0); }}
                    >
                        <circleGeometry args={[0.6, 48]} />
                        <meshBasicMaterial map={tex} transparent opacity={dim ? 0.45 : 1} depthWrite={false} toneMapped={false} />
                    </mesh>
                </group>
            </Billboard>

            {/* name + meta plate — hidden when selected (panel names them) or while another person is focused */}
            {!isSelected && (!anySelected || hovered) && (
                <Billboard position={[0, baseSize * 0.72 + 0.4, 0]}>
                    <mesh raycast={NO_RAYCAST} scale={[1.6, 0.53, 1]} renderOrder={3}>
                        <planeGeometry args={[1, 1]} />
                        <meshBasicMaterial map={plate} transparent depthWrite={false} depthTest={false} toneMapped={false} opacity={dim ? 0.5 : 1} />
                    </mesh>
                </Billboard>
            )}

            {isSelected && (
                <>
                    <EnergyLine from={[0, 0, 0]} to={[-position.x, -position.y, -position.z]} color={hex} active speed={0.8} />
                    <DeviceCluster person={person} onSelectDevice={onSelectDevice} selectedDeviceId={selectedDeviceId} />
                </>
            )}
        </group>
    );
}

// ─── Faint orbital track + containment field (decoration) ────────────────────
function OrbitTracks({ radius }: { radius: number }) {
    return (
        <group>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
                <torusGeometry args={[radius, 0.01, 8, 180]} />
                <meshBasicMaterial color="#334155" transparent opacity={0.5} />
            </mesh>
            <mesh raycast={NO_RAYCAST}>
                <sphereGeometry args={[radius * 1.7, 24, 24]} />
                <meshBasicMaterial color="#1e293b" wireframe transparent opacity={0.05} />
            </mesh>
        </group>
    );
}

// ─── Camera focus — real zoom dolly toward selection, then hands back control ─
function FocusController({ targetPos, controlsRef, selectionToken, sceneRadius, arrivedRef }: {
    targetPos: THREE.Vector3 | null; controlsRef: React.MutableRefObject<any>; selectionToken: string; sceneRadius: number;
    arrivedRef: React.MutableRefObject<boolean>;
}) {
    const { camera } = useThree();
    const animating = useRef(false);
    const startT = useRef(0);
    const fromTarget = useRef(new THREE.Vector3());
    const toTarget = useRef(new THREE.Vector3());
    const fromCam = useRef(new THREE.Vector3());
    const toCam = useRef(new THREE.Vector3());
    const DURATION = 0.9;

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls || !arrivedRef.current) return; // wait until the arrival fly-in finishes
        fromTarget.current.copy(controls.target);
        fromCam.current.copy(camera.position);

        // keep the user's current viewing direction, just change distance
        const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
        if (dir.lengthSq() < 0.0001) dir.set(0, 0.4, 1);
        dir.normalize();

        if (targetPos) {
            toTarget.current.copy(targetPos);
            const focusDist = 7; // close enough to read the device tiles
            toCam.current.copy(targetPos).add(dir.clone().multiplyScalar(focusDist));
        } else {
            toTarget.current.set(0, 0, 0);
            // pull back to frame the whole constellation
            toCam.current.copy(dir.multiplyScalar(sceneRadius * 2.4 + 6));
        }

        animating.current = true;
        startT.current = performance.now() / 1000;
    }, [selectionToken]); // eslint-disable-line react-hooks/exhaustive-deps

    useFrame(() => {
        if (!animating.current || !controlsRef.current) return;
        let p = (performance.now() / 1000 - startT.current) / DURATION;
        if (p >= 1) { p = 1; animating.current = false; }
        const e = easeInOutCubic(p);
        controlsRef.current.target.lerpVectors(fromTarget.current, toTarget.current, e);
        camera.position.lerpVectors(fromCam.current, toCam.current, e);
        controlsRef.current.update();
    });
    return null;
}

// ─── Arrival fly-in — holds far until armed, then warps in and settles ───────
function ArrivalController({ armed, controlsRef, sceneRadius, arrivedRef, onArrived }: {
    armed: boolean; controlsRef: React.MutableRefObject<any>; sceneRadius: number;
    arrivedRef: React.MutableRefObject<boolean>; onArrived: () => void;
}) {
    const { camera } = useThree();
    const tRef = useRef(0);
    const started = useRef(false);
    const DUR = 1.7;
    useFrame((_, dt) => {
        if (arrivedRef.current) return;
        const far = sceneRadius * 2.4 + 6;
        if (!armed) {
            // hold the camera way out, looking at the hub, perfectly still
            camera.position.set(0, far * 0.22, far * 3);
            if (controlsRef.current) { controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); }
            return;
        }
        if (!started.current) { started.current = true; tRef.current = 0; }
        tRef.current += dt;
        const p = Math.min(tRef.current / DUR, 1);
        const e = easeOutCubic(p);
        const startDist = far * 3;
        const dist = startDist + (far - startDist) * e;
        camera.position.set(Math.sin(-0.2) * dist * 0.12, far * 0.16 + (1 - e) * far * 0.45, dist);
        if (controlsRef.current) { controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); }
        if (p >= 1 && !arrivedRef.current) { arrivedRef.current = true; onArrived(); }
    });
    return null;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function Scene({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId, showAllFlows, onHover, paused, reducedMotion, armArrival, onArrived }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
    showAllFlows: boolean; onHover: (key: string | null, x: number, y: number) => void;
    paused: boolean; reducedMotion: boolean; armArrival: boolean; onArrived: () => void;
}) {
    const controlsRef = useRef<any>(null);
    const introGrp = useRef<THREE.Group>(null);
    const intro = useRef(reducedMotion ? 1 : 0);
    const arrivedRef = useRef(reducedMotion);
    const [arrived, setArrived] = useState(reducedMotion);
    const handleArrived = () => { setArrived(true); onArrived(); };
    useEffect(() => { if (reducedMotion) { arrivedRef.current = true; onArrived(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const ringRadius = useMemo(() => 4.8 + Math.min(people.length, 14) * 0.42, [people.length]);
    const positions = useMemo(() => {
        const n = people.length;
        return people.map((_, i) => {
            const a = (i / Math.max(n, 1)) * Math.PI * 2;
            const y = (i % 3 - 1) * 1.25;
            return new THREE.Vector3(Math.cos(a) * ringRadius, y, Math.sin(a) * ringRadius);
        });
    }, [people, ringRadius]);

    const totalHeld = useMemo(() => people.reduce((s, p) => s + p.currentlyHolding, 0), [people]);

    const selectedIdx = people.findIndex(p => p.key === selectedKey);
    const focusTarget = selectedIdx >= 0 ? positions[selectedIdx] : null;

    useFrame((_, dt) => {
        if (intro.current < 1) {
            intro.current = Math.min(intro.current + dt * 1.1, 1);
            if (introGrp.current) introGrp.current.scale.setScalar(0.85 + 0.15 * easeOutCubic(intro.current));
        }
    });

    return (
        <>
            <color attach="background" args={['#04060f']} />
            <fog attach="fog" args={['#04060f', 20, 52]} />
            <ambientLight intensity={0.5} />
            <pointLight position={[12, 10, 10]} intensity={1.1} />
            <pointLight position={[-12, -8, -10]} intensity={0.6} color="#8b5cf6" />
            <Stars radius={70} depth={50} count={1800} factor={4} saturation={0} fade speed={1} />

            <group ref={introGrp} scale={0.85}>
                <OrbitTracks radius={ringRadius} />
                <Core label="DEVICE FLEET" sub={`${people.length} people · ${totalHeld} in use`} />
                {showAllFlows && selectedKey === null && <AllFlows people={people} positions={positions} />}
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
                        selToken={selectedKey ?? ''}
                        onHover={onHover}
                    />
                ))}
            </group>

            <FocusController targetPos={focusTarget} controlsRef={controlsRef} selectionToken={selectedKey ?? '__none__'} sceneRadius={ringRadius} arrivedRef={arrivedRef} />
            <ArrivalController armed={armArrival} controlsRef={controlsRef} sceneRadius={ringRadius} arrivedRef={arrivedRef} onArrived={handleArrived} />

            <OrbitControls
                ref={controlsRef}
                makeDefault
                enablePan={false}
                enabled={arrived}
                minDistance={4}
                maxDistance={ringRadius * 3 + 8}
                autoRotate={arrived && selectedKey === null && !paused && !reducedMotion}
                autoRotateSpeed={0.4}
                enableDamping
                dampingFactor={0.09}
                rotateSpeed={0.85}
                zoomSpeed={0.9}
                minPolarAngle={Math.PI * 0.2}
                maxPolarAngle={Math.PI * 0.46}
            />
            <AdaptiveDpr pixelated={false} />
        </>
    );
}

// ─── Public component ────────────────────────────────────────────────────────
export default function PeopleOrbit3D({ people, selectedKey, onSelectPerson, onSelectDevice, selectedDeviceId, showAllFlows = false, onHover, armArrival = true, onArrived }: {
    people: OrbitPerson[]; selectedKey: string | null; onSelectPerson: (key: string | null) => void;
    onSelectDevice: (d: OrbitDevice) => void; selectedDeviceId: string | null;
    showAllFlows?: boolean; onHover?: (key: string | null, x: number, y: number) => void;
    armArrival?: boolean; onArrived?: () => void;
}) {
    // drag-guard: don't deselect if the pointer moved (i.e. it was a rotate, not a tap)
    const downPos = useRef<{ x: number; y: number } | null>(null);
    const handleHover = onHover ?? (() => {});
    const handleArrived = onArrived ?? (() => {});
    const [paused, setPaused] = useState(false);

    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        []
    );
    const webglOk = useMemo(() => {
        if (typeof document === 'undefined') return true;
        try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
        catch { return false; }
    }, []);

    if (!webglOk) {
        return (
            <div className="flex h-full items-center justify-center text-center px-6">
                <p className="text-sm text-slate-400">3D view needs WebGL, which is unavailable here. Switch to the <span className="text-white font-semibold">List</span> view.</p>
            </div>
        );
    }

    return (
        <Canvas
            camera={{ position: [0, 3, 16], fov: 55 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            onPointerDown={(e) => { downPos.current = { x: e.clientX, y: e.clientY }; }}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onPointerMissed={(e) => {
                const d = downPos.current;
                const moved = d ? Math.hypot(e.clientX - d.x, e.clientY - d.y) : 0;
                if (moved < 6) onSelectPerson(null); // real tap on empty space
            }}
        >
            <Suspense fallback={null}>
                <Scene
                    people={people}
                    selectedKey={selectedKey}
                    onSelectPerson={onSelectPerson}
                    onSelectDevice={onSelectDevice}
                    selectedDeviceId={selectedDeviceId}
                    showAllFlows={showAllFlows}
                    onHover={handleHover}
                    paused={paused}
                    reducedMotion={reducedMotion}
                    armArrival={armArrival}
                    onArrived={handleArrived}
                />
            </Suspense>
        </Canvas>
    );
}
