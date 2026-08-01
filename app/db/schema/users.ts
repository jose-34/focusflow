import { sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended'])
export const userRoleEnum = pgEnum('user_role', ['student', 'teacher'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    role: userRoleEnum('role').notNull().default('student'),
    gradeLevel: integer('grade_level'),
    // Sprint 5: xp column deleted — xp_ledger is the sole source of truth
    // for a user's XP total. This was a write-only running counter with
    // zero readers anywhere in the app (confirmed by grep before removing
    // it, not assumed); a real consumer, once one exists, computes the
    // total with SUM(amount) FROM xp_ledger WHERE user_id = ?, already
    // indexed by user_id.
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'users_grade_level_range',
      sql`${table.gradeLevel} IS NULL OR (${table.gradeLevel} >= 4 AND ${table.gradeLevel} <= 12)`,
    ),
    pgPolicy('users_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.id}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.id}`,
    }),
  ],
).enableRLS()

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_token_idx').on(table.token),
    pgPolicy('sessions_self_access', {
      for: 'all',
      using: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
      withCheck: sql`nullif(current_setting('app.user_id', true), '')::uuid = ${table.userId}`,
    }),
  ],
).enableRLS()

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
