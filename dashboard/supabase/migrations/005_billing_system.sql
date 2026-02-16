-- ============================================================
-- 005: Usage metering & spending caps
-- Append-only usage ledger + daily rollups for cap enforcement.
-- Pure x402 micropayment model — no subscriptions or plans.
-- ============================================================

-- ============================================================
-- USAGE_LEDGER
-- Immutable append-only log of every billable operation.
-- The source of truth for all spending.
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  operation       TEXT NOT NULL
    CHECK (operation IN (
      'api_call', 'config_write', 'config_read', 'sync',
      'heartbeat', 'export', 'compute_minute', 'skill_install',
      'x402_payment'
    )),
  cost_usdc       NUMERIC(10,6) NOT NULL DEFAULT 0,
  skill_slug      TEXT,
  metadata        JSONB DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON usage_ledger FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

-- Only server (service role) inserts — prevents users fabricating records.

CREATE INDEX idx_usage_wallet_time
  ON usage_ledger (wallet_address, occurred_at DESC);

CREATE INDEX idx_usage_wallet_day
  ON usage_ledger (wallet_address, (occurred_at::date));

-- ============================================================
-- USAGE_DAILY_SUMMARY
-- Atomic daily rollups for fast cap checks.
-- Upserted on every recorded operation via RPC.
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_daily_summary (
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  day             DATE NOT NULL,
  total_cost_usdc NUMERIC(10,6) NOT NULL DEFAULT 0,
  api_calls       INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, day)
);

ALTER TABLE usage_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily summary"
  ON usage_daily_summary FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Atomic increment for daily usage (called by billing middleware)
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_wallet TEXT,
  p_cost NUMERIC,
  p_calls INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO usage_daily_summary (wallet_address, day, total_cost_usdc, api_calls)
  VALUES (p_wallet, CURRENT_DATE, p_cost, p_calls)
  ON CONFLICT (wallet_address, day)
  DO UPDATE SET
    total_cost_usdc = usage_daily_summary.total_cost_usdc + p_cost,
    api_calls = usage_daily_summary.api_calls + p_calls,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fast cap check: daily spend
CREATE OR REPLACE FUNCTION get_daily_spend(p_wallet TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(total_cost_usdc, 0)
  FROM usage_daily_summary
  WHERE wallet_address = p_wallet AND day = CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER;

-- Fast cap check: monthly spend
CREATE OR REPLACE FUNCTION get_monthly_spend(p_wallet TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(total_cost_usdc), 0)
  FROM usage_daily_summary
  WHERE wallet_address = p_wallet
    AND day >= date_trunc('month', CURRENT_DATE)::date;
$$ LANGUAGE sql SECURITY DEFINER;
