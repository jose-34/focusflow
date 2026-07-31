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

export const removeStudentSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
})

export type RemoveStudentInput = z.infer<typeof removeStudentSchema>

export const createPracticeTaskSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  dueDate: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreatePracticeTaskInput = z.infer<typeof createPracticeTaskSchema>

export const taskTemplateIdSchema = z.object({
  templateId: z.string().uuid(),
})
