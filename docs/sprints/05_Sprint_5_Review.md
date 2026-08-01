# Sprint 5 — Review

## Sprint Review

Closes [18_Product_Roadmap.md](../18_Product_Roadmap.md) Version 1.0's XP-reconciliation item. Reality-checked before writing the plan, same discipline as every sprint since Sprint 1: grepped every read and write of `users.xp` and `xp_ledger` before deciding anything. Found the "two sources of truth" framing overstated what was actually there — one column had zero readers anywhere in the app, ever. Reconciliation turned out to mean deletion, not a formalization exercise.

## Completed

1. **`users.xp` deleted.** Confirmed by grep before removing it (not assumed): zero reads anywhere in the codebase. `xp_ledger` is now the sole, explicit source of truth for a user's XP total.
2. **Both write sites updated** — `focusMode.ts`'s `startAssignmentFn` and the shared `completeFocusSession()` helper (Sprint 4) now only insert into `xp_ledger`; the redundant `users.xp` increment removed from both.
3. **No speculative read helper added.** Nothing in the app displays a total XP figure yet (Version 2.0 gamification-expansion territory) — a `getUserXpFn` with no caller would have been exactly the kind of ahead-of-need work this project has repeatedly declined elsewhere. When a real consumer exists, `SUM(amount) FROM xp_ledger WHERE user_id = ?` is one indexed query away.
4. **The zero-reader finding held through implementation, not just at planning time**: `tsc -b` came back clean immediately after removing the column from the schema type — no hidden consumer surfaced.

## Deferred

- Nothing — this was a small, fully-scoped item and it's fully closed.

## Known Issues

- None new. Full local e2e suite (18/18) re-verified clean, including both tests that exercise real XP awards end-to-end (`pomodoro-xp.spec.ts`, `quiz-achievement-unlock.spec.ts`).
- **A real root-cause finding worth recording, not just another flake note**: `quiz-achievement-unlock.spec.ts`'s "Add Question" step failed three times in direct succession during this sprint's verification, including in isolation — more than pure chance would suggest, so it was investigated properly this time rather than dismissed. Root cause confirmed precisely with a standalone debug script: the route-warming technique used in prior sprints (an unauthenticated `curl` request) hits a `307` redirect in the route's `beforeLoad` *before* the expensive `TeacherQuizView`/`QuestionForm` component code ever compiles — so it never actually warmed the costly part of this specific route. A real authenticated page visit does. Confirmed the underlying app behavior was correct throughout (a manual Playwright script driving the identical steps passed cleanly); this is a Vite dev-mode cold-compile cost specific to how this route was being warmed, not a code defect. Recorded here so future warming attempts for this route use a real authenticated visit, not a bare `curl`.
- Production Railway database still needs this sprint's migration run manually before it matches the new schema (same tunnel pattern as every prior sprint).

## Documentation Updated?

Yes — [09_Database_Design.md](../09_Database_Design.md) (`users` table entry, closed its own open question), [12_Gamification_Framework.md](../12_Gamification_Framework.md) (closed the reconciliation note it had explicitly flagged as binding on itself), [18_Product_Roadmap.md](../18_Product_Roadmap.md) (Version 1.0 item marked done).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean.
- `npm run test:unit`: 12/12 passing (unchanged).
- `npx playwright test`: 18/18 passing.

## Ready for Next Sprint?

**Yes.** Version 1.0 now has three of five items closed (deployment, XP reconciliation, plus the always-separate legal review isn't engineering work at all). Three real engineering items remain: automated backups + restore, error monitoring, and formalizing the RLS test suite from a per-sprint throwaway script into a permanent one.
