// Pure, dependency-free by design (mirrors app/features/progress/streaks.ts
// and app/features/roadmap/nodes.ts) — testable without a DB connection.
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Keeps only the earliest timestamp per calendar day. */
export function earliestPerDay(timestamps: Array<Date>): Map<string, Date> {
  const map = new Map<string, Date>()
  for (const ts of timestamps) {
    const key = toDateKey(ts)
    const existing = map.get(key)
    if (!existing || ts < existing) map.set(key, ts)
  }
  return map
}

export interface DailyStartDelay {
  date: string
  /** Minutes between that day's first login and first focus session. Null if either is missing that day. */
  delayMinutes: number | null
}

/**
 * One entry per day in `days` (oldest first) — a fixed calendar axis makes
 * this safe to render directly as a trend chart's x-axis without the
 * caller re-deriving which days had data.
 */
export function computeDailyStartDelays(
  loginsByDay: Map<string, Date>,
  sessionsByDay: Map<string, Date>,
  days: Array<string>,
): Array<DailyStartDelay> {
  return days.map((date) => {
    const login = loginsByDay.get(date)
    const session = sessionsByDay.get(date)
    if (!login || !session) return { date, delayMinutes: null }
    return { date, delayMinutes: Math.max(0, (session.getTime() - login.getTime()) / 60_000) }
  })
}

export function averageDelayMinutes(delays: Array<DailyStartDelay>): number | null {
  const valid = delays.map((d) => d.delayMinutes).filter((m): m is number => m !== null)
  if (valid.length === 0) return null
  return valid.reduce((sum, m) => sum + m, 0) / valid.length
}

/**
 * Compares the average delay over the most recent `windowDays` against the
 * `windowDays` immediately before that. Requires both windows to have at
 * least one real data point — an empty "prior" window would make any first
 * week of data look like a 100% reduction, which isn't a real signal.
 */
export function isProcrastinationReduced(delays: Array<DailyStartDelay>, windowDays = 7): boolean {
  const recent = averageDelayMinutes(delays.slice(-windowDays))
  const prior = averageDelayMinutes(delays.slice(-windowDays * 2, -windowDays))
  if (recent === null || prior === null || prior === 0) return false
  return (prior - recent) / prior >= 0.2
}

export interface TaskLatencyResult {
  averageLatencyHours: number | null
  count: number
}

export function computeTaskLatency(tasks: Array<{ createdAt: Date; completedAt: Date | null }>): TaskLatencyResult {
  const completed = tasks.filter((t): t is { createdAt: Date; completedAt: Date } => t.completedAt !== null)
  if (completed.length === 0) return { averageLatencyHours: null, count: 0 }
  const totalHours = completed.reduce((sum, t) => sum + (t.completedAt.getTime() - t.createdAt.getTime()) / 3_600_000, 0)
  return { averageLatencyHours: totalHours / completed.length, count: completed.length }
}
