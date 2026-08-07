import { z } from 'zod'

export const startFocusSessionSchema = z.object({
  durationMinutes: z.coerce.number().int().min(1, 'Must be at least 1 minute'),
  taskId: z.string().uuid().optional().nullable(),
  commitment: z.string().trim().min(1, 'A commitment is required to start a focus session').max(280, 'Keep it short — 280 characters max'),
})

export const completeFocusSessionSchema = z.object({
  id: z.string().uuid(),
  commitmentMet: z.boolean().optional(),
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

// createQuizSchema/createQuestionSchema/submitQuizSchema (+questionTypeValues)
// moved to @/features/quizzes/schemas — colocated with the rest of the
// quiz feature's schemas now that Phase 2's question-type work is already
// touching that file. Import from there, not here.

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
  accessMode: z.enum(['class', 'public']).default('class'),
  pacingMode: z.enum(['teacher_led', 'student_led']).default('teacher_led'),
})

export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>

export const joinGameSchema = z.object({
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
})

export type JoinGameInput = z.infer<typeof joinGameSchema>

export const joinGameAsGuestSchema = z.object({
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
  officialName: z.string().trim().min(1, 'Please enter your name').max(80),
})

export const gameSessionPinSchema = z.object({
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
})

export const guestParticipantSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
})

export const guestSubmitGameAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedChoiceId: z.string().uuid().nullable(),
})

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
