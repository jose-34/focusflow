import { z } from 'zod'

export const joinGameSchema = z.object({
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits'),
})

export type JoinGameInput = z.infer<typeof joinGameSchema>

export const createGameSessionSchema = z.object({
  quizId: z.string().uuid(),
  questionDurationSeconds: z.coerce.number().int().min(5).max(120).default(20),
})

export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>

export const submitGameAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedChoiceId: z.string().uuid().nullable(),
})

export type SubmitGameAnswerInput = z.infer<typeof submitGameAnswerSchema>
