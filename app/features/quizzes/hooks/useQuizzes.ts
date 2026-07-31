import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq } from 'drizzle-orm'
import type { Tx } from '@/db'
import { withRlsContext } from '@/db'
import { quizAnswers, quizAttempts, quizChoices, quizQuestions, quizzes, tasks } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { createQuestionSchema, createQuizSchema, questionIdSchema, quizIdSchema, submitQuizSchema, togglePublishSchema } from '@/features/auth/validators'
import { classIdSchema } from '@/features/classes/schemas'
import { computeRiskScore } from '../riskScore'

export interface ClassQuizSummary {
  id: string
  title: string
  isPublished: boolean
  dueDate?: string | null
  questionCount?: number
  attempted?: boolean
  score?: number | null
  maxScore?: number | null
}

export const getClassQuizzesFn = createServerFn({ method: 'POST' })
  .validator(classIdSchema)
  .handler(async ({ data }): Promise<Array<ClassQuizSummary>> => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      if (user.role === 'teacher') {
        const quizList = await tx.query.quizzes.findMany({
          where: (q, { eq: eqOp }) => eqOp(q.classId, data.classId),
          with: { questions: true },
          orderBy: (q, { desc }) => desc(q.createdAt),
        })
        return quizList.map((q) => ({
          id: q.id,
          title: q.title,
          isPublished: q.isPublished,
          dueDate: q.dueDate ? q.dueDate.toISOString() : null,
          questionCount: q.questions.length,
        }))
      }

      const quizList = await tx.query.quizzes.findMany({
        where: (q, { eq: eqOp, and: andOp }) => andOp(eqOp(q.classId, data.classId), eqOp(q.isPublished, true)),
        orderBy: (q, { desc }) => desc(q.createdAt),
      })

      for (const quiz of quizList) {
        await ensureAssignmentTask(tx, user.id, quiz)
      }

      const myAttempts = await tx.query.quizAttempts.findMany({
        where: (a, { eq: eqOp }) => eqOp(a.studentId, user.id),
      })
      const attemptByQuiz = new Map(myAttempts.map((a) => [a.quizId, a]))

      return quizList.map((q) => {
        const attempt = attemptByQuiz.get(q.id)
        return {
          id: q.id,
          title: q.title,
          isPublished: true,
          dueDate: q.dueDate ? q.dueDate.toISOString() : null,
          attempted: !!attempt?.submittedAt,
          score: attempt?.score ?? null,
          maxScore: attempt?.maxScore ?? null,
        }
      })
    })
  })

// Turns a due-dated published quiz into a real task the moment a student can
// see it � idempotent (checked by quizId+studentId) so it's safe to call from
// every student-facing quiz-read path. quizId is never client-settable on the
// regular create-task path, so this is the only way a task's quizId gets set,
// which keeps it a trustworthy signal for the teacher-visible assignment view.
async function ensureAssignmentTask(tx: Tx, studentId: string, quiz: { id: string; title: string; dueDate: Date | null }) {
  if (!quiz.dueDate) return
  const existing = await tx.query.tasks.findFirst({
    where: (t, { eq: eqOp, and: andOp }) => andOp(eqOp(t.userId, studentId), eqOp(t.quizId, quiz.id)),
  })
  if (existing) return
  await tx.insert(tasks).values({
    userId: studentId,
    title: `Quiz: ${quiz.title}`,
    quizId: quiz.id,
    dueDate: quiz.dueDate,
    priority: 'medium',
  })
}

export const createQuizFn = createServerFn({ method: 'POST' })
  .validator(createQuizSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can create quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: data.classId,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          timeLimitMinutes: data.timeLimitMinutes ?? null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        })
        .returning()
      return quiz
    })
  })

export const addQuestionFn = createServerFn({ method: 'POST' })
  .validator(createQuestionSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can add questions')
    }

    return withRlsContext(user.id, async (tx) => {
      const existing = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, data.quizId),
      })
      const [question] = await tx
        .insert(quizQuestions)
        .values({
          quizId: data.quizId,
          questionText: data.questionText.trim(),
          questionType: data.questionType,
          points: data.points,
          position: existing.length,
        })
        .returning()

      await tx.insert(quizChoices).values(
        data.choices.map((choice, index) => ({
          questionId: question.id,
          choiceText: choice.choiceText.trim(),
          isCorrect: choice.isCorrect,
          position: index,
        })),
      )

      return question
    })
  })

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .validator(questionIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can delete questions')
    }

    return withRlsContext(user.id, async (tx) => {
      await tx.delete(quizQuestions).where(eq(quizQuestions.id, data.questionId))
      return { success: true }
    })
  })

export const togglePublishFn = createServerFn({ method: 'POST' })
  .validator(togglePublishSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can publish quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .update(quizzes)
        .set({ isPublished: data.isPublished, updatedAt: new Date() })
        .where(eq(quizzes.id, data.quizId))
        .returning()
      if (!quiz) throw new Error('Quiz not found')
      return quiz
    })
  })

export interface QuizAuthoringChoice {
  id: string
  choiceText: string
  isCorrect: boolean
}

export interface QuizAuthoringQuestion {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false'
  points: number
  choices: Array<QuizAuthoringChoice>
}

export interface QuizAuthoringDetail {
  id: string
  classId: string
  title: string
  description: string | null
  isPublished: boolean
  timeLimitMinutes: number | null
  dueDate: string | null
  questions: Array<QuizAuthoringQuestion>
  attempts: Array<{
    id: string
    studentName: string
    score: number | null
    maxScore: number
    submittedAt: string | null
  }>
}

export const getQuizAuthoringFn = createServerFn({ method: 'POST' })
  .validator(quizIdSchema)
  .handler(async ({ data }): Promise<QuizAuthoringDetail> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can manage quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const quiz = await tx.query.quizzes.findFirst({
        where: (q, { eq: eqOp }) => eqOp(q.id, data.quizId),
      })
      if (!quiz) throw new Error('Quiz not found')

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, data.quizId),
        with: { choices: true },
        orderBy: (q, { asc }) => asc(q.position),
      })

      const attempts = await tx.query.quizAttempts.findMany({
        where: (a, { eq: eqOp }) => eqOp(a.quizId, data.quizId),
        with: { student: true },
      })

      return {
        id: quiz.id,
        classId: quiz.classId,
        title: quiz.title,
        description: quiz.description,
        isPublished: quiz.isPublished,
        timeLimitMinutes: quiz.timeLimitMinutes,
        dueDate: quiz.dueDate ? quiz.dueDate.toISOString() : null,
        questions: questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          choices: q.choices
            .sort((a, b) => a.position - b.position)
            .map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })),
        })),
        attempts: attempts.map((a) => ({
          id: a.id,
          studentName: `${a.student.firstName} ${a.student.lastName}`,
          score: a.score,
          maxScore: a.maxScore,
          submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
        })),
      }
    })
  })

export interface AssignmentInsightsResponse {
  assignmentId: string
  classId: string
  computedAt: string
  metrics: {
    avgTimeToStartHours: number | null
    medianTimeToStartHours: number | null
    percentStartedWithin24h: number
    percentStartedWithin72h: number
    percentCompletedEarly24h: number
    lastMinuteCompletionRate: number
    averageFocusMinutesPerStudent: number
  }
  insights: Array<{
    studentId: string
    studentName: string
    startedAt: string | null
    attemptStartedAt: string | null
    submittedAt: string | null
    score: number | null
    maxScore: number | null
    focusSessionCount: number
    totalFocusMinutes: number
    hoursBeforeDeadline: number | null
    procrastinationFlag: boolean
    riskScore: number
  }>
  atRiskStudents: Array<{ studentId: string; studentName: string; riskReason: string }>
}

export const getAssignmentInsightsFn = createServerFn({ method: 'POST' })
  .validator(quizIdSchema)
  .handler(async ({ data }): Promise<AssignmentInsightsResponse> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can view insights')
    }

    return withRlsContext(user.id, async (tx) => {
      const quiz = await tx.query.quizzes.findFirst({
        where: (q, { eq: eqOp }) => eqOp(q.id, data.quizId),
      })
      if (!quiz) throw new Error('Quiz not found')

      const enrollments = await tx.query.enrollments.findMany({
        where: (e, { eq: eqOp }) => eqOp(e.classId, quiz.classId),
        with: { student: true },
      })

      const attempts = await tx.query.quizAttempts.findMany({
        where: (a, { eq: eqOp }) => eqOp(a.quizId, data.quizId),
        with: { student: true },
      })

      const startEvents = await tx.query.startEvents.findMany({
        where: (s, { eq: eqOp }) => eqOp(s.assignmentId, data.quizId),
      })

      const allFocusSessions = await tx.query.focusSessions.findMany({
        where: (fs, { eq: eqOp }) => eqOp(fs.assignmentId, data.quizId),
      })

      const students = enrollments.map((enrollment) => ({
        id: enrollment.studentId,
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      }))

      const attemptsByStudent = new Map(attempts.map((attempt) => [attempt.studentId, attempt]))
      const startByStudent = new Map(startEvents.map((start) => [start.userId, start]))
      const focusByStudent = new Map<string, Array<typeof allFocusSessions[number]>>()
      for (const session of allFocusSessions) {
        const list = focusByStudent.get(session.userId) ?? []
        list.push(session)
        focusByStudent.set(session.userId, list)
      }

      const startDurations: number[] = []
      const insights = students.map((student) => {
        const attempt = attemptsByStudent.get(student.id)
        const startEvent = startByStudent.get(student.id)
        const focusSessionsForStudent = focusByStudent.get(student.id) ?? []

        const startedAt = startEvent?.startAt ? startEvent.startAt.toISOString() : null
        const attemptStartedAt = attempt?.startedAt ? attempt.startedAt.toISOString() : null
        const submittedAt = attempt?.submittedAt ? attempt.submittedAt.toISOString() : null
        const score = attempt?.score ?? null
        const maxScore = attempt?.maxScore ?? null

        if (startEvent?.startAt && quiz.createdAt) {
          const hours = (startEvent.startAt.getTime() - quiz.createdAt.getTime()) / (1000 * 60 * 60)
          if (hours >= 0) startDurations.push(hours)
        }

        let hoursBeforeDeadline: number | null = null
        if (quiz.dueDate && attempt?.startedAt) {
          hoursBeforeDeadline = (quiz.dueDate.getTime() - attempt.startedAt.getTime()) / (1000 * 60 * 60)
        }

        const focusSessionCount = focusSessionsForStudent.length
        const totalFocusMinutes = focusSessionsForStudent.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0)

        const { procrastinationFlag: isProcrastinating, riskScore } = computeRiskScore({
          hasAttempt: !!attempt,
          focusSessionCount,
          hoursBeforeDeadline,
        })

        return {
          studentId: student.id,
          studentName: student.name,
          startedAt,
          attemptStartedAt,
          submittedAt,
          score,
          maxScore,
          focusSessionCount,
          totalFocusMinutes,
          hoursBeforeDeadline,
          procrastinationFlag: isProcrastinating,
          riskScore,
        }
      })

      const startedWithin24h = startDurations.filter((hours) => hours <= 24).length
      const startedWithin72h = startDurations.filter((hours) => hours <= 72).length
      const completedEarly = insights.filter((entry) => entry.submittedAt && quiz.dueDate && entry.hoursBeforeDeadline !== null && entry.hoursBeforeDeadline >= 24).length
      const lastMinuteCompletions = insights.filter((entry) => entry.submittedAt && quiz.dueDate && entry.hoursBeforeDeadline !== null && entry.hoursBeforeDeadline <= 24).length
      const totalStudents = students.length || 1
      const averageFocusMinutesPerStudent = Math.round(
        insights.reduce((sum, entry) => sum + entry.totalFocusMinutes, 0) / totalStudents,
      )

      const metrics = {
        avgTimeToStartHours: startDurations.length ? Number((startDurations.reduce((sum, value) => sum + value, 0) / startDurations.length).toFixed(1)) : null,
        medianTimeToStartHours: startDurations.length
          ? Number(
              startDurations
                .slice()
                .sort((a, b) => a - b)
                .slice(Math.floor((startDurations.length - 1) / 2), Math.ceil((startDurations.length + 1) / 2))
                .reduce((sum, value) => sum + value, 0) /
                (startDurations.length % 2 === 0 ? 2 : 1),
            )
          : null,
        percentStartedWithin24h: totalStudents ? Math.round((startedWithin24h / totalStudents) * 100) : 0,
        percentStartedWithin72h: totalStudents ? Math.round((startedWithin72h / totalStudents) * 100) : 0,
        percentCompletedEarly24h: totalStudents ? Math.round((completedEarly / totalStudents) * 100) : 0,
        lastMinuteCompletionRate: totalStudents ? Math.round((lastMinuteCompletions / totalStudents) * 100) : 0,
        averageFocusMinutesPerStudent,
      }

      const atRiskStudents = insights
        .filter((entry) => entry.riskScore >= 2)
        .map((entry) => ({
          studentId: entry.studentId,
          studentName: entry.studentName,
          riskReason: !entry.attemptStartedAt
            ? 'No attempt started yet and the deadline is close'
            : 'Started without tracked focus time within the final day',
        }))

      return {
        assignmentId: quiz.id,
        classId: quiz.classId,
        computedAt: new Date().toISOString(),
        metrics,
        insights,
        atRiskStudents,
      }
    })
  })

export const getQuizForStudentFn = createServerFn({ method: 'POST' })
  .validator(quizIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') {
      throw new Error('Only students can take quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const quiz = await tx.query.quizzes.findFirst({
        where: (q, { eq: eqOp, and: andOp }) => andOp(eqOp(q.id, data.quizId), eqOp(q.isPublished, true)),
        with: { questions: { with: { choices: true }, orderBy: (q, { asc }) => asc(q.position) } },
      })
      if (!quiz) throw new Error('Quiz not found')

      const existingAttempt = await tx.query.quizAttempts.findFirst({
        where: (a, { eq: eqOp, and: andOp }) => andOp(eqOp(a.quizId, data.quizId), eqOp(a.studentId, user.id)),
      })

      const myAnswers = existingAttempt
        ? await tx.query.quizAnswers.findMany({
            where: (answer, { eq: eqOp }) => eqOp(answer.attemptId, existingAttempt.id),
          })
        : []

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimitMinutes: quiz.timeLimitMinutes,
        dueDate: quiz.dueDate ? quiz.dueDate.toISOString() : null,
        attemptId: existingAttempt?.id ?? null,
        attempt: existingAttempt
          ? {
              id: existingAttempt.id,
              score: existingAttempt.score,
              maxScore: existingAttempt.maxScore,
              submittedAt: existingAttempt.submittedAt ? existingAttempt.submittedAt.toISOString() : null,
            }
          : null,
        myAnswers: myAnswers.map((answer) => ({ questionId: answer.questionId, selectedChoiceId: answer.selectedChoiceId })),
        questions: quiz.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          choices: q.choices
            .sort((a, b) => a.position - b.position)
            .map((c) => ({ id: c.id, choiceText: c.choiceText })),
        })),
      }
    })
  })

export const startAttemptFn = createServerFn({ method: 'POST' })
  .validator(quizIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') {
      throw new Error('Only students can start quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const existing = await tx.query.quizAttempts.findFirst({
        where: (a, { eq: eqOp, and: andOp }) => andOp(eqOp(a.quizId, data.quizId), eqOp(a.studentId, user.id)),
      })
      if (existing) return existing

      const [attempt] = await tx
        .insert(quizAttempts)
        .values({ quizId: data.quizId, studentId: user.id, maxScore: 0 })
        .returning()
      return attempt
    })
  })

export const submitQuizFn = createServerFn({ method: 'POST' })
  .validator(submitQuizSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const attempt = await tx.query.quizAttempts.findFirst({
        where: (a, { eq: eqOp }) => eqOp(a.id, data.attemptId),
      })
      if (!attempt || attempt.studentId !== user.id) {
        throw new Error('Attempt not found')
      }
      if (attempt.submittedAt) {
        throw new Error('Already submitted')
      }

      let score = 0
      const graded: Array<{ questionId: string; selectedChoiceId: string | null; isCorrect: boolean }> = []

      for (const answer of data.answers) {
        const question = await tx.query.quizQuestions.findFirst({
          where: (q, { eq: eqOp }) => eqOp(q.id, answer.questionId),
          with: { choices: true },
        })
        if (!question) continue

        const correctChoice = question.choices.find((c) => c.isCorrect)
        const isCorrect = !!answer.selectedChoiceId && answer.selectedChoiceId === correctChoice?.id
        if (isCorrect) score += question.points

        await tx.insert(quizAnswers).values({
          attemptId: attempt.id,
          questionId: answer.questionId,
          selectedChoiceId: answer.selectedChoiceId,
          isCorrect,
        })

        graded.push({
          questionId: answer.questionId,
          selectedChoiceId: answer.selectedChoiceId,
          isCorrect,
        })
      }

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, attempt.quizId),
      })
      const maxScore = questions.reduce((sum, question) => sum + question.points, 0)

      const [updated] = await tx
        .update(quizAttempts)
        .set({ score, maxScore, submittedAt: new Date() })
        .where(eq(quizAttempts.id, data.attemptId))
        .returning()

      return { attempt: updated, graded, score: updated?.score ?? 0, maxScore: updated?.maxScore ?? maxScore }
    })
  })

export function useQuizzes(classId: string) {
  const queryClient = useQueryClient()

  const { data: quizzes, isLoading } = useQuery<ClassQuizSummary[]>({
    queryKey: ['quizzes', classId],
    queryFn: () => getClassQuizzesFn({ data: { classId } }),
  })

  const createMutation = useMutation({
    mutationFn: (input: { classId: string; title: string; description?: string; timeLimitMinutes?: number; dueDate?: string }) =>
      createQuizFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', classId] })
    },
  })

  return {
    quizzes: quizzes ?? [],
    isLoading,
    createQuiz: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}

export function useClassQuizzes(classId: string) {
  return useQuery<ClassQuizSummary[]>({
    queryKey: ['quizzes', classId],
    queryFn: () => getClassQuizzesFn({ data: { classId } }),
    retry: false,
  })
}

export function useQuizAuthoring(quizId: string) {
  const queryClient = useQueryClient()

  const query = useQuery<QuizAuthoringDetail>({
    queryKey: ['quizzes', 'authoring', quizId],
    queryFn: () => getQuizAuthoringFn({ data: { quizId } }),
    retry: false,
  })

  const addQuestionMutation = useMutation({
    mutationFn: (input: { questionText: string; questionType: 'multiple_choice' | 'true_false'; points: number; choices: Array<{ choiceText: string; isCorrect: boolean }> }) =>
      addQuestionFn({ data: { quizId, ...input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'authoring', quizId] })
      await queryClient.invalidateQueries({ queryKey: ['quizzes', quizId] })
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => deleteQuestionFn({ data: { questionId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'authoring', quizId] })
    },
  })

  const togglePublishMutation = useMutation({
    mutationFn: (isPublished: boolean) => togglePublishFn({ data: { quizId, isPublished } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'authoring', quizId] })
      await queryClient.invalidateQueries({ queryKey: ['quizzes', quizId] })
    },
  })

  return {
    quiz: query.data,
    isLoading: query.isLoading,
    addQuestion: addQuestionMutation.mutateAsync,
    isAddingQuestion: addQuestionMutation.isPending,
    deleteQuestion: deleteQuestionMutation.mutateAsync,
    togglePublish: togglePublishMutation.mutateAsync,
    isTogglingPublish: togglePublishMutation.isPending,
  }
}

export function useQuizTaking(quizId: string) {
  const queryClient = useQueryClient()

  const { data: quiz, isLoading } = useQuery<StudentQuizDetail>({
    queryKey: ['quizzes', 'student', quizId],
    queryFn: () => getQuizForStudentFn({ data: { quizId } }),
    retry: false,
  })

  const startMutation = useMutation({
    mutationFn: () => startAttemptFn({ data: { quizId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'student', quizId] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: (input: { attemptId: string; answers: Array<{ questionId: string; selectedChoiceId: string | null }> }) =>
      submitQuizFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'student', quizId] })
    },
  })

  return {
    quiz,
    isLoading,
    startAttempt: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    submitQuiz: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  }
}

export interface AssignmentInsightEntry {
  studentId: string
  studentName: string
  score: number | null
  maxScore: number
  submittedAt: string | null
  correctCount: number
  totalQuestions: number
  focusSessionCount: number
  totalFocusMinutes: number
  attemptStartedAt: string | null
  hoursBeforeDeadline: number | null
  procrastinationFlag: boolean
}

export function useAssignmentInsights(quizId: string) {
  return useQuery<AssignmentInsightsResponse>({
    queryKey: ['quizzes', 'insights', quizId],
    queryFn: () => getAssignmentInsightsFn({ data: { quizId } }),
    retry: false,
  })
}

export interface StudentQuizDetail {
  id: string
  title: string
  description: string | null
  timeLimitMinutes: number | null
  dueDate: string | null
  attemptId: string | null
  attempt: {
    id: string
    score: number | null
    maxScore: number
    submittedAt: string | null
  } | null
  myAnswers: Array<{ questionId: string; selectedChoiceId: string | null }>
  questions: Array<{
    id: string
    questionText: string
    questionType: 'multiple_choice' | 'true_false'
    points: number
    choices: Array<{ id: string; choiceText: string; isCorrect?: boolean }>
  }>
}
