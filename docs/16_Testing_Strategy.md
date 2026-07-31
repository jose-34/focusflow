# Focus Flow: Testing Strategy

*An honest accounting first: today, real automated verification is exactly one layer deep — end-to-end Playwright tests. Everything else in this document (unit, integration, performance, accessibility, formal security testing) is a target to build toward, named explicitly as such, not retrofitted to sound more mature than it is.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Verifies the rules and constraints specified across every prior document in this set — this document's job is to make sure they stay true, not just get stated once.

---

## 1. Unit tests — adopted in Sprint 0

**Vitest is now configured** (`vitest.config.ts`, `npm run test:unit`), separate from `vite.config.ts` deliberately — the app config's TanStack Start plugin and dev-only WebSocket side effect have no place in a unit-test run.

**A correction to this section's own earlier claim**: it previously asserted "a unit test on `computeStreaks` would have caught the streak-truncation bug in seconds." That's imprecise, caught while actually writing the test. `computeStreaks` itself is correct — given a full history, it computes the right streak (now proven by `app/features/progress/streaks.test.ts`'s 20-day test case). **The real bug is entirely in the caller** (`getProgressDataFn`), which only ever queries 14 days of sessions before handing the result to `computeStreaks`. A pure unit test of `computeStreaks` cannot catch this — it would need an integration-level test that seeds >14 days of real sessions and asserts on `getProgressDataFn`'s actual output, which is a Version 2.2 task (the same release already scheduled to fix the bug itself), not something Sprint 0 solves by extraction alone.

Both pure functions this section originally targeted are now extracted (out of files that import `@/db`, so they're testable without a live `DATABASE_URL`) and tested:

1. `computeStreaks` → `app/features/progress/streaks.ts` + `streaks.test.ts` (6 tests, all passing) — correctly proves the function itself is sound; explicitly does **not** claim to catch the windowing bug, per the correction above.
2. `computeRiskScore` (the risk-score logic inside `getAssignmentInsightsFn`, [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §2) → `app/features/quizzes/riskScore.ts` + `riskScore.test.ts` (6 tests, all passing).

**Still pending, not yet done**:
3. The XP economy calculations proposed in [12_Gamification_Framework.md](12_Gamification_Framework.md) §2 — write these once that economy is actually implemented (Version 2.0), not before.
4. Zod schema edge cases (e.g., `createQuestionSchema`'s "exactly one correct choice" refine) — cheap to test, not yet done.

---

## 2. Integration tests — informally practiced, never formalized

**No integration test suite exists as a distinct, repeatable layer** — but this session's own work already demonstrates the right shape for one. Verifying the two real RLS bugs in [09_Database_Design.md](09_Database_Design.md) meant writing small, throwaway scripts that called `withRlsContext` directly against the real test database, as two different real users, and asserted on the actual result — exactly what a real integration test does, just written once, run manually, and deleted afterward instead of committed and re-run automatically.

**Recommendation**: formalize this exact pattern into a real, committed test suite — one test file per server function (or per table), each calling the real handler through `withRlsContext` with a seeded test user, asserting both the happy path and the cross-user-denial path. This is the natural home for verifying every "Permission rule" column in [10_API_Architecture.md](10_API_Architecture.md), one assertion per rule, rather than trusting that RLS is correct because a policy exists.

---

## 3. UI (end-to-end) tests — Built, and the most mature layer today

Playwright, with `@playwright/test` installed and `test:e2e`/`test:e2e:ui` npm scripts. Real, established conventions, restated here as the standing rules for any new test, not re-derived:

- Label-based selectors (`getByLabel`, `getByRole`), never brittle CSS selectors.
- Radix/shadcn `Select` components require the combobox pattern (`button[role="combobox"]` + `getByRole('option', {name, exact:true})`) — `selectOption()` silently fails against them.
- Every test generates its own unique test account (timestamped email) — never depends on a pre-seeded fixture user, since a fresh database has none.
- `adminDb` cleanup after every run, with an explicit double-check for real (non-test) data before deleting anything — this project's own real class ("GRADE 9") has been correctly preserved through several rounds of test cleanup specifically because this check was never skipped.
- Elevated timeouts (`expect: 15000ms`, per-test `60000ms`) to absorb Vite dev-mode's cold-route-compile latency — confirmed, not guessed, by direct measurement during this session (a route can take 15–20 seconds to compile on its first hit).
- `retry: false` on queries expected to fail permanently (an RLS-denied "not found") — React Query's default retry-with-backoff otherwise makes a real, permanent access-control failure look like a 7–9 second hang, which has previously cost real debugging time chasing a red herring.

**A real, project-specific operational constraint worth stating as a standing testing-infrastructure rule, not a one-off note**: this development machine has only 8GB of RAM. Orphaned `chrome.exe` processes from interrupted or crashed Playwright runs have twice, in this session alone, dropped free memory to under 500MB and made the dev server itself unresponsive — confirmed by direct measurement, not assumed. **Standing rule: check for and kill leftover `chrome.exe` processes before every Playwright run, and prefer `--workers=1` over parallel workers when memory is already tight** — this is not a one-time cleanup, it recurs, and should be treated as routine test-run hygiene going forward.

---

## 4. Performance tests — none exist, and this is a real gap against a stated design principle

[00_Project_Philosophy.md](00_Project_Philosophy.md) states a shared, low-end Android phone on a metered data bundle is "the real user, not an edge case" — but nothing in this codebase actually *measures* performance against that claim. A design principle with no test verifying it is a belief, not a guarantee.

**Recommendation**: two concrete, low-effort starting points rather than a heavyweight performance-testing program:
1. A bundle-size budget check in CI, specifically watching the React Three Fiber celebration bundle ([11_UI_UX_Design_System.md](11_UI_UX_Design_System.md)) — since it's the one part of the app explicitly justified as "worth the weight because it's rare," a budget check keeps that justification honest as the codebase grows.
2. A Lighthouse (or similar) run against the three or four heaviest real pages (`/dashboard`, `/classes/:id`, the live game player view) on a throttled, low-end-device network profile — matching the actual target hardware, not a developer's own fast machine.

---

## 5. Accessibility tests — none exist; the checklist already exists

[11_UI_UX_Design_System.md](11_UI_UX_Design_System.md) already named five specific, real gaps — this document does not invent a new generic accessibility program, it points at that exact list as the starting checklist:

1. `CardTitle` renders a `<div>`, not a real heading element.
2. `prefers-reduced-motion` is not respected anywhere (Framer Motion or the R3F celebration layer).
3. No WCAG AA contrast check has been run on either theme, especially the gold accent.
4. No systematic screen-reader pass has been done on the live game or celebration flows specifically — the most animation-heavy, least conventional parts of the UI, and therefore the most likely to have real accessibility gaps.
5. (New, named here for the first time) **No keyboard-only navigation pass has been done on the Live Game host/player flows** — a fast-paced, timer-driven UI is exactly the kind of interface that's easy to build mouse/touch-first and forget to verify with a keyboard alone.

---

## 6. Security tests — informal, and already proven valuable; formalize the exact pattern that worked

[09_Database_Design.md](09_Database_Design.md)'s two real findings were caught by a specific, repeatable technique: seed two distinct real users via `adminDb`, then attempt a cross-user read or write through `withRlsContext` as each, and assert the isolation holds. **Recommendation**: turn this into a standing, committed test suite — one cross-user-isolation test per RLS-protected table in [09_Database_Design.md](09_Database_Design.md), run in CI on every schema change, not written once during a documentation exercise and then discarded. This single technique already found two real, live vulnerabilities this session; it should not depend on someone happening to write a documentation doc to be run again.

---

## 7. User Acceptance Testing

**A real, informal version has already happened**: Focus Flow was built for and presented at the Young Scientists Kenya National Science and Technology Exhibition, to real students and real judges — genuine real-world exposure, not a lab test. **What doesn't exist yet is a repeatable process for future releases.**

**Recommendation**: a lightweight UAT checklist before any significant feature ships — a real teacher and a small group of real students try the golden path of the new feature, in a real classroom or equivalent setting, before it's rolled out further. Given [00_Project_Philosophy.md](00_Project_Philosophy.md)'s emphasis on the actual device and classroom this product is built for, this kind of grounded, real-user check matters more here than a generic "beta tester" program would for a typical SaaS product.

---

## 8. Prioritization — what to actually build first, given nothing exists but E2E

Given a small team and finite time, the order below is a deliberate recommendation, not an arbitrary checklist:

1. ~~Formalize the RLS cross-user-isolation security test suite (§6)~~ — **done, Sprint 0**: 28 checks across every RLS-protected table, all passing (see [DESIGN_REVIEW_BOARD.md](DESIGN_REVIEW_BOARD.md)).
2. ~~Unit tests for `computeStreaks` and `computeRiskScore`~~ — **done, Sprint 0**: both extracted to dependency-free files and tested (§1). The remaining two (XP economy, zod schema edge cases) are still pending.
3. **Integration tests, formalizing the pattern in §2** — extends the same technique used for security to ordinary correctness, not just access control. Not yet done.
4. **Accessibility fixes from the existing checklist (§5)** — the list already exists; this is execution, not new discovery. Not yet done.
5. **Performance budget/Lighthouse checks (§4)** and **a formal UAT process (§7)** — valuable, but lower urgency than the above. Not yet done.

---

## Open questions carried into engineering

- Choose and configure Vitest (or an alternative) — not yet done.
- Decide how integration tests reach a real (not production) test database — a seeding/teardown strategy needs to exist before §2's recommendation is actionable.
- Decide whether the security test suite in §6 blocks a schema-change PR from merging (a real CI gate) or only runs informationally at first.

---

**Next:** [17_Deployment_Architecture.md] — resolving the several dependencies this document set has already named and deferred here: the WebSocket production gap, encryption-in-transit/at-rest, backups, and where CI actually runs these tests.
