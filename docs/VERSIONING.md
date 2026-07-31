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
