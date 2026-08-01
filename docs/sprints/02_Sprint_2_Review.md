# Sprint 2 — Review

## Sprint Review

[D3 Commitment Setting](../04_Product_Requirements_Document.md#d3-commitment-setting) is complete and empirically verified, with the mandatory-vs-optional open question resolved (required) before any code was written, per the PRD's own instruction to decide it deliberately rather than default silently.

## Completed

1. **Schema** — `focus_sessions` gains `commitment` (text, nullable in the DB — see note below) and `commitment_met` (boolean, nullable).
2. **Required commitment gate** — `startFocusSessionSchema` requires a non-empty, trimmed, ≤280-character commitment; the client disables the Start button for a focus session (not for breaks, which need none) until one is entered, and `start()` re-validates server-side regardless.
3. **Deferred completion flow** — the timer no longer marks a session complete the instant it hits zero. `handleModeComplete` now pauses on a `pendingReflection` state, showing the student's commitment back verbatim in a dialog with **Met / Not Met / Skip** — only once one of those is chosen does `completeFocusSessionFn` actually run (achievements, XP-adjacent side effects, the completion toast, and the break-mode switch all happen at that point, not before).
4. **Abandoned sessions never see the reflection** — `reset()` (abandon) is untouched from the pre-existing path; it doesn't set `pendingReflection`, so there's nothing to reflect on for a session that was never finished.
5. **A real schema-safety decision made deliberately, not accidentally**: `commitment` is nullable in the database even though it's required for every *new* session — enforced at the Zod/UI layer, not a `NOT NULL` constraint, so historical rows created before this sprint don't need a backfill or break the migration.

## Deferred

- Nothing else was in scope this sprint. D4 (Teacher Risk Signal) and any analytics reading commitment data were explicitly out of bounds, per the plan's own scope-discipline note — this is a student-facing reflection feature only.

## Known Issues

- None new. The two Known Issues carried since Sprint 0 (the memory-pressure-linked e2e flake, the CI pipeline never having run on a real GitHub Actions runner) are unchanged — the full local Playwright run this sprint (14/14, including the previously-flaky test) didn't reproduce the flake, consistent with it being environmental rather than fixed.

## Documentation Updated?

Yes — [04_Product_Requirements_Document.md](../04_Product_Requirements_Document.md) (D3 status, resolved open question, updated acceptance criteria), [03_Product_Glossary.md](../03_Product_Glossary.md) (Commitment entry and summary table), [09_Database_Design.md](../09_Database_Design.md) (`focus_sessions` new columns + the nullable-by-design note), [18_Product_Roadmap.md](../18_Product_Roadmap.md) (Version 1.1's deferred item marked shipped).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean.
- `npm run test:unit`: 12/12 passing (unchanged — no new pure-logic extraction this sprint; the feature is UI state + a direct DB round-trip, not the extractable-pure-function shape Sprint 0's tests covered).
- `npx playwright test`: 14/14 passing (4 new in `e2e/commitment-setting.spec.ts`, covering the required-commitment gate, the full completion-and-reflection round trip via Playwright's `clock.runFor()` to simulate the 15-minute duration without a real wait, and the abandoned-session-skips-reflection case).

Same discipline as Sprint 1: two genuine test-authoring mistakes were caught and fixed along the way, not the app's fault —
1. `page.clock.fastForward()` only fires timers due *at* the new time, not every intermediate tick; switched to `page.clock.runFor()`, which fires each `setInterval` callback in sequence — required since the countdown decrements one second at a time, not in one jump.
2. Both the main `/focus` page and the persistent `MiniTimer` layout widget render their own Pause/Reset buttons once a session is running (by design — the mini-timer lets a student control the session from anywhere in the app), so bare `getByRole('button', { name: 'Pause' })` was ambiguous. Scoped to `.first()`, matching document order (the page's own control renders before the layout-level `MiniTimerGate`).

## Ready for Next Sprint?

**Yes.** No known issues introduced. Version 1.1 of the roadmap is now fully shipped (Practice Tasks, roster removal, and Commitment Setting). Version 1.2 (Unified Focus System) is the natural next scope — it explicitly depends on nothing from this sprint being redone, only extended.
