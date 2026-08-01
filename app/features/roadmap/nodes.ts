// Pure, dependency-free by design (mirrors app/features/progress/streaks.ts)
// — the roadmap only ever visualizes real unlock state (XP ledger total,
// achievement unlocks); it never invents its own progress source. Only 6 of
// the 8 historical achievement keys are actually unlockable today (see
// app/features/achievements/definitions.ts) — night_owl and marathon were
// retired per the Design Review Board, so they're deliberately absent here
// too rather than placing a checkpoint that can never light up.
export type RoadmapNodeKind = 'start' | 'badge' | 'chest' | 'boss' | 'goal'

export interface RoadmapNode {
  id: string
  kind: RoadmapNodeKind
  label: string
  achievementKey?: string
  xpThreshold?: number
}

export const ROADMAP_NODES: Array<RoadmapNode> = [
  { id: 'start', kind: 'start', label: 'Start' },
  { id: 'first_focus', kind: 'badge', label: 'First Focus', achievementKey: 'first_focus' },
  { id: 'xp_50', kind: 'chest', label: '50 XP', xpThreshold: 50 },
  { id: 'early_bird', kind: 'badge', label: 'Early Bird', achievementKey: 'early_bird' },
  { id: 'streak_starter', kind: 'badge', label: 'Streak Starter', achievementKey: 'streak_starter' },
  { id: 'xp_150', kind: 'chest', label: '150 XP', xpThreshold: 150 },
  { id: 'week_warrior', kind: 'badge', label: 'Week Warrior', achievementKey: 'week_warrior' },
  { id: 'task_master', kind: 'badge', label: 'Task Master', achievementKey: 'task_master' },
  { id: 'xp_400', kind: 'chest', label: '400 XP', xpThreshold: 400 },
  { id: 'century_club', kind: 'boss', label: 'Century Club', achievementKey: 'century_club' },
  { id: 'goal', kind: 'goal', label: 'Journey Complete' },
]

export interface RoadmapProgressInput {
  totalXp: number
  unlockedAchievementKeys: ReadonlySet<string>
}

export interface RoadmapNodeState extends RoadmapNode {
  /** Position along the path, 0..1. */
  t: number
  unlocked: boolean
}

export interface RoadmapState {
  nodes: Array<RoadmapNodeState>
  /** Where the avatar should stand — the furthest-along unlocked node. */
  avatarT: number
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
    return { ...node, t, unlocked }
  })

  const unlockedTs = nodes.filter((n) => n.unlocked).map((n) => n.t)
  const avatarT = unlockedTs.length > 0 ? Math.max(...unlockedTs) : 0

  return { nodes, avatarT }
}
