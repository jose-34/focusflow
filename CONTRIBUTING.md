# Contributing to Focus Flow

*Distills the patterns already proven throughout `docs/-01_Focus_Flow_Principles.md` through `docs/19_Implementation_Guide.md` into a form you can follow without re-reading all twenty documents first. When this file and the full docs disagree, the full docs win — file a correction here.*

Read [`docs/-01_Focus_Flow_Principles.md`](docs/-01_Focus_Flow_Principles.md) before anything else. Then, for any real feature work, follow the ten-stage pipeline in [`docs/19_Implementation_Guide.md`](docs/19_Implementation_Guide.md) (Requirements → Architecture → Database → API → Backend → Frontend → Testing → Documentation → Deployment → Review) — no shortcuts, no exceptions, because this project has already paid the real cost of skipping one (see that document's §3).

## The server function shape

Every backend operation is a `createServerFn`, and every one of them follows this exact shape:

```ts
export const someActionFn = createServerFn({ method: 'POST' })
  .validator(someZodSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    // role checks here, if any
    return withRlsContext(user.id, async (tx) => {
      // ... actual work, using tx, never a raw db import
    })
  })
```

- `requireUser()` always comes first — nothing runs unauthenticated.
- `withRlsContext` is what makes the database enforce access control — it is never optional, and it is never replaced with a raw `db` or `adminDb` call except in the narrow, already-documented discovery cases (joining a class by code, joining a game by PIN — see `app/features/classes/hooks/useClasses.ts`'s `joinClassFn` for the reference pattern).
- Any client-suppliable ID that implies ownership (a `taskId`, a `classId`) is re-verified server-side against the current user — never trusted because the client sent it. See `startFocusSessionFn` in `app/features/timer/hooks/useFocusSession.ts`.

## The RLS rule that has already caused two real bugs

**A policy body written only in a schema file (`pgPolicy(...)`) does not do anything.** `drizzle-kit push` silently drops `USING`/`WITH CHECK` bodies on push. The real, enforced policy body must also be added to `app/db/apply-rls.ts`, and `npm run db:rls` must be re-run after every `npm run db:push`. This is not a style preference — two real, live vulnerabilities in this exact codebase (`xp_ledger`, `start_events`/`focus_heartbeats`) existed because this step was skipped once. See `docs/09_Database_Design.md` for the full account.

**Before considering any new table's RLS "done," verify it empirically** — seed two real, distinct users, attempt cross-user access through `withRlsContext`, confirm isolation holds. Don't assume a policy that looks right is enforced; the two bugs above both looked completely correct in the schema file.

Two structural RLS rules, permanent:
1. Cross-table permission checks go through a `SECURITY DEFINER` Postgres function (see the `fn_*` functions in `apply-rls.ts`), never an inline subquery — two tables whose policies each check the other cause a Postgres recursion error.
2. A table's own SELECT policy must never re-query that same table by the row's own `id` — this fails intermittently under `INSERT ... RETURNING` (the row being created isn't visible to a nested self-query in the same command). Reference the row's own columns directly instead, or query a different table.

## Routing rules (TanStack Router)

1. Any route that will ever gain a child route must start as `name.index.tsx` + a real `name.tsx` layout — never a bare leaf file. A bare leaf file that later gains a child silently becomes a non-rendering implicit layout, with no error. This has happened twice in this project's real history, at two different nesting depths.
2. Routes that don't share a real parent-child relationship stay flat, even if they feel related (see the `game.*` routes, which deliberately don't nest under the quiz they belong to).

## Testing

- Playwright is the only test runner today (Vitest is being adopted starting Sprint 0 — check `docs/16_Testing_Strategy.md` for current status).
- Use label-based selectors (`getByLabel`, `getByRole`) — never brittle CSS selectors.
- Radix/shadcn `Select` components need the combobox pattern: `page.locator('button[role="combobox"]')` + `getByRole('option', {name, exact:true})`. `selectOption()` silently fails against them.
- Every test generates its own unique test account — never depends on a seeded fixture.
- Clean up test data via `adminDb` after every run, and **always double-check for real (non-test) data before deleting anything.**
- Set `retry: false` on any query expected to fail permanently (an RLS-denied "not found") — otherwise React Query's default retry makes a real access-control failure look like a 7-9 second hang.
- **This machine has 8GB RAM.** Kill leftover `chrome.exe` processes and prefer `--workers=1` before running Playwright if the dev server seems unresponsive — this has recurred multiple times in this project's real history and is routine hygiene, not a one-off fix.

## Documentation discipline

Every document in `docs/` tags claims **Built** or **Planned**. When you ship a Planned feature, flip its tag everywhere it's mentioned — a stale tag is worse than no tag, because it actively misleads the next person (or AI) who reads it. See `docs/09_Database_Design.md`'s own critical-findings section for a real example of this going stale even within the same session it was written.

Follow [`docs/VERSIONING.md`](docs/VERSIONING.md) for how to categorize a change (Patch/Minor/Major) and the sprint-plan/sprint-review template every sprint uses.
