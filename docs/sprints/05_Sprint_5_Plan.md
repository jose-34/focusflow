# Sprint 5 — XP Reconciliation

*Reality-checked before writing this: grepped every read and write of `users.xp` and `xp_ledger` first. Found exactly two write sites (`focusMode.ts`, `app/features/focus/completeFocusSession.ts`), both already correctly dual-writing both — and zero read sites for `users.xp` anywhere in the app. The "reconcile two sources of truth" framing in the roadmap turned out to actually be "one written-but-never-read column vs. one real, working source" — a smaller, more clear-cut fix than the phrasing implied.*

## Sprint Number
5

## Objectives

Close [18_Product_Roadmap.md](../18_Product_Roadmap.md) Version 1.0's XP-reconciliation item: `xp_ledger` becomes the sole source of truth for a user's XP total; `users.xp` — a write-only, zero-consumer running counter — is deleted rather than kept as a formalized cache, per the founder's own decision.

## Decision resolved before implementation

Delete `users.xp` outright, don't keep it as a maintained cache. No `getUserXpFn` added speculatively either — nothing in the app displays a total XP figure yet (that's Version 2.0 gamification-expansion work); adding a read helper with no caller now would be exactly the kind of ahead-of-need work this project has repeatedly avoided elsewhere. When a real consumer needs it, `SELECT SUM(amount) FROM xp_ledger WHERE user_id = ?` is one query away, already indexed.

## Features

- `users.xp` column dropped from schema and both live database (local + Railway).
- Both write sites (`startAssignmentFn` in `focusMode.ts`, `completeFocusSession()`) stop updating it — `xp_ledger` insert is now the entire XP-award side effect.

## Dependencies

None. No code anywhere reads `users.xp` (confirmed by grep, not assumed) — nothing downstream to migrate.

## Risks

- **Confirm the zero-reader finding stays true through implementation** — a stray reference caught only at `tsc -b` time (after the column is removed from the schema type) would be a build failure, not a silent runtime bug, which is the safe failure mode here.

## Acceptance Criteria

- ✓ `users.xp` no longer exists in the schema or either live database.
- ✓ XP awards still insert into `xp_ledger` correctly (unchanged amounts, unchanged anti-grinding cap behavior).
- ✓ `tsc -b` clean with the column gone — proves no hidden consumer existed.

## Testing Plan

- `tsc -b` / lint / unit tests.
- Full e2e suite re-run (touches `pomodoro-xp.spec.ts` and `quiz-achievement-unlock.spec.ts` directly, both of which exercise real XP awards).

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and [19_Implementation_Guide.md](../19_Implementation_Guide.md)'s ten-stage checklist, applied here as it was for Sprints 0–4.
