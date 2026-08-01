# Sprint 3 — Review

## Sprint Review

Both objectives from [03_Sprint_3_Plan.md](03_Sprint_3_Plan.md) are complete: the confirmed-dead schema file is gone, and the achievement-unlock gap named in the roadmap is fixed. The larger merge the roadmap's Version 1.2 entry originally proposed was deliberately left out — reality-checked as bigger and riskier than the entry implied, and explicitly deferred to its own sprint rather than rushed in alongside this one.

## Completed

1. **`app/db/schema/focus.ts` deleted.** Re-confirmed zero imports immediately before deletion, not just at planning time, per the plan's own stated caution. `tsc -b` and the full 16-test Playwright suite stayed clean without it.
2. **The achievement-unlock gap fixed.** `focusMode.ts`'s `endFocusSessionFn` now calls `checkAndUnlockAchievements(tx, user.id)` after marking a session `wasSuccessful: true` — the same check the Pomodoro completion path already ran, now applied to the quiz-linked path too. The function's return type gained `unlockedAchievements`; the quiz-taking route (`classes.$classId.quizzes.$quizId.tsx`) celebrates any newly-unlocked achievement on submit, using the exact same `ACHIEVEMENT_MAP`/`celebrate()` pattern `TimerContext.tsx` already established.
3. **Empirically verified, not just code-reviewed**: a new e2e test drives a full quiz-taking flow (teacher creates a published quiz, student starts it, waits for the first real heartbeat round-trip to land, submits) and confirms `First Focus` shows as unlocked on `/achievements` afterward — proving the fix actually fires in the real request path, not just that the function call was added.

## Deferred

- The full `focus_sessions`/`start_events`/`focus_heartbeats` merge, and the XP-reconciliation it requires (quiz path awards real XP today; Pomodoro path awards none) — named explicitly in the updated [18_Product_Roadmap.md](../18_Product_Roadmap.md) as the real remaining work for Version 1.2, not abandoned.
- The polymorphic `assignment_id` gap (no type discriminator, no FK) — same reasoning; resolving it properly is part of the deferred merge, not a standalone column fix.
- Reflection prompts extending Wellness Check-in — untouched, waits for the same future sprint.

## Known Issues

- None new. Same two carried since Sprint 0 (the memory-pressure-linked e2e flake, CI never run on a real GitHub Actions runner) — unchanged.
- Worth naming plainly, not fixed here (already documented in [10_API_Architecture.md](../10_API_Architecture.md)): `reportFocusHeartbeatFn`'s "verified minutes" and `endFocusSessionFn`'s XP award are both heuristics derived from heartbeat *count*, not a measured duration — real, but out of this sprint's scope.

## Documentation Updated?

Yes — [09_Database_Design.md](../09_Database_Design.md) (dead-file section marked deleted, its own open question closed), [10_API_Architecture.md](../10_API_Architecture.md) (`endFocusSessionFn`'s row updated), [18_Product_Roadmap.md](../18_Product_Roadmap.md) (Version 1.2 split into what shipped vs. what's still real remaining work).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean.
- `npm run test:unit`: 12/12 passing (unchanged — no new pure logic this sprint).
- `npx playwright test`: 16/16 passing (2 new in `e2e/quiz-achievement-unlock.spec.ts`).

One real test-writing bug caught along the way, not the app's fault: `getByText('Live')` (non-exact) matched both the quiz's "Live" status badge and the unrelated "Host Live Game" button — fixed with `{ exact: true }`. Separately, the first attempt at this test flaked on a transient timing issue unrelated to this sprint's changes (a click on "Add Question" that didn't register before a 60s timeout) — re-ran clean immediately after with tracing on, confirming it was a one-off environmental blip, not a reproducible bug in the touched code.

## Ready for Next Sprint?

**Yes.** Scope discipline held — the temptation to "just also do the full merge since we're in here" was named and declined in the plan itself, not discovered as a problem afterward. The deferred merge (with XP reconciliation) is the natural next scope whenever picked up, now with a clearer, more honest account of what it actually involves than the original one-line roadmap entry had.
