import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { and, eq } from 'drizzle-orm'
import { withRlsContext } from '@/db'
import { tasks, type Task } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { checkAndUnlockAchievements } from '@/features/achievements/services/achievement.service'
import { createTaskSchema, deleteTaskSchema, toggleTaskSchema, type CreateTaskInput } from '@/features/auth/validators'

const tasksQueryKey = ['tasks'] as const

export const getTasksFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<Task>> => {
  const user = await requireUser()
  return withRlsContext(user.id, (tx) =>
    tx.query.tasks.findMany({
      where: (t, { eq: eqOp }) => eqOp(t.userId, user.id),
      orderBy: (t, { asc, desc }) => [asc(t.completed), desc(t.createdAt)],
    }),
  )
})

export const createTaskFn = createServerFn({ method: 'POST' })
  .validator(createTaskSchema)
  .handler(async ({ data }): Promise<Task> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          userId: user.id,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          priority: data.priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        })
        .returning()
      return task
    })
  })

export const toggleTaskFn = createServerFn({ method: 'POST' })
  .validator(toggleTaskSchema)
  .handler(async ({ data }): Promise<{ task: Task; unlockedAchievements: Array<string> }> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [task] = await tx
        .update(tasks)
        .set({ completed: data.completed, completedAt: data.completed ? new Date() : null })
        .where(and(eq(tasks.id, data.id), eq(tasks.userId, user.id)))
        .returning()
      // Sprint 0 error-handling standard (docs/VERSIONING.md, docs/10_API_Architecture.md):
      // an id that doesn't belong to the caller must throw, not silently no-op.
      if (!task) throw new Error('Task not found')
      const unlockedAchievements = data.completed ? await checkAndUnlockAchievements(tx, user.id) : []
      return { task, unlockedAchievements }
    })
  })

export const deleteTaskFn = createServerFn({ method: 'POST' })
  .validator(deleteTaskSchema)
  .handler(async ({ data }): Promise<{ success: true }> => {
    const user = await requireUser()
    const deleted = await withRlsContext(user.id, (tx) =>
      tx.delete(tasks).where(and(eq(tasks.id, data.id), eq(tasks.userId, user.id))).returning(),
    )
    if (deleted.length === 0) throw new Error('Task not found')
    return { success: true }
  })

export function useTasks() {
  const queryClient = useQueryClient()

  const { data: tasksList, isLoading } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => getTasksFn(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => createTaskFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) => toggleTaskFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string }) => deleteTaskFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    },
  })

  return {
    tasks: tasksList ?? [],
    isLoading,
    createTask: createMutation.mutateAsync,
    toggleTask: toggleMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
