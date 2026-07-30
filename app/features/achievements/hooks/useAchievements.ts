import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'
import { ACHIEVEMENT_DEFINITIONS } from '../definitions'

export interface AchievementStatus {
  key: string
  title: string
  description: string
  unlockedAt: string | null
}

export const getAchievementsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<AchievementStatus>> => {
  const user = await requireUser()
  const unlocked = await withRlsContext(user.id, (tx) =>
    tx.query.userAchievements.findMany({
      where: (ua, { eq }) => eq(ua.userId, user.id),
    }),
  )
  const unlockedMap = new Map(unlocked.map((row) => [row.achievementKey, row.unlockedAt]))

  return ACHIEVEMENT_DEFINITIONS.map((def) => ({
    key: def.key,
    title: def.title,
    description: def.description,
    unlockedAt: unlockedMap.get(def.key)?.toISOString() ?? null,
  }))
})

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: () => getAchievementsFn(),
  })
}
