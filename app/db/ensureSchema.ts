import { sql } from 'drizzle-orm'
import { adminDb } from './admin'

export async function ensureMinimumDatabaseSchema() {
  await adminDb.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)

  await adminDb.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0
  `)

  await adminDb.execute(sql`
    CREATE TABLE IF NOT EXISTS xp_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount integer NOT NULL,
      source text NOT NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await adminDb.execute(sql`
    CREATE TABLE IF NOT EXISTS start_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id uuid NOT NULL,
      user_id uuid NOT NULL,
      start_at timestamptz NOT NULL DEFAULT now(),
      start_method text NOT NULL CHECK (start_method IN ('web', 'extension', 'mobile')),
      start_xp integer NOT NULL DEFAULT 0,
      start_token text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (assignment_id, user_id)
    )
  `)

  await adminDb.execute(sql`
    ALTER TABLE focus_sessions
    ADD COLUMN IF NOT EXISTS start_event_id uuid,
    ADD COLUMN IF NOT EXISTS assignment_id uuid,
    ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false
  `)

  await adminDb.execute(sql`
    CREATE TABLE IF NOT EXISTS focus_heartbeats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      focus_session_id uuid,
      start_event_id uuid NOT NULL,
      assignment_id uuid NOT NULL,
      user_id uuid NOT NULL,
      heartbeat_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}
