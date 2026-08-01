# Sprint 3 — Achievement Gap Fix + Dead Schema Cleanup

*Reality-checked before writing this: [18_Product_Roadmap.md](../18_Product_Roadmap.md)'s Version 1.2 entry proposes a full merge of `focus_sessions` and the `start_events`/`focus_heartbeats` system in one sprint. Investigating both systems directly found the merge is more involved than the roadmap entry implies — the two systems have structurally different completion semantics and inconsistent XP rules (the quiz path awards real XP via `xpLedger`; the Pomodoro path, even after Sprint 2, awards none). Rather than take on the full merge and the XP reconciliation it requires in one sprint, this sprint deliberately takes the smaller, safe slice: the confirmed-dead schema file, and the one specific, well-scoped bug named in the roadmap entry. The full unification and XP reconciliation are left for a dedicated follow-up sprint.*

## Sprint Number
3

## Objectives

1. Delete `app/db/schema/focus.ts`, confirmed dead (zero imports anywhere, an incompatible duplicate of the real `focus_sessions` schema).
2. Fix the confirmed achievement-unlock gap: a quiz-linked focus session (via `focusMode.ts`'s `endFocusSessionFn`) never calls `checkAndUnlockAchievements` — only the Pomodoro path does, even though both paths set `wasSuccessful: true` on the same `focus_sessions` table the achievement service reads.

## Features

- `endFocusSessionFn` calls `checkAndUnlockAchievements(tx, user.id)` after marking the session successful, and returns the unlocked keys.
- The quiz-taking route's submit handler celebrates any newly-unlocked achievement, matching the pattern already used by the Pomodoro timer (`TimerContext.tsx`'s `finishFocusSession`).
- `app/db/schema/focus.ts` deleted after re-confirming zero imports at deletion time, per the roadmap's own stated caution.

## Dependencies

None external. `checkAndUnlockAchievements` and `useCelebration`/`ACHIEVEMENT_MAP` already exist and are already used by the Pomodoro path — this sprint wires the same, already-proven pieces into the second path.

## Risks

- **Scope discipline**: the full `focus_sessions`/`start_events`/`focus_heartbeats` merge and the XP-reconciliation it requires are explicitly *not* this sprint — named here so the temptation to "just also fix it while in there" is on record as deliberately declined, not forgotten.
- **Re-verify the dead-file claim at deletion time, not just at planning time** — a grep run today could be stale by the time this is implemented if anything changed in between (it didn't, but the check is repeated immediately before deleting regardless).

## Acceptance Criteria

- ✓ Completing a quiz with at least one focus heartbeat reported unlocks `first_focus` (or any other eligible achievement) exactly as the Pomodoro path already does.
- ✓ `app/db/schema/focus.ts` no longer exists; `tsc -b` and the full test suite stay clean without it.
- ✓ No change to XP awarding on either path — that reconciliation stays out of scope.

## Testing Plan

- E2E: a student takes and submits a quiz (triggering at least one focus heartbeat, which fires immediately on start, not just on the 15s interval) and sees the same achievement-unlock celebration the Pomodoro path already produces.
- `tsc -b` / lint / unit tests, confirming the dead file's removal breaks nothing.

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and [19_Implementation_Guide.md](../19_Implementation_Guide.md)'s ten-stage checklist, applied here as it was for Sprints 0–2.
