import { relations } from 'drizzle-orm'
import { classes, enrollments } from './classes'
import { curricula, subjects } from './curricula'
import { quizAttempts, quizChoices, quizQuestions, quizzes } from './quizzes'
import { gameAnswers, gameParticipants, gameSessions } from './game_sessions'
import { taskTemplates } from './task_templates'
import { tasks } from './tasks'
import { users } from './users'

export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  class: one(classes, {
    fields: [taskTemplates.classId],
    references: [classes.id],
  }),
  teacher: one(users, {
    fields: [taskTemplates.teacherId],
    references: [users.id],
  }),
  tasks: many(tasks),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  template: one(taskTemplates, {
    fields: [tasks.templateId],
    references: [taskTemplates.id],
  }),
}))

export const curriculaRelations = relations(curricula, ({ many }) => ({
  subjects: many(subjects),
}))

export const subjectsRelations = relations(subjects, ({ one }) => ({
  curriculum: one(curricula, {
    fields: [subjects.curriculumId],
    references: [curricula.id],
  }),
}))

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classes.teacherId],
    references: [users.id],
  }),
  curriculum: one(curricula, {
    fields: [classes.curriculumId],
    references: [curricula.id],
  }),
  subject: one(subjects, {
    fields: [classes.subjectId],
    references: [subjects.id],
  }),
  enrollments: many(enrollments),
  quizzes: many(quizzes),
}))

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
}))

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  class: one(classes, {
    fields: [quizzes.classId],
    references: [classes.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}))

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  choices: many(quizChoices),
}))

export const quizChoicesRelations = relations(quizChoices, ({ one }) => ({
  question: one(quizQuestions, {
    fields: [quizChoices.questionId],
    references: [quizQuestions.id],
  }),
}))

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  student: one(users, {
    fields: [quizAttempts.studentId],
    references: [users.id],
  }),
}))

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [gameSessions.quizId],
    references: [quizzes.id],
  }),
  host: one(users, {
    fields: [gameSessions.hostId],
    references: [users.id],
  }),
  participants: many(gameParticipants),
}))

export const gameParticipantsRelations = relations(gameParticipants, ({ one, many }) => ({
  session: one(gameSessions, {
    fields: [gameParticipants.sessionId],
    references: [gameSessions.id],
  }),
  student: one(users, {
    fields: [gameParticipants.studentId],
    references: [users.id],
  }),
  answers: many(gameAnswers),
}))

export const gameAnswersRelations = relations(gameAnswers, ({ one }) => ({
  participant: one(gameParticipants, {
    fields: [gameAnswers.participantId],
    references: [gameParticipants.id],
  }),
  question: one(quizQuestions, {
    fields: [gameAnswers.questionId],
    references: [quizQuestions.id],
  }),
}))
