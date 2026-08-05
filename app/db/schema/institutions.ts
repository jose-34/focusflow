import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Reference data, not scoped to any one role's RLS — same "plain INSERT,
// no enum migration" convention as curricula/subjects. Only the admin
// dashboard reads this today; policy body lives in app/db/apply-rls.ts.
export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    campus: text('campus'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
).enableRLS()

export type Institution = typeof institutions.$inferSelect
export type NewInstitution = typeof institutions.$inferInsert
