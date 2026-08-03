import { z } from 'zod'

export const createQuizSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000).optional(),
  timeLimitMinutes: z
    .union([z.coerce.number().int().min(1, 'Must be at least 1 minute').max(180, 'Must be 180 minutes or less'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  // Setting this turns the quiz into an "assignment": a task auto-appears in
  // each enrolled student's task list once they can see the published quiz.
  dueDate: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateQuizInput = z.infer<typeof createQuizSchema>

// Admin's classless public content — no classId, but needs its own
// curriculum/subject/grade tagging since there's no class to inherit that
// from. Kept as its own schema rather than making classId optional on
// createQuizSchema above, so the teacher path's validation never has to
// reason about an admin-only shape.
export const createAdminQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000).optional(),
  curriculumId: z.string().uuid(),
  subjectId: z.string().uuid(),
  gradeLabel: z.string().max(50).optional(),
  timeLimitMinutes: z
    .union([z.coerce.number().int().min(1, 'Must be at least 1 minute').max(180, 'Must be 180 minutes or less'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateAdminQuizInput = z.infer<typeof createAdminQuizSchema>

// Separate from "publish" (draft vs. live within its own class/library) —
// this is the "how far beyond that does it reach" toggle: private stays
// class-only (or, for admin content, author-only), public reaches any
// authenticated user plus anonymous landing-page visitors.
export const toggleVisibilitySchema = z.object({
  quizId: z.string().uuid(),
  visibility: z.enum(['private', 'public']),
})

export type ToggleVisibilityInput = z.infer<typeof toggleVisibilitySchema>

export const questionTypeValues = ['multiple_choice', 'true_false'] as const

export const createQuestionSchema = z
  .object({
    quizId: z.string().uuid(),
    questionText: z.string().min(1, 'Question text is required').max(1000, 'Question text is too long'),
    questionType: z.enum(questionTypeValues),
    points: z.coerce.number().int().min(1, 'Must be at least 1 point').max(100, 'Must be 100 points or less'),
    choices: z
      .array(
        z.object({
          choiceText: z.string().min(1, 'Choice text is required').max(500, 'Choice text is too long'),
          isCorrect: z.boolean(),
        }),
      )
      .min(2, 'At least 2 choices are required')
      .max(6, 'At most 6 choices are allowed'),
  })
  .refine((data) => data.choices.filter((c) => c.isCorrect).length === 1, {
    message: 'Exactly one choice must be marked as correct',
    path: ['choices'],
  })

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>

export const submitQuizSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedChoiceId: z.string().uuid().nullable(),
    }),
  ),
})

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>
