import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Tx } from '@/db'
import { withRlsContext } from '@/db'
import { quizAnswerChoices, quizAnswers, quizAttempts, quizChoices, quizQuestions, quizzes, tasks, xpLedger } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { questionIdSchema, quizIdSchema, togglePublishSchema } from '@/features/auth/validators'
import {
  ACCEPTED_DOCUMENT_MIME_TYPES,
  createAdminQuizSchema,
  createQuestionSchema,
  createQuizSchema,
  generateAdminQuizFromDocumentSchema,
  generateAdminQuizFromTopicSchema,
  generateClassQuizFromDocumentSchema,
  generateClassQuizFromTopicSchema,
  generateQuestionsSchema,
  submitQuizSchema,
  toggleVisibilitySchema,
  updateQuizDueDateSchema,
  type CreateQuestionInput,
  type GenerateAdminQuizFromDocumentInput,
  type GenerateAdminQuizFromTopicInput,
  type GenerateClassQuizFromDocumentInput,
  type GenerateClassQuizFromTopicInput,
} from '@/features/quizzes/schemas'
import { gradeAnswer } from '@/features/quizzes/grading'
import { awardCoins } from '@/features/economy/hooks/useEconomy'
import { isManualGradingType, type QuestionAnswerConfig, type QuestionResponseData, type QuestionTypeValue } from '@/features/quizzes/questionTypes'
import { classIdSchema } from '@/features/classes/schemas'
import { checkAndUnlockAchievements } from '@/features/achievements/services/achievement.service'
import { generateQuestionsFromDocument, generateQuizFromDocument, generateQuizFromTopic, MAX_DOCUMENT_BYTES, type GeneratedQuestion } from '@/lib/ai'
import { rateLimit } from '@/lib/rateLimit'
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
    taskType: 'quiz_assignment',
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
          authorId: user.id,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          timeLimitMinutes: data.timeLimitMinutes ?? null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        })
        .returning()
      return quiz
    })
  })

// Admin's classless public content — always visibility='public' (that's
// the entire point of admin content) and always isPublished=false at
// creation, matching the teacher path's draft-first convention: an admin
// still has to explicitly publish once questions are added, rather than
// exposing a half-built quiz to real anonymous visitors immediately.
export const createAdminQuizFn = createServerFn({ method: 'POST' })
  .validator(createAdminQuizSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'admin') {
      throw new Error('Only admins can create public content this way')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: null,
          authorId: user.id,
          visibility: 'public',
          curriculumId: data.curriculumId,
          subjectId: data.subjectId,
          gradeLabel: data.gradeLabel?.trim() || null,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          timeLimitMinutes: data.timeLimitMinutes ?? null,
        })
        .returning()
      return quiz
    })
  })

export interface AdminContentSummary {
  id: string
  title: string
  isPublished: boolean
  curriculumCode: string
  curriculumName: string
  subjectName: string
  gradeLabel: string | null
  questionCount: number
  createdAt: string
}

export const getAdminContentListFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<AdminContentSummary>> => {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('Only admins can view this content library')
  }

  return withRlsContext(user.id, async (tx) => {
    const rows = await tx.query.quizzes.findMany({
      where: (q, { eq: eqOp }) => eqOp(q.authorId, user.id),
      with: { questions: true, curriculum: true, subject: true },
      orderBy: (q, { desc }) => desc(q.createdAt),
    })
    return rows.map((q) => ({
      id: q.id,
      title: q.title,
      isPublished: q.isPublished,
      curriculumCode: q.curriculum?.code ?? '',
      curriculumName: q.curriculum?.name ?? 'Unknown',
      subjectName: q.subject?.name ?? 'Unknown',
      gradeLabel: q.gradeLabel,
      questionCount: q.questions.length,
      createdAt: q.createdAt.toISOString(),
    }))
  })
})

export const addQuestionFn = createServerFn({ method: 'POST' })
  .validator(createQuestionSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can add questions')
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
          answerConfig: data.answerConfig ?? null,
          requiresManualGrading: isManualGradingType(data.questionType) || data.questionType === 'open_ended',
        })
        .returning()

      if (data.choices) {
        await tx.insert(quizChoices).values(
          data.choices.map((choice, index) => ({
            questionId: question.id,
            choiceText: choice.choiceText.trim(),
            isCorrect: choice.isCorrect,
            position: index,
          })),
        )
      }

      return question
    })
  })

// Shared by generateQuestionsFromDocumentFn (adds to an existing quiz) and
// the four create-a-whole-quiz functions below (document- and topic-based,
// admin and teacher) — the question insert loop is identical either way,
// only what quiz row they're attached to differs. Type-aware since Phase
// 2/3: choice-based types insert into quiz_choices exactly as before,
// every other AI-generatable type carries its answerConfig directly.
async function insertGeneratedQuestions(tx: Tx, quizId: string, generated: Array<GeneratedQuestion>, startPosition: number): Promise<number> {
  let nextPosition = startPosition
  for (const generatedQuestion of generated) {
    const [question] = await tx
      .insert(quizQuestions)
      .values({
        quizId,
        questionText: generatedQuestion.questionText.trim(),
        questionType: generatedQuestion.questionType,
        points: generatedQuestion.points,
        position: nextPosition,
        answerConfig: generatedQuestion.answerConfig ?? null,
      })
      .returning()
    nextPosition += 1

    if (generatedQuestion.choices) {
      await tx.insert(quizChoices).values(
        generatedQuestion.choices.map((choice, index) => ({
          questionId: question.id,
          choiceText: choice.choiceText.trim(),
          isCorrect: choice.isCorrect,
          position: index,
        })),
      )
    }
  }
  return generated.length
}

export const generateQuestionsFromDocumentFn = createServerFn({ method: 'POST' })
  .validator(generateQuestionsSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can generate questions')
    }
    // AI calls are the most expensive endpoint in the app by far (real
    // per-token billing) — a tighter cap than the other rate limits here.
    rateLimit('generate-questions', { max: 10, windowMs: 10 * 60_000 })

    // Base64 inflates raw bytes by ~4/3 — check against the real file size,
    // not the encoded string length.
    const approxRawBytes = (data.fileBase64.length * 3) / 4
    if (approxRawBytes > MAX_DOCUMENT_BYTES) {
      throw new Error('File is too large — please upload a document under 8MB.')
    }

    return withRlsContext(user.id, async (tx) => {
      // Confirm ownership before spending API tokens on a document for a
      // quiz this user doesn't actually control.
      const quiz = await tx.query.quizzes.findFirst({
        where: (q, { eq: eqOp }) => eqOp(q.id, data.quizId),
      })
      if (!quiz) throw new Error('Quiz not found')

      const generated = await generateQuestionsFromDocument({
        mimeType: data.mimeType,
        base64: data.fileBase64,
        questionCount: data.questionCount,
        gradeLevel: data.gradeLevel,
        dokLevel: data.dokLevel,
        language: data.language,
        questionTypes: data.questionTypes,
      })
      if (generated.length === 0) {
        throw new Error('Could not extract any valid questions from this document — try a clearer or more detailed file.')
      }

      const existing = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, data.quizId),
      })
      const createdCount = await insertGeneratedQuestions(tx, data.quizId, generated, existing.length)
      return { createdCount }
    })
  })

// "Generate with AI" entry point for admin content — creates the quiz row
// AND its questions from a single document upload, so there's no separate
// "create an empty quiz shell first" step. Curriculum/subject/grade are
// still explicit picks (they're real foreign keys the model can't safely
// guess), but the title comes from the document.
export const generateAdminQuizFromDocumentFn = createServerFn({ method: 'POST' })
  .validator(generateAdminQuizFromDocumentSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'admin') {
      throw new Error('Only admins can create public content this way')
    }
    rateLimit('generate-questions', { max: 10, windowMs: 10 * 60_000 })

    const approxRawBytes = (data.fileBase64.length * 3) / 4
    if (approxRawBytes > MAX_DOCUMENT_BYTES) {
      throw new Error('File is too large — please upload a document under 8MB.')
    }

    const generatedQuiz = await generateQuizFromDocument({
      mimeType: data.mimeType,
      base64: data.fileBase64,
      questionCount: data.questionCount,
      gradeLevel: data.gradeLevel,
      dokLevel: data.dokLevel,
      language: data.language,
      questionTypes: data.questionTypes,
    })

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: null,
          authorId: user.id,
          visibility: 'public',
          curriculumId: data.curriculumId,
          subjectId: data.subjectId,
          gradeLabel: data.gradeLabel?.trim() || null,
          title: generatedQuiz.title,
        })
        .returning()

      await insertGeneratedQuestions(tx, quiz.id, generatedQuiz.questions, 0)
      return quiz
    })
  })

// Teacher equivalent — same one-motion creation, scoped to a class instead
// of curriculum/subject/grade (the class already carries those).
export const generateClassQuizFromDocumentFn = createServerFn({ method: 'POST' })
  .validator(generateClassQuizFromDocumentSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can create quizzes this way')
    }
    rateLimit('generate-questions', { max: 10, windowMs: 10 * 60_000 })

    const approxRawBytes = (data.fileBase64.length * 3) / 4
    if (approxRawBytes > MAX_DOCUMENT_BYTES) {
      throw new Error('File is too large — please upload a document under 8MB.')
    }

    const generatedQuiz = await generateQuizFromDocument({
      mimeType: data.mimeType,
      base64: data.fileBase64,
      questionCount: data.questionCount,
      gradeLevel: data.gradeLevel,
      dokLevel: data.dokLevel,
      language: data.language,
      questionTypes: data.questionTypes,
    })

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: data.classId,
          authorId: user.id,
          title: generatedQuiz.title,
        })
        .returning()

      await insertGeneratedQuestions(tx, quiz.id, generatedQuiz.questions, 0)
      return quiz
    })
  })

// Text-only "describe a topic" entry point — admin, classless public
// content. Same rate-limit bucket as the document-based generators (same
// real per-token billing cost regardless of entry point).
export const generateAdminQuizFromTopicFn = createServerFn({ method: 'POST' })
  .validator(generateAdminQuizFromTopicSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'admin') {
      throw new Error('Only admins can create public content this way')
    }
    rateLimit('generate-questions', { max: 10, windowMs: 10 * 60_000 })

    const generatedQuiz = await generateQuizFromTopic({
      topic: data.topic,
      questionCount: data.questionCount,
      gradeLevel: data.gradeLevel,
      dokLevel: data.dokLevel,
      language: data.language,
      questionTypes: data.questionTypes,
    })

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: null,
          authorId: user.id,
          visibility: 'public',
          curriculumId: data.curriculumId,
          subjectId: data.subjectId,
          gradeLabel: data.gradeLabel?.trim() || null,
          title: generatedQuiz.title,
        })
        .returning()

      await insertGeneratedQuestions(tx, quiz.id, generatedQuiz.questions, 0)
      return quiz
    })
  })

// Teacher equivalent of the topic-only entry point above.
export const generateClassQuizFromTopicFn = createServerFn({ method: 'POST' })
  .validator(generateClassQuizFromTopicSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can create quizzes this way')
    }
    rateLimit('generate-questions', { max: 10, windowMs: 10 * 60_000 })

    const generatedQuiz = await generateQuizFromTopic({
      topic: data.topic,
      questionCount: data.questionCount,
      gradeLevel: data.gradeLevel,
      dokLevel: data.dokLevel,
      language: data.language,
      questionTypes: data.questionTypes,
    })

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          classId: data.classId,
          authorId: user.id,
          title: generatedQuiz.title,
        })
        .returning()

      await insertGeneratedQuestions(tx, quiz.id, generatedQuiz.questions, 0)
      return quiz
    })
  })

const gradeManualAnswerSchema = z.object({
  answerId: z.string().uuid(),
  isCorrect: z.boolean(),
})

// Audio/video response, draw, hotspot, math response, graphing, and
// open-ended all leave isCorrect null at submit time (see gradeAnswer) —
// this is the only path that ever sets it for those types.
export const gradeManualAnswerFn = createServerFn({ method: 'POST' })
  .validator(gradeManualAnswerSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can grade answers')
    }

    return withRlsContext(user.id, async (tx) => {
      const answer = await tx.query.quizAnswers.findFirst({
        where: (a, { eq: eqOp }) => eqOp(a.id, data.answerId),
        with: { question: true },
      })
      if (!answer) throw new Error('Answer not found')

      const pointsEarned = data.isCorrect ? answer.question.points : 0
      const [updated] = await tx
        .update(quizAnswers)
        .set({ isCorrect: data.isCorrect, gradedByTeacherId: user.id, gradedAt: new Date() })
        .where(eq(quizAnswers.id, data.answerId))
        .returning()

      // Re-sum the attempt's score from every graded answer now that this
      // one has a real isCorrect value — manual-grading answers contribute
      // 0 until graded, so a re-grade can only ever raise the score.
      const attempt = await tx.query.quizAttempts.findFirst({ where: (a, { eq: eqOp }) => eqOp(a.id, answer.attemptId) })
      if (attempt) {
        const allAnswers = await tx.query.quizAnswers.findMany({
          where: (a, { eq: eqOp }) => eqOp(a.attemptId, answer.attemptId),
          with: { question: true },
        })
        const score = allAnswers.reduce((sum, a) => sum + (a.isCorrect ? a.question.points : 0), 0)
        await tx.update(quizAttempts).set({ score }).where(eq(quizAttempts.id, answer.attemptId))
      }

      return { ...updated, pointsEarned }
    })
  })

// Teacher-only queue of answers awaiting manual grading for a given quiz
// (audio/video response, draw, hotspot, math response, graphing,
// open-ended). Surfaced on the class quiz-results view.
export const getManualGradingQueueFn = createServerFn({ method: 'POST' })
  .validator(quizIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can view the grading queue')
    }

    return withRlsContext(user.id, async (tx) => {
      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp, and: andOp }) => andOp(eqOp(q.quizId, data.quizId), eqOp(q.requiresManualGrading, true)),
      })
      const questionIds = questions.map((q) => q.id)
      if (questionIds.length === 0) return []

      const answers = await tx.query.quizAnswers.findMany({
        where: (a, { inArray, isNull, and: andOp }) => andOp(inArray(a.questionId, questionIds), isNull(a.isCorrect)),
        with: { attempt: { with: { student: true } }, question: true },
      })

      return answers.map((a) => ({
        answerId: a.id,
        questionText: a.question.questionText,
        studentName: `${a.attempt.student.firstName} ${a.attempt.student.lastName}`,
        responseData: a.responseData,
        points: a.question.points,
      }))
    })
  })

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .validator(questionIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can delete questions')
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
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can publish quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .update(quizzes)
        .set({
          isPublished: data.isPublished,
          unpublishedAt: data.isPublished ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quizzes.id, data.quizId))
        .returning()
      if (!quiz) throw new Error('Quiz not found')
      return quiz
    })
  })

export const toggleVisibilityFn = createServerFn({ method: 'POST' })
  .validator(toggleVisibilitySchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can change quiz visibility')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .update(quizzes)
        .set({ visibility: data.visibility, updatedAt: new Date() })
        .where(eq(quizzes.id, data.quizId))
        .returning()
      if (!quiz) throw new Error('Quiz not found')
      return quiz
    })
  })

export const updateQuizDueDateFn = createServerFn({ method: 'POST' })
  .validator(updateQuizDueDateSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can assign quizzes')
    }

    return withRlsContext(user.id, async (tx) => {
      const [quiz] = await tx
        .update(quizzes)
        .set({ dueDate: data.dueDate ? new Date(data.dueDate) : null, updatedAt: new Date() })
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
  questionType: QuestionTypeValue
  points: number
  choices: Array<QuizAuthoringChoice>
  answerConfig: QuestionAnswerConfig | null
  requiresManualGrading: boolean
}

export interface QuizAuthoringDetail {
  id: string
  classId: string | null
  title: string
  description: string | null
  isPublished: boolean
  visibility: 'private' | 'public'
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
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new Error('Only teachers and admins can manage quizzes')
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
        visibility: quiz.visibility,
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
          answerConfig: q.answerConfig,
          requiresManualGrading: q.requiresManualGrading,
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
      // Assignment insights are inherently class-scoped (enrollments, a
      // roster to measure against) — never meaningful for admin's
      // classless public content, which this teacher-only function can't
      // reach anyway, but the schema-level type is `string | null` now.
      if (!quiz.classId) throw new Error('Assignment insights are only available for class-linked quizzes')
      // Narrowing on `quiz.classId` doesn't survive capture in the closure
      // below — pull it into its own const first.
      const classId = quiz.classId

      const enrollments = await tx.query.enrollments.findMany({
        where: (e, { eq: eqOp }) => eqOp(e.classId, classId),
        with: { student: true },
      })

      const attempts = await tx.query.quizAttempts.findMany({
        where: (a, { eq: eqOp }) => eqOp(a.quizId, data.quizId),
        with: { student: true },
      })

      // Sprint 4 unification: focus_sessions is now created immediately at
      // start (quizId set), so it's both the "started" record and the
      // duration record in one — no separate start_events query needed
      // anymore. The (quiz_id, user_id) unique index guarantees at most one
      // row per student here, same guarantee start_events used to provide.
      const allFocusSessions = await tx.query.focusSessions.findMany({
        where: (fs, { eq: eqOp }) => eqOp(fs.quizId, data.quizId),
      })

      const students = enrollments.map((enrollment) => ({
        id: enrollment.studentId,
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      }))

      const attemptsByStudent = new Map(attempts.map((attempt) => [attempt.studentId, attempt]))
      const startByStudent = new Map(allFocusSessions.map((session) => [session.userId, session]))
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

        const startedAt = startEvent?.startedAt ? startEvent.startedAt.toISOString() : null
        const attemptStartedAt = attempt?.startedAt ? attempt.startedAt.toISOString() : null
        const submittedAt = attempt?.submittedAt ? attempt.submittedAt.toISOString() : null
        const score = attempt?.score ?? null
        const maxScore = attempt?.maxScore ?? null

        if (startEvent?.startedAt && quiz.createdAt) {
          const hours = (startEvent.startedAt.getTime() - quiz.createdAt.getTime()) / (1000 * 60 * 60)
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

export interface QuizAssignmentSummary {
  id: string
  classId: string
  title: string
  className: string
  dueDate: string
  isPublished: boolean
  assignedCount: number
  completedCount: number
  inProgressCount: number
}

// Reports needs a unified "everything a teacher assigned" list, not just
// live-game sessions (usePastGameSessions covers those). Mirrors
// dashboard.tsx's getDashboardDataFn teacher-branch dueDatedQuizzes query
// exactly (same shape, same reasoning) but without its limit(5) — this is
// the full history view, not a dashboard preview widget.
export const getTeacherQuizAssignmentsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<QuizAssignmentSummary>> => {
  const user = await requireUser()

  return withRlsContext(user.id, async (tx) => {
    const teacherClasses = await tx.query.classes.findMany({
      where: (c, { eq: eqOp }) => eqOp(c.teacherId, user.id),
    })
    const classIds = teacherClasses.map((c) => c.id)
    if (classIds.length === 0) return []

    const dueDatedQuizzes = await tx.query.quizzes.findMany({
      where: (q, { inArray: inArrayOp, isNotNull, and: andOp }) => andOp(inArrayOp(q.classId, classIds), isNotNull(q.dueDate)),
      with: { class: { with: { enrollments: true } }, attempts: true },
      orderBy: (q, { desc: descOp }) => descOp(q.dueDate),
    })

    return dueDatedQuizzes.map((q) => ({
      id: q.id,
      classId: q.classId!,
      title: q.title,
      className: q.class?.name ?? '',
      dueDate: q.dueDate!.toISOString(),
      isPublished: q.isPublished,
      assignedCount: q.class?.enrollments.filter((e) => e.status === 'active').length ?? 0,
      completedCount: q.attempts.filter((a) => a.submittedAt !== null).length,
      inProgressCount: q.attempts.filter((a) => a.submittedAt === null).length,
    }))
  })
})

export function useTeacherQuizAssignments() {
  return useQuery({
    queryKey: ['quizzes', 'teacher-assignments'],
    queryFn: () => getTeacherQuizAssignmentsFn(),
  })
}

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
            with: { selectedChoices: true },
          })
        : []

      // Same invariant as the live game's PlayerGameState: the answer key
      // must never reach the client before the attempt is submitted.
      const revealAnswers = !!existingAttempt?.submittedAt

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
        myAnswers: myAnswers.map((answer) => ({
          questionId: answer.questionId,
          selectedChoiceId: answer.selectedChoiceId,
          selectedChoiceIds: answer.selectedChoices.map((sc) => sc.choiceId),
          responseData: answer.responseData,
        })),
        questions: quiz.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          choices: q.choices
            .sort((a, b) => a.position - b.position)
            .map((c) => ({ id: c.id, choiceText: c.choiceText, ...(revealAnswers ? { isCorrect: c.isCorrect } : {}) })),
          answerConfig: q.answerConfig,
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
      const graded: Array<{ questionId: string; selectedChoiceId: string | null; isCorrect: boolean | null }> = []

      for (const answer of data.answers) {
        const question = await tx.query.quizQuestions.findFirst({
          where: (q, { eq: eqOp }) => eqOp(q.id, answer.questionId),
          with: { choices: true },
        })
        if (!question) continue

        const { isCorrect, pointsEarned } = gradeAnswer(question, answer)
        score += pointsEarned

        const [inserted] = await tx
          .insert(quizAnswers)
          .values({
            attemptId: attempt.id,
            questionId: answer.questionId,
            selectedChoiceId: answer.selectedChoiceId ?? null,
            isCorrect,
            responseData: (answer.responseData as never) ?? null,
            // Manual-grading types (audio/video response, draw, hotspot,
            // math response, graphing, open-ended) leave isCorrect null
            // here; gradeManualAnswerFn picks them up later by joining back
            // to quiz_questions.requiresManualGrading.
          })
          .returning()

        if (question.questionType === 'multi_select' && answer.selectedChoiceIds?.length) {
          await tx.insert(quizAnswerChoices).values(answer.selectedChoiceIds.map((choiceId) => ({ answerId: inserted.id, choiceId })))
        }

        graded.push({
          questionId: answer.questionId,
          selectedChoiceId: answer.selectedChoiceId ?? null,
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

      // XP equal to points earned, 1:1 with the quiz's own point scale
      // (docs/12_Gamification_Framework.md §2) — the attempt's submittedAt
      // guard above already makes this whole handler run-once per attempt,
      // so there's no separate idempotency check needed here.
      if (score > 0) {
        await tx.insert(xpLedger).values({
          userId: user.id,
          amount: score,
          source: 'quiz_attempt',
          metadata: { quizId: attempt.quizId, attemptId: attempt.id },
        })
        // Coins at half the XP rate — cosmetic-only currency, see
        // docs/12_Gamification_Framework.md §8's 2026-08-04 note.
        await awardCoins(tx, user.id, Math.round(score / 2), 'quiz_attempt', { quizId: attempt.quizId, attemptId: attempt.id })
      }
      const unlockedAchievements = await checkAndUnlockAchievements(tx, user.id)

      return {
        attempt: updated,
        graded,
        score: updated?.score ?? 0,
        maxScore: updated?.maxScore ?? maxScore,
        unlockedAchievements,
      }
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

  const updateDueDateMutation = useMutation({
    mutationFn: (input: { quizId: string; dueDate: string | null }) => updateQuizDueDateFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', classId] })
    },
  })

  return {
    quizzes: quizzes ?? [],
    isLoading,
    createQuiz: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateDueDate: updateDueDateMutation.mutateAsync,
    isUpdatingDueDate: updateDueDateMutation.isPending,
  }
}

export function useClassQuizzes(classId: string) {
  return useQuery<ClassQuizSummary[]>({
    queryKey: ['quizzes', classId],
    queryFn: () => getClassQuizzesFn({ data: { classId } }),
    retry: false,
  })
}

export function useAdminContent() {
  return useQuery<AdminContentSummary[]>({
    queryKey: ['quizzes', 'admin-content'],
    queryFn: () => getAdminContentListFn(),
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
    mutationFn: (
      input: Omit<CreateQuestionInput, 'quizId'>,
    ) => addQuestionFn({ data: { quizId, ...input } }),
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

  const toggleVisibilityMutation = useMutation({
    mutationFn: (visibility: 'private' | 'public') => toggleVisibilityFn({ data: { quizId, visibility } }),
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
    toggleVisibility: toggleVisibilityMutation.mutateAsync,
    isTogglingVisibility: toggleVisibilityMutation.isPending,
  }
}

export function useGenerateQuestionsFromDocument(quizId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { mimeType: (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number]; fileBase64: string; questionCount: number }) =>
      generateQuestionsFromDocumentFn({ data: { quizId, ...input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'authoring', quizId] })
      await queryClient.invalidateQueries({ queryKey: ['quizzes', quizId] })
    },
  })
}

export function useGenerateAdminQuizFromDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<GenerateAdminQuizFromDocumentInput, 'questionCount'> & { questionCount: number }) =>
      generateAdminQuizFromDocumentFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'admin-content'] })
    },
  })
}

export function useGenerateClassQuizFromDocument(classId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<GenerateClassQuizFromDocumentInput, 'classId' | 'questionCount'> & { questionCount: number }) =>
      generateClassQuizFromDocumentFn({ data: { classId, ...input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', classId] })
    },
  })
}

export function useGenerateAdminQuizFromTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<GenerateAdminQuizFromTopicInput, 'questionCount'> & { questionCount: number }) => generateAdminQuizFromTopicFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', 'admin-content'] })
    },
  })
}

export function useGenerateClassQuizFromTopic(classId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<GenerateClassQuizFromTopicInput, 'classId' | 'questionCount'> & { questionCount: number }) =>
      generateClassQuizFromTopicFn({ data: { classId, ...input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', classId] })
    },
  })
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
  myAnswers: Array<{
    questionId: string
    selectedChoiceId: string | null
    selectedChoiceIds: Array<string>
    responseData: QuestionResponseData | null
  }>
  questions: Array<{
    id: string
    questionText: string
    questionType: QuestionTypeValue
    points: number
    choices: Array<{ id: string; choiceText: string; isCorrect?: boolean }>
    answerConfig: QuestionAnswerConfig | null
  }>
}
