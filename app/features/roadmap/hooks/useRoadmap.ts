import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { eq, sql } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'
import { xpLedger } from '@/db/schema'
import { useProgress } from '@/features/progress/hooks/useProgress'
import { useAchievements } from '@/features/achievements/hooks/useAchievements'
import { computeRoadmapState, type RoadmapState } from '../nodes'

export const getTotalXpFn = createServerFn({ method: 'GET' }).handler(async (): Promise<number> => {
  const user = await requireUser()
  return withRlsContext(user.id, async (tx) => {
    const [row] = await tx
      .select({ total: sql<string>`coalesce(sum(${xpLedger.amount}), 0)` })
      .from(xpLedger)
      .where(eq(xpLedger.userId, user.id))
    return Number(row?.total ?? 0)
  })
})

function useTotalXp() {
  return useQuery({ queryKey: ['roadmap', 'totalXp'], queryFn: () => getTotalXpFn() })
}

interface UseRoadmapResult {
  isLoading: boolean
  totalXp: number
  currentStreak: number
  longestStreak: number
  roadmap: RoadmapState | null
}

/**
 * Combines the roadmap's one new query (totalXp) with data the app already
 * computes elsewhere (streak via useProgress, unlocked badges via
 * useAchievements) rather than re-deriving either — the roadmap is a view
 * over existing progress state, not a second source of truth for it.
 */
export function useRoadmap(): UseRoadmapResult {
  const xpQuery = useTotalXp()
  const progressQuery = useProgress()
  const achievementsQuery = useAchievements()

  const isLoading = xpQuery.isLoading || progressQuery.isLoading || achievementsQuery.isLoading
  const totalXp = xpQuery.data ?? 0
  const currentStreak = progressQuery.data?.currentStreak ?? 0
  const longestStreak = progressQuery.data?.longestStreak ?? 0

  if (isLoading || !achievementsQuery.data) {
    return { isLoading, totalXp, currentStreak, longestStreak, roadmap: null }
  }

  const unlockedAchievementKeys = new Set(achievementsQuery.data.filter((a) => a.unlockedAt).map((a) => a.key))
  const roadmap = computeRoadmapState({ totalXp, unlockedAchievementKeys })

  return { isLoading, totalXp, currentStreak, longestStreak, roadmap }
}
