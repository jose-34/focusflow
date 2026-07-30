import { pgPolicy, pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core'

export const focusHeartbeats = pgTable(
  'focus_heartbeats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    focusSessionId: uuid('focus_session_id').notNull(),
    startEventId: uuid('start_event_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    userId: uuid('user_id').notNull(),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('focus_heartbeats_session_id_idx').on(table.focusSessionId),
    index('focus_heartbeats_start_event_id_idx').on(table.startEventId),
    index('focus_heartbeats_assignment_id_idx').on(table.assignmentId),
    index('focus_heartbeats_user_id_idx').on(table.userId),
    // Real policy body lives in app/db/apply-rls.ts (see that file for why).
    pgPolicy('focus_heartbeats_self_access', { for: 'all' }),
  ],
).enableRLS()

export type FocusHeartbeat = typeof focusHeartbeats.$inferSelect
export type NewFocusHeartbeat = typeof focusHeartbeats.$inferInsert
