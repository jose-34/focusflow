import { pgTable, uuid, timestamp, text, integer, boolean } from 'drizzle-orm/pg-core'

export const startEvents = pgTable('start_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id').notNull(),
  userId: uuid('user_id').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull().defaultNow(),
  startMethod: text('start_method').notNull(),
  startXp: integer('start_xp').notNull().default(0),
  startToken: text('start_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const focusSessions = pgTable('focus_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  startEventId: uuid('start_event_id').notNull(),
  userId: uuid('user_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const focusHeartbeats = pgTable('focus_heartbeats', {
  id: uuid('id').defaultRandom().primaryKey(),
  focusSessionId: uuid('focus_session_id'),
  startEventId: uuid('start_event_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  userId: uuid('user_id').notNull(),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
