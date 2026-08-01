import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'
import { missions, quizAttempts } from '@/db/schema'

const MAX_ACTIVE_MISSIONS = 3

export interface MissionView {
  id: string
  title: string
  kind: 'practice_task' | 'quiz'
  dueAt: string
  completed: boolean
}

/**
 * Fills the student's Mission slots (up to MAX_ACTIVE_MISSIONS) from real,
 * currently-assigned work on every read, rather than a scheduled job — the
 * data volumes here (a handful of tasks/quizzes per student) make that
 * cheap, and it means a Mission is only ever created at the moment it's
 * actually about to be shown, never speculatively. Per docs/04_PRD.md §E5
 * / docs/12_Gamification_Framework.md §5: never a generic daily-login
 * quest — every Mission points at one real Practice Task or Quiz the
 * student already has, and disappears silently once its due date passes.
 */
export const getMissionsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<MissionView>> => {
  const user = await requireUser()
  if (user.role !== 'student') return []

  return withRlsContext(user.id, async (tx) => {
    const now = new Date()

    const activeMissions = await tx.query.missions.findMany({
      where: (m, { eq: eqOp, and: andOp, gt: gtOp }) => andOp(eqOp(m.studentId, user.id), gtOp(m.dueAt, now)),
      orderBy: (m, { asc }) => asc(m.dueAt),
    })

    const slotsRemaining = MAX_ACTIVE_MISSIONS - activeMissions.length
    const newlyCreated: Array<typeof missions.$inferSelect> = []

    if (slotsRemaining > 0) {
      const referencedTaskIds = activeMissions.map((m) => m.taskId).filter((id): id is string => id !== null)
      const referencedQuizIds = activeMissions.map((m) => m.quizId).filter((id): id is string => id !== null)

      const candidateTasks = await tx.query.tasks.findMany({
        where: (t, { eq: eqOp, and: andOp, isNotNull: isNotNullOp, gt: gtOp, notInArray }) =>
          andOp(
            eqOp(t.userId, user.id),
            eqOp(t.taskType, 'practice'),
            eqOp(t.completed, false),
            isNotNullOp(t.dueDate),
            gtOp(t.dueDate, now),
            referencedTaskIds.length > 0 ? notInArray(t.id, referencedTaskIds) : undefined,
          ),
        orderBy: (t, { asc }) => asc(t.dueDate),
      })

      const enrollments = await tx.query.enrollments.findMany({
        where: (e, { eq: eqOp, and: andOp }) => andOp(eqOp(e.studentId, user.id), eqOp(e.status, 'active')),
      })
      const classIds = enrollments.map((e) => e.classId)

      const candidateQuizzesRaw =
        classIds.length === 0
          ? []
          : await tx.query.quizzes.findMany({
              where: (q, { eq: eqOp, and: andOp, isNotNull: isNotNullOp, gt: gtOp, inArray: inArrayOp, notInArray }) =>
                andOp(
                  inArrayOp(q.classId, classIds),
                  eqOp(q.isPublished, true),
                  isNotNullOp(q.dueDate),
                  gtOp(q.dueDate, now),
                  referencedQuizIds.length > 0 ? notInArray(q.id, referencedQuizIds) : undefined,
                ),
              orderBy: (q, { asc }) => asc(q.dueDate),
            })

      const attemptedQuizIds =
        candidateQuizzesRaw.length === 0
          ? new Set<string>()
          : new Set(
              (
                await tx
                  .select({ quizId: quizAttempts.quizId })
                  .from(quizAttempts)
                  .where(
                    and(
                      eq(quizAttempts.studentId, user.id),
                      isNotNull(quizAttempts.submittedAt),
                      inArray(
                        quizAttempts.quizId,
                        candidateQuizzesRaw.map((q) => q.id),
                      ),
                    ),
                  )
              ).map((row) => row.quizId),
            )
      const candidateQuizzes = candidateQuizzesRaw.filter((q) => !attemptedQuizIds.has(q.id))

      const candidates: Array<{ title: string; dueAt: Date; taskId?: string; quizId?: string }> = [
        ...candidateTasks.map((t) => ({ title: `Complete "${t.title}"`, dueAt: t.dueDate!, taskId: t.id })),
        ...candidateQuizzes.map((q) => ({ title: `Take the "${q.title}" quiz`, dueAt: q.dueDate!, quizId: q.id })),
      ].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())

      const toCreate = candidates.slice(0, slotsRemaining)
      if (toCreate.length > 0) {
        const inserted = await tx
          .insert(missions)
          .values(
            toCreate.map((c) => ({
              studentId: user.id,
              title: c.title,
              taskId: c.taskId ?? null,
              quizId: c.quizId ?? null,
              dueAt: c.dueAt,
            })),
          )
          .returning()
        newlyCreated.push(...inserted)
      }
    }

    const allMissions = [...activeMissions, ...newlyCreated]
    if (allMissions.length === 0) return []

    const taskIds = allMissions.map((m) => m.taskId).filter((id): id is string => id !== null)
    const quizIds = allMissions.map((m) => m.quizId).filter((id): id is string => id !== null)

    const [completedTaskRows, submittedAttemptRows] = await Promise.all([
      taskIds.length === 0
        ? []
        : tx.query.tasks.findMany({
            where: (t, { inArray: inArrayOp, eq: eqOp, and: andOp }) => andOp(inArrayOp(t.id, taskIds), eqOp(t.completed, true)),
          }),
      quizIds.length === 0
        ? []
        : tx
            .select({ quizId: quizAttempts.quizId })
            .from(quizAttempts)
            .where(and(eq(quizAttempts.studentId, user.id), isNotNull(quizAttempts.submittedAt), inArray(quizAttempts.quizId, quizIds))),
    ])
    const completedTaskIds = new Set(completedTaskRows.map((t) => t.id))
    const completedQuizIds = new Set(submittedAttemptRows.map((r) => r.quizId))

    return allMissions
      .map((m) => ({
        id: m.id,
        title: m.title,
        kind: (m.taskId ? 'practice_task' : 'quiz') as MissionView['kind'],
        dueAt: m.dueAt.toISOString(),
        completed: m.taskId ? completedTaskIds.has(m.taskId) : completedQuizIds.has(m.quizId!),
      }))
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  })
})

export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: () => getMissionsFn() })
}
