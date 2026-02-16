-- ============================================================
-- 004: Sync preferences + agent registry
-- ============================================================

-- Sync toggles on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sync_activity BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_wallet BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_status BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_configs BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- AGENT_REGISTRY
-- Tracks provisioned cloud agents (Fly.io machines).
-- One row per user (single-agent MVP).
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  fly_app_name    TEXT NOT NULL,
  fly_machine_id  TEXT NOT NULL,
  region          TEXT NOT NULL DEFAULT 'iad',
  gateway_url     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'starting'
    CHECK (status IN ('starting', 'running', 'stopped', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address)
);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent registry"
  ON agent_registry FOR ALL
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE TRIGGER trg_agent_registry_updated_at
  BEFORE UPDATE ON agent_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DATA RETENTION CRON
-- Uses pg_cron (available on Supabase Pro+) to run daily cleanup.
-- On free tier, call cleanup_old_events() via Edge Function instead.
-- ============================================================
-- Uncomment below if pg_cron is available:
-- SELECT cron.schedule(
--   'cleanup-old-events',
--   '0 3 * * *',  -- 3 AM UTC daily
--   $$SELECT cleanup_old_events()$$
-- );
