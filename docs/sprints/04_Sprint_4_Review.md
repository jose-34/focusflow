# Sprint 4 — Review

## Sprint Review

The full Version 1.2 unification is complete — not the small slice Sprint 3 deliberately left for later, but the real architectural work: one schema, one completion path, consistent XP, a resolved naming violation, and a genuine migration-correctness hazard found and retired along the way. Designed collaboratively with the founder before any code was written, since the roadmap's own cited design source ([08_System_Architecture.md](../08_System_Architecture.md)) turned out to contain no actual target schema for the merge — this sprint's design *is* that missing spec, worked out fresh and confirmed piece by piece (XP reconciliation first, since it was the one real product decision, then the schema shape) rather than assumed.

## Completed

1. **`start_events` deleted, folded into `focus_sessions`.** `quiz_id`, `start_method`, `start_xp_awarded` added; the row is now created immediately at start instead of deferred to the first heartbeat — which also made the old `start_token` concept provably redundant (RLS already scopes `sessionId` access to its owner) and let it be dropped rather than carried over unused.
2. **`assignment_id`'s polymorphism resolved, not just renamed.** Confirmed by grep — `startAssignmentFn` is called from exactly one place in the entire codebase, always with a quiz id — before retyping it to a real `quiz_id` FK. Closes [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md)'s I4 finding, open since the Design Review Board.
3. **`focus_heartbeats` simplified and given its first real FK.** Denormalized `start_event_id`/`assignment_id` columns dropped (derivable via `focus_session_id`); a real `focus_session_id → focus_sessions.id` cascade FK added — closing a data-integrity gap [09_Database_Design.md](../09_Database_Design.md) had named directly. Applying it surfaced one real orphaned heartbeat row in local dev data, cleaned up before the constraint could be added — not silently worked around.
4. **XP reconciled, per the decision made before building anything**: every completed focus session — Pomodoro or quiz-linked — now earns the same duration-based XP via one shared `completeFocusSession()` helper both `useFocusSession.ts` and `focusMode.ts` call. The assignment-start bonus (10 XP, 3/day anti-grinding cap) stays quiz-only, since only a quiz-linked session has a "started promptly" signal to reward. **A real, visible behavior change**: Pomodoro sessions earn XP for the first time in this product's history.
5. **`getAssignmentInsightsFn` (Teacher Risk Signal) rewritten** against the unified table — a real consumer of the old two-table split, not just the tables themselves. One query now does what two used to.
6. **A genuine migration-correctness hazard found and retired**: `app/server.tsx` called `ensureMinimumDatabaseSchema()` on every production boot, hardcoding the *old* schema via raw SQL — including recreating `start_events`. Left in place, it would have silently undone this entire migration on every Railway restart. Deleted outright, not patched — the project's `db:push`/`db:rls` flow (proven every sprint since Sprint 1) supersedes it.
7. **A real, pre-existing bug found and fixed along the way, from Sprint 2**: `finishFocusSession`'s `setCompletedFocusSessions` functional updater contained side effects (`toast.success`, `setMode`) — a React purity violation, since an updater function may legitimately be invoked more than once. Surfaced by this sprint's new e2e test asserting the toast's exact text and catching a duplicate render; confirmed via direct DB inspection that the *server-side* mutation only ever fired once (one `xp_ledger` row, `xp = 2` exactly, not 4) before concluding it was a client-side purity bug, not a double-award bug. Fixed with a ref-backed counter and side effects moved out of the updater.

## Deferred

- Reflection prompts extending Wellness Check-in ([13_Anti_Procrastination_Framework.md](../13_Anti_Procrastination_Framework.md) §8) — the one item from the original Version 1.2 roadmap entry not touched this sprint, left for a future one now that session-completion is a single code path to extend.

## Known Issues

- None new. The two carried since Sprint 0 (memory-pressure e2e flake, CI never run on a real GitHub Actions runner) are unchanged. This sprint's full local suite reproduced the flake pattern under parallel-worker load (2 workers) but passed cleanly every time in isolation (1 worker) — consistent with the existing environmental diagnosis, not a new regression; re-confirmed rather than assumed.
- The production Railway database still needs this sprint's migration run manually (`db:push` + `db:rls` via the established tunnel pattern) before this code path works there — flagged, not silently assumed done.

## Documentation Updated?

Yes, extensively — [09_Database_Design.md](../09_Database_Design.md) (full rewrite of the Focus & Behavior tables, ER diagram, open questions), [10_API_Architecture.md](../10_API_Architecture.md) (full rewrite of both Focus & Behavior function tables, closed the "which functions survive" open question), [18_Product_Roadmap.md](../18_Product_Roadmap.md) (Version 1.2 marked shipped), [13_Anti_Procrastination_Framework.md](../13_Anti_Procrastination_Framework.md) (closed its own "not-yet-unified" note and open question), [03_Product_Glossary.md](../03_Product_Glossary.md) (XP Ledger entry corrected — no longer quiz-only), [DESIGN_REVIEW_BOARD.md](../DESIGN_REVIEW_BOARD.md) (I4 closure noted in its existing blocker-closure record, the review's own findings left as originally written per its stated convention).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean.
- `npm run test:unit`: 12/12 passing (unchanged).
- `npx playwright test`: 18/18 passing (2 new in `e2e/pomodoro-xp.spec.ts`; every pre-existing spec re-verified against the unified schema, not assumed compatible).

## Ready for Next Sprint?

**Yes.** Version 1.2 is now genuinely complete, not partially deferred. The codebase carries one focus-tracking schema instead of two, one completion path instead of two independently-maintained copies, and two long-open documentation findings (I4's naming violation, the "which functions survive" question) are closed with real code, not just updated text.
