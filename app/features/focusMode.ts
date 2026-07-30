import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { startEvents, focusSessions, focusHeartbeats, xpLedger, users } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'

const START_XP = 10
const START_TOKEN_BYTES = 24
// Anti-grinding cap (Design Review Board blocker #1): starting an assignment
// is a real, useful signal to keep tracking unconditionally — it's the flat
// per-start XP that was farmable by starting many different assignments in
// quick succession. Only the first N starts per calendar day earn XP; every
// start still creates a real start_event either way.
const MAX_XP_AWARDING_STARTS_PER_DAY = 3

const startAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  startMethod: z.enum(['web', 'extension', 'mobile']).optional(),
  clientTimestamp: z.string().optional(),
})

export const startAssignmentFn = createServerFn({ method: 'POST' })
  .validator(startAssignmentSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') throw new Error('Only students can start assignments')

    return withRlsContext(user.id, async (tx) => {
      // Basic existence check: ensure assignment exists (quiz or task)
      const assignmentExists = await tx.query.quizzes.findFirst({ where: (q, { eq: eqOp }) => eqOp(q.id, data.assignmentId) })
      if (!assignmentExists) {
        const taskExists = await tx.query.tasks.findFirst({ where: (t, { eq: eqOp }) => eqOp(t.id, data.assignmentId) })
        if (!taskExists) throw new Error('Assignment not found')
      }

      // Anti-grinding check: count today's XP-awarding starts BEFORE inserting
      // this one, so the cap is exact (not off-by-one from including this row).
      const [{ value: startsToday }] = await tx
        .select({ value: count() })
        .from(startEvents)
        .where(and(eq(startEvents.userId, user.id), gte(startEvents.startAt, sql`current_date`)))
      const xpForThisStart = startsToday < MAX_XP_AWARDING_STARTS_PER_DAY ? START_XP : 0

      // Upsert start_event: ensure idempotent start XP awarding
      const token = randomBytes(START_TOKEN_BYTES).toString('hex')
      const startMethod = data.startMethod ?? 'web'

      const insertedRows = await tx
        .insert(startEvents)
        .values({ assignmentId: data.assignmentId, userId: user.id, startMethod, startXp: xpForThisStart, startToken: token })
        .onConflictDoNothing()
        .returning()

      if (insertedRows.length > 0) {
        const inserted = insertedRows[0]
        if (xpForThisStart > 0) {
          await tx.insert(xpLedger).values({ userId: user.id, amount: xpForThisStart, source: 'start_assignment', metadata: { assignmentId: data.assignmentId, startEventId: inserted.id } })
          await tx.update(users).set({ xp: sql`${users.xp} + ${xpForThisStart}` }).where(eq(users.id, user.id))
        }

        return {
          startEventId: inserted.id,
          userId: user.id,
          assignmentId: data.assignmentId,
          startAt: inserted.startAt.toISOString(),
          startXPAwarded: inserted.startXp,
          startMethod,
          startToken: token,
          currentStreakDays: null,
          message: xpForThisStart > 0 ? `You earned ${xpForThisStart} XP for starting!` : 'Assignment started',
        }
      }

      const existing = await tx.query.startEvents.findFirst({ where: (s, { eq: eqOp, and: andOp }) => andOp(eqOp(s.assignmentId, data.assignmentId), eqOp(s.userId, user.id)) })
      if (!existing) throw new Error('Failed to create start event')

      return {
        startEventId: existing.id,
        userId: user.id,
        assignmentId: data.assignmentId,
        startAt: existing.startAt ? existing.startAt.toISOString() : new Date().toISOString(),
        startXPAwarded: 0,
        startMethod: existing.startMethod as any,
        startToken: existing.startToken ?? '',
        currentStreakDays: null,
        message: 'Already started',
      }
    })
  })

const reportHeartbeatSchema = z.object({
  startToken: z.string().optional(),
  startEventId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  clientHeartbeatAt: z.string(),
  clientOffsetMs: z.number().optional(),
})

export const reportFocusHeartbeatFn = createServerFn({ method: 'POST' })
  .validator(reportHeartbeatSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      // Resolve start_event either by token or id
      let startEvent: any = null
      if (data.startToken) {
              // data.startToken is narrowed by the if-check; cast to string for the DB comparison
              startEvent = await tx.query.startEvents.findFirst({ where: (s, { eq: eqOp }) => eqOp(s.startToken, data.startToken as string) })
            } else if (data.startEventId) {
              startEvent = await tx.query.startEvents.findFirst({ where: (s, { eq: eqOp }) => eqOp(s.id, data.startEventId as string) })
            }
      if (!startEvent) throw new Error('Invalid or expired start token')
      if (startEvent.userId !== user.id) throw new Error('Start token does not belong to current user')

      // Create or find focus_session for this start_event + user where completedAt IS NULL.
      // If the client provides a known sessionId, reuse it directly when it belongs to the current user.
      let session
      if (data.sessionId) {
        session = await tx.query.focusSessions.findFirst({ where: (fs, { eq: eqOp }) => eqOp(fs.id, data.sessionId as string) })
        if (!session) throw new Error('Focus session not found')
        if (session.userId !== user.id) throw new Error('Focus session does not belong to current user')
      }

      const task = await tx.query.tasks.findFirst({ where: (t, { eq: eqOp }) => eqOp(t.quizId, startEvent.assignmentId) })
      if (!session) {
        // Build the where clause conditionally to avoid passing null into eq()
        if (task && task.id) {
          session = await tx.query.focusSessions.findFirst({ where: (fs, { eq: eqOp, and: andOp }) => andOp(eqOp(fs.taskId, task.id), eqOp(fs.userId, user.id), sql`${fs.completedAt} IS NULL`) })
        } else {
          session = await tx.query.focusSessions.findFirst({ where: (fs, { eq: eqOp, and: andOp }) => andOp(eqOp(fs.userId, user.id), sql`${fs.completedAt} IS NULL`) })
        }
        if (!session) {
          const [created] = await tx.insert(focusSessions).values({
            userId: user.id,
            startedAt: new Date(),
            taskId: task?.id ?? null,
            startEventId: startEvent.id,
            assignmentId: startEvent.assignmentId,
            verified: false,
          }).returning()
          session = created
        }
      }

      // Insert heartbeat into focus_heartbeats
      const heartbeatAt = new Date(data.clientHeartbeatAt)
      await tx.insert(focusHeartbeats).values({ focusSessionId: session.id, startEventId: startEvent.id, assignmentId: startEvent.assignmentId, userId: user.id, heartbeatAt })

      // Compute approximate verified minutes (simple heuristic: count heartbeats grouped by minute)
      const heartbeats = await tx.query.focusHeartbeats.findMany({ where: (h, { eq: eqOp }) => eqOp(h.focusSessionId, session.id) })
      const hbCount = heartbeats.length
      const approxMinutes = Math.floor(hbCount / 4) // assuming ~4 heartbeats per minute

      return { accepted: true, focusSessionId: session.id, lastHeartbeatAt: new Date().toISOString(), totalVerifiedMinutes: approxMinutes, message: 'heartbeat accepted' }
    })
  })

const endSessionSchema = z.object({ sessionId: z.string().uuid() })

export const endFocusSessionFn = createServerFn({ method: 'POST' })
  .validator(endSessionSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [updated] = await tx
        .update(focusSessions)
        .set({ completedAt: new Date(), wasSuccessful: true })
        .where(eq(focusSessions.id, data.sessionId))
        .returning()
      if (!updated) throw new Error('Session not found')

      // compute duration from heartbeats or timestamps
      const heartbeats = await tx.query.focusHeartbeats.findMany({ where: (h, { eq: eqOp }) => eqOp(h.focusSessionId, updated.id) })
      const hbCount = heartbeats.length
      const approxMinutes = Math.floor(hbCount / 4)
      const durationMinutes = approxMinutes || (updated.completedAt && updated.startedAt ? Math.max(0, Math.round(((updated.completedAt as Date).getTime() - (updated.startedAt as Date).getTime()) / 60000)) : 0)
      const verified = hbCount >= 3

      await tx.update(focusSessions).set({ durationMinutes, verified }).where(eq(focusSessions.id, updated.id))

      // Award per-minute XP if desired: e.g., 2 XP per 10 minutes -> 0.2 XP per minute; for simplicity award floor(durationMinutes/10)*2
      const xpAwarded = Math.floor(durationMinutes / 10) * 2

      if (xpAwarded > 0) {
        await tx.insert(xpLedger).values({ userId: user.id, amount: xpAwarded, source: 'focus_session', metadata: { sessionId: updated.id, durationMinutes } })
        await tx.update(users).set({ xp: sql`${users.xp} + ${xpAwarded}` }).where(eq(users.id, user.id))
      }

      return { focusSessionId: updated.id, startAt: updated.startedAt, endAt: updated.completedAt ?? new Date().toISOString(), durationMinutes, verified, xpAwarded }
    })
  })

export function useFocusMode() {
  return { startAssignment: (input: any) => startAssignmentFn({ data: input }), reportHeartbeat: (input: any) => reportFocusHeartbeatFn({ data: input }), endSession: (id: string) => endFocusSessionFn({ data: { sessionId: id } }) }
}
