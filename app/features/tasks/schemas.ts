import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
