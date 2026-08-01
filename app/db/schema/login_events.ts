import { index, pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

// One append-only row per login, unlike users.lastLoginAt which is
// overwritten each time — needed for the procrastination "start delay"
// trend chart, which has to compare each day's actual login time against
// that day's first focus session, not just the single most recent login.
export const loginEvents = pgTable(
  'login_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loginAt: timestamp('login_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('login_events_user_id_idx').on(table.userId),
    index('login_events_login_at_idx').on(table.loginAt),
    pgPolicy('login_events_self_access', { for: 'all' }),
  ],
).enableRLS()

export type LoginEvent = typeof loginEvents.$inferSelect
export type NewLoginEvent = typeof loginEvents.$inferInsert
