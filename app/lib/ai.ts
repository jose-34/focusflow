import { GoogleGenAI } from '@google/genai'
import mammoth from 'mammoth'
import type { QuestionAnswerConfig, QuestionTypeValue } from '@/features/quizzes/questionTypes'

// Lazy singleton — constructing GoogleGenAI() throws immediately if
// GEMINI_API_KEY is unset, and this module is imported by server function
// files that also handle plenty of requests that never touch AI features.
// Constructing eagerly at module load would crash the whole app on any
// request if the key is missing/misconfigured, not just AI calls.
let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024 // 8MB raw file size

// Only types with a clear, compactly-representable "correct answer" shape
// are worth asking the model to generate. Poll (no correct answer) and the
// manual-grading types (audio/video response, draw, hotspot, math
// response, graphing) aren't included — there's nothing meaningful for the
// model to generate for those beyond the question text itself, which
// authoring already covers directly.
export const AI_GENERATABLE_QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  'multi_select',
  'fill_blank',
  'match',
  'reorder',
  'categorize',
  'table_fill',
] as const satisfies ReadonlyArray<QuestionTypeValue>

export type AiGeneratableQuestionType = (typeof AI_GENERATABLE_QUESTION_TYPES)[number]

export interface GeneratedChoice {
  choiceText: string
  isCorrect: boolean
}

export interface GeneratedQuestion {
  questionText: string
  questionType: QuestionTypeValue
  points: number
  choices?: Array<GeneratedChoice>
  answerConfig?: QuestionAnswerConfig
}

// The raw shape Gemini emits — one flat object with every type's fields
// present as optional, rather than a discriminated oneOf. A flatter schema
// is markedly more reliable for structured-output models to fill correctly
// than a nested union, at the cost of needing real validation afterward
// (toGeneratedQuestion below) rather than trusting the schema alone.
interface RawGeneratedQuestion {
  questionType: string
  questionText: string
  points: number
  choices?: Array<GeneratedChoice>
  acceptedAnswers?: Array<string>
  pairs?: Array<{ left: string; right: string }>
  steps?: Array<string>
  categories?: Array<string>
  items?: Array<{ text: string; category: string }>
  rows?: Array<string>
  columns?: Array<string>
  cells?: Array<{ row: string; column: string; answer: string }>
}

const rawQuestionItemSchema = {
  type: 'object',
  properties: {
    questionType: { type: 'string', description: 'One of the allowed question types listed in the prompt' },
    questionText: { type: 'string', description: 'The question, self-contained and answerable from the material alone' },
    points: { type: 'integer', description: 'Point value 1-10, higher for questions requiring deeper reasoning' },
    choices: {
      type: 'array',
      description: 'multiple_choice/true_false/multi_select only: the answer choices, each with isCorrect set',
      items: {
        type: 'object',
        properties: { choiceText: { type: 'string' }, isCorrect: { type: 'boolean' } },
        required: ['choiceText', 'isCorrect'],
      },
    },
    acceptedAnswers: { type: 'array', description: 'fill_blank only: acceptable correct answers', items: { type: 'string' } },
    pairs: {
      type: 'array',
      description: 'match only: left/right pairs to match',
      items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } }, required: ['left', 'right'] },
    },
    steps: { type: 'array', description: 'reorder only: steps/items in their correct order', items: { type: 'string' } },
    categories: { type: 'array', description: 'categorize only: the category names', items: { type: 'string' } },
    items: {
      type: 'array',
      description: 'categorize only: items to sort, each with its correct category (must match one of `categories`)',
      items: { type: 'object', properties: { text: { type: 'string' }, category: { type: 'string' } }, required: ['text', 'category'] },
    },
    rows: { type: 'array', description: 'table_fill only: row labels', items: { type: 'string' } },
    columns: { type: 'array', description: 'table_fill only: column labels', items: { type: 'string' } },
    cells: {
      type: 'array',
      description: 'table_fill only: the correct answer for each row/column combination',
      items: {
        type: 'object',
        properties: { row: { type: 'string' }, column: { type: 'string' }, answer: { type: 'string' } },
        required: ['row', 'column', 'answer'],
      },
    },
  },
  required: ['questionType', 'questionText', 'points'],
}

// Plain JSON Schema, passed via responseJsonSchema — Gemini enforces this
// on the response, so no separate parsing/validation pass is needed and
// there's no risk of the model wrapping the array in explanatory prose.
const questionsJsonSchema = {
  type: 'object',
  properties: { questions: { type: 'array', items: rawQuestionItemSchema } },
  required: ['questions'],
}

const quizWithTitleJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A short, specific quiz title describing what this covers (e.g. "Photosynthesis Basics"), not a generic label' },
    questions: { type: 'array', items: rawQuestionItemSchema },
  },
  required: ['title', 'questions'],
}

// DOCX has no native Gemini document-understanding support (unlike PDF/
// images, which Gemini reads directly via inlineData) — extract to plain
// text first via mammoth, then treat it the same as a .txt upload.
async function extractTextIfNeeded(mimeType: string, base64: string): Promise<string | null> {
  if (mimeType === 'text/plain') {
    return Buffer.from(base64, 'base64').toString('utf-8')
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(base64, 'base64') })
    return value
  }
  return null
}

const DOK_GUIDANCE: Record<1 | 2 | 3, string> = {
  1: 'Depth of Knowledge Level 1 (Recall): test recognition and recall of facts, terms, and definitions directly stated in the material.',
  2: 'Depth of Knowledge Level 2 (Application/Skill): require applying a concept or procedure to a straightforward situation, not just recalling a fact.',
  3: 'Depth of Knowledge Level 3 (Strategic Thinking): require multi-step reasoning, analysis, or justifying a conclusion using the material.',
}

const TYPE_PROMPT_HINTS: Record<AiGeneratableQuestionType, string> = {
  multiple_choice: 'multiple_choice: exactly 4 choices, exactly one isCorrect: true.',
  true_false: 'true_false: exactly 2 choices ("True"/"False"), exactly one isCorrect: true.',
  multi_select: 'multi_select: 4-6 choices, 2 or more marked isCorrect: true.',
  fill_blank: 'fill_blank: questionText contains a blank (e.g. "____"), acceptedAnswers lists 1-3 acceptable correct answers.',
  match: 'match: pairs lists 3-5 {left, right} pairs to match up.',
  reorder: 'reorder: steps lists 3-6 items in their correct order.',
  categorize: 'categorize: categories lists 2-4 category names; items lists 4-8 {text, category} entries, each category value matching one of `categories`.',
  table_fill: 'table_fill: rows and columns each list 2-4 labels; cells lists the correct answer for every row/column combination (rows.length × columns.length entries).',
}

export interface GenerateOptions {
  gradeLevel?: string
  dokLevel?: 1 | 2 | 3
  language?: string
  questionTypes?: Array<AiGeneratableQuestionType>
}

function buildQuestionPrompt(questionCount: number, includeTitle: boolean, options: GenerateOptions = {}): string {
  const titlePart = includeTitle ? ' Also generate a short, specific title for a quiz built from this material.' : ''
  const types = options.questionTypes?.length ? options.questionTypes : (['multiple_choice'] as Array<AiGeneratableQuestionType>)
  const typeHints = types.map((t) => TYPE_PROMPT_HINTS[t]).join(' ')
  const typeInstruction =
    types.length === 1
      ? ` Every question must be of type "${types[0]}". ${typeHints}`
      : ` Distribute questions across these types as makes sense for the content: ${types.join(', ')}. For each type: ${typeHints}`
  const gradeClause = options.gradeLevel ? ` Write at a level appropriate for ${options.gradeLevel} students.` : ''
  const dokClause = options.dokLevel ? ` ${DOK_GUIDANCE[options.dokLevel]}` : ''
  const languageClause = options.language && options.language !== 'en' ? ` Write the question text and all answer content in ${options.language}.` : ''

  return `Read the attached study material and generate exactly ${questionCount} quiz questions that test understanding of its content.${titlePart}${typeInstruction}${gradeClause}${dokClause}${languageClause} Assign points 1-10 based on difficulty. Every "questionType" value must be exactly one of: ${types.join(', ')}. Questions must be answerable from the material alone — do not invent facts not present in it.`
}

function buildTopicPrompt(topic: string, questionCount: number, options: GenerateOptions = {}): string {
  const types = options.questionTypes?.length ? options.questionTypes : (['multiple_choice'] as Array<AiGeneratableQuestionType>)
  const typeHints = types.map((t) => TYPE_PROMPT_HINTS[t]).join(' ')
  const typeInstruction =
    types.length === 1
      ? ` Every question must be of type "${types[0]}". ${typeHints}`
      : ` Distribute questions across these types as makes sense for the topic: ${types.join(', ')}. For each type: ${typeHints}`
  const gradeClause = options.gradeLevel ? ` Write at a level appropriate for ${options.gradeLevel} students.` : ''
  const dokClause = options.dokLevel ? ` ${DOK_GUIDANCE[options.dokLevel]}` : ''
  const languageClause = options.language && options.language !== 'en' ? ` Write the question text and all answer content in ${options.language}.` : ''

  return `Generate exactly ${questionCount} quiz questions and a short, specific quiz title about this topic: "${topic}".${typeInstruction}${gradeClause}${dokClause}${languageClause} Assign points 1-10 based on difficulty. Every "questionType" value must be exactly one of: ${types.join(', ')}.`
}

async function callGemini(params: { mimeType?: string; base64?: string; prompt: string; schema: object }): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

  if (params.mimeType && params.base64) {
    const extractedText = await extractTextIfNeeded(params.mimeType, params.base64)
    if (extractedText !== null) {
      parts.push({ text: `--- Document content ---\n${extractedText}\n--- End of document ---\n\n${params.prompt}` })
    } else {
      parts.push({ inlineData: { mimeType: params.mimeType, data: params.base64 } })
      parts.push({ text: params.prompt })
    }
  } else {
    parts.push({ text: params.prompt })
  }

  const response = await getClient().models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: params.schema,
    },
  })

  const text = response.text
  if (!text) {
    throw new Error('The AI did not return a response — try again or use a clearer prompt.')
  }
  return text
}

// Converts a raw, loosely-typed Gemini item into a real GeneratedQuestion,
// or null if it doesn't validate for its declared type — mirrors the
// defensive-filtering role the old sanitizeQuestions played for
// multiple_choice, now generalized across every AI-generatable type.
function toGeneratedQuestion(raw: RawGeneratedQuestion, allowedTypes: Array<AiGeneratableQuestionType>): GeneratedQuestion | null {
  if (!allowedTypes.includes(raw.questionType as AiGeneratableQuestionType)) return null
  const points = Math.max(1, Math.min(10, Math.round(raw.points || 1)))
  const questionText = raw.questionText?.trim()
  if (!questionText) return null

  switch (raw.questionType as AiGeneratableQuestionType) {
    case 'multiple_choice': {
      const choices = raw.choices ?? []
      if (choices.length < 2 || choices.filter((c) => c.isCorrect).length !== 1) return null
      return { questionText, questionType: 'multiple_choice', points, choices }
    }
    case 'true_false': {
      const choices = raw.choices ?? []
      if (choices.length !== 2 || choices.filter((c) => c.isCorrect).length !== 1) return null
      return { questionText, questionType: 'true_false', points, choices }
    }
    case 'multi_select': {
      const choices = raw.choices ?? []
      if (choices.length < 3 || choices.filter((c) => c.isCorrect).length < 1) return null
      return { questionText, questionType: 'multi_select', points, choices }
    }
    case 'fill_blank': {
      const acceptedAnswers = (raw.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean)
      if (acceptedAnswers.length === 0) return null
      return { questionText, questionType: 'fill_blank', points, answerConfig: { kind: 'fill_blank', acceptedAnswers } }
    }
    case 'match': {
      const pairs = (raw.pairs ?? []).filter((p) => p.left?.trim() && p.right?.trim())
      if (pairs.length < 2) return null
      return { questionText, questionType: 'match', points, answerConfig: { kind: 'match', pairs } }
    }
    case 'reorder': {
      const correctOrder = (raw.steps ?? []).map((s) => s.trim()).filter(Boolean)
      if (correctOrder.length < 2) return null
      return { questionText, questionType: 'reorder', points, answerConfig: { kind: 'reorder', correctOrder } }
    }
    case 'categorize': {
      const categories = (raw.categories ?? []).map((c) => c.trim()).filter(Boolean)
      const items = (raw.items ?? []).filter((i) => i.text?.trim() && categories.includes(i.category))
      if (categories.length < 2 || items.length < 2) return null
      return { questionText, questionType: 'categorize', points, answerConfig: { kind: 'categorize', categories, items } }
    }
    case 'table_fill': {
      const rows = (raw.rows ?? []).map((r) => r.trim()).filter(Boolean)
      const columns = (raw.columns ?? []).map((c) => c.trim()).filter(Boolean)
      const answers: Record<string, string> = {}
      for (const cell of raw.cells ?? []) {
        if (rows.includes(cell.row) && columns.includes(cell.column) && cell.answer?.trim()) {
          answers[`${cell.row}|${cell.column}`] = cell.answer.trim()
        }
      }
      if (rows.length === 0 || columns.length === 0 || Object.keys(answers).length === 0) return null
      return { questionText, questionType: 'table_fill', points, answerConfig: { kind: 'table_fill', rows, columns, answers } }
    }
    default:
      return null
  }
}

function sanitizeQuestions(raw: Array<RawGeneratedQuestion>, allowedTypes: Array<AiGeneratableQuestionType>): Array<GeneratedQuestion> {
  const results: Array<GeneratedQuestion> = []
  for (const item of raw) {
    const converted = toGeneratedQuestion(item, allowedTypes)
    if (converted) results.push(converted)
  }
  return results
}

export async function generateQuestionsFromDocument(params: {
  mimeType: string
  base64: string
  questionCount: number
} & GenerateOptions): Promise<Array<GeneratedQuestion>> {
  const allowedTypes = params.questionTypes?.length ? params.questionTypes : (['multiple_choice'] as Array<AiGeneratableQuestionType>)
  const text = await callGemini({
    mimeType: params.mimeType,
    base64: params.base64,
    prompt: buildQuestionPrompt(params.questionCount, false, params),
    schema: questionsJsonSchema,
  })

  let parsed: { questions: Array<RawGeneratedQuestion> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an invalid response — please try again.')
  }
  return sanitizeQuestions(parsed.questions, allowedTypes)
}

export interface GeneratedQuiz {
  title: string
  questions: Array<GeneratedQuestion>
}

// Used by the "generate a whole new quiz from a document" entry point —
// unlike generateQuestionsFromDocument (which only adds questions to a
// quiz that already has a title), this also asks the model for a title so
// the quiz can be created in one motion, no manual title entry required.
export async function generateQuizFromDocument(params: {
  mimeType: string
  base64: string
  questionCount: number
} & GenerateOptions): Promise<GeneratedQuiz> {
  const allowedTypes = params.questionTypes?.length ? params.questionTypes : (['multiple_choice'] as Array<AiGeneratableQuestionType>)
  const text = await callGemini({
    mimeType: params.mimeType,
    base64: params.base64,
    prompt: buildQuestionPrompt(params.questionCount, true, params),
    schema: quizWithTitleJsonSchema,
  })

  let parsed: { title: string; questions: Array<RawGeneratedQuestion> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an invalid response — please try again.')
  }

  const questions = sanitizeQuestions(parsed.questions, allowedTypes)
  if (questions.length === 0) {
    throw new Error('Could not extract any valid questions from this document — try a clearer or more detailed file.')
  }

  return { title: parsed.title?.trim() || 'Generated Quiz', questions }
}

// Text-only path — "describe a topic" instead of uploading a document.
export async function generateQuizFromTopic(params: {
  topic: string
  questionCount: number
} & GenerateOptions): Promise<GeneratedQuiz> {
  const allowedTypes = params.questionTypes?.length ? params.questionTypes : (['multiple_choice'] as Array<AiGeneratableQuestionType>)
  const text = await callGemini({
    prompt: buildTopicPrompt(params.topic, params.questionCount, params),
    schema: quizWithTitleJsonSchema,
  })

  let parsed: { title: string; questions: Array<RawGeneratedQuestion> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an invalid response — please try again.')
  }

  const questions = sanitizeQuestions(parsed.questions, allowedTypes)
  if (questions.length === 0) {
    throw new Error('Could not generate any valid questions for this topic — try a more specific description.')
  }

  return { title: parsed.title?.trim() || 'Generated Quiz', questions }
}
