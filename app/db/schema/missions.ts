import { sql } from 'drizzle-orm'
import { check, index, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { quizzes } from './quizzes'
import { users } from './users'

// A Mission always points at real, currently-assigned work (docs/04_PRD.md
// §E5, docs/12_Gamification_Framework.md §5) — never a synthetic
// daily-login objective. Deliberately no `completed` column: completion is
// computed at read time from the referenced task/quiz's own real state
// (tasks.completed, or a submitted quizAttempt), so this table can never
// drift out of sync with the work it's pointing at.
export const missions = pgTable(
  'missions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Exactly one of these is ever set (see the check constraint below) —
    // a Mission references one real Practice Task or one real Quiz, never
    // both and never neither.
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
    // Snapshotted from the referenced work's own due date at generation
    // time. A Mission is never regenerated once created, so this doesn't
    // need to track later edits to the underlying due date.
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('missions_student_id_idx').on(table.studentId),
    index('missions_due_at_idx').on(table.dueAt),
    check('missions_exactly_one_reference', sql`(${table.taskId} is not null) <> (${table.quizId} is not null)`),
    pgPolicy('missions_self_access', { for: 'all' }),
  ],
).enableRLS()

export type Mission = typeof missions.$inferSelect
export type NewMission = typeof missions.$inferInsert
