import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { withRlsContext } from '@/db'
import { requireUser } from '@/features/auth/utils'

export interface CurriculumWithSubjects {
  id: string
  code: string
  name: string
  country: string | null
  subjects: Array<{ id: string; name: string }>
}

export const getCurriculaFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<CurriculumWithSubjects>> => {
  const user = await requireUser()

  return withRlsContext(user.id, async (tx) => {
    const rows = await tx.query.curricula.findMany({
      with: { subjects: true },
      orderBy: (c, { asc }) => asc(c.name),
    })
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      country: c.country,
      subjects: c.subjects
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ id: s.id, name: s.name })),
    }))
  })
})

export function useCurricula() {
  return useQuery({
    queryKey: ['curricula'],
    queryFn: () => getCurriculaFn(),
    staleTime: 60 * 60 * 1000,
  })
}
