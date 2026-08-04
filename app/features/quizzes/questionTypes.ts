// Shared client+server question-type vocabulary. `answerConfig` on
// quiz_questions holds the correct-answer shape for every NON-choice-based
// type — multiple_choice/true_false/multi_select keep using quiz_choices
// exactly as before, so they have no answerConfig shape here.
// Poll is structurally choice-based too (needs an options list a student
// picks from) — it just never has a "correct" choice, so grading always
// returns isCorrect: null for it regardless of what's selected.
export const CHOICE_BASED_TYPES = ['multiple_choice', 'true_false', 'multi_select', 'poll'] as const
export const TIER_C_MANUAL_TYPES = ['audio_response', 'video_response', 'draw', 'hotspot', 'math_response', 'graphing'] as const

export const questionTypeValues = [
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
  ...TIER_C_MANUAL_TYPES,
] as const

export type QuestionTypeValue = (typeof questionTypeValues)[number]

export function isChoiceBasedType(type: string): boolean {
  return (CHOICE_BASED_TYPES as readonly string[]).includes(type)
}

export function isManualGradingType(type: string): boolean {
  return (TIER_C_MANUAL_TYPES as readonly string[]).includes(type)
}

export type QuestionAnswerConfig =
  | { kind: 'fill_blank'; acceptedAnswers: Array<string>; caseSensitive?: boolean }
  | { kind: 'open_ended'; sampleAnswer?: string }
  | { kind: 'match'; pairs: Array<{ left: string; right: string }> }
  | { kind: 'reorder'; correctOrder: Array<string> }
  | { kind: 'categorize'; categories: Array<string>; items: Array<{ text: string; category: string }> }
  | { kind: 'dropdown'; segments: Array<{ text: string } | { blankOptions: Array<string>; correctIndex: number }> }
  | { kind: 'table_fill'; rows: Array<string>; columns: Array<string>; answers: Record<string, string> }
  | { kind: 'manual' }

export type QuestionResponseData =
  | { kind: 'fill_blank'; answer: string }
  | { kind: 'open_ended'; answer: string }
  | { kind: 'match'; pairs: Array<{ left: string; right: string }> }
  | { kind: 'reorder'; order: Array<string> }
  | { kind: 'categorize'; assignments: Array<{ text: string; category: string }> }
  | { kind: 'dropdown'; selections: Array<{ segmentIndex: number; choiceIndex: number }> }
  | { kind: 'table_fill'; answers: Record<string, string> }
  | { kind: 'manual'; text?: string; mediaUrl?: string }

export function defaultAnswerConfigFor(type: QuestionTypeValue): QuestionAnswerConfig | null {
  switch (type) {
    case 'fill_blank':
      return { kind: 'fill_blank', acceptedAnswers: [''] }
    case 'open_ended':
      return { kind: 'open_ended' }
    case 'match':
      return { kind: 'match', pairs: [{ left: '', right: '' }] }
    case 'reorder':
      return { kind: 'reorder', correctOrder: [''] }
    case 'categorize':
      return { kind: 'categorize', categories: [''], items: [] }
    case 'dropdown':
      return { kind: 'dropdown', segments: [{ text: '' }] }
    case 'table_fill':
      return { kind: 'table_fill', rows: [''], columns: [''], answers: {} }
    default:
      return isManualGradingType(type) ? { kind: 'manual' } : null
  }
}
