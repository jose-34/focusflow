import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, count, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { focusSessions, focusHeartbeats, xpLedger } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { completeFocusSession } from '@/features/focus/completeFocusSession'

const START_XP = 10
// Anti-grinding cap (Design Review Board blocker #1): starting an assignment
// is a real, useful signal to keep tracking unconditionally — it's the flat
// per-start XP that was farmable by starting many different assignments in
// quick succession. Only the first N starts per calendar day earn XP; every
// start still creates a real focus_sessions row either way.
const MAX_XP_AWARDING_STARTS_PER_DAY = 3

const startAssignmentSchema = z.object({
  quizId: z.string().uuid(),
  startMethod: z.enum(['web', 'extension', 'mobile']).optional(),
})

export const startAssignmentFn = createServerFn({ method: 'POST' })
  .validator(startAssignmentSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') throw new Error('Only students can start assignments')

    return withRlsContext(user.id, async (tx) => {
      const quiz = await tx.query.quizzes.findFirst({ where: (q, { eq: eqOp }) => eqOp(q.id, data.quizId) })
      if (!quiz) throw new Error('Assignment not found')

      // Sprint 4: the row is created here, immediately — not deferred to the
      // first heartbeat like the old start_events -> focus_sessions two-step.
      // Resolve the linked task at the same time, same lookup the old
      // heartbeat handler used to do on every call.
      const task = await tx.query.tasks.findFirst({ where: (t, { eq: eqOp }) => eqOp(t.quizId, data.quizId) })

      // Anti-grinding check: count today's XP-awarding assignment starts
      // BEFORE inserting this one, so the cap is exact (not off-by-one from
      // including this row). Only quiz-linked sessions count — a Pomodoro
      // session has no assignment-start signal to grind.
      const [{ value: startsToday }] = await tx
        .select({ value: count() })
        .from(focusSessions)
        .where(and(eq(focusSessions.userId, user.id), isNotNull(focusSessions.quizId), gte(focusSessions.startedAt, sql`current_date`)))
      const xpForThisStart = startsToday < MAX_XP_AWARDING_STARTS_PER_DAY ? START_XP : 0
      const startMethod = data.startMethod ?? 'web'

      const insertedRows = await tx
        .insert(focusSessions)
        .values({
          userId: user.id,
          quizId: data.quizId,
          taskId: task?.id ?? null,
          startedAt: new Date(),
          startMethod,
          startXpAwarded: xpForThisStart,
          durationMinutes: 0, // unknown until endFocusSessionFn computes it from heartbeats
        })
        .onConflictDoNothing({ target: [focusSessions.quizId, focusSessions.userId] })
        .returning()

      if (insertedRows.length > 0) {
        const inserted = insertedRows[0]
        if (xpForThisStart > 0) {
          await tx.insert(xpLedger).values({ userId: user.id, amount: xpForThisStart, source: 'start_assignment', metadata: { quizId: data.quizId, sessionId: inserted.id } })
        }

        return {
          sessionId: inserted.id,
          startAt: inserted.startedAt.toISOString(),
          startXPAwarded: xpForThisStart,
          message: xpForThisStart > 0 ? `You earned ${xpForThisStart} XP for starting!` : 'Assignment started',
        }
      }

      // Already started (unique index conflict) — return the existing row.
      const existing = await tx.query.focusSessions.findFirst({
        where: (fs, { eq: eqOp, and: andOp }) => andOp(eqOp(fs.quizId, data.quizId), eqOp(fs.userId, user.id)),
      })
      if (!existing) throw new Error('Failed to create focus session')

      return {
        sessionId: existing.id,
        startAt: existing.startedAt.toISOString(),
        startXPAwarded: 0,
        message: 'Already started',
      }
    })
  })

const reportHeartbeatSchema = z.object({
  sessionId: z.string().uuid(),
  clientHeartbeatAt: z.string(),
})

export const reportFocusHeartbeatFn = createServerFn({ method: 'POST' })
  .validator(reportHeartbeatSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      // RLS (focus_sessions_self_access) already scopes this to the current
      // user's own rows — a sessionId the caller doesn't own simply won't
      // resolve, no separate ownership check needed.
      const session = await tx.query.focusSessions.findFirst({ where: (fs, { eq: eqOp }) => eqOp(fs.id, data.sessionId) })
      if (!session) throw new Error('Focus session not found')

      const heartbeatAt = new Date(data.clientHeartbeatAt)
      await tx.insert(focusHeartbeats).values({ focusSessionId: session.id, userId: user.id, heartbeatAt })

      // Compute approximate verified minutes (simple heuristic: count heartbeats grouped by minute)
      const heartbeats = await tx.query.focusHeartbeats.findMany({ where: (h, { eq: eqOp }) => eqOp(h.focusSessionId, session.id) })
      const hbCount = heartbeats.length
      const approxMinutes = Math.floor(hbCount / 4) // assuming ~4 heartbeats per minute

      return { accepted: true, focusSessionId: session.id, lastHeartbeatAt: new Date().toISOString(), totalVerifiedMinutes: approxMinutes }
    })
  })

const endSessionSchema = z.object({ sessionId: z.string().uuid() })

export const endFocusSessionFn = createServerFn({ method: 'POST' })
  .validator(endSessionSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const heartbeats = await tx.query.focusHeartbeats.findMany({ where: (h, { eq: eqOp }) => eqOp(h.focusSessionId, data.sessionId) })
      const hbCount = heartbeats.length
      const approxMinutes = Math.floor(hbCount / 4)
      const session = await tx.query.focusSessions.findFirst({ where: (fs, { eq: eqOp }) => eqOp(fs.id, data.sessionId) })
      if (!session) throw new Error('Session not found')
      const durationMinutes = approxMinutes || Math.max(0, Math.round((Date.now() - session.startedAt.getTime()) / 60000))
      const verified = hbCount >= 3

      const { session: updated, xpAwarded, unlockedAchievements } = await completeFocusSession(tx, {
        sessionId: data.sessionId,
        userId: user.id,
        durationMinutesOverride: durationMinutes,
        verified,
      })

      return {
        focusSessionId: updated.id,
        startAt: updated.startedAt,
        endAt: updated.completedAt ?? new Date().toISOString(),
        durationMinutes,
        verified,
        xpAwarded,
        unlockedAchievements,
      }
    })
  })
