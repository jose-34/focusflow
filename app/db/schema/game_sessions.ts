import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { quizChoices, quizQuestions, quizzes } from './quizzes'
import { users } from './users'

export const gameSessionStatusEnum = pgEnum('game_session_status', ['lobby', 'question', 'reveal', 'finished'])
// 'class' = today's behavior, enrolled students only. 'public' = anyone
// with the PIN may join as a guest (see gameParticipants.studentId below).
export const gameAccessModeEnum = pgEnum('game_access_mode', ['class', 'public'])

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pin: text('pin').notNull().unique(),
    status: gameSessionStatusEnum('status').notNull().default('lobby'),
    accessMode: gameAccessModeEnum('access_mode').notNull().default('class'),
    currentQuestionIndex: integer('current_question_index').notNull().default(0),
    questionDurationSeconds: integer('question_duration_seconds').notNull().default(20),
    phaseStartedAt: timestamp('phase_started_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('game_sessions_quiz_id_idx').on(table.quizId),
    pgPolicy('game_sessions_select', { for: 'select' }),
    pgPolicy('game_sessions_insert', { for: 'insert' }),
    pgPolicy('game_sessions_update', { for: 'update' }),
  ],
).enableRLS()

export const gameParticipants = pgTable(
  'game_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    // Nullable: a public-session guest has no users row at all — their
    // typed official name lives directly in `nickname` below, and every
    // guest access path is authorized by knowing this row's own id (an
    // unguessable uuid) rather than a studentId, via adminDb-backed guest
    // server functions instead of withRlsContext.
    studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    score: integer('score').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Partial: only prevents a registered student from double-joining.
    // Guest rows (studentId null) are intentionally unconstrained here.
    uniqueIndex('game_participants_session_student_idx').on(table.sessionId, table.studentId).where(sql`${table.studentId} is not null`),
    pgPolicy('game_participants_select', { for: 'select' }),
    pgPolicy('game_participants_insert', { for: 'insert' }),
    pgPolicy('game_participants_update', { for: 'update' }),
  ],
).enableRLS()

export const gameAnswers = pgTable(
  'game_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => gameParticipants.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    selectedChoiceId: uuid('selected_choice_id').references(() => quizChoices.id, { onDelete: 'set null' }),
    isCorrect: boolean('is_correct').notNull(),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    responseTimeMs: integer('response_time_ms').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('game_answers_participant_question_idx').on(table.participantId, table.questionId),
    pgPolicy('game_answers_select', { for: 'select' }),
    pgPolicy('game_answers_insert', { for: 'insert' }),
  ],
).enableRLS()

export type GameSession = typeof gameSessions.$inferSelect
export type NewGameSession = typeof gameSessions.$inferInsert
export type GameParticipant = typeof gameParticipants.$inferSelect
export type NewGameParticipant = typeof gameParticipants.$inferInsert
export type GameAnswer = typeof gameAnswers.$inferSelect
export type NewGameAnswer = typeof gameAnswers.$inferInsert
