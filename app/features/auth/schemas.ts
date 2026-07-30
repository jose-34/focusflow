import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be 8-72 characters').max(72, 'Password must be 8-72 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
    email: z.email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be 8-72 characters')
      .max(72, 'Password must be 8-72 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string(),
    role: z.enum(['student', 'teacher'], { error: 'Please select a role' }),
    gradeLevel: z.enum(['4', '5', '6', '7', '8', '9', '10', '11', '12']).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.role !== 'student' || !!data.gradeLevel, {
    message: 'Grade level is required for students',
    path: ['gradeLevel'],
  })

export type RegisterInput = z.infer<typeof registerSchema>
