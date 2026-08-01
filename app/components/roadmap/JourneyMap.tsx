import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, Html, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { RoadmapNodeState } from '@/features/roadmap/nodes'
import {
  AVATAR_TEXTURE_PATH,
  BACKGROUND_TEXTURE_PATH,
  CELEBRATION_YOU_DID_IT_PATH,
  CONFETTI_BURST_PATH,
  DECORATION_TEXTURES,
  textureForNode,
  ZONE_BANNER_TEXTURE,
} from './roadmapAssets'

const PALETTE = {
  gold: '#c9a84c',
  teacherGreen: '#059669',
  locked: '#9ca3af',
  fogged: '#d8d2c2',
  road: '#e7dcc0',
  sceneBackground: '#f5f0e0',
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

const BURST_DURATION_MS = 1800

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Loads a texture optimistically and resolves to null on any failure (404,
 * decode error) instead of throwing — every real asset in this scene is
 * optional today, so callers just fall back to a procedural placeholder
 * rather than needing a Suspense/ErrorBoundary pair per node.
 */
function useOptionalTexture(path: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(
      path,
      (loaded) => {
        if (!cancelled) setTexture(loaded)
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [path])

  return texture
}

/** Tracks which node ids just transitioned locked -> unlocked, for a burst animation that fades after BURST_DURATION_MS. */
function useJustUnlocked(nodes: Array<RoadmapNodeState>): Set<string> {
  const previouslyUnlocked = useRef<Set<string>>(new Set())
  const [justUnlocked, setJustUnlocked] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentlyUnlocked = new Set(nodes.filter((n) => n.unlocked).map((n) => n.id))
    const newlyUnlocked = [...currentlyUnlocked].filter((id) => !previouslyUnlocked.current.has(id))
    previouslyUnlocked.current = currentlyUnlocked

    if (newlyUnlocked.length === 0 || prefersReducedMotion) return
    setJustUnlocked((prev) => new Set([...prev, ...newlyUnlocked]))
    const timer = setTimeout(() => {
      setJustUnlocked((prev) => {
        const next = new Set(prev)
        for (const id of newlyUnlocked) next.delete(id)
        return next
      })
    }, BURST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [nodes])

  return justUnlocked
}

function BackgroundPlane() {
  const texture = useOptionalTexture(BACKGROUND_TEXTURE_PATH)
  if (!texture) return null
  return (
    <mesh position={[0.5, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[42, 32]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function RoadPath({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.35, 6, false), [curve])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={PALETTE.road} roughness={0.9} />
    </mesh>
  )
}

function NodeMarker({
  node,
  position,
  justUnlocked,
}: {
  node: RoadmapNodeState
  position: THREE.Vector3
  justUnlocked: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useOptionalTexture(textureForNode(node.kind, node.achievementKey, node.id))
  const fogged = !node.zoneUnlocked
  const color = fogged ? PALETTE.fogged : node.unlocked ? (node.kind === 'boss' || node.kind === 'goal' ? PALETTE.gold : PALETTE.teacherGreen) : PALETTE.locked

  useFrame(({ clock }) => {
    if (!meshRef.current || !node.unlocked || fogged || prefersReducedMotion) return
    const bob = Math.sin(clock.elapsedTime * 1.5 + position.x) * 0.08
    const pulse = justUnlocked ? 1 + Math.sin(clock.elapsedTime * 10) * 0.15 : 1
    meshRef.current.position.y = position.y + 0.5 + bob
    meshRef.current.scale.setScalar(pulse)
  })

  const size = node.kind === 'boss' ? 0.55 : node.kind === 'goal' ? 0.6 : 0.32
  const opacity = fogged ? 0.35 : 1

  return (
    <group position={position}>
      {texture ? (
        <Billboard position={[0, 0.5 + size, 0]}>
          <mesh>
            <planeGeometry args={[size * 2.2, size * 2.2]} />
            <meshBasicMaterial map={texture} transparent alphaTest={0.1} opacity={opacity} toneMapped={false} />
          </mesh>
        </Billboard>
      ) : (
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
            transparent
            opacity={opacity}
            metalness={node.unlocked && !fogged ? 0.5 : 0.1}
            roughness={node.unlocked && !fogged ? 0.3 : 0.8}
            emissive={color}
            emissiveIntensity={node.unlocked && !fogged ? 0.35 : 0}
          />
        </mesh>
      )}

      {node.unlocked && !fogged && !prefersReducedMotion && (
        <Sparkles count={justUnlocked ? 30 : 8} scale={justUnlocked ? [2, 2, 2] : [1, 1.2, 1]} size={justUnlocked ? 4 : 2} speed={0.4} color={color} position={[0, 0.6, 0]} />
      )}

      <Html position={[0, 1.2, 0]} center distanceFactor={10} occlude={false}>
        <div
          className={
            fogged
              ? 'pointer-events-none rounded-full bg-card/50 px-2 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground'
              : node.unlocked
                ? 'pointer-events-none rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-foreground shadow-sm'
                : 'pointer-events-none rounded-full bg-card/60 px-2 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground'
          }
        >
          {fogged ? '🔒 ???' : node.label}
        </div>
      </Html>
    </group>
  )
}

/** Entrance signage at the start of each zone — purely decorative, never gates anything itself. */
function ZoneBanner({ zone, position }: { zone: number; position: THREE.Vector3 }) {
  const texturePath = ZONE_BANNER_TEXTURE[zone]
  const texture = useOptionalTexture(texturePath)
  if (!texture) return null
  return (
    <Billboard position={[position.x, position.y + 1.6, position.z]}>
      <mesh>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.1} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

/** A single decorative prop (tree/bush/rock/etc) — no gameplay meaning, just atmosphere. */
function DecorationProp({ texturePath, position }: { texturePath: string; position: THREE.Vector3 }) {
  const texture = useOptionalTexture(texturePath)
  if (!texture) return null
  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.1} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

/**
 * Scatters DECORATION_TEXTURES at fixed points offset perpendicular to the
 * path, alternating sides. Fixed t-values and a fixed side-alternation
 * (not random) so the scene doesn't reshuffle between renders/reloads.
 */
function Decorations({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const spots = useMemo(() => {
    const tValues = [0.06, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.92]
    return tValues.map((t, i) => {
      const point = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      const side = i % 2 === 0 ? 1 : -1
      const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(1.6 * side)
      const position = point.clone().add(perpendicular)
      position.y = 0.4
      const texturePath = DECORATION_TEXTURES[i % DECORATION_TEXTURES.length]
      return { key: `deco-${i}`, texturePath, position }
    })
  }, [curve])

  return (
    <>
      {spots.map((spot) => (
        <DecorationProp key={spot.key} texturePath={spot.texturePath} position={spot.position} />
      ))}
    </>
  )
}

/** A one-shot "You Did It!" banner + confetti when the goal node is freshly reached. */
function GoalCelebration({ position }: { position: THREE.Vector3 }) {
  const bannerTexture = useOptionalTexture(CELEBRATION_YOU_DID_IT_PATH)
  const confettiTexture = useOptionalTexture(CONFETTI_BURST_PATH)

  return (
    <group position={[position.x, position.y, position.z]}>
      {bannerTexture && (
        <Billboard position={[0, 2.2, 0]}>
          <mesh>
            <planeGeometry args={[2.2, 0.52]} />
            <meshBasicMaterial map={bannerTexture} transparent alphaTest={0.1} toneMapped={false} />
          </mesh>
        </Billboard>
      )}
      {confettiTexture && (
        <Billboard position={[0, 1.4, 0]}>
          <mesh>
            <planeGeometry args={[1.6, 1]} />
            <meshBasicMaterial map={confettiTexture} transparent alphaTest={0.1} toneMapped={false} />
          </mesh>
        </Billboard>
      )}
      {!prefersReducedMotion && <Sparkles count={50} scale={[2.5, 2.5, 2.5]} size={4} speed={0.6} color={PALETTE.gold} position={[0, 1.5, 0]} />}
    </group>
  )
}

function Avatar({ curve, avatarT }: { curve: THREE.CatmullRomCurve3; avatarT: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const animatedT = useRef(prefersReducedMotion ? avatarT : 0)
  const texture = useOptionalTexture(AVATAR_TEXTURE_PATH)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    animatedT.current = prefersReducedMotion ? avatarT : THREE.MathUtils.damp(animatedT.current, avatarT, 3, delta)
    const point = curve.getPointAt(Math.min(Math.max(animatedT.current, 0), 1))
    groupRef.current.position.set(point.x, point.y + 0.75, point.z)
    if (!prefersReducedMotion) {
      groupRef.current.position.y += Math.sin(performance.now() * 0.003) * 0.06
      if (!texture) groupRef.current.rotation.y += delta * 0.8
    }
  })

  return (
    <group ref={groupRef}>
      {texture ? (
        <Billboard>
          <mesh>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial map={texture} transparent alphaTest={0.1} toneMapped={false} />
          </mesh>
        </Billboard>
      ) : (
        <mesh>
          <coneGeometry args={[0.28, 0.6, 8]} />
          <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={0.6} metalness={0.4} roughness={0.25} />
        </mesh>
      )}
      {!prefersReducedMotion && <Sparkles count={14} scale={[0.6, 0.8, 0.6]} size={2.5} speed={0.5} color={PALETTE.gold} />}
    </group>
  )
}

interface JourneyMapProps {
  nodes: Array<RoadmapNodeState>
  avatarT: number
}

export function JourneyMap({ nodes, avatarT }: JourneyMapProps) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(PATH_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.4),
    [],
  )
  const nodePositions = useMemo(() => nodes.map((node) => curve.getPointAt(node.t)), [curve, nodes])
  const justUnlocked = useJustUnlocked(nodes)

  const zoneEntrances = useMemo(() => {
    const firstIndexByZone = new Map<number, number>()
    nodes.forEach((node, index) => {
      if (!firstIndexByZone.has(node.zone)) firstIndexByZone.set(node.zone, index)
    })
    return [...firstIndexByZone.entries()].map(([zone, index]) => ({ zone, position: nodePositions[index] }))
  }, [nodes, nodePositions])

  const goalIndex = nodes.findIndex((n) => n.kind === 'goal')
  const showGoalCelebration = goalIndex >= 0 && justUnlocked.has(nodes[goalIndex].id)

  return (
    <Canvas
      orthographic
      dpr={[1, 1.5]}
      camera={{ position: [0, 16, 9], zoom: 46, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 5]} intensity={1} />
      <pointLight position={[-4, 3, -3]} intensity={0.3} color={PALETTE.teacherGreen} />

      <BackgroundPlane />
      <Decorations curve={curve} />
      <RoadPath curve={curve} />
      {nodes.map((node, index) => (
        <NodeMarker key={node.id} node={node} position={nodePositions[index]} justUnlocked={justUnlocked.has(node.id)} />
      ))}
      {zoneEntrances.map(({ zone, position }) => (
        <ZoneBanner key={zone} zone={zone} position={position} />
      ))}
      <Avatar curve={curve} avatarT={avatarT} />
      {showGoalCelebration && <GoalCelebration position={nodePositions[goalIndex]} />}
    </Canvas>
  )
}
