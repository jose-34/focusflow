import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { RoadmapNodeState } from '@/features/roadmap/nodes'

const PALETTE = {
  gold: '#c9a84c',
  teacherGreen: '#059669',
  locked: '#9ca3af',
  road: '#e7dcc0',
} as const

// Shape control points for a gentle winding path — independent of node
// count, so nodes.ts can grow/shrink its checkpoint list without this curve
// needing to change. Node markers are placed via curve.getPointAt(node.t).
const PATH_CONTROL_POINTS: Array<[number, number, number]> = [
  [-6, 0, 2.5],
  [-3, 0, -2],
  [0, 0, 2],
  [3, 0, -2],
  [5, 0, 1.5],
  [7, 0, -1],
]

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function RoadPath({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.35, 6, false), [curve])
  return (
    <mesh geometry={geometry} rotation={[0, 0, 0]}>
      <meshStandardMaterial color={PALETTE.road} roughness={0.9} />
    </mesh>
  )
}

function NodeMarker({ node, position }: { node: RoadmapNodeState; position: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = node.unlocked ? (node.kind === 'boss' || node.kind === 'goal' ? PALETTE.gold : PALETTE.teacherGreen) : PALETTE.locked

  useFrame(({ clock }) => {
    if (!meshRef.current || !node.unlocked || prefersReducedMotion) return
    meshRef.current.position.y = position.y + 0.5 + Math.sin(clock.elapsedTime * 1.5 + position.x) * 0.08
  })

  const size = node.kind === 'boss' ? 0.55 : node.kind === 'goal' ? 0.6 : 0.32

  return (
    <group position={position}>
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        {node.kind === 'chest' ? (
          <boxGeometry args={[size, size * 0.7, size * 0.6]} />
        ) : node.kind === 'goal' ? (
          <coneGeometry args={[size * 0.7, size * 1.6, 4]} />
        ) : node.kind === 'boss' ? (
          <icosahedronGeometry args={[size, 0]} />
        ) : node.kind === 'start' ? (
          <cylinderGeometry args={[size * 0.15, size * 0.15, 1, 6]} />
        ) : (
          <octahedronGeometry args={[size, 0]} />
        )}
        <meshStandardMaterial
          color={color}
          metalness={node.unlocked ? 0.5 : 0.1}
          roughness={node.unlocked ? 0.3 : 0.8}
          emissive={color}
          emissiveIntensity={node.unlocked ? 0.35 : 0}
        />
      </mesh>

      {node.unlocked && !prefersReducedMotion && (
        <Sparkles count={8} scale={[1, 1.2, 1]} size={2} speed={0.3} color={color} position={[0, 0.6, 0]} />
      )}

      <Html position={[0, 1.2, 0]} center distanceFactor={10} occlude={false}>
        <div
          className={
            node.unlocked
              ? 'pointer-events-none rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-foreground shadow-sm'
              : 'pointer-events-none rounded-full bg-card/60 px-2 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground'
          }
        >
          {node.label}
        </div>
      </Html>
    </group>
  )
}

function Avatar({ curve, avatarT }: { curve: THREE.CatmullRomCurve3; avatarT: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const animatedT = useRef(prefersReducedMotion ? avatarT : 0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    animatedT.current = prefersReducedMotion ? avatarT : THREE.MathUtils.damp(animatedT.current, avatarT, 3, delta)
    const point = curve.getPointAt(Math.min(Math.max(animatedT.current, 0), 1))
    groupRef.current.position.set(point.x, point.y + 0.75, point.z)
    if (!prefersReducedMotion) {
      groupRef.current.position.y += Math.sin(performance.now() * 0.003) * 0.06
      groupRef.current.rotation.y += delta * 0.8
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <coneGeometry args={[0.28, 0.6, 8]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={0.6} metalness={0.4} roughness={0.25} />
      </mesh>
      {!prefersReducedMotion && <Sparkles count={14} scale={[0.6, 0.8, 0.6]} size={2.5} speed={0.5} color={PALETTE.gold} />}
    </group>
  )
}

interface RoadmapSceneProps {
  nodes: Array<RoadmapNodeState>
  avatarT: number
}

export function RoadmapScene({ nodes, avatarT }: RoadmapSceneProps) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(PATH_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.4),
    [],
  )
  const nodePositions = useMemo(() => nodes.map((node) => curve.getPointAt(node.t)), [curve, nodes])

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 9, 7], fov: 38 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 5]} intensity={1} />
      <pointLight position={[-4, 3, -3]} intensity={0.3} color={PALETTE.teacherGreen} />

      <RoadPath curve={curve} />
      {nodes.map((node, index) => (
        <NodeMarker key={node.id} node={node} position={nodePositions[index]} />
      ))}
      <Avatar curve={curve} avatarT={avatarT} />
    </Canvas>
  )
}
