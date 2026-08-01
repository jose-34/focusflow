import type { RoadmapNodeKind } from '@/features/roadmap/nodes'

// Maps each node type (and, for badges, each specific achievement) to where
// its texture *will* live once real art is supplied. None of these files
// exist yet — JourneyMap.tsx loads them optimistically and falls back to a
// procedural placeholder shape on load failure, so the map is fully
// functional today and just gets prettier as PNGs land in
// public/roadmap-assets/. See the asset brief (dimensions, transparent PNG,
// consistent top-left lighting) from the design conversation this manifest
// came out of.
const BASE = '/roadmap-assets'

export const BACKGROUND_TEXTURE_PATH = `${BASE}/background-trail.png`

export const NODE_KIND_TEXTURE: Record<RoadmapNodeKind, string> = {
  start: `${BASE}/start-signpost.png`,
  badge: `${BASE}/badge-medallion.png`,
  chest: `${BASE}/treasure-chest.png`,
  boss: `${BASE}/boss-marker.png`,
  goal: `${BASE}/goal-castle.png`,
}

// Per-achievement badge art overrides the generic badge texture above once
// supplied — falls back to NODE_KIND_TEXTURE.badge (and, below that, the
// procedural octahedron) until each one exists.
export const BADGE_ACHIEVEMENT_TEXTURE: Partial<Record<string, string>> = {
  first_focus: `${BASE}/badge-first-focus.png`,
  streak_starter: `${BASE}/badge-streak-starter.png`,
  week_warrior: `${BASE}/badge-week-warrior.png`,
  century_club: `${BASE}/badge-century-club.png`,
  task_master: `${BASE}/badge-task-master.png`,
  early_bird: `${BASE}/badge-early-bird.png`,
  night_owl: `${BASE}/badge-night-owl.png`,
  marathon: `${BASE}/badge-marathon.png`,
}

export const AVATAR_TEXTURE_PATH = `${BASE}/avatar-walker.png`
export const SPARKLE_TEXTURE_PATH = `${BASE}/sparkle-particle.png`

export function textureForNode(kind: RoadmapNodeKind, achievementKey?: string): string {
  if (kind === 'badge' && achievementKey && BADGE_ACHIEVEMENT_TEXTURE[achievementKey]) {
    return BADGE_ACHIEVEMENT_TEXTURE[achievementKey]!
  }
  return NODE_KIND_TEXTURE[kind]
}
