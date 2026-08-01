import { describe, expect, it } from 'vitest'
import { computeRoadmapState } from './nodes'

describe('computeRoadmapState', () => {
  it('unlocks only the start node for a brand new user', () => {
    const { nodes, avatarT } = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set() })
    expect(nodes.filter((n) => n.unlocked).map((n) => n.id)).toEqual(['start'])
    expect(avatarT).toBe(0)
  })

  it('unlocks xp chest nodes purely from the totalXp threshold', () => {
    const { nodes } = computeRoadmapState({ totalXp: 150, unlockedAchievementKeys: new Set() })
    const chest50 = nodes.find((n) => n.id === 'xp_50')!
    const chest150 = nodes.find((n) => n.id === 'xp_150')!
    const chest400 = nodes.find((n) => n.id === 'xp_400')!
    expect(chest50.unlocked).toBe(true)
    expect(chest150.unlocked).toBe(true)
    expect(chest400.unlocked).toBe(false)
  })

  it('unlocks badge nodes purely from the achievement key set', () => {
    const { nodes } = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['first_focus', 'early_bird']) })
    expect(nodes.find((n) => n.id === 'first_focus')!.unlocked).toBe(true)
    expect(nodes.find((n) => n.id === 'early_bird')!.unlocked).toBe(true)
    expect(nodes.find((n) => n.id === 'streak_starter')!.unlocked).toBe(false)
  })

  it('the goal node unlocks only once the boss (century_club) does, regardless of XP', () => {
    const withoutBoss = computeRoadmapState({ totalXp: 10_000, unlockedAchievementKeys: new Set() })
    expect(withoutBoss.nodes.find((n) => n.id === 'goal')!.unlocked).toBe(false)

    const withBoss = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['century_club']) })
    expect(withBoss.nodes.find((n) => n.id === 'goal')!.unlocked).toBe(true)
  })

  it('places the avatar at the furthest-along unlocked node even if unlocks are out of order', () => {
    // task_master (index 7) unlocked without streak_starter (index 4) — a
    // real possible path (50 completed tasks well before a 3-day streak).
    const { avatarT, nodes } = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['first_focus', 'task_master']) })
    const taskMasterNode = nodes.find((n) => n.id === 'task_master')!
    expect(avatarT).toBe(taskMasterNode.t)
  })
})
