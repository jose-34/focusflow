import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Sparkles } from '@react-three/drei'
import type { Group } from 'three'

const PODIUM_COLORS = ['#C9A84C', '#B0B8C1', '#B87333']
const PODIUM_HEIGHTS = [1.4, 1.0, 0.7]
// left-to-right visual order is 2nd, 1st, 3rd (classic podium arrangement)
const PODIUM_SLOTS = [1, 0, 2]
const PODIUM_X = [-1.6, 0, 1.6]
const RANK_LABELS = ['1st', '2nd', '3rd']

export interface PodiumEntry {
  nickname: string
  score: number
}

function Podiums({ topThree }: { topThree?: Array<PodiumEntry> }) {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.15
  })

  return (
    <group ref={groupRef}>
      {PODIUM_SLOTS.map((rankIndex, slot) => {
        const entry = topThree?.[rankIndex]
        const boxTop = PODIUM_HEIGHTS[rankIndex] - 0.7
        return (
          <group key={rankIndex}>
            <mesh position={[PODIUM_X[slot], PODIUM_HEIGHTS[rankIndex] / 2 - 0.7, 0]}>
              <boxGeometry args={[1.1, PODIUM_HEIGHTS[rankIndex], 1.1]} />
              <meshStandardMaterial color={PODIUM_COLORS[rankIndex]} metalness={0.6} roughness={0.3} />
            </mesh>
            {entry && (
              // Real DOM labels synced to the mesh's 3D transform, not
              // troika-three-text <Text> meshes — this scene already spends
              // its GPU budget on 3 boxes + a rotating group + 60 sparkles,
              // and stacking SDF font-atlas generation for 9 more meshes on
              // top of that reliably crashed the WebGL context under
              // software rendering (confirmed via a headless repro: the
              // canvas existed at the right size but isContextLost() was
              // true). Html's cost is just a CSS transform update per
              // frame, not a texture upload.
              <Html position={[PODIUM_X[slot], boxTop + 0.55, 0]} center distanceFactor={4} transform occlude={false}>
                <div className="pointer-events-none flex w-28 flex-col items-center gap-0.5 text-center">
                  <span className="rounded-full bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">{RANK_LABELS[rankIndex]}</span>
                  <span className="rounded bg-white/90 px-1.5 py-0.5 text-xs font-semibold text-slate-800 shadow-sm">{entry.nickname}</span>
                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{entry.score.toLocaleString()} pts</span>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

export function PodiumScene({ topThree }: { topThree?: Array<PodiumEntry> }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 5], fov: 45 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <pointLight position={[-3, 2, -2]} intensity={0.3} color="#064E3B" />
      <Podiums topThree={topThree} />
      <Sparkles count={60} scale={[6, 3, 3]} size={2.5} speed={0.3} color="#C9A84C" />
    </Canvas>
  )
}
