import { sql } from 'drizzle-orm'
import { check, index, integer, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { focusSessions } from './focus_sessions'
import { users } from './users'

export const distractionEvents = pgTable(
  'distraction_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    focusSessionId: uuid('focus_session_id')
      .notNull()
      .references(() => focusSessions.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer('duration_seconds').notNull(),
  },
  (table) => [
    index('distraction_events_user_id_idx').on(table.userId),
    index('distraction_events_session_id_idx').on(table.focusSessionId),
    check('distraction_events_duration_positive', sql`${table.durationSeconds} >= 0`),
    pgPolicy('distraction_events_self_access', { for: 'all' }),
  ],
).enableRLS()

export type DistractionEvent = typeof distractionEvents.$inferSelect
export type NewDistractionEvent = typeof distractionEvents.$inferInsert
