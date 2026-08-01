import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { quizzes } from './quizzes'
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
    // Sprint 4 unification: this table is now the single source of truth for
    // BOTH the Pomodoro path (quizId/startMethod/startXpAwarded all null)
    // and the quiz-linked path (populated at start, not deferred to the
    // first heartbeat — the old start_events table's entire reason to exist
    // collapsed into these columns; its start_token existed only to let a
    // client reference an in-progress start before a focus_sessions row
    // existed yet — moot now that the row exists immediately, dropped
    // rather than carried over unused). assignment_id was previously a
    // bare, polymorphic uuid (quiz or task, no discriminator) — confirmed
    // by grep that startAssignmentFn is only ever called with a quiz id in
    // this codebase, so this is a real FK, not a rename with the same gap.
    quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
    startMethod: text('start_method'),
    startXpAwarded: integer('start_xp_awarded'),
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
    index('focus_sessions_quiz_id_idx').on(table.quizId),
    // Reproduces start_events' old one-start-per-assignment-per-user
    // guarantee. NULL quiz_id values are never considered equal to each
    // other by Postgres, so Pomodoro sessions (quiz_id IS NULL) are
    // unrestricted — this only constrains quiz-linked rows.
    uniqueIndex('focus_sessions_quiz_user_uidx').on(table.quizId, table.userId),
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
