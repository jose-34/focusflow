import { index, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'
import { users } from './users'

// Sprint 1 ([C2](../../../docs/04_Product_Requirements_Document.md#c2-practice-task-assignment)):
// one row per teacher-assigned Practice Task; fans out to one `tasks` row
// per actively-enrolled student at assignment time (see the server function,
// not this schema, for the fan-out itself — deleting a template cascades
// to every fanned-out task, since they only exist because the template does).
export const taskTemplates = pgTable(
  'task_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('task_templates_class_id_idx').on(table.classId),
    index('task_templates_teacher_id_idx').on(table.teacherId),
    // Real policy body lives in app/db/apply-rls.ts (see that file for why).
    pgPolicy('task_templates_all', { for: 'all' }),
  ],
).enableRLS()

export type TaskTemplate = typeof taskTemplates.$inferSelect
export type NewTaskTemplate = typeof taskTemplates.$inferInsert
