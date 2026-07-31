import { sql } from 'drizzle-orm'
import { adminDb } from './admin'

/**
 * Creates and grants the restricted `focusflow_app` Postgres role that
 * `DATABASE_URL` connects as (see .env.example) — the role RLS policies
 * grant SECURITY DEFINER function execution to. Idempotent, so it's safe to
 * run against an already-provisioned database (a plain `CREATE ROLE` is
 * not, which is why this exists as a real script rather than a line in a
 * README).
 *
 * Sprint 0 finding: no such script existed anywhere in this repository
 * before this — a fresh Postgres instance (a new developer's machine, a CI
 * runner, a first real production database) had no documented, scripted way
 * to reach the state every other db: script already assumes. Run this once,
 * before `npm run db:push` and `npm run db:rls`, against any new database.
 */
async function main() {
  await adminDb.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'focusflow_app') THEN
        CREATE ROLE focusflow_app LOGIN PASSWORD 'password';
      END IF;
    END
    $$;
  `)

  const dbName = new URL(process.env.DATABASE_ADMIN_URL ?? '').pathname.replace('/', '') || 'focusflow'
  await adminDb.execute(sql.raw(`GRANT CONNECT ON DATABASE "${dbName}" TO focusflow_app`))
  await adminDb.execute(sql`GRANT USAGE ON SCHEMA public TO focusflow_app`)
  // Table-level DML grants — RLS restricts *which rows*, these grants are
  // what let the role touch the table at all. Applied to future tables too,
  // so a newly-added table doesn't need a manual grant step.
  await adminDb.execute(sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO focusflow_app`)
  await adminDb.execute(sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO focusflow_app`)
  await adminDb.execute(sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO focusflow_app`)
  await adminDb.execute(sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO focusflow_app`)

  console.log('✅ focusflow_app role created/verified and granted.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to bootstrap focusflow_app role:', error)
    process.exit(1)
  })
