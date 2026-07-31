// Pure, dependency-free by design (Sprint 0, docs/16_Testing_Strategy.md §1)
// — extracted out of useQuizzes.ts so importing it for a unit test never
// drags in `@/db` (which throws at module load if DATABASE_URL isn't set).
// This is the core rule behind the Risk Signal — the mechanic
// docs/13_Anti_Procrastination_Framework.md §11 calls the product's actual
// competitive moat — so it's worth being independently testable on its own.
export function computeRiskScore(input: {
  hasAttempt: boolean
  focusSessionCount: number
  hoursBeforeDeadline: number | null
}): { procrastinationFlag: boolean; riskScore: number } {
  const { hasAttempt, focusSessionCount, hoursBeforeDeadline } = input
  const procrastinationFlag = focusSessionCount === 0 && hoursBeforeDeadline !== null && hoursBeforeDeadline <= 24
  const riskScore = !hasAttempt
    ? 3
    : focusSessionCount === 0 && hoursBeforeDeadline !== null && hoursBeforeDeadline <= 24
      ? 2
      : hoursBeforeDeadline !== null && hoursBeforeDeadline <= 48
        ? 1
        : 0
  return { procrastinationFlag, riskScore }
}
