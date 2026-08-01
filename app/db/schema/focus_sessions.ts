import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const focusSessions = pgTable(
  'focus_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    durationMinutes: integer('duration_minutes').notNull().default(25),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    wasSuccessful: boolean('was_successful').notNull().default(false),
    startEventId: uuid('start_event_id'),
    assignmentId: uuid('assignment_id'),
    verified: boolean('verified').notNull().default(false),
    // Optional link to the task this session was spent on — lets a session
    // count as focus time logged against a specific (possibly assigned) task.
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    // D3 Commitment Setting. Nullable in the DB even though the product
    // decision made "required" for new sessions — enforced at the Zod/UI
    // layer, not a DB constraint, so historical rows created before this
    // column existed don't need a backfill. commitmentMet stays null until
    // the student self-reports at session completion; an abandoned session
    // never gets a reflection prompt, so it stays null forever for those.
    commitment: text('commitment'),
    commitmentMet: boolean('commitment_met'),
  },
  (table) => [
    index('focus_sessions_user_id_idx').on(table.userId),
    index('focus_sessions_task_id_idx').on(table.taskId),
    index('focus_sessions_start_event_id_idx').on(table.startEventId),
    index('focus_sessions_assignment_id_idx').on(table.assignmentId),
    pgPolicy('focus_sessions_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
    pgPolicy('focus_sessions_teacher_select', { for: 'select' }),
  ],
).enableRLS()

export type FocusSession = typeof focusSessions.$inferSelect
export type NewFocusSession = typeof focusSessions.$inferInsert
