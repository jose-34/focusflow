// Pure, dependency-free by design (Sprint 0, docs/16_Testing_Strategy.md §1)
// — extracted out of useProgress.ts specifically so importing it for a unit
// test never drags in `@/db` (which throws at module load if DATABASE_URL
// isn't set). This function's own logic is correct — the real, documented
// bug (docs/10_API_Architecture.md, docs/14_Analytics_And_Reporting.md) is
// that its caller (getProgressDataFn) only ever passes it 14 days of
// history, not that this function mis-computes a streak given full data. A
// unit test here proves computeStreaks itself is sound; it does not, and
// cannot, catch the windowing bug — that requires an integration-level test
// against getProgressDataFn with >14 days of seeded sessions, tracked for
// its already-scheduled Version 2.2 fix, not solved by this extraction.
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function computeStreaks(successDates: Set<string>): { current: number; longest: number } {
  if (successDates.size === 0) return { current: 0, longest: 0 }

  const sorted = [...successDates].sort()
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000)
    run = diffDays === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  const today = toDateKey(new Date())
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000))
  let anchor: string | null = null
  if (successDates.has(today)) anchor = today
  else if (successDates.has(yesterday)) anchor = yesterday

  let current = 0
  if (anchor) {
    let cursor = new Date(anchor)
    while (successDates.has(toDateKey(cursor))) {
      current += 1
      cursor = new Date(cursor.getTime() - 86_400_000)
    }
  }

  return { current, longest }
}
