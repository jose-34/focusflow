import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { gte } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'
import { computeStreaks, toDateKey } from '../streaks'

const DAYS_IN_CHART = 14

interface ProgressData {
  dailyMinutes: Array<{ date: string; minutes: number }>
  todayMinutes: number
  weekMinutes: number
  currentStreak: number
  longestStreak: number
  tasksCompletedThisWeek: number
}

export const getProgressDataFn = createServerFn({ method: 'GET' }).handler(async (): Promise<ProgressData> => {
  const user = await requireUser()
  return withRlsContext(user.id, async (tx) => {
    const windowStart = new Date(Date.now() - DAYS_IN_CHART * 86_400_000)

    const sessions = await tx.query.focusSessions.findMany({
      where: (fs, { eq: eqOp, and: andOp }) => andOp(eqOp(fs.userId, user.id), eqOp(fs.wasSuccessful, true), gte(fs.startedAt, windowStart)),
    })

    const minutesByDay = new Map<string, number>()
    for (const session of sessions) {
      const key = toDateKey(session.startedAt)
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.durationMinutes)
    }

    const dailyMinutes: Array<{ date: string; minutes: number }> = []
    for (let i = DAYS_IN_CHART - 1; i >= 0; i--) {
      const date = toDateKey(new Date(Date.now() - i * 86_400_000))
      dailyMinutes.push({ date, minutes: minutesByDay.get(date) ?? 0 })
    }

    const today = toDateKey(new Date())
    const todayMinutes = minutesByDay.get(today) ?? 0

    const weekAgo = new Date(Date.now() - 7 * 86_400_000)
    const weekMinutes = sessions
      .filter((s) => s.startedAt >= weekAgo)
      .reduce((sum, s) => sum + s.durationMinutes, 0)

    const { current, longest } = computeStreaks(new Set(minutesByDay.keys()))

    const completedTasks = await tx.query.tasks.findMany({
      where: (t, { eq: eqOp, and: andOp }) => andOp(eqOp(t.userId, user.id), eqOp(t.completed, true)),
    })
    const tasksCompletedThisWeek = completedTasks.filter((t) => t.completedAt && t.completedAt >= weekAgo).length

    return {
      dailyMinutes,
      todayMinutes,
      weekMinutes,
      currentStreak: current,
      longestStreak: longest,
      tasksCompletedThisWeek,
    }
  })
})

export function useProgress() {
  return useQuery({
    queryKey: ['progress'],
    queryFn: () => getProgressDataFn(),
  })
}
