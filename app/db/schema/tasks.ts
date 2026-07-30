import { sql } from 'drizzle-orm'
import { boolean, index, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { quizzes } from './quizzes'
import { users } from './users'

export const taskPriorityEnum = pgEnum('task_priority', ['high', 'medium', 'low'])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    completed: boolean('completed').notNull().default(false),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Set ONLY by the server's assignment-sync helper (never accepted as
    // client input on the regular create-task path) when a student first
    // views a due-dated published quiz — this is what makes the task a
    // trustworthy signal for the teacher-visible assignment insights, rather
    // than something a student could fake by setting it themselves.
    quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    index('tasks_quiz_id_idx').on(table.quizId),
    pgPolicy('tasks_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
    pgPolicy('tasks_teacher_select', { for: 'select' }),
  ],
).enableRLS()

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
