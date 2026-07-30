# Sprint 0 — Engineering Foundation

*Before scoping this sprint, each generically-listed Sprint 0 objective was checked against what actually exists in this codebase — several are already built and would be wasted effort to "set up" again. This plan covers only the genuine gaps.*

## Reality check — what Sprint 0 does NOT need to build

| Generic Sprint 0 item | Actual status |
|---|---|
| Development environment | **Already exists** — `npm run dev`, `.env.example`, Vite/TanStack Start configured. |
| Authentication framework | **Already exists** — `bcryptjs` + first-party session cookies, per [08_System_Architecture.md](../08_System_Architecture.md). |
| Role-based access control | **Already exists, and unusually mature** — real Postgres RLS is the enforcement boundary, not app-layer checks; verified via a 28-check cross-user isolation sweep ([DESIGN_REVIEW_BOARD.md](../DESIGN_REVIEW_BOARD.md)). |
| Database migrations | **Already exists** — `drizzle-kit push` + `apply-rls.ts` for the policy layer `drizzle-kit` can't push itself. |
| Linting | **Partially exists** — `oxlint` is configured (`npm run lint`); not yet enforced in CI, since no CI exists. |

## Sprint Number
0

## Objectives

Establish the engineering-process infrastructure this specification depends on but doesn't itself provide — repository governance, CI, and the specific gaps [15_Security_Privacy.md](../15_Security_Privacy.md), [16_Testing_Strategy.md](../16_Testing_Strategy.md), and [10_API_Architecture.md](../10_API_Architecture.md) already named. Deliver no user-facing feature — this sprint is foundation only, matching the founder's own instruction to keep it narrow.

## Features

Not applicable — this sprint delivers infrastructure, not product features.

## Tasks

1. **Initialize version control.** This project is not currently a git repository at all — confirmed, not assumed. Before any branch strategy can mean anything, `git init` + an initial commit of the current working tree is a real prerequisite, not a formality.
2. **Branch strategy.** Given a solo/small team (per [01_Product_Vision.md](../01_Product_Vision.md)), a lightweight trunk-based model — `main` always deployable, short-lived feature branches per sprint task, no long-lived `develop` — fits better than a heavier gitflow model built for larger teams.
3. **CI pipeline** (GitHub Actions, per [17_Deployment_Architecture.md](../17_Deployment_Architecture.md) §5): on every push, run `tsc -b`, `oxlint`, and the Playwright suite; fail the build on any failure. Deploy step deferred until a hosting decision is made (§2 of that same document is still open).
4. **Unit test framework**: adopt Vitest (per [16_Testing_Strategy.md](../16_Testing_Strategy.md) §1 — it integrates natively with the existing Vite tooling, no new build config). First real tests: `computeStreaks` (has a known, documented bug — a good first test to write *failing*, then decide whether to fix the bug in this sprint or file it for Sprint 6/Analytics) and the `riskScore` calculation.
5. **Audit-log table**: the minimal `audit_log` schema named in [15_Security_Privacy.md](../15_Security_Privacy.md) §4 — actor, action, target, timestamp, required reason field — real RLS policy from day one, following the exact `apply-rls.ts` pattern every other table uses (this sprint is the right place to make sure this table is never added the way `xp_ledger` originally was).
6. **Error-handling standard**: resolve the open question from [10_API_Architecture.md](../10_API_Architecture.md) — a real `{code, message}` error shape (or an explicit, documented decision to keep bare `Error` messages) — and fix the `toggleTaskFn`/`deleteTaskFn` silent-no-op inconsistency noted there while this is being decided.
7. **Coding standards doc**: a short `CONTRIBUTING.md` distilling the patterns [19_Implementation_Guide.md](../19_Implementation_Guide.md) already established (the `requireUser` → `withRlsContext` server-function shape, the RLS-body-lives-in-`apply-rls.ts` rule, the flat-vs-nested routing rule) — not new standards, just making the already-proven ones easy to find without reading the full implementation guide every time.

## Dependencies

- Task 3 (CI) has no external dependency and can start immediately.
- Task 5 (audit log) should land before any work resumes on the Platform Administrator role ([18_Product_Roadmap.md](../18_Product_Roadmap.md) Version 2.1) — it's a hard prerequisite there, not just a nice-to-have here.
- No task in this sprint depends on the still-open hosting decision ([17_Deployment_Architecture.md](../17_Deployment_Architecture.md) §2) — deploy automation is deliberately deferred, not blocked.

## Risks

- **Scope creep risk, named explicitly**: "coding standards" and "documentation automation" are open-ended asks by nature. Bounded here to a single short document and, if pursued at all, a single lightweight staleness-check script — not a tooling program.
- **The `computeStreaks` bug (task 4)** — writing a test for it will immediately produce a red test. Decide up front whether Sprint 0 fixes it inline (it's a small, well-understood fix) or files it as a tracked failure for its already-scheduled fix in Version 2.2 ([18_Product_Roadmap.md](../18_Product_Roadmap.md)) — don't let an already-planned fix get accidentally duplicated or contradicted.

## Acceptance Criteria

- ✓ The repository is a real git repo with an initial commit and a documented branch strategy.
- ✓ A CI pipeline runs type-check, lint, and the full Playwright suite on every push, and fails the build on any failure.
- ✓ Vitest is installed and configured; at least the two named unit tests exist and pass (or, for `computeStreaks`, exist and are explicitly tracked as a known-failing test with a linked fix date, not silently ignored).
- ✓ `audit_log` exists, has a real RLS policy verified the same empirical way every other table in this project now is, and is referenced from [15_Security_Privacy.md](../15_Security_Privacy.md) as resolved rather than open.
- ✓ The error-handling decision is made and documented in [10_API_Architecture.md](../10_API_Architecture.md), and the `toggleTaskFn`/`deleteTaskFn` inconsistency is resolved to match it.
- ✓ `CONTRIBUTING.md` exists and a new contributor (human or AI) could follow it to correctly implement one new server function without re-reading the full 21-document specification.

## Testing Plan

Every task above is itself testing/process infrastructure, so the "test" for this sprint is largely: does the pipeline built in task 3 actually catch a deliberately-introduced failure? Verify by intentionally breaking a type, a lint rule, and a Playwright assertion in a throwaway branch and confirming CI fails on each, then revert — don't just assume the pipeline works because it was configured correctly on paper.

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and the standing [19_Implementation_Guide.md](../19_Implementation_Guide.md) checklist — all ten stages, applied to infrastructure rather than a feature this time. This sprint is done when the *next* sprint (Practice Tasks, [18_Product_Roadmap.md](../18_Product_Roadmap.md) Version 1.1) can be built entirely inside the process this sprint establishes, with no exceptions granted.
