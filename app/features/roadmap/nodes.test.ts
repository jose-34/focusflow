import { describe, expect, it } from 'vitest'
import { computeRoadmapState } from './nodes'

describe('computeRoadmapState', () => {
  it('unlocks only the start node for a brand new user', () => {
    const { nodes, avatarT } = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set() })
    expect(nodes.filter((n) => n.unlocked).map((n) => n.id)).toEqual(['start'])
    expect(avatarT).toBe(0)
  })

  it('unlocks xp chest nodes purely from the totalXp threshold', () => {
    const { nodes } = computeRoadmapState({ totalXp: 150, unlockedAchievementKeys: new Set(['streak_starter']) })
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

  it('zone 1 is always revealed; zones 2 and 3 stay fogged until their gate achievement unlocks', () => {
    const fresh = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set() })
    expect(fresh.nodes.find((n) => n.id === 'xp_50')!.zoneUnlocked).toBe(true) // zone 1
    expect(fresh.nodes.find((n) => n.id === 'night_owl')!.zoneUnlocked).toBe(false) // zone 2
    expect(fresh.nodes.find((n) => n.id === 'task_master')!.zoneUnlocked).toBe(false) // zone 3

    const zone2Open = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['streak_starter']) })
    expect(zone2Open.nodes.find((n) => n.id === 'night_owl')!.zoneUnlocked).toBe(true)
    expect(zone2Open.nodes.find((n) => n.id === 'task_master')!.zoneUnlocked).toBe(false)

    const zone3Open = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['streak_starter', 'week_warrior']) })
    expect(zone3Open.nodes.find((n) => n.id === 'task_master')!.zoneUnlocked).toBe(true)
  })

  it('does not let the avatar stand on a checkpoint whose zone is still fogged', () => {
    // xp_150 (zone 2) is satisfied by XP alone, but zone 2 requires
    // streak_starter — a real reachable state (lots of sessions, broken streak).
    const { avatarT, nodes } = computeRoadmapState({ totalXp: 200, unlockedAchievementKeys: new Set(['first_focus']) })
    const xp150 = nodes.find((n) => n.id === 'xp_150')!
    expect(xp150.unlocked).toBe(true)
    expect(xp150.zoneUnlocked).toBe(false)
    expect(avatarT).toBeLessThan(xp150.t)
  })

  it('places the avatar at the furthest-along reachable node even if unlocks are out of order', () => {
    const { avatarT, nodes } = computeRoadmapState({ totalXp: 0, unlockedAchievementKeys: new Set(['first_focus', 'streak_starter']) })
    const streakStarterNode = nodes.find((n) => n.id === 'streak_starter')!
    expect(avatarT).toBe(streakStarterNode.t)
  })
})
