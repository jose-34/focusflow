import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const queryClient = postgres(process.env.DATABASE_URL)

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
