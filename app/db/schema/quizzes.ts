import { boolean, index, integer, jsonb, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { classes } from './classes'
import { curricula, subjects } from './curricula'
import { users } from './users'
import type { QuestionAnswerConfig, QuestionResponseData } from '@/features/quizzes/questionTypes'

export const questionTypeEnum = pgEnum('question_type', [
  'multiple_choice',
  'true_false',
  'multi_select',
  'fill_blank',
  'poll',
  'open_ended',
  'match',
  'reorder',
  'categorize',
  'dropdown',
  'table_fill',
  'audio_response',
  'video_response',
  'draw',
  'hotspot',
  'math_response',
  'graphing',
])
// 'public' = visible beyond the owning class/author: to any authenticated
// user, and (via a separate adminDb-backed read path, since anonymous
// visitors have no RLS user context at all) to anonymous landing-page
// visitors too. 'private' is the original, unchanged class-only behavior.
export const quizVisibilityEnum = pgEnum('quiz_visibility', ['private', 'public'])

export const quizzes = pgTable(
  'quizzes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable as of the admin content system: a teacher's quiz always has
    // one, but an admin-authored quiz (never tied to any class) doesn't.
    classId: uuid('class_id').references(() => classes.id, { onDelete: 'cascade' }),
    // The creating user — a teacher (classId set) or an admin (classId
    // null). Nullable only because existing rows predate this column;
    // every new quiz always sets it (backfilled for old rows via
    // app/db/backfill-quiz-authors.ts).
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    visibility: quizVisibilityEnum('visibility').notNull().default('private'),
    // Only meaningful when classId is null (admin content has no class to
    // inherit a subject/grade from). A class-owned quiz's subject/grade
    // comes from its class instead — deliberately not duplicated here.
    curriculumId: uuid('curriculum_id').references(() => curricula.id, { onDelete: 'set null' }),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    gradeLabel: text('grade_label'),
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
    index('quizzes_author_id_idx').on(table.authorId),
    index('quizzes_visibility_idx').on(table.visibility),
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
    // The correct-answer shape for every NON-choice-based type (quiz_choices
    // keeps handling multiple_choice/true_false/multi_select exactly as
    // before — this column stays null for those three).
    answerConfig: jsonb('answer_config').$type<QuestionAnswerConfig>(),
    // Audio/video response, draw, hotspot, math response, graphing — no
    // deterministic auto-check exists for these, so grading always leaves
    // isCorrect null until a teacher reviews the submission.
    requiresManualGrading: boolean('requires_manual_grading').notNull().default(false),
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
    // The student's answer for every non-single-choice type (mirrors
    // QuestionAnswerConfig's shapes). multi_select uses quizAnswerChoices
    // below instead, since it needs real referential integrity to
    // quiz_choices rows for grading, not a JSON array of ids.
    responseData: jsonb('response_data').$type<QuestionResponseData>(),
    gradedByTeacherId: uuid('graded_by_teacher_id').references(() => users.id, { onDelete: 'set null' }),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
  },
  (table) => [
    index('quiz_answers_attempt_id_idx').on(table.attemptId),
    pgPolicy('quiz_answers_select', { for: 'select' }),
    pgPolicy('quiz_answers_insert', { for: 'insert' }),
    pgPolicy('quiz_answers_update', { for: 'update' }),
  ],
).enableRLS()

// multi_select answers: one row per choice the student picked. A join
// table (not a JSON array of ids on quiz_answers) so grading can still join
// straight to quiz_choices for isCorrect, same as single-choice answers.
export const quizAnswerChoices = pgTable(
  'quiz_answer_choices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    answerId: uuid('answer_id')
      .notNull()
      .references(() => quizAnswers.id, { onDelete: 'cascade' }),
    choiceId: uuid('choice_id')
      .notNull()
      .references(() => quizChoices.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('quiz_answer_choices_answer_id_idx').on(table.answerId),
    pgPolicy('quiz_answer_choices_select', { for: 'select' }),
    pgPolicy('quiz_answer_choices_insert', { for: 'insert' }),
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
export type QuizAnswerChoice = typeof quizAnswerChoices.$inferSelect
export type NewQuizAnswerChoice = typeof quizAnswerChoices.$inferInsert
