import { index, pgEnum, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { curricula, subjects } from './curricula'
import { users } from './users'

export const classStatusEnum = pgEnum('class_status', ['active', 'archived'])
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'dropped'])

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: classStatusEnum('status').notNull().default('active'),
    curriculumId: uuid('curriculum_id')
      .notNull()
      .references(() => curricula.id, { onDelete: 'restrict' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    // Free text, not tied to the numeric users.gradeLevel check constraint —
    // grade naming is curriculum-specific (CBC has PP1/PP2 alongside numeric
    // grades; Cambridge uses "Year N") so this is descriptive only.
    gradeLabel: text('grade_label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('classes_teacher_id_idx').on(table.teacherId),
    index('classes_curriculum_id_idx').on(table.curriculumId),
    index('classes_subject_id_idx').on(table.subjectId),
    // Real policy bodies are applied by app/db/apply-rls.ts (see that file for why).
    pgPolicy('classes_select', { for: 'select' }),
    pgPolicy('classes_insert', { for: 'insert' }),
    pgPolicy('classes_update', { for: 'update' }),
    pgPolicy('classes_delete', { for: 'delete' }),
  ],
).enableRLS()

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull().default('active'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('enrollments_class_student_idx').on(table.classId, table.studentId),
    index('enrollments_student_id_idx').on(table.studentId),
    pgPolicy('enrollments_select', { for: 'select' }),
    pgPolicy('enrollments_insert', { for: 'insert' }),
    pgPolicy('enrollments_delete', { for: 'delete' }),
    pgPolicy('enrollments_update', { for: 'update' }),
  ],
).enableRLS()

export type Class = typeof classes.$inferSelect
export type NewClass = typeof classes.$inferInsert
export type Enrollment = typeof enrollments.$inferSelect
export type NewEnrollment = typeof enrollments.$inferInsert
