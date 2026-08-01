import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eq } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { distractionEvents, focusSessions, type FocusSession } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { checkAndUnlockAchievements } from '@/features/achievements/services/achievement.service'
import { completeFocusSessionSchema, logDistractionSchema, startFocusSessionSchema } from '@/features/auth/validators'

export const startFocusSessionFn = createServerFn({ method: 'POST' })
  .validator(startFocusSessionSchema)
  .handler(async ({ data }): Promise<FocusSession> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      // Re-verify task ownership server-side rather than trusting the client
      // id as-is — otherwise a student could point a session at someone
      // else's assignment task and inflate that student's apparent focus time
      // in the teacher-visible insights.
      let taskId: string | null = null
      if (data.taskId) {
        const task = await tx.query.tasks.findFirst({
          where: (t, { eq: eqOp, and: andOp }) => andOp(eqOp(t.id, data.taskId!), eqOp(t.userId, user.id)),
        })
        taskId = task?.id ?? null
      }

      const [session] = await tx
        .insert(focusSessions)
        .values({ userId: user.id, durationMinutes: data.durationMinutes, taskId, commitment: data.commitment })
        .returning()
      return session
    })
  })

export const completeFocusSessionFn = createServerFn({ method: 'POST' })
  .validator(completeFocusSessionSchema)
  .handler(async ({ data }): Promise<{ session: FocusSession; unlockedAchievements: Array<string> }> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [session] = await tx
        .update(focusSessions)
        .set({ completedAt: new Date(), wasSuccessful: true, commitmentMet: data.commitmentMet })
        .where(eq(focusSessions.id, data.id))
        .returning()
      const unlockedAchievements = await checkAndUnlockAchievements(tx, user.id)
      return { session, unlockedAchievements }
    })
  })

export const abandonFocusSessionFn = createServerFn({ method: 'POST' })
  .validator(completeFocusSessionSchema)
  .handler(async ({ data }): Promise<FocusSession> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [session] = await tx
        .update(focusSessions)
        .set({ completedAt: new Date(), wasSuccessful: false })
        .where(eq(focusSessions.id, data.id))
        .returning()
      return session
    })
  })

export const logDistractionFn = createServerFn({ method: 'POST' })
  .validator(logDistractionSchema)
  .handler(async ({ data }): Promise<{ success: true }> => {
    const user = await requireUser()
    await withRlsContext(user.id, (tx) =>
      tx.insert(distractionEvents).values({
        userId: user.id,
        focusSessionId: data.focusSessionId,
        durationSeconds: data.durationSeconds,
      }),
    )
    return { success: true }
  })

export function useFocusSession() {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: (input: { durationMinutes: number; taskId?: string | null; commitment: string }) => startFocusSessionFn({ data: input }),
  })

  const completeMutation = useMutation({
    mutationFn: (input: { id: string; commitmentMet?: boolean }) => completeFocusSessionFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['progress'] })
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
    },
  })

  const abandonMutation = useMutation({
    mutationFn: (id: string) => abandonFocusSessionFn({ data: { id } }),
  })

  const logDistractionMutation = useMutation({
    mutationFn: (input: { focusSessionId: string; durationSeconds: number }) => logDistractionFn({ data: input }),
  })

  return {
    startSession: startMutation.mutateAsync,
    completeSession: completeMutation.mutateAsync,
    abandonSession: abandonMutation.mutateAsync,
    logDistraction: logDistractionMutation.mutateAsync,
  }
}
