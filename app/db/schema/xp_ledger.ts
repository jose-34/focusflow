import { sql } from 'drizzle-orm'
import { index, jsonb, pgPolicy, pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const xpLedger = pgTable(
  'xp_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    source: text('source').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('xp_ledger_user_id_idx').on(table.userId),
    pgPolicy('xp_ledger_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

export type XpLedger = typeof xpLedger.$inferSelect
export type NewXpLedger = typeof xpLedger.$inferInsert
