import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { withRlsContext } from '@/db'
import { adminDb } from '@/db/admin'
import { classes, enrollments } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import {
  classIdSchema,
  createClassSchema,
  joinClassSchema,
  removeStudentSchema,
  type CreateClassInput,
} from '@/features/classes/schemas'
import { rateLimit } from '@/lib/rateLimit'
import { eq, and } from 'drizzle-orm'

const classesQueryKey = ['classes'] as const

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateClassCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export interface ClassSummary {
  id: string
  name: string
  code: string
  curriculumName: string
  subjectName: string
  gradeLabel: string | null
  studentCount?: number
  teacherName?: string
}

export const getClassesFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<ClassSummary>> => {
  const user = await requireUser()

  return withRlsContext(user.id, async (tx) => {
    if (user.role === 'teacher') {
      const ownedClasses = await tx.query.classes.findMany({
        where: (c, { eq: eqOp }) => eqOp(c.teacherId, user.id),
        with: { enrollments: true, curriculum: true, subject: true },
        orderBy: (c, { desc }) => desc(c.createdAt),
      })
      return ownedClasses.map((cls) => ({
        id: cls.id,
        name: cls.name,
        code: cls.code,
        curriculumName: cls.curriculum.name,
        subjectName: cls.subject.name,
        gradeLabel: cls.gradeLabel,
        studentCount: cls.enrollments.filter((e) => e.status === 'active').length,
      }))
    }

    const myEnrollments = await tx.query.enrollments.findMany({
      where: (e, { eq: eqOp, and: andOp }) => andOp(eqOp(e.studentId, user.id), eqOp(e.status, 'active')),
      with: { class: { with: { teacher: true, curriculum: true, subject: true } } },
      orderBy: (e, { desc }) => desc(e.enrolledAt),
    })
    return myEnrollments.map((enrollment) => ({
      id: enrollment.class.id,
      name: enrollment.class.name,
      code: enrollment.class.code,
      curriculumName: enrollment.class.curriculum.name,
      subjectName: enrollment.class.subject.name,
      gradeLabel: enrollment.class.gradeLabel,
      teacherName: `${enrollment.class.teacher.firstName} ${enrollment.class.teacher.lastName}`,
    }))
  })
})

export const createClassFn = createServerFn({ method: 'POST' })
  .validator(createClassSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can create classes')
    }

    return withRlsContext(user.id, async (tx) => {
      const subject = await tx.query.subjects.findFirst({
        where: (s, { eq: eqOp }) => eqOp(s.id, data.subjectId),
      })
      if (!subject || subject.curriculumId !== data.curriculumId) {
        throw new Error('That subject does not belong to the chosen curriculum')
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [created] = await tx
            .insert(classes)
            .values({
              name: data.name.trim(),
              code: generateClassCode(),
              teacherId: user.id,
              curriculumId: data.curriculumId,
              subjectId: data.subjectId,
              gradeLabel: data.gradeLabel,
            })
            .returning()
          return created
        } catch (error) {
          const isUniqueViolation = error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505'
          if (!isUniqueViolation || attempt === 4) throw error
        }
      }
      throw new Error('Could not generate a unique class code — please try again')
    })
  })

export const joinClassFn = createServerFn({ method: 'POST' })
  .validator(joinClassSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') {
      throw new Error('Only students can join classes')
    }
    // A 6-character code is brute-forceable given enough unthrottled
    // attempts; this caps guessing speed without affecting a real student
    // mistyping a code a few times.
    rateLimit('join-class', { max: 15, windowMs: 60_000 })

    const normalizedCode = data.code.trim().toUpperCase()

    const targetClass = await adminDb.query.classes.findFirst({
      where: (c, { eq: eqOp, and: andOp }) => andOp(eqOp(c.code, normalizedCode), eqOp(c.status, 'active')),
    })
    if (!targetClass) {
      throw new Error('No active class found with that code')
    }

    return withRlsContext(user.id, async (tx) => {
      const existing = await tx.query.enrollments.findFirst({
        where: (e, { eq: eqOp, and: andOp }) => andOp(eqOp(e.classId, targetClass.id), eqOp(e.studentId, user.id)),
      })
      if (existing) {
        throw new Error("You're already enrolled in this class")
      }

      const [enrollment] = await tx
        .insert(enrollments)
        .values({ classId: targetClass.id, studentId: user.id })
        .returning()
      return { enrollment, className: targetClass.name }
    })
  })

export interface ClassDetail {
  id: string
  name: string
  code: string
  curriculumName: string
  subjectName: string
  gradeLabel: string | null
  isTeacher: boolean
  teacherName: string
  roster: Array<{ id: string; firstName: string; lastName: string; email: string }>
}

export const getClassDetailFn = createServerFn({ method: 'POST' })
  .validator(classIdSchema)
  .handler(async ({ data }): Promise<ClassDetail> => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const cls = await tx.query.classes.findFirst({
        where: (c, { eq: eqOp }) => eqOp(c.id, data.classId),
        with: { teacher: true, curriculum: true, subject: true, enrollments: { with: { student: true } } },
      })
      if (!cls) {
        throw new Error('Class not found')
      }

      return {
        id: cls.id,
        name: cls.name,
        code: cls.code,
        curriculumName: cls.curriculum.name,
        subjectName: cls.subject.name,
        gradeLabel: cls.gradeLabel,
        isTeacher: user.role === 'teacher' && cls.teacherId === user.id,
        teacherName: `${cls.teacher.firstName} ${cls.teacher.lastName}`,
        roster: cls.enrollments
          .filter((e) => e.status === 'active')
          .map((e) => ({
            id: e.student.id,
            firstName: e.student.firstName,
            lastName: e.student.lastName,
            email: e.student.email,
          })),
      }
    })
  })

// Sprint 1: soft-delete (status = 'dropped'), never a hard delete — the
// student's own historical Task/Quiz/Focus Session records are entirely
// unaffected, since none of those are foreign-keyed to `enrollments`.
export const removeStudentFn = createServerFn({ method: 'POST' })
  .validator(removeStudentSchema)
  .handler(async ({ data }): Promise<{ success: true }> => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can remove a student from a class')
    }

    return withRlsContext(user.id, async (tx) => {
      const updated = await tx
        .update(enrollments)
        .set({ status: 'dropped' })
        .where(and(eq(enrollments.classId, data.classId), eq(enrollments.studentId, data.studentId)))
        .returning()
      if (updated.length === 0) throw new Error('Enrollment not found')
      return { success: true }
    })
  })

export function useClasses() {
  const queryClient = useQueryClient()

  const { data: classList, isLoading } = useQuery({
    queryKey: classesQueryKey,
    queryFn: () => getClassesFn(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateClassInput) => createClassFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesQueryKey })
    },
  })

  const joinMutation = useMutation({
    mutationFn: (code: string) => joinClassFn({ data: { code } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesQueryKey })
    },
  })

  return {
    classes: classList ?? [],
    isLoading,
    createClass: createMutation.mutateAsync,
    joinClass: joinMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isJoining: joinMutation.isPending,
  }
}

export function useClassDetail(classId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['classes', classId],
    queryFn: () => getClassDetailFn({ data: { classId } }),
    retry: false,
  })

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => removeStudentFn({ data: { classId, studentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', classId] })
    },
  })

  return {
    ...query,
    removeStudent: removeStudentMutation.mutateAsync,
    isRemovingStudent: removeStudentMutation.isPending,
  }
}
