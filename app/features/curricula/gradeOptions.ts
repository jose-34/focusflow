// Grade labels are stored as free text on classes/quizzes (Cambridge's
// "Year 10" and CBC's "Grade 10" aren't the same shape), but presenting
// them as free-text input invites typos that silently break grade-based
// matching elsewhere (the arcade demo, Discover filtering). This is the
// single source of truth for what a picker should offer per curriculum,
// and the order used for grouping/sorting a content library by grade.
const CBC_GRADES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9']

const CAMBRIDGE_GRADES = Array.from({ length: 13 }, (_, i) => `Year ${i + 1}`)

export function getGradeOptions(curriculumCode: string | undefined | null): Array<string> {
  if (curriculumCode === 'cbc') return CBC_GRADES
  if (curriculumCode === 'cambridge') return CAMBRIDGE_GRADES
  return []
}

export function gradeSortIndex(curriculumCode: string | undefined | null, gradeLabel: string | null): number {
  const options = getGradeOptions(curriculumCode)
  if (!gradeLabel) return options.length
  const index = options.indexOf(gradeLabel)
  return index === -1 ? options.length : index
}
