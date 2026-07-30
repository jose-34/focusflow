import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_ADMIN_URL) {
  throw new Error('DATABASE_ADMIN_URL environment variable is not set')
}

const adminClient = postgres(process.env.DATABASE_ADMIN_URL)

/**
 * Bypasses RLS (connects as the Postgres superuser). Reserved for the auth
 * flows that inherently need cross-user access before any user context can
 * exist yet: looking a user up by email at login, validating a session by
 * its token, and creating the initial row for a brand-new registrant. Every
 * other feature query must go through `db` + `withRlsContext` in `app/db/index.ts`.
 */
export const adminDb = drizzle(adminClient, { schema })
