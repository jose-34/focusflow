import { z } from 'zod'
import { isChoiceBasedType, isManualGradingType, questionTypeValues } from './questionTypes'
import { AI_GENERATABLE_QUESTION_TYPES } from '@/lib/ai'

// Shared by every AI-generation entry point (document-based and
// topic-based, admin and teacher). Grade/DOK/language are free-form
// prompt-shaping hints, not enforced foreign keys — curriculum/subject
// stay explicit user picks everywhere since those are real relations the
// model can't safely guess.
const dokLevelSchema = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
)

const aiGenerationOptionsSchema = {
  gradeLevel: z.string().max(50).optional(),
  dokLevel: dokLevelSchema,
  language: z.string().max(30).default('en'),
  questionTypes: z.array(z.enum(AI_GENERATABLE_QUESTION_TYPES)).min(1).default(['multiple_choice']),
}

export const createQuizSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000).optional(),
  timeLimitMinutes: z
    .union([z.coerce.number().int().min(1, 'Must be at least 1 minute').max(180, 'Must be 180 minutes or less'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  // Setting this turns the quiz into an "assignment": a task auto-appears in
  // each enrolled student's task list once they can see the published quiz.
  dueDate: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateQuizInput = z.infer<typeof createQuizSchema>

// Admin's classless public content — no classId, but needs its own
// curriculum/subject/grade tagging since there's no class to inherit that
// from. Kept as its own schema rather than making classId optional on
// createQuizSchema above, so the teacher path's validation never has to
// reason about an admin-only shape.
export const createAdminQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000).optional(),
  curriculumId: z.string().uuid(),
  subjectId: z.string().uuid(),
  gradeLabel: z.string().max(50).optional(),
  timeLimitMinutes: z
    .union([z.coerce.number().int().min(1, 'Must be at least 1 minute').max(180, 'Must be 180 minutes or less'), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
})

export type CreateAdminQuizInput = z.infer<typeof createAdminQuizSchema>

// Separate from "publish" (draft vs. live within its own class/library) —
// this is the "how far beyond that does it reach" toggle: private stays
// class-only (or, for admin content, author-only), public reaches any
// authenticated user plus anonymous landing-page visitors.
export const toggleVisibilitySchema = z.object({
  quizId: z.string().uuid(),
  visibility: z.enum(['private', 'public']),
})

export type ToggleVisibilityInput = z.infer<typeof toggleVisibilitySchema>

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const generateQuestionsSchema = z.object({
  quizId: z.string().uuid(),
  mimeType: z.enum(ACCEPTED_DOCUMENT_MIME_TYPES),
  // Base64-encoded file content, no `data:` URL prefix. ~8MB raw file cap
  // is enforced client-side and re-checked server-side (base64 inflates
  // size ~33%, so this ceiling is generous relative to that check).
  fileBase64: z.string().min(1).max(12_000_000),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  ...aiGenerationOptionsSchema,
})

// z.input (not z.infer) — language/questionTypes/questionCount all have
// zod .default()s, which z.infer treats as required-on-output; the client
// needs the input-side type where defaulted fields stay optional.
export type GenerateQuestionsInput = z.input<typeof generateQuestionsSchema>

// "Generate a whole new quiz from a document" — the AI supplies the title,
// so unlike createAdminQuizSchema/createQuizSchema there's no title field
// here. Curriculum/subject/grade are still real foreign keys the AI can't
// safely guess, so those stay explicit user picks.
export const generateAdminQuizFromDocumentSchema = z.object({
  curriculumId: z.string().uuid(),
  subjectId: z.string().uuid(),
  gradeLabel: z.string().max(50).optional(),
  mimeType: z.enum(ACCEPTED_DOCUMENT_MIME_TYPES),
  fileBase64: z.string().min(1).max(12_000_000),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  ...aiGenerationOptionsSchema,
})

export type GenerateAdminQuizFromDocumentInput = z.input<typeof generateAdminQuizFromDocumentSchema>

export const generateClassQuizFromDocumentSchema = z.object({
  classId: z.string().uuid(),
  mimeType: z.enum(ACCEPTED_DOCUMENT_MIME_TYPES),
  fileBase64: z.string().min(1).max(12_000_000),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  ...aiGenerationOptionsSchema,
})

export type GenerateClassQuizFromDocumentInput = z.input<typeof generateClassQuizFromDocumentSchema>

// Text-only "describe a topic" mode — same generation options, no file.
export const generateAdminQuizFromTopicSchema = z.object({
  curriculumId: z.string().uuid(),
  subjectId: z.string().uuid(),
  gradeLabel: z.string().max(50).optional(),
  topic: z.string().min(3, 'Describe the topic in a bit more detail').max(500),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  ...aiGenerationOptionsSchema,
})

export type GenerateAdminQuizFromTopicInput = z.input<typeof generateAdminQuizFromTopicSchema>

export const generateClassQuizFromTopicSchema = z.object({
  classId: z.string().uuid(),
  topic: z.string().min(3, 'Describe the topic in a bit more detail').max(500),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  ...aiGenerationOptionsSchema,
})

export type GenerateClassQuizFromTopicInput = z.input<typeof generateClassQuizFromTopicSchema>

export { questionTypeValues }

const choiceSchema = z.object({
  choiceText: z.string().min(1, 'Choice text is required').max(500, 'Choice text is too long'),
  isCorrect: z.boolean(),
})

const answerConfigSchema = z.union([
  z.object({ kind: z.literal('fill_blank'), acceptedAnswers: z.array(z.string().min(1)).min(1), caseSensitive: z.boolean().optional() }),
  z.object({ kind: z.literal('open_ended'), sampleAnswer: z.string().optional() }),
  z.object({ kind: z.literal('match'), pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).min(2) }),
  z.object({ kind: z.literal('reorder'), correctOrder: z.array(z.string().min(1)).min(2) }),
  z.object({
    kind: z.literal('categorize'),
    categories: z.array(z.string().min(1)).min(2),
    items: z.array(z.object({ text: z.string().min(1), category: z.string().min(1) })).min(2),
  }),
  z.object({
    kind: z.literal('dropdown'),
    segments: z.array(
      z.union([
        z.object({ text: z.string() }),
        z.object({ blankOptions: z.array(z.string().min(1)).min(2), correctIndex: z.number().int().min(0) }),
      ]),
    ),
  }),
  z.object({
    kind: z.literal('table_fill'),
    rows: z.array(z.string().min(1)).min(1),
    columns: z.array(z.string().min(1)).min(1),
    answers: z.record(z.string(), z.string()),
  }),
  z.object({ kind: z.literal('manual') }),
])

// One schema, not 17 discriminated-union branches — `questionType` still
// picks the required shape, but via superRefine rather than a literal-keyed
// union, since most types share either the "choices" or "answerConfig"
// shape and a real discriminated union would mean duplicating that shape
// per type for no validation benefit.
export const createQuestionSchema = z
  .object({
    quizId: z.string().uuid(),
    questionText: z.string().min(1, 'Question text is required').max(1000, 'Question text is too long'),
    questionType: z.enum(questionTypeValues),
    points: z.coerce.number().int().min(1, 'Must be at least 1 point').max(100, 'Must be 100 points or less'),
    choices: z.array(choiceSchema).min(2, 'At least 2 choices are required').max(6, 'At most 6 choices are allowed').optional(),
    answerConfig: answerConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (isChoiceBasedType(data.questionType)) {
      if (!data.choices) {
        ctx.addIssue({ code: 'custom', message: 'Choices are required for this question type', path: ['choices'] })
        return
      }
      const correctCount = data.choices.filter((c) => c.isCorrect).length
      if (data.questionType === 'multi_select' && correctCount < 1) {
        ctx.addIssue({ code: 'custom', message: 'At least one choice must be marked as correct', path: ['choices'] })
      }
      if ((data.questionType === 'multiple_choice' || data.questionType === 'true_false') && correctCount !== 1) {
        ctx.addIssue({ code: 'custom', message: 'Exactly one choice must be marked as correct', path: ['choices'] })
      }
      // Poll intentionally has no correct-choice requirement — it just
      // collects opinions, so `correctCount` is never validated for it.
      if (data.questionType === 'true_false' && data.choices.length !== 2) {
        ctx.addIssue({ code: 'custom', message: 'True/False questions need exactly 2 choices', path: ['choices'] })
      }
    } else if (isManualGradingType(data.questionType)) {
      // Manual-grading types (audio/video response, draw, hotspot, math
      // response, graphing) need no answerConfig payload beyond the
      // question text itself — the teacher grades the submission directly.
    } else if (!data.answerConfig || data.answerConfig.kind !== data.questionType) {
      ctx.addIssue({ code: 'custom', message: 'Answer configuration does not match the selected question type', path: ['answerConfig'] })
    }
  })

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedChoiceId: z.string().uuid().nullable().optional(),
  selectedChoiceIds: z.array(z.string().uuid()).optional(),
  responseData: z.record(z.string(), z.unknown()).optional(),
})

export const submitQuizSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(submitAnswerSchema),
})

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>
