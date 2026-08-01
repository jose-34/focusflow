# Sprint 2 — Commitment Setting

*Reality-checked before writing this: zero code exists for this feature — no `commitment` column, no schema, nothing referencing it anywhere in `app/`. A clean, fully-specified gap, not a rediscovery like Sprint 1's roster removal.*

## Sprint Number
2

## Objectives

Ship [D3 Commitment Setting](../04_Product_Requirements_Document.md#d3-commitment-setting) end-to-end: a student states a specific intention before a Focus Session starts, sees it shown back at session end, and self-reports whether they met it.

## Product decision resolved before implementation

D3's own PRD text flagged an unresolved question: mandatory or optional. **Resolved: required.** A student must enter a non-empty commitment before a focus session can start — chosen over the lower-friction "optional" alternative on the reasoning that implementation-intention techniques are known to work better when not skippable. Self-reporting whether it was met stays non-judgmental either way (D3's own rule: "never system-judged").

## Features

- A required, short free-text commitment prompt shown before a Focus Session starts (not before every timer mode — breaks don't need one).
- The commitment is shown back verbatim when the session completes, alongside a simple Met / Not Met self-check (optional to answer — the *commitment* is required, the *reflection on it* is not, matching D3's self-report-not-compliance stance).
- An abandoned (not completed) session skips the reflection step entirely — there's nothing to reflect on if the session was never finished.

## Dependencies

None external. `focus_sessions` already exists and is already RLS-scoped per-user; this only adds two nullable columns to it.

## Risks

- **Schema safety**: existing `focus_sessions` rows have no commitment. The new `commitment` column is added as nullable in the DB (never NOT NULL) — "required" is enforced at the Zod/UI layer for all *new* sessions, not as a DB constraint that would break historical rows or force a backfill.
- **Scope discipline**: D4 (Teacher Risk Signal) and anything analytics-shaped that could read commitment data is explicitly out of scope this sprint — this is a student-facing reflection feature only, not a new teacher-visible signal.

## Acceptance Criteria

Per the PRD's own list:
- ✓ A Commitment set at session start is shown back verbatim at session end.
- ✓ A student cannot start a Focus Session without entering a commitment (required, per the decision above — supersedes the PRD's original "skipping never blocks starting" line, which was written before the mandatory/optional question was resolved).
- ✓ Met/Not-Met is self-reported only — nothing in this feature computes or infers it.
- ✓ An abandoned session never prompts for a met/not-met reflection.

## Testing Plan

- No new pure-logic unit tests expected — this is UI + a straight DB round-trip, not the extractable-pure-function shape Sprint 0's `computeStreaks`/`riskScore` tests covered.
- E2E: start a focus session, confirm it's blocked without a commitment, enter one, complete the session, confirm the commitment is shown back verbatim with a Met/Not Met choice, confirm an abandoned session shows no reflection prompt.

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and [19_Implementation_Guide.md](../19_Implementation_Guide.md)'s ten-stage checklist, applied here as it was for Sprints 0 and 1.
