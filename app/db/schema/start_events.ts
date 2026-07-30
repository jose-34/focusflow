import { pgPolicy, pgTable, uuid, timestamp, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const startEvents = pgTable(
  'start_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assignmentId: uuid('assignment_id').notNull(),
    userId: uuid('user_id').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull().defaultNow(),
    startMethod: text('start_method').notNull(),
    startXp: integer('start_xp').notNull().default(0),
    startToken: text('start_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('start_events_assignment_user_uidx').on(table.assignmentId, table.userId),
    uniqueIndex('start_events_start_token_uidx').on(table.startToken),
    index('start_events_user_id_idx').on(table.userId),
    index('start_events_assignment_id_idx').on(table.assignmentId),
    index('start_events_start_token_idx').on(table.startToken),
    // Real policy body lives in app/db/apply-rls.ts (see that file for why).
    pgPolicy('start_events_self_access', { for: 'all' }),
  ],
).enableRLS()

export type StartEvent = typeof startEvents.$inferSelect
export type NewStartEvent = typeof startEvents.$inferInsert
