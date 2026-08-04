import type { QuestionAnswerConfig, QuestionTypeValue } from './questionTypes'
import { isChoiceBasedType, isManualGradingType } from './questionTypes'

export interface GradableQuestion {
  questionType: QuestionTypeValue
  points: number
  answerConfig: QuestionAnswerConfig | null
  choices: Array<{ id: string; isCorrect: boolean }>
}

export interface SubmittedAnswer {
  selectedChoiceId?: string | null
  selectedChoiceIds?: Array<string>
  responseData?: Record<string, unknown>
}

export interface GradeResult {
  isCorrect: boolean | null
  pointsEarned: number
}

function sameSet(a: Array<string>, b: Array<string>): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((item) => setB.has(item))
}

function normalize(value: string, caseSensitive?: boolean): string {
  const trimmed = value.trim()
  return caseSensitive ? trimmed : trimmed.toLowerCase()
}

// Every branch is deliberately all-or-nothing (no partial credit) — keeps
// scoring predictable across 17 question types; can be revisited per-type
// later if a real need for partial credit shows up.
export function gradeAnswer(question: GradableQuestion, answer: SubmittedAnswer): GradeResult {
  const { questionType, answerConfig, points } = question

  if (isManualGradingType(questionType) || questionType === 'open_ended') {
    return { isCorrect: null, pointsEarned: 0 }
  }

  if (questionType === 'poll') {
    // No correct answer, ever — a poll just collects opinions.
    return { isCorrect: null, pointsEarned: 0 }
  }

  if (isChoiceBasedType(questionType)) {
    const correctIds = question.choices.filter((c) => c.isCorrect).map((c) => c.id)
    if (questionType === 'multi_select') {
      const selected = answer.selectedChoiceIds ?? []
      const isCorrect = sameSet(selected, correctIds)
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    const isCorrect = !!answer.selectedChoiceId && correctIds.includes(answer.selectedChoiceId)
    return { isCorrect, pointsEarned: isCorrect ? points : 0 }
  }

  if (!answerConfig) return { isCorrect: false, pointsEarned: 0 }
  const response = answer.responseData ?? {}

  switch (answerConfig.kind) {
    case 'fill_blank': {
      const given = typeof response.answer === 'string' ? response.answer : ''
      const isCorrect = answerConfig.acceptedAnswers.some((accepted) => normalize(accepted, answerConfig.caseSensitive) === normalize(given, answerConfig.caseSensitive))
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    case 'match': {
      const given = Array.isArray(response.pairs) ? (response.pairs as Array<{ left: string; right: string }>) : []
      const isCorrect =
        given.length === answerConfig.pairs.length &&
        answerConfig.pairs.every((pair) => given.some((g) => g.left === pair.left && g.right === pair.right))
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    case 'reorder': {
      const given = Array.isArray(response.order) ? (response.order as Array<string>) : []
      const isCorrect = given.length === answerConfig.correctOrder.length && given.every((item, i) => item === answerConfig.correctOrder[i])
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    case 'categorize': {
      const given = Array.isArray(response.assignments) ? (response.assignments as Array<{ text: string; category: string }>) : []
      const isCorrect =
        given.length === answerConfig.items.length &&
        answerConfig.items.every((item) => given.some((g) => g.text === item.text && g.category === item.category))
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    case 'dropdown': {
      const given = Array.isArray(response.selections) ? (response.selections as Array<{ segmentIndex: number; choiceIndex: number }>) : []
      const blanks = answerConfig.segments
        .map((segment, index) => ({ segment, index }))
        .filter((s): s is { segment: { blankOptions: Array<string>; correctIndex: number }; index: number } => 'blankOptions' in s.segment)
      const isCorrect =
        blanks.length > 0 && blanks.every((blank) => given.some((g) => g.segmentIndex === blank.index && g.choiceIndex === blank.segment.correctIndex))
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    case 'table_fill': {
      const given = (response.answers ?? {}) as Record<string, string>
      const keys = Object.keys(answerConfig.answers)
      const isCorrect = keys.length > 0 && keys.every((key) => normalize(given[key] ?? '') === normalize(answerConfig.answers[key]))
      return { isCorrect, pointsEarned: isCorrect ? points : 0 }
    }
    default:
      return { isCorrect: false, pointsEarned: 0 }
  }
}
