import type { Tx } from '@/db'
import { userAchievements } from '@/db/schema'
import { ACHIEVEMENT_DEFINITIONS } from '../definitions'

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function computeCurrentStreak(successDates: Set<string>): number {
  if (successDates.size === 0) return 0

  const today = toDateKey(new Date())
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000))
  let anchor: string | null = null
  if (successDates.has(today)) anchor = today
  else if (successDates.has(yesterday)) anchor = yesterday
  if (!anchor) return 0

  let current = 0
  let cursor = new Date(anchor)
  while (successDates.has(toDateKey(cursor))) {
    current += 1
    cursor = new Date(cursor.getTime() - 86_400_000)
  }
  return current
}

/**
 * Evaluates every achievement rule for `userId` inside the caller's
 * already-RLS-scoped transaction, inserts any newly-earned ones, and
 * returns the keys that were just unlocked (so the caller can show a
 * celebration). Must be called with the same `tx` the caller already has
 * from `withRlsContext` — this function does not open its own transaction
 * or set the RLS context itself.
 */
export async function checkAndUnlockAchievements(tx: Tx, userId: string): Promise<Array<string>> {
  const [sessions, completedTasks, existing] = await Promise.all([
    tx.query.focusSessions.findMany({
      where: (fs, { eq, and }) => and(eq(fs.userId, userId), eq(fs.wasSuccessful, true)),
    }),
    tx.query.tasks.findMany({
      where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.completed, true)),
    }),
    tx.query.userAchievements.findMany({
      where: (ua, { eq }) => eq(ua.userId, userId),
    }),
  ])

  const existingKeys = new Set(existing.map((row) => row.achievementKey))
  const toUnlock = new Set<string>()

  if (sessions.length >= 1) toUnlock.add('first_focus')
  if (sessions.length >= 100) toUnlock.add('century_club')
  if (completedTasks.length >= 50) toUnlock.add('task_master')

  const successDates = new Set(sessions.map((s) => toDateKey(s.startedAt)))
  const streak = computeCurrentStreak(successDates)
  if (streak >= 3) toUnlock.add('streak_starter')
  if (streak >= 7) toUnlock.add('week_warrior')

  if (sessions.some((s) => s.startedAt.getHours() < 8)) toUnlock.add('early_bird')

  const newlyUnlocked = [...toUnlock].filter(
    (key) => !existingKeys.has(key) && ACHIEVEMENT_DEFINITIONS.some((def) => def.key === key),
  )

  if (newlyUnlocked.length > 0) {
    await tx
      .insert(userAchievements)
      .values(newlyUnlocked.map((achievementKey) => ({ userId, achievementKey })))
      .onConflictDoNothing()
  }

  return newlyUnlocked
}
