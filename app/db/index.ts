import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Explicit pool limits rather than postgres.js's silent defaults: `max`
// caps how many concurrent connections this client can open (a burst of
// traffic queues for a free connection instead of exhausting Postgres's
// own connection limit — shared with `adminDb`'s own pool below, so the
// two together must stay under whatever the Postgres plan allows).
// `connect_timeout`/`idle_timeout` keep a slow network or a leaked
// transaction from holding a connection open indefinitely.
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(queryClient, { schema })

export type Tx = Parameters<Parameters<(typeof db)['transaction']>[0]>[0]

/**
 * Runs `callback` inside a transaction with the Postgres session variable
 * `app.user_id` set via `set_config(..., true)` (transaction-local). RLS
 * policies check this variable, so every query inside `callback` is scoped
 * to `userId`'s own rows. Using `SET LOCAL` semantics (via set_config's
 * third argument) instead of a bare `SET` is required here: this app connects
 * through a pooled `postgres.js` client, and a plain `SET` would leak the
 * user context to whichever unrelated request reuses the same connection.
 */
export async function withRlsContext<T>(userId: string, callback: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    return callback(tx)
  })
}
