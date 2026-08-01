import type { Tx } from '@/db'
import { userAchievements } from '@/db/schema'
import { computeStreaks, toDateKey } from '@/features/progress/streaks'
import { ACHIEVEMENT_DEFINITIONS } from '../definitions'

/**
 * Evaluates every achievement rule for `userId` inside the caller's
 * already-RLS-scoped transaction, inserts any newly-earned ones, and
 * returns the keys that were just unlocked (so the caller can show a
 * celebration). Must be called with the same `tx` the caller already has
 * from `withRlsContext` — this function does not open its own transaction
 * or set the RLS context itself.
 */
export async function checkAndUnlockAchievements(tx: Tx, userId: string): Promise<Array<string>> {
  const [sessions, completedTasks, quizAttemptRows, existing] = await Promise.all([
    tx.query.focusSessions.findMany({
      where: (fs, { eq, and }) => and(eq(fs.userId, userId), eq(fs.wasSuccessful, true)),
    }),
    tx.query.tasks.findMany({
      where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.completed, true)),
    }),
    tx.query.quizAttempts.findMany({
      where: (a, { eq, and, isNotNull }) => and(eq(a.studentId, userId), isNotNull(a.submittedAt)),
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
  if (completedTasks.filter((t) => t.taskType === 'practice').length >= 10) toUnlock.add('practice_progress')
  if (quizAttemptRows.length >= 10) toUnlock.add('quiz_scholar')
  if (quizAttemptRows.some((a) => a.score !== null && a.maxScore > 0 && a.score === a.maxScore)) toUnlock.add('quiz_ace')

  const successDates = new Set(sessions.map((s) => toDateKey(s.startedAt)))
  const { current: streak } = computeStreaks(successDates)
  if (streak >= 3) toUnlock.add('streak_starter')
  if (streak >= 7) toUnlock.add('week_warrior')

  if (sessions.some((s) => s.startedAt.getHours() < 8)) toUnlock.add('early_bird')
  if (sessions.some((s) => s.startedAt.getHours() >= 20)) toUnlock.add('night_owl')

  const sessionsPerDay = new Map<string, number>()
  for (const s of sessions) {
    const key = toDateKey(s.startedAt)
    sessionsPerDay.set(key, (sessionsPerDay.get(key) ?? 0) + 1)
  }
  if ([...sessionsPerDay.values()].some((count) => count >= 5)) toUnlock.add('marathon')

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
