BEGIN;

-- Add a denormalized user XP total for quick reads
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

-- Ledger of XP transactions (immutable audit log)
CREATE TABLE IF NOT EXISTS xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_ledger_user_id_idx ON xp_ledger(user_id);

COMMIT;
