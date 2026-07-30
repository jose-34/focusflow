import { z } from 'zod'

export const classIdSchema = z.object({
  classId: z.string().uuid(),
})

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(100, 'Class name is too long'),
  curriculumId: z.string().uuid('Choose a curriculum'),
  subjectId: z.string().uuid('Choose a subject'),
  gradeLabel: z
    .string()
    .max(50, 'Grade label is too long')
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateClassInput = z.infer<typeof createClassSchema>

export const joinClassSchema = z.object({
  code: z.string().min(6, 'Class codes are 6 characters').max(6, 'Class codes are 6 characters'),
})

export type JoinClassInput = z.infer<typeof joinClassSchema>
