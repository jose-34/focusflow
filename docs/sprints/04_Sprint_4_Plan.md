# Sprint 4 — Unified Focus System

*Designed collaboratively before writing any code, per [18_Product_Roadmap.md](../18_Product_Roadmap.md)'s Version 1.2 entry — which turned out to name a destination without a route: [08_System_Architecture.md](../08_System_Architecture.md), the doc the roadmap cites as the design source, contains no actual target schema for the merge. The design below was worked out fresh, not extracted from an existing spec, and confirmed with the founder before implementation started.*

## Sprint Number
4

## Objectives

Merge `focus_sessions` and the `start_events`/`focus_heartbeats` system into one coherent design; reconcile XP so both entry points (Pomodoro, quiz-linked) award consistently; fix a real migration-correctness hazard found along the way.

## The design (confirmed before building)

1. **`assignment_id` → real `quiz_id` FK.** Confirmed by grep that `startAssignmentFn` is called from exactly one place in the entire app, always with a `quizId` — the "or a Task" branch in its existence-check was defensive code for a case that never happens. Not polymorphic; retyped to what it's always actually been.
2. **`start_events` table deleted, folded into `focus_sessions`.** New columns: `start_token`, `start_method`, `start_xp_awarded` (all nullable — only populated for quiz-linked sessions). A unique index on `(quiz_id, user_id)` reproduces the old table's one-start-per-assignment-per-user guarantee; Postgres treats `NULL` quiz_id values as distinct from each other, so Pomodoro sessions (`quiz_id IS NULL`) are unaffected.
3. **`focus_sessions` row created immediately on start**, not deferred to the first heartbeat like the old `start_events`→`focus_sessions` two-step. Removes the "resolve by token vs. resolve by heartbeat" indirection `reportFocusHeartbeatFn` used to need.
4. **`focus_heartbeats` kept** (the real anti-gaming signal for unsupervised quiz-taking — the Pomodoro path doesn't need it, since its live countdown UI is its own verification), simplified to FK `focus_session_id` only. The denormalized `start_event_id`/`assignment_id` columns are dropped.
5. **XP reconciliation** (the real product decision): every completed focus session, Pomodoro or quiz-linked, now earns the same duration-based XP (`floor(minutes/10)×2`) via one shared helper both completion paths call. The flat assignment-start bonus (10 XP, capped at 3/day, anti-grinding) stays exactly as-is — it rewards starting an assignment promptly, a signal that only exists for quiz-linked sessions, not Pomodoro ones.
6. **Two entry points stay** (`useFocusSession.ts` for manual-duration Pomodoro sessions, `focusMode.ts` for heartbeat-verified quiz sessions) — they start differently for real reasons, but now write the same table shape and share one completion helper (XP + `checkAndUnlockAchievements`) instead of two independently-maintained copies.

## An additional, blocking finding

`app/server.tsx` calls `ensureMinimumDatabaseSchema()` on every production boot, which hardcodes the *old* schema via raw SQL (recreates `start_events`, patches the old `focus_sessions` columns). Left in place, it would silently undo this migration on every Railway restart. Retired as part of this sprint — the project now has a real, twice-proven `db:push`/`db:rls` migration flow that supersedes this stopgap.

## Dependencies

`getAssignmentInsightsFn` ([04_Product_Requirements_Document.md](../04_Product_Requirements_Document.md) D4) queries both `startEvents` and `focusSessions` by `assignmentId` today — this is a real consumer, not just the two systems themselves, and must be rewritten against the unified shape in the same sprint, not left broken.

## Risks

- **Live, tested surface area**: both flows have real e2e coverage (`quiz-achievement-unlock.spec.ts`, `commitment-setting.spec.ts`, `practice-tasks.spec.ts`'s assignment-adjacent paths). Every existing test must stay green, not just the new ones added this sprint.
- **XP behavior change is real and visible**: Pomodoro sessions will start earning XP for the first time. Not a bug — the confirmed design decision — but worth flagging plainly since it changes what a student actually experiences, not just internal plumbing.
- **Production migration must be run manually** against Railway (same `railway connect Postgres --tunnel-only` → `db:push` → `db:rls` pattern used for Sprints 1–3), and this time also requires dropping the old `start_events` table and altering `focus_sessions`/`focus_heartbeats` columns — a destructive step for those two specific tables, reviewed before running, not assumed safe by default.

## Acceptance Criteria

- ✓ `start_events` no longer exists as a table; `focus.ts`-style dead code isn't left behind.
- ✓ A quiz-linked session still enforces one start per assignment per user, and heartbeats still gate `verified`.
- ✓ A completed Pomodoro session now awards XP identically to a completed quiz session of the same duration.
- ✓ The assignment start bonus (10 XP, 3/day cap) behaves identically to before, now reading from `focus_sessions`.
- ✓ `getAssignmentInsightsFn` (Teacher Risk Signal) produces the same shape of output against the unified table.
- ✓ `ensureMinimumDatabaseSchema()` no longer runs a stale schema on every boot.
- ✓ Every existing e2e test still passes; new coverage added for Pomodoro XP and the unified quiz-start flow.

## Testing Plan

- Empirical RLS re-verification for `focus_sessions`' extended shape and `focus_heartbeats`' simplified FK, per the project's standing convention.
- E2E: full existing suite must stay green; add a Pomodoro-completion-awards-XP check and re-verify the quiz-achievement-unlock flow still works against the new table shape.
- `tsc -b` / lint / unit tests.

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and [19_Implementation_Guide.md](../19_Implementation_Guide.md)'s ten-stage checklist, applied here as it was for Sprints 0–3.
