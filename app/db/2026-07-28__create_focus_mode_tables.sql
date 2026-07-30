-- 2026-07-28__create_focus_mode_tables.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- start_events: one start per (assignment, user) - idempotent by unique constraint
CREATE TABLE IF NOT EXISTS start_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  start_method text NOT NULL CHECK (start_method IN ('web','extension','mobile')),
  start_xp integer NOT NULL DEFAULT 0,
  start_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);

COMMENT ON TABLE start_events IS 'One-off event when a student first starts an assignment. Used to award Start XP and compute time-to-start metrics.';

CREATE INDEX IF NOT EXISTS idx_start_events_assignment ON start_events (assignment_id);
CREATE INDEX IF NOT EXISTS idx_start_events_user ON start_events (user_id);
CREATE INDEX IF NOT EXISTS idx_start_events_assignment_created_at ON start_events (assignment_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_start_events_start_token ON start_events (start_token);

-- focus_sessions: add assignment linkage and verification support to the existing focus session table
ALTER TABLE IF EXISTS focus_sessions
  ADD COLUMN IF NOT EXISTS start_event_id uuid,
  ADD COLUMN IF NOT EXISTS assignment_id uuid,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_event ON focus_sessions (start_event_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_assignment ON focus_sessions (assignment_id);

-- focus_heartbeats: raw heartbeat events (high-volume, short retention)
CREATE TABLE IF NOT EXISTS focus_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  focus_session_id uuid NULL,
  start_event_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  heartbeat_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE focus_heartbeats IS 'Fine-grained heartbeats for verifying continuous focus. Retain raw rows for 30 days; aggregate into focus_sessions for longer retention.';

CREATE INDEX IF NOT EXISTS idx_focus_heartbeats_session ON focus_heartbeats (focus_session_id);
CREATE INDEX IF NOT EXISTS idx_focus_heartbeats_start_event ON focus_heartbeats (start_event_id);
CREATE INDEX IF NOT EXISTS idx_focus_heartbeats_assignment ON focus_heartbeats (assignment_id);
CREATE INDEX IF NOT EXISTS idx_focus_heartbeats_user ON focus_heartbeats (user_id);

COMMIT;
