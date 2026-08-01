import { eq } from 'drizzle-orm'
import type { Tx } from '@/db'
import { focusSessions, xpLedger, type FocusSession } from '@/db/schema'
import { checkAndUnlockAchievements } from '@/features/achievements/services/achievement.service'

const XP_PER_10_MINUTES = 2

/**
 * The one completion path both entry points share (Sprint 4 unification):
 * useFocusSession.ts's Pomodoro completion and focusMode.ts's quiz-linked
 * completion both call this instead of maintaining two independent copies
 * of the XP/achievement logic. XP is derived from whatever durationMinutes
 * ends up on the row after this update — the Pomodoro path already has the
 * right value from session start, the quiz path passes a freshly-computed
 * heuristic via durationMinutesOverride. Must be called inside the caller's
 * own withRlsContext transaction, same convention as
 * checkAndUnlockAchievements.
 */
export async function completeFocusSession(
  tx: Tx,
  params: {
    sessionId: string
    userId: string
    commitmentMet?: boolean
    durationMinutesOverride?: number
    verified?: boolean
  },
): Promise<{ session: FocusSession; xpAwarded: number; unlockedAchievements: Array<string> }> {
  const updateValues: Partial<typeof focusSessions.$inferInsert> = { completedAt: new Date(), wasSuccessful: true }
  if (params.commitmentMet !== undefined) updateValues.commitmentMet = params.commitmentMet
  if (params.verified !== undefined) updateValues.verified = params.verified
  if (params.durationMinutesOverride !== undefined) updateValues.durationMinutes = params.durationMinutesOverride

  const [session] = await tx.update(focusSessions).set(updateValues).where(eq(focusSessions.id, params.sessionId)).returning()
  if (!session) throw new Error('Focus session not found')

  const xpAwarded = Math.floor(session.durationMinutes / 10) * XP_PER_10_MINUTES
  if (xpAwarded > 0) {
    await tx.insert(xpLedger).values({
      userId: params.userId,
      amount: xpAwarded,
      source: 'focus_session',
      metadata: { sessionId: session.id, durationMinutes: session.durationMinutes },
    })
  }

  const unlockedAchievements = await checkAndUnlockAchievements(tx, params.userId)

  return { session, xpAwarded, unlockedAchievements }
}
