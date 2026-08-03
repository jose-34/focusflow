import { GoogleGenAI } from '@google/genai'
import mammoth from 'mammoth'

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

export interface GeneratedChoice {
  choiceText: string
  isCorrect: boolean
}

export interface GeneratedQuestion {
  questionText: string
  points: number
  choices: Array<GeneratedChoice>
}

// Plain JSON Schema, passed via responseJsonSchema — Gemini enforces this
// on the response, so no separate parsing/validation pass is needed and
// there's no risk of the model wrapping the array in explanatory prose.
const questionsJsonSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionText: { type: 'string', description: 'The question, self-contained and answerable from the document alone' },
          points: { type: 'integer', description: 'Point value 1-10, higher for questions requiring deeper reasoning' },
          choices: {
            type: 'array',
            description: 'Exactly 4 choices, exactly one marked isCorrect: true',
            items: {
              type: 'object',
              properties: {
                choiceText: { type: 'string' },
                isCorrect: { type: 'boolean' },
              },
              required: ['choiceText', 'isCorrect'],
            },
          },
        },
        required: ['questionText', 'points', 'choices'],
      },
    },
  },
  required: ['questions'],
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

export async function generateQuestionsFromDocument(params: {
  mimeType: string
  base64: string
  questionCount: number
}): Promise<Array<GeneratedQuestion>> {
  const extractedText = await extractTextIfNeeded(params.mimeType, params.base64)

  const promptText = `Read the attached study material and generate exactly ${params.questionCount} multiple-choice quiz questions that test understanding of its content. Each question needs exactly 4 answer choices with exactly one correct. Assign points 1-10 based on difficulty. Questions must be answerable from the material alone — do not invent facts not present in it.`

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  if (extractedText !== null) {
    parts.push({ text: `--- Document content ---\n${extractedText}\n--- End of document ---\n\n${promptText}` })
  } else {
    parts.push({ inlineData: { mimeType: params.mimeType, data: params.base64 } })
    parts.push({ text: promptText })
  }

  const response = await getClient().models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: questionsJsonSchema,
    },
  })

  const text = response.text
  if (!text) {
    throw new Error('The AI did not return any questions — try again or use a clearer document.')
  }

  let parsed: { questions: Array<GeneratedQuestion> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an invalid response — please try again.')
  }

  return parsed.questions
    .filter((q) => q.choices.filter((c) => c.isCorrect).length === 1 && q.choices.length >= 2)
    .map((q) => ({
      questionText: q.questionText,
      points: Math.max(1, Math.min(10, Math.round(q.points))),
      choices: q.choices,
    }))
}
