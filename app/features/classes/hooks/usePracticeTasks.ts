import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { taskTemplates, tasks } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { classIdSchema, createPracticeTaskSchema, taskTemplateIdSchema } from '@/features/classes/schemas'

export interface PracticeTaskSummary {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  createdAt: string
  totalStudents: number
  completedCount: number
}

// [C2](../../../docs/04_Product_Requirements_Document.md#c2-practice-task-assignment):
// one task_templates row, fanned out to one `tasks` row per *actively*
// enrolled student at assignment time — a student who joins later never
// retroactively receives it, since the fan-out only runs once, here.
export const createPracticeTaskFn = createServerFn({ method: 'POST' })
  .validator(createPracticeTaskSchema)
  .handler(async ({ data }): Promise<PracticeTaskSummary> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can assign practice tasks')
    }

    return withRlsContext(user.id, async (tx) => {
      const [template] = await tx
        .insert(taskTemplates)
        .values({
          classId: data.classId,
          teacherId: user.id,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        })
        .returning()

      const activeEnrollments = await tx.query.enrollments.findMany({
        where: (e, { eq: eqOp, and: andOp }) => andOp(eqOp(e.classId, data.classId), eqOp(e.status, 'active')),
      })

      if (activeEnrollments.length > 0) {
        await tx.insert(tasks).values(
          activeEnrollments.map((enrollment) => ({
            userId: enrollment.studentId,
            title: template.title,
            description: template.description,
            dueDate: template.dueDate,
            taskType: 'practice' as const,
            templateId: template.id,
            classId: data.classId,
          })),
        )
      }

      return {
        id: template.id,
        title: template.title,
        description: template.description,
        dueDate: template.dueDate ? template.dueDate.toISOString() : null,
        createdAt: template.createdAt.toISOString(),
        totalStudents: activeEnrollments.length,
        completedCount: 0,
      }
    })
  })

export const getPracticeTasksForClassFn = createServerFn({ method: 'POST' })
  .validator(classIdSchema)
  .handler(async ({ data }): Promise<Array<PracticeTaskSummary>> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can view practice task assignments')
    }

    return withRlsContext(user.id, async (tx) => {
      const templates = await tx.query.taskTemplates.findMany({
        where: (t, { eq: eqOp }) => eqOp(t.classId, data.classId),
        with: { tasks: true },
        orderBy: (t, { desc }) => desc(t.createdAt),
      })

      return templates.map((template) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        dueDate: template.dueDate ? template.dueDate.toISOString() : null,
        createdAt: template.createdAt.toISOString(),
        totalStudents: template.tasks.length,
        completedCount: template.tasks.filter((t) => t.completed).length,
      }))
    })
  })

// Deleting a template cascades to every task it fanned out (templateId's
// FK is `onDelete: 'cascade'`) — a single delete removes the assignment
// from every student's list at once, by design, not a client-side loop.
export const deletePracticeTaskFn = createServerFn({ method: 'POST' })
  .validator(taskTemplateIdSchema)
  .handler(async ({ data }): Promise<{ success: true }> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can delete a practice task assignment')
    }

    return withRlsContext(user.id, async (tx) => {
      const deleted = await tx.delete(taskTemplates).where(eq(taskTemplates.id, data.templateId)).returning()
      if (deleted.length === 0) throw new Error('Practice task not found')
      return { success: true }
    })
  })

export function usePracticeTasks(classId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['practice-tasks', classId] as const

  const { data: practiceTasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => getPracticeTasksForClassFn({ data: { classId } }),
  })

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description?: string; dueDate?: string }) =>
      createPracticeTaskFn({ data: { classId, ...input } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => deletePracticeTaskFn({ data: { templateId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    practiceTasks: practiceTasks ?? [],
    isLoading,
    createPracticeTask: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deletePracticeTask: deleteMutation.mutateAsync,
  }
}
