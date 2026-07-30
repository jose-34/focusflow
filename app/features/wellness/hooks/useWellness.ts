import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { withRlsContext } from '@/db'
import { wellnessLogs, type WellnessLog } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { wellnessCheckInSchema } from '@/features/auth/validators'

const wellnessQueryKey = ['wellness', 'logs'] as const

export const getRecentWellnessLogsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<WellnessLog>> => {
  const user = await requireUser()
  return withRlsContext(user.id, (tx) =>
    tx.query.wellnessLogs.findMany({
      where: (w, { eq: eqOp }) => eqOp(w.userId, user.id),
      orderBy: (w, { desc }) => desc(w.createdAt),
      limit: 7,
    }),
  )
})

export const createWellnessLogFn = createServerFn({ method: 'POST' })
  .validator(wellnessCheckInSchema)
  .handler(async ({ data }): Promise<WellnessLog> => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [log] = await tx
        .insert(wellnessLogs)
        .values({ userId: user.id, mood: data.mood, notes: data.notes?.trim() || null })
        .returning()
      return log
    })
  })

export function useWellness() {
  const queryClient = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: wellnessQueryKey,
    queryFn: () => getRecentWellnessLogsFn(),
  })

  const checkInMutation = useMutation({
    mutationFn: (input: { mood: number; notes?: string }) => createWellnessLogFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wellnessQueryKey })
    },
  })

  return {
    logs: logs ?? [],
    isLoading,
    checkIn: checkInMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
    todaysLog: (logs ?? []).find((log) => new Date(log.createdAt).toDateString() === new Date().toDateString()) ?? null,
  }
}
