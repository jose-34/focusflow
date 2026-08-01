import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import type { Mesh } from 'three'

function RotatingBadge({ color, sparkleCount, shape }: { color: string; sparkleCount: number; shape: 'badge' | 'chest' }) {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.6
    meshRef.current.rotation.x += delta * 0.15
  })

  return (
    <>
      <mesh ref={meshRef}>
        {shape === 'chest' ? <boxGeometry args={[1.6, 1.1, 1]} /> : <octahedronGeometry args={[1.2, 0]} />}
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.2} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <Sparkles count={sparkleCount} scale={[4, 4, 2]} size={3} speed={0.4} color={color} />
    </>
  )
}

export function CelebrationScene({
  accentColor = '#C9A84C',
  sparkleCount = 40,
  shape = 'badge',
}: {
  accentColor?: string
  sparkleCount?: number
  shape?: 'badge' | 'chest'
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <pointLight position={[-3, -2, -2]} intensity={0.4} color="#064E3B" />
      <RotatingBadge color={accentColor} sparkleCount={sparkleCount} shape={shape} />
    </Canvas>
  )
}
