import { sql } from 'drizzle-orm'
import { check, index, integer, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const wellnessLogs = pgTable(
  'wellness_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mood: integer('mood').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('wellness_logs_user_id_idx').on(table.userId),
    check('wellness_logs_mood_range', sql`${table.mood} >= 1 AND ${table.mood} <= 5`),
    pgPolicy('wellness_logs_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

export type WellnessLog = typeof wellnessLogs.$inferSelect
export type NewWellnessLog = typeof wellnessLogs.$inferInsert
