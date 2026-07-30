import { boolean, index, integer, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'
import { users } from './users'

export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'true_false'])

export const quizzes = pgTable(
  'quizzes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    timeLimitMinutes: integer('time_limit_minutes'),
    // Assignment deadline — distinct from timeLimitMinutes (the per-attempt
    // countdown). Setting this is what turns a quiz into an "assignment": it
    // gates auto-creation of a linked task in each enrolled student's list.
    dueDate: timestamp('due_date', { withTimezone: true }),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('quizzes_class_id_idx').on(table.classId),
    pgPolicy('quizzes_select', { for: 'select' }),
    pgPolicy('quizzes_insert', { for: 'insert' }),
    pgPolicy('quizzes_update', { for: 'update' }),
    pgPolicy('quizzes_delete', { for: 'delete' }),
  ],
).enableRLS()

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    questionType: questionTypeEnum('question_type').notNull().default('multiple_choice'),
    position: integer('position').notNull().default(0),
    points: integer('points').notNull().default(1),
  },
  (table) => [
    index('quiz_questions_quiz_id_idx').on(table.quizId),
    pgPolicy('quiz_questions_select', { for: 'select' }),
    pgPolicy('quiz_questions_insert', { for: 'insert' }),
    pgPolicy('quiz_questions_update', { for: 'update' }),
    pgPolicy('quiz_questions_delete', { for: 'delete' }),
  ],
).enableRLS()

export const quizChoices = pgTable(
  'quiz_choices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    choiceText: text('choice_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('quiz_choices_question_id_idx').on(table.questionId),
    pgPolicy('quiz_choices_select', { for: 'select' }),
    pgPolicy('quiz_choices_insert', { for: 'insert' }),
    pgPolicy('quiz_choices_update', { for: 'update' }),
    pgPolicy('quiz_choices_delete', { for: 'delete' }),
  ],
).enableRLS()

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    score: integer('score'),
    maxScore: integer('max_score').notNull().default(0),
  },
  (table) => [
    index('quiz_attempts_quiz_id_idx').on(table.quizId),
    index('quiz_attempts_student_id_idx').on(table.studentId),
    pgPolicy('quiz_attempts_select', { for: 'select' }),
    pgPolicy('quiz_attempts_insert', { for: 'insert' }),
    pgPolicy('quiz_attempts_update', { for: 'update' }),
  ],
).enableRLS()

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    selectedChoiceId: uuid('selected_choice_id').references(() => quizChoices.id, { onDelete: 'set null' }),
    isCorrect: boolean('is_correct'),
  },
  (table) => [
    index('quiz_answers_attempt_id_idx').on(table.attemptId),
    pgPolicy('quiz_answers_select', { for: 'select' }),
    pgPolicy('quiz_answers_insert', { for: 'insert' }),
    pgPolicy('quiz_answers_update', { for: 'update' }),
  ],
).enableRLS()

export type Quiz = typeof quizzes.$inferSelect
export type NewQuiz = typeof quizzes.$inferInsert
export type QuizQuestion = typeof quizQuestions.$inferSelect
export type NewQuizQuestion = typeof quizQuestions.$inferInsert
export type QuizChoice = typeof quizChoices.$inferSelect
export type NewQuizChoice = typeof quizChoices.$inferInsert
export type QuizAttempt = typeof quizAttempts.$inferSelect
export type NewQuizAttempt = typeof quizAttempts.$inferInsert
export type QuizAnswer = typeof quizAnswers.$inferSelect
export type NewQuizAnswer = typeof quizAnswers.$inferInsert
