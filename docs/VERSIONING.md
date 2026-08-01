# Focus Flow: Versioning & Change Governance

*Effective from `Focus Flow Specification v1.0`, Status: Engineering Approved. Every change to the product or the specification is categorized before it's made, not after.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). This document is itself under the same discipline it describes — changes to it are a Minor version event at minimum.

---

## Change categories

### Patch (v1.0.x)
Bug fixes, documentation corrections, performance improvements, security fixes, accessibility improvements. **No new functionality.** Examples already in this project's real history: the `xp_ledger`/`start_events`/`focus_heartbeats` RLS fixes, the `startAssignmentFn` anti-grinding cap, the five factual doc corrections from the Design Review Board closure — all Patch-scale, none of them added a feature.

### Minor (v1.x)
New features, new AI capabilities, new gamification mechanics, additional analytics, curriculum extensions. Everything in [18_Product_Roadmap.md](18_Product_Roadmap.md)'s Version 1.1 through 3.0 line items is Minor-scale by this definition.

### Major (v2.0+)
Architectural changes, breaking API changes, major UX redesigns, a new deployment model, or a fundamental change to the product philosophy. Nothing currently on the roadmap is Major-scale — by design, per [01_Product_Vision.md](01_Product_Vision.md)'s "evolve, never rip-and-replace" decision.

**A change that touches [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md) itself is always Major, regardless of how small the edit looks** — the constitution changing is definitionally a bigger event than anything it governs.

---

## Sprint discipline

Every sprint gets a plan, before work starts, in this shape:

```
Sprint Number
Objectives
Features
Dependencies
Risks
Acceptance Criteria
Testing Plan
Definition of Done
```

And a review, after work ends, in this shape:

```
Sprint Review
Completed
Deferred
Known Issues
Documentation Updated?
Tests Passed?
Ready for Next Sprint?
```

Plans and reviews live in `docs/sprints/`, numbered to match the sprint (`00_Sprint_0_Plan.md`, `00_Sprint_0_Review.md`, `01_Sprint_1_Plan.md`, ...).

---

## Version history

| Version | Date | Status | Summary |
|---|---|---|---|
| v1.0 | 2026-07-31 | **Engineering Approved** | The full `-01`–`19` specification, [Architecture Review](ARCHITECTURE_REVIEW.md), and [Design Review Board](DESIGN_REVIEW_BOARD.md) verdict — all five blockers closed and empirically verified. Sprint 0 authorized. |
| v1.0 (Sprint 0) | 2026-07-31 | **Complete** | Git repo, CI pipeline, Vitest + 12 unit tests, audit-log table, error-handling standard, `CONTRIBUTING.md`, and a real `focusflow_app` role-bootstrap script (a gap found while wiring CI, not in the original plan). One React Rules-of-Hooks bug found and fixed via lint. See [00_Sprint_0_Review.md](sprints/00_Sprint_0_Review.md) for the full account, including one known e2e flake carried forward openly. |
| v1.1 (Sprint 1) | 2026-07-31 | **Complete** | Practice Task assignment (`task_templates`, `tasks.taskType`, teacher-assign-to-class fan-out) and roster removal (soft-delete via `enrollments.status = 'dropped'`, new `enrollments_update` RLS policy). A real RLS gap found and fixed (`tasks_teacher_insert_practice`, closing a fan-out insert violation). Commitment Setting deliberately deferred, not bundled in as originally floated. See [01_Sprint_1_Review.md](sprints/01_Sprint_1_Review.md) for the full account. |
| v1.1 (Sprint 2) | 2026-08-01 | **Complete** | Commitment Setting ([D3](04_Product_Requirements_Document.md#d3-commitment-setting)) — required commitment before a Focus Session starts, shown back verbatim with a skippable Met/Not Met self-check at completion. `focus_sessions` gains `commitment`/`commitment_met` (both nullable in the DB, enforced required at the Zod/UI layer). See [02_Sprint_2_Review.md](sprints/02_Sprint_2_Review.md) for the full account. |
| v1.2 (Sprint 3, partial) | 2026-08-01 | **Complete (small slice)** | Deleted the confirmed-dead `app/db/schema/focus.ts`; fixed the achievement-unlock gap (`endFocusSessionFn` now calls `checkAndUnlockAchievements`, matching the Pomodoro path). The full `focus_sessions`/`start_events`/`focus_heartbeats` merge and XP reconciliation, originally proposed as one Version 1.2 sprint, were reality-checked as bigger than the roadmap entry implied and deliberately deferred. See [03_Sprint_3_Review.md](sprints/03_Sprint_3_Review.md). |
| v1.2 (Sprint 4) | 2026-08-01 | **Complete** | The real Version 1.2 unification, designed collaboratively before writing code since no target schema existed anywhere: `start_events` deleted and folded into `focus_sessions` (created immediately at start); `assignment_id`'s polymorphism resolved to a real `quiz_id` FK; `focus_heartbeats` simplified and given its first real FK; XP reconciled so Pomodoro sessions earn it for the first time, via one shared completion helper both paths now call. A migration-correctness hazard (`ensureMinimumDatabaseSchema()`, which would have silently undone this migration on every server restart) found and retired; a pre-existing React purity bug from Sprint 2 (side effects inside a `setState` updater) found via a new e2e test and fixed. See [04_Sprint_4_Review.md](sprints/04_Sprint_4_Review.md). |
