import type { RoadmapNodeKind } from '@/features/roadmap/nodes'

// Real, extracted art — see design-assets/*.png for the source sheets these
// were cropped from. JourneyMap.tsx still loads every path here
// optimistically and falls back to procedural placeholder geometry on
// failure, so a missing/renamed file never breaks the scene.
const BASE = '/assets/roadmap'

export const BACKGROUND_TEXTURE_PATH = `${BASE}/background.png`

export const NODE_KIND_TEXTURE: Record<RoadmapNodeKind, string> = {
  start: `${BASE}/start-signpost.png`,
  badge: `${BASE}/badge-sparkle.png`,
  chest: `${BASE}/treasure-chest.png`,
  boss: `${BASE}/boss-monster.png`,
  goal: `${BASE}/goal-castle.png`,
}

// Per-achievement badge art — mirrors the icon choices already used on
// /achievements (Sparkles/Flame/Trophy/Award/ListChecks/Sunrise/Moon/Zap)
// so the same achievement always reads the same way across both pages.
export const BADGE_ACHIEVEMENT_TEXTURE: Partial<Record<string, string>> = {
  first_focus: `${BASE}/badge-sparkle.png`,
  streak_starter: `${BASE}/badge-flame.png`,
  week_warrior: `${BASE}/badge-trophy.png`,
  century_club: `${BASE}/badge-ribbon.png`,
  task_master: `${BASE}/badge-books.png`,
  // No sun/horizon icon existed in the source sheets — this uses the plain
  // gold star badge as a stand-in until a real sunrise asset is supplied.
  early_bird: `${BASE}/badge-sunrise.png`,
  night_owl: `${BASE}/badge-moon.png`,
  marathon: `${BASE}/badge-lightning.png`,
}

// The final XP chest before the boss gets the fancier purple/gold chest —
// a small visual escalation so the biggest reward on the board reads as
// the biggest reward, not identical to the 50/150 XP chests.
export const CHEST_TIER_TEXTURE: Partial<Record<string, string>> = {
  xp_400: `${BASE}/chest-epic.png`,
}

export const AVATAR_TEXTURE_PATH = `${BASE}/avatar-walker.png`
export const SPARKLE_TEXTURE_PATH = `${BASE}/sparkle-particle.png`

// One per zone (nodes.ts's ZONE_GATE_ACHIEVEMENT) — rendered as entrance
// signage where each zone begins, echoing the reference mockup's
// "LEVEL 1 / LEVEL 2 / LEVEL 3" scroll banners.
export const ZONE_BANNER_TEXTURE: Record<number, string> = {
  1: `${BASE}/level-banner-1.png`,
  2: `${BASE}/level-banner-2.png`,
  3: `${BASE}/level-banner-3.png`,
}

// Purely decorative scatter props (trees/bushes/rocks/clouds/flowers) with
// no gameplay meaning — placed at fixed offsets from the path for
// atmosphere. Order matters: cycled through by index, not randomized, so
// the scene is stable across renders/reloads rather than reshuffling.
export const DECORATION_TEXTURES: Array<string> = [
  `${BASE}/tree-pine.png`,
  `${BASE}/bush.png`,
  `${BASE}/rock-1.png`,
  `${BASE}/flowers.png`,
  `${BASE}/rock-2.png`,
  `${BASE}/cloud.png`,
]

export const CELEBRATION_YOU_DID_IT_PATH = `${BASE}/celebration-you-did-it.png`
export const CONFETTI_BURST_PATH = `${BASE}/confetti-burst.png`

// Extracted but not yet wired anywhere:
//  - xp-popup-banner.png ("+25 XP") — would need a client-side XP-earned
//    event to hang a transient popup off; no such event exists yet outside
//    the toast in TimerContext.
//  - blank-scroll.png — reusable generic banner backdrop, no current caller.

export function textureForNode(kind: RoadmapNodeKind, achievementKey?: string, nodeId?: string): string {
  if (kind === 'badge' && achievementKey && BADGE_ACHIEVEMENT_TEXTURE[achievementKey]) {
    return BADGE_ACHIEVEMENT_TEXTURE[achievementKey]!
  }
  if (kind === 'chest' && nodeId && CHEST_TIER_TEXTURE[nodeId]) {
    return CHEST_TIER_TEXTURE[nodeId]!
  }
  return NODE_KIND_TEXTURE[kind]
}
