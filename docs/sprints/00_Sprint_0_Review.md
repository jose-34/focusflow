# Sprint 0 — Review

## Sprint Review

Sprint 0's actual infrastructure gap-list (§ "Reality check" in [00_Sprint_0_Plan.md](00_Sprint_0_Plan.md)) is closed. Everything is verified, not just marked done — several items required real code fixes, not just configuration.

## Completed

1. **Git repository** — `git init -b main`, real initial commit (153 files), `.gitignore` hardened (`.tanstack`, `tsconfig.tsbuildinfo`, Playwright output, `.claude` tooling state all excluded).
2. **CI pipeline** — `.github/workflows/ci.yml`: a `checks` job (type-check, lint, unit tests) and an `e2e` job (Postgres 16 service container, schema push, RLS apply, seed, full Playwright run). YAML validated locally; **cannot be verified as green on a real runner** — there's no GitHub remote yet, so this has never actually executed in GitHub Actions. Flagged, not silently assumed working.
3. **Unit test framework** — Vitest adopted, deliberately isolated from `vite.config.ts` (that config's TanStack Start plugin and dev-only WebSocket side effect have no place in a unit-test run). `computeStreaks` and `computeRiskScore` extracted into dependency-free files and tested — 12 tests, all passing.
4. **Audit-log table** — built, RLS-enabled with zero policies (default-deny for every app role, including the actor), verified empirically. Not yet wired to any real caller — correctly deferred until Platform Administrator exists.
5. **Error-handling standard** — decided (bare `Error` messages, explicitly, not a stopgap) and one real inconsistency fixed (`toggleTaskFn`/`deleteTaskFn` now throw instead of silently no-op-ing).
6. **CONTRIBUTING.md** — written, distilling patterns already proven in the Implementation Guide.
7. **A new, previously-undocumented gap found and closed**: no script anywhere created the restricted `focusflow_app` Postgres role every `db:*` script assumes exists. `app/db/bootstrap-role.ts` fixes this — a real finding from actually trying to make CI work end-to-end, not something the original plan anticipated.
8. **A real bug found and fixed while wiring CI**, not part of the original plan: four `useEffect` hooks in the student quiz-taking view (`classes.$classId.quizzes.$quizId.tsx`) were called after conditional early returns — a genuine React Rules-of-Hooks violation `npm run lint` surfaced the moment CI was actually run. Fixed by moving them above the guards; re-verified with `tsc -b` and `npm run lint`, both clean.

## Deferred

- The XP economy unit tests and zod schema edge-case tests ([16_Testing_Strategy.md](../16_Testing_Strategy.md) §1, items 3–4) — correctly deferred to when those systems are actually implemented, not built speculatively now.
- Documentation-staleness automation ([00_Sprint_0_Plan.md](00_Sprint_0_Plan.md)'s risk note) — not attempted; scope stayed bounded to the plan's core six tasks plus the two real findings above.

## Known Issues

1. **One e2e test flakes under this development machine's memory ceiling**: `curriculum-onboarding.spec.ts`'s second test intermittently fails on a `getByText('Competency-Based Curriculum (CBC)')` assertion. Investigated rather than dismissed: `git diff` against the pre-Sprint-0 commit confirms **zero code overlap** between Sprint 0's changes and the class/enrollment/curriculum code this test exercises (`app/features/classes/`, `app/db/apply-rls.ts`'s enrollment policies are untouched). The same test passed cleanly earlier in this project's history before Sprint 0 began. Reproduced twice under memory pressure (free RAM cycling between ~300MB and ~2GB across repeated runs, with 15–23 orphaned `chrome.exe` processes each time) — consistent with this machine's already-documented 8GB RAM constraint, not a logic defect. Not fixed inline; recorded here rather than silently retried into a false pass.
2. **The CI workflow has never run on a real GitHub Actions runner** — no remote exists for this repository yet. The YAML is syntactically valid and the command sequence matches what's been manually verified locally throughout this project, but "green in CI" is not yet a claim this review makes.

## Documentation Updated?

Yes — [10_API_Architecture.md](../10_API_Architecture.md) (error-handling decision), [15_Security_Privacy.md](../15_Security_Privacy.md) (audit log resolved), [16_Testing_Strategy.md](../16_Testing_Strategy.md) (unit tests adopted, plus a correction to its own earlier claim about what a `computeStreaks` test would and wouldn't catch).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean (one real, pre-existing error fixed; only pre-existing "fast refresh" warnings remain, none new).
- `npm run test:unit`: 12/12 passing.
- `npx playwright test`: 4/5 passing reliably; the 5th flakes per Known Issue #1 above, root-caused to system resource pressure rather than a code regression.

## Ready for Next Sprint?

**Yes**, with the two Known Issues carried forward openly rather than hidden: the e2e flake should be watched (not re-chased) during Sprint 1, and the CI pipeline's first real run (once a remote exists) should be treated as the actual verification, not this local YAML validation.
