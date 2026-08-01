import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { gte } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'
import { computeStreaks, toDateKey } from '@/features/progress/streaks'
import {
  averageDelayMinutes,
  computeDailyStartDelays,
  computeTaskLatency,
  earliestPerDay,
  isProcrastinationReduced,
  type DailyStartDelay,
} from '../metrics'

const WINDOW_DAYS = 30

export interface ProcrastinationMetrics {
  dailyStartDelay: Array<DailyStartDelay>
  averageStartDelayMinutes: number | null
  procrastinationReduced: boolean
  taskLatency: { averageLatencyHours: number | null; count: number }
  consistency: { current: number; longest: number; days: Array<{ date: string; hasSession: boolean }> }
}

export const getProcrastinationMetricsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProcrastinationMetrics> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000)

      const [logins, sessions, taskRows] = await Promise.all([
        tx.query.loginEvents.findMany({
          where: (le, { eq: eqOp, and: andOp }) => andOp(eqOp(le.userId, user.id), gte(le.loginAt, windowStart)),
        }),
        tx.query.focusSessions.findMany({
          where: (fs, { eq: eqOp, and: andOp }) => andOp(eqOp(fs.userId, user.id), gte(fs.startedAt, windowStart)),
        }),
        tx.query.tasks.findMany({
          where: (t, { eq: eqOp, and: andOp }) => andOp(eqOp(t.userId, user.id), gte(t.createdAt, windowStart)),
        }),
      ])

      const days: Array<string> = []
      for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
        days.push(toDateKey(new Date(Date.now() - i * 86_400_000)))
      }

      const loginsByDay = earliestPerDay(logins.map((l) => l.loginAt))
      const sessionsByDay = earliestPerDay(sessions.map((s) => s.startedAt))
      const dailyStartDelay = computeDailyStartDelays(loginsByDay, sessionsByDay, days)

      const taskLatency = computeTaskLatency(taskRows.map((t) => ({ createdAt: t.createdAt, completedAt: t.completedAt })))

      const sessionDaySet = new Set(sessionsByDay.keys())
      const { current, longest } = computeStreaks(sessionDaySet)
      const consistency = {
        current,
        longest,
        days: days.map((date) => ({ date, hasSession: sessionDaySet.has(date) })),
      }

      return {
        dailyStartDelay,
        averageStartDelayMinutes: averageDelayMinutes(dailyStartDelay),
        procrastinationReduced: isProcrastinationReduced(dailyStartDelay),
        taskLatency,
        consistency,
      }
    })
  },
)

export function useProcrastinationMetrics() {
  return useQuery({ queryKey: ['procrastination', 'metrics'], queryFn: () => getProcrastinationMetricsFn() })
}
