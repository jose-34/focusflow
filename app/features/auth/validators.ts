import { z } from 'zod'

export const startFocusSessionSchema = z.object({
  durationMinutes: z.coerce.number().int().min(1, 'Must be at least 1 minute'),
  taskId: z.string().uuid().optional().nullable(),
})

export const completeFocusSessionSchema = z.object({
  id: z.string().uuid(),
})

export const logDistractionSchema = z.object({
  focusSessionId: z.string().uuid(),
  durationSeconds: z.coerce.number().int().min(0, 'Duration must be non-negative'),
})

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const toggleTaskSchema = z.object({
  id: z.string().uuid(),
  completed: z.boolean(),
})

export const deleteTaskSchema = z.object({
  id: z.string().uuid(),
})

export const wellnessCheckInSchema = z.object({
  mood: z.coerce.number().int().min(1, 'Mood must be 1-5').max(5, 'Mood must be 1-5'),
  notes: z.string().max(1000).optional(),
})

export const quizIdSchema = z.object({
  quizId: z.string().uuid(),
})

export const createQuizSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000).optional(),
  timeLimitMinutes: z
    .union([z.coerce.number().int().min(1, 'Must be at least 1 minute').max(180, 'Must be 180 minutes or less'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  dueDate: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateQuizInput = z.infer<typeof createQuizSchema>

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

export const questionIdSchema = z.object({
  questionId: z.string().uuid(),
})

export const togglePublishSchema = z.object({
  quizId: z.string().uuid(),
  isPublished: z.boolean(),
})

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
})

export const createGameSessionSchema = z.object({
  quizId: z.string().uuid(),
  questionDurationSeconds: z.coerce.number().int().min(5).max(120).default(20),
})

export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>

export const joinGameSchema = z.object({
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
})

export type JoinGameInput = z.infer<typeof joinGameSchema>

export const submitGameAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedChoiceId: z.string().uuid().nullable(),
})

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be 8-72 characters').max(72, 'Password must be 8-72 characters'),
})

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
