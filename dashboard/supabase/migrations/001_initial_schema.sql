-- ClawSight MVP Schema
-- Single-agent per wallet. Agents table deferred until multi-agent is needed.
-- All tables use RLS. wallet_address is denormalized for fast policy checks.

-- ============================================================
-- USERS
-- Stores wallet, character customization, and display preferences.
-- ============================================================
CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  display_mode   TEXT NOT NULL DEFAULT 'fun'
    CHECK (display_mode IN ('fun', 'professional')),
  agent_name     TEXT NOT NULL DEFAULT 'Mrs. Claws',
  avatar_style   TEXT NOT NULL DEFAULT 'lobster'
    CHECK (avatar_style IN ('lobster', 'robot', 'pixel', 'cat', 'custom')),
  avatar_color   TEXT NOT NULL DEFAULT '#FF6B6B',
  custom_avatar_url TEXT,
  daily_spend_cap_usdc  NUMERIC(10,4) DEFAULT 0.10,
  monthly_spend_cap_usdc NUMERIC(10,4) DEFAULT 2.00,
  data_retention_days INTEGER NOT NULL DEFAULT 90,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row"
  ON users FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Users can update own row"
  ON users FOR UPDATE
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Users can insert own row"
  ON users FOR INSERT
  WITH CHECK (wallet_address = auth.jwt()->>'wallet_address');

-- ============================================================
-- SKILL_CONFIGS
-- Per-skill configuration. One row per wallet+skill pair.
-- ============================================================
CREATE TABLE skill_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  skill_slug            TEXT NOT NULL,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  config                JSONB NOT NULL DEFAULT '{}',
  config_source         TEXT NOT NULL DEFAULT 'manual'
    CHECK (config_source IN ('clawsight', 'manual', 'preset', 'default')),
  config_schema_version INTEGER NOT NULL DEFAULT 1,
  sync_status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'applied', 'failed')),
  sync_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, skill_slug)
);

ALTER TABLE skill_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own skill configs"
  ON skill_configs FOR ALL
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE INDEX idx_skill_configs_wallet
  ON skill_configs (wallet_address);

-- ============================================================
-- ACTIVITY_EVENTS
-- Timeline of agent actions. session_id groups events.
-- ============================================================
CREATE TABLE activity_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  skill_slug      TEXT,
  session_id      TEXT,
  event_type      TEXT NOT NULL
    CHECK (event_type IN (
      'tool_call', 'message_sent', 'payment', 'error',
      'status_change', 'skill_installed', 'config_changed'
    )),
  event_data      JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON activity_events FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Users can insert own events"
  ON activity_events FOR INSERT
  WITH CHECK (wallet_address = auth.jwt()->>'wallet_address');

CREATE INDEX idx_activity_wallet_time
  ON activity_events (wallet_address, occurred_at DESC);

CREATE INDEX idx_activity_session
  ON activity_events (session_id)
  WHERE session_id IS NOT NULL;

-- ============================================================
-- AGENT_STATUS
-- Lightweight table for heartbeat / live status. One row per user.
-- Separated from users to avoid constant UPDATE on the users row.
-- ============================================================
CREATE TABLE agent_status (
  wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'thinking', 'idle', 'offline')),
  last_heartbeat TIMESTAMPTZ,
  session_id     TEXT,
  session_start  TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own status"
  ON agent_status FOR ALL
  USING (wallet_address = auth.jwt()->>'wallet_address');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_skill_configs_updated_at
  BEFORE UPDATE ON skill_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_status_updated_at
  BEFORE UPDATE ON agent_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DATA RETENTION
-- Call this daily via pg_cron or Supabase scheduled function.
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_events ae
  USING users u
  WHERE ae.wallet_address = u.wallet_address
    AND ae.occurred_at < NOW() - (u.data_retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
