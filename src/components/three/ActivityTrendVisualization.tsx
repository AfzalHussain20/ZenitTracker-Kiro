'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface DataPoint {
  date: string;
  tests: number;
  passed: number;
  failed: number;
}

interface Props {
  data: DataPoint[];
}

function FlowingCurve({
  points,
  color,
  label,
}: {
  points: THREE.Vector3[];
  color: string;
  label: string;
}) {
  const particleRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const tubePoints = useMemo(() => curve.getPoints(80), [curve]);

  // Build line geometry
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(tubePoints);
    return geo;
  }, [tubePoints]);

  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.9,
      }),
    [color]
  );

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * 0.3) % 1;
    if (particleRef.current) {
      const pos = curve.getPoint(progressRef.current);
      particleRef.current.position.copy(pos);
    }
  });

  return (
    <group>
      <primitive object={new THREE.Line(lineGeo, mat)} />
      {/* Glowing traveling particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* Data point spheres */}
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Label at end */}
      <Text
        position={[points[points.length - 1].x + 0.4, points[points.length - 1].y, 0]}
        fontSize={0.28}
        color={color}
        anchorX="left"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

function GridPlane({ count }: { count: number }) {
  const lines = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 0; i <= count; i++) {
      const y = (i / count) * 3;
      verts.push(-4, y, 0, 4, y, 0);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [count]);

  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.08,
      }),
    []
  );

  return <primitive object={new THREE.LineSegments(lines, mat)} />;
}

function DateLabels({ dates }: { dates: string[] }) {
  return (
    <>
      {dates.map((d, i) => {
        const x = (i / Math.max(dates.length - 1, 1)) * 8 - 4;
        return (
          <Text
            key={i}
            position={[x, -0.4, 0]}
            fontSize={0.22}
            color="#888888"
            anchorX="center"
            anchorY="top"
          >
            {d}
          </Text>
        );
      })}
    </>
  );
}

function Scene({ data }: { data: DataPoint[] }) {
  const maxVal = useMemo(
    () => Math.max(...data.map((d) => Math.max(d.passed, d.failed)), 1),
    [data]
  );

  const passedPoints = useMemo(
    () =>
      data.map(
        (d, i) =>
          new THREE.Vector3(
            (i / Math.max(data.length - 1, 1)) * 8 - 4,
            (d.passed / maxVal) * 3,
            0
          )
      ),
    [data, maxVal]
  );

  const failedPoints = useMemo(
    () =>
      data.map(
        (d, i) =>
          new THREE.Vector3(
            (i / Math.max(data.length - 1, 1)) * 8 - 4,
            (d.failed / maxVal) * 3,
            0.1
          )
      ),
    [data, maxVal]
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#10b981" />
      <pointLight position={[0, 0, -3]} intensity={0.4} color="#ef4444" />

      <GridPlane count={4} />
      <DateLabels dates={data.map((d) => d.date)} />

      {passedPoints.length >= 2 && (
        <FlowingCurve points={passedPoints} color="#10b981" label="Passed" />
      )}
      {failedPoints.length >= 2 && (
        <FlowingCurve points={failedPoints} color="#ef4444" label="Failed" />
      )}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.4}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

export const ActivityTrendVisualization = ({ data }: Props) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 2, 9], fov: 50 }}>
        <Scene data={data} />
      </Canvas>
    </div>
  );
};
