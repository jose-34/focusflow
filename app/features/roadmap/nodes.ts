// Pure, dependency-free by design (mirrors app/features/progress/streaks.ts)
// — the roadmap only ever visualizes real unlock state (XP ledger total,
// achievement unlocks); it never invents its own progress source. All 8
// achievement keys are represented (see app/features/achievements/definitions.ts
// and docs/DESIGN_REVIEW_BOARD.md's 2026-08-01 reversal note for why
// night_owl/marathon are back after being retired).
export type RoadmapNodeKind = 'start' | 'badge' | 'chest' | 'boss' | 'goal'

export interface RoadmapNode {
  id: string
  kind: RoadmapNodeKind
  label: string
  achievementKey?: string
  xpThreshold?: number
  /** Which map zone this checkpoint sits in — see ZONE_GATE_ACHIEVEMENT. */
  zone: number
}

export const ROADMAP_NODES: Array<RoadmapNode> = [
  { id: 'start', kind: 'start', label: 'Start', zone: 1 },
  { id: 'first_focus', kind: 'badge', label: 'First Focus', achievementKey: 'first_focus', zone: 1 },
  { id: 'xp_50', kind: 'chest', label: '50 XP', xpThreshold: 50, zone: 1 },
  { id: 'early_bird', kind: 'badge', label: 'Early Bird', achievementKey: 'early_bird', zone: 1 },
  // streak_starter is the last node of zone 1 by design — it's the gate
  // condition for zone 2, so it can't itself live inside the zone it opens.
  { id: 'streak_starter', kind: 'badge', label: 'Streak Starter', achievementKey: 'streak_starter', zone: 1 },
  { id: 'xp_150', kind: 'chest', label: '150 XP', xpThreshold: 150, zone: 2 },
  { id: 'night_owl', kind: 'badge', label: 'Night Owl', achievementKey: 'night_owl', zone: 2 },
  // Same reasoning: week_warrior gates zone 3, so it lives at the end of zone 2.
  { id: 'week_warrior', kind: 'badge', label: 'Week Warrior', achievementKey: 'week_warrior', zone: 2 },
  { id: 'task_master', kind: 'badge', label: 'Task Master', achievementKey: 'task_master', zone: 3 },
  { id: 'marathon', kind: 'badge', label: 'Marathon', achievementKey: 'marathon', zone: 3 },
  { id: 'xp_400', kind: 'chest', label: '400 XP', xpThreshold: 400, zone: 3 },
  { id: 'century_club', kind: 'boss', label: 'Century Club', achievementKey: 'century_club', zone: 3 },
  { id: 'goal', kind: 'goal', label: 'Journey Complete', zone: 3 },
]

/** Zone N (N > 1) is revealed once the named achievement is unlocked. Zone 1 is always visible. */
export const ZONE_GATE_ACHIEVEMENT: Record<number, string> = {
  2: 'streak_starter',
  3: 'week_warrior',
}

export interface RoadmapProgressInput {
  totalXp: number
  unlockedAchievementKeys: ReadonlySet<string>
}

export interface RoadmapNodeState extends RoadmapNode {
  /** Position along the path, 0..1. */
  t: number
  /** Whether this specific checkpoint's own condition has been met. */
  unlocked: boolean
  /** Whether the zone containing this node has been revealed yet. */
  zoneUnlocked: boolean
}

export interface RoadmapState {
  nodes: Array<RoadmapNodeState>
  /** Where the avatar should stand — the furthest-along node that is both unlocked and in a revealed zone. */
  avatarT: number
}

function isZoneUnlocked(zone: number, unlockedAchievementKeys: ReadonlySet<string>): boolean {
  const gateKey = ZONE_GATE_ACHIEVEMENT[zone]
  return gateKey ? unlockedAchievementKeys.has(gateKey) : true
}

/**
 * The goal node has no threshold of its own — it unlocks once the boss
 * node (the hardest checkpoint) does, rather than requiring a separate,
 * arbitrary "journey complete" condition.
 */
export function computeRoadmapState(input: RoadmapProgressInput): RoadmapState {
  const count = ROADMAP_NODES.length
  const bossKey = ROADMAP_NODES.find((n) => n.kind === 'boss')?.achievementKey
  const bossUnlocked = bossKey ? input.unlockedAchievementKeys.has(bossKey) : false

  const nodes: Array<RoadmapNodeState> = ROADMAP_NODES.map((node, index) => {
    const t = count === 1 ? 0 : index / (count - 1)
    let unlocked: boolean
    switch (node.kind) {
      case 'start':
        unlocked = true
        break
      case 'chest':
        unlocked = input.totalXp >= (node.xpThreshold ?? 0)
        break
      case 'goal':
        unlocked = bossUnlocked
        break
      default:
        unlocked = node.achievementKey ? input.unlockedAchievementKeys.has(node.achievementKey) : false
    }
    const zoneUnlocked = isZoneUnlocked(node.zone, input.unlockedAchievementKeys)
    return { ...node, t, unlocked, zoneUnlocked }
  })

  // The avatar can only stand somewhere actually reachable — unlocked AND
  // in a revealed zone. Without the zoneUnlocked check, a high-XP,
  // low-streak user could satisfy a zone-2 chest's XP threshold before ever
  // opening zone 2, which would strand the avatar visibly inside fog.
  const reachableTs = nodes.filter((n) => n.unlocked && n.zoneUnlocked).map((n) => n.t)
  const avatarT = reachableTs.length > 0 ? Math.max(...reachableTs) : 0

  return { nodes, avatarT }
}
