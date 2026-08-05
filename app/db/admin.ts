import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_ADMIN_URL) {
  throw new Error('DATABASE_ADMIN_URL environment variable is not set')
}

const adminClient = postgres(process.env.DATABASE_ADMIN_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
})

/**
 * Bypasses RLS (connects as the Postgres superuser). Two legitimate uses:
 * (1) the auth flows that inherently need cross-user access before any user
 * context can exist yet — looking a user up by email at login, validating a
 * session by its token, creating the initial row for a new registrant; (2)
 * the admin platform console (`app/features/admin/`), which by design needs
 * a genuine cross-user view no RLS policy grants (every existing policy
 * scopes to "your own rows", none carve out a blanket admin bypass) — always
 * gated by `requireAdmin()` first. Every other feature query must go through
 * `db` + `withRlsContext` in `app/db/index.ts`.
 */
export const adminDb = drizzle(adminClient, { schema })
