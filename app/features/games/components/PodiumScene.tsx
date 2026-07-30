import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import type { Group } from 'three'

const PODIUM_COLORS = ['#C9A84C', '#B0B8C1', '#B87333']
const PODIUM_HEIGHTS = [1.4, 1.0, 0.7]
// left-to-right visual order is 2nd, 1st, 3rd (classic podium arrangement)
const PODIUM_SLOTS = [1, 0, 2]
const PODIUM_X = [-1.6, 0, 1.6]

function Podiums() {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.15
  })

  return (
    <group ref={groupRef}>
      {PODIUM_SLOTS.map((rankIndex, slot) => (
        <mesh key={rankIndex} position={[PODIUM_X[slot], PODIUM_HEIGHTS[rankIndex] / 2 - 0.7, 0]}>
          <boxGeometry args={[1.1, PODIUM_HEIGHTS[rankIndex], 1.1]} />
          <meshStandardMaterial color={PODIUM_COLORS[rankIndex]} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

export function PodiumScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 5], fov: 45 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <pointLight position={[-3, 2, -2]} intensity={0.3} color="#064E3B" />
      <Podiums />
      <Sparkles count={60} scale={[6, 3, 3]} size={2.5} speed={0.3} color="#C9A84C" />
    </Canvas>
  )
}
