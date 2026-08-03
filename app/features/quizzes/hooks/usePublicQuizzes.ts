import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { adminDb } from '@/db/admin'

// Anonymous-safe: landing-page visitors and logged-out demo play both hit
// this. Never routed through withRlsContext/requireUser — there's no
// session yet — so it must filter to visibility='public' AND
// isPublished=true explicitly here rather than relying on RLS to do it,
// same convention as auth.service.ts's pre-session adminDb reads.
export interface PublicQuizQuestion {
  id: string
  question: string
  choices: Array<string>
  correctIndex: number
}

export interface PublicQuizSummary {
  id: string
  title: string
  authorName: string
  curriculumCode: string
  curriculumName: string
  subjectName: string
  gradeLabel: string | null
  questions: Array<PublicQuizQuestion>
}

const getPublicQuizzesSchema = z
  .object({
    subjectName: z.string().optional(),
    gradeLabel: z.string().optional(),
  })
  .optional()

export const getPublicQuizzesFn = createServerFn({ method: 'GET' })
  .validator(getPublicQuizzesSchema)
  .handler(async ({ data }): Promise<Array<PublicQuizSummary>> => {
    const rows = await adminDb.query.quizzes.findMany({
      where: (q, { eq: eqOp, and: andOp }) => andOp(eqOp(q.visibility, 'public'), eqOp(q.isPublished, true)),
      with: {
        author: true,
        curriculum: true,
        subject: true,
        questions: { with: { choices: true } },
      },
      orderBy: (q, { desc }) => desc(q.createdAt),
    })

    return rows
      .filter((q) => q.curriculum && q.subject && q.questions.length > 0)
      .filter((q) => (data?.subjectName ? q.subject!.name === data.subjectName : true))
      .filter((q) => (data?.gradeLabel ? q.gradeLabel === data.gradeLabel : true))
      .map((q) => ({
        id: q.id,
        title: q.title,
        authorName: q.author ? `${q.author.firstName} ${q.author.lastName}` : 'FocusFlow',
        curriculumCode: q.curriculum!.code,
        curriculumName: q.curriculum!.name,
        subjectName: q.subject!.name,
        gradeLabel: q.gradeLabel,
        questions: q.questions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((question) => {
            const sortedChoices = question.choices.slice().sort((a, b) => a.position - b.position)
            return {
              id: question.id,
              question: question.questionText,
              choices: sortedChoices.map((c) => c.choiceText),
              correctIndex: Math.max(0, sortedChoices.findIndex((c) => c.isCorrect)),
            }
          }),
      }))
  })

export function usePublicQuizzes(filter?: { subjectName?: string; gradeLabel?: string }) {
  return useQuery({
    queryKey: ['quizzes', 'public', filter?.subjectName, filter?.gradeLabel],
    queryFn: () => getPublicQuizzesFn({ data: filter }),
    staleTime: 5 * 60 * 1000,
  })
}
