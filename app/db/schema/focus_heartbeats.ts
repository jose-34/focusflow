import { pgPolicy, pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core'
import { focusSessions } from './focus_sessions'

export const focusHeartbeats = pgTable(
  'focus_heartbeats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Sprint 4 unification: start_event_id/assignment_id were denormalized
    // copies, purely derivable via focus_session_id — dropped. This is also
    // the first real FK constraint this table has ever had (previously a
    // bare, unconstrained uuid — a data-integrity gap 09_Database_Design.md
    // already named directly); cascades since a heartbeat has no meaning
    // once its session is gone.
    focusSessionId: uuid('focus_session_id')
      .notNull()
      .references(() => focusSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('focus_heartbeats_session_id_idx').on(table.focusSessionId),
    index('focus_heartbeats_user_id_idx').on(table.userId),
    // Real policy body lives in app/db/apply-rls.ts (see that file for why).
    pgPolicy('focus_heartbeats_self_access', { for: 'all' }),
  ],
).enableRLS()

export type FocusHeartbeat = typeof focusHeartbeats.$inferSelect
export type NewFocusHeartbeat = typeof focusHeartbeats.$inferInsert
