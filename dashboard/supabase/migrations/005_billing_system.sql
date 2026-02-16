-- ============================================================
-- 005: Full billing system
-- Usage ledger, billing plans, subscriptions, invoices
-- ============================================================

-- ============================================================
-- BILLING_PLANS
-- Defines available plans. Seeded with defaults.
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_plans (
  id              TEXT PRIMARY KEY,  -- e.g. 'free', 'starter', 'pro', 'team'
  name            TEXT NOT NULL,
  description     TEXT,
  price_usdc      NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_usd_cents INTEGER NOT NULL DEFAULT 0,  -- For Stripe (in cents)
  stripe_price_id TEXT,                        -- Stripe Price ID for fiat billing
  -- Limits
  daily_api_calls     INTEGER NOT NULL DEFAULT 100,
  monthly_api_calls   INTEGER NOT NULL DEFAULT 3000,
  max_skills          INTEGER NOT NULL DEFAULT 5,
  max_agents          INTEGER NOT NULL DEFAULT 1,
  compute_minutes_mo  INTEGER NOT NULL DEFAULT 0,   -- 0 = no cloud agent
  data_retention_days INTEGER NOT NULL DEFAULT 30,
  -- Features
  has_cloud_agent     BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  has_custom_skills   BOOLEAN NOT NULL DEFAULT false,
  -- Metadata
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO billing_plans (id, name, description, price_usdc, price_usd_cents, daily_api_calls, monthly_api_calls, max_skills, max_agents, compute_minutes_mo, data_retention_days, has_cloud_agent, has_priority_support, has_custom_skills, sort_order) VALUES
  ('free',    'Free',    'Get started with basic agent monitoring',     0,     0, 100,   3000,  5,  0,     0, 30, false, false, false, 0),
  ('starter', 'Starter', 'For individuals running a personal agent',    5,   500, 1000, 30000, 15,  1,  1440, 90, true,  false, false, 1),
  ('pro',     'Pro',     'For power users and developers',             20,  2000, 5000,150000, 50,  3, 10080, 365, true,  true,  true,  2)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUBSCRIPTIONS
-- Tracks each user's active plan + Stripe subscription.
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address    TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  plan_id           TEXT NOT NULL REFERENCES billing_plans(id) DEFAULT 'free',
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  payment_method    TEXT NOT NULL DEFAULT 'x402'
    CHECK (payment_method IN ('x402', 'stripe', 'free')),
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (wallet_address = auth.jwt()->>'wallet_address');

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- USAGE_LEDGER
-- Immutable append-only log of all billable operations.
-- Used for real-time cap enforcement and monthly invoicing.
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

-- Only server (service role) inserts into usage_ledger — no user insert policy.
-- This prevents users from fabricating usage records.

CREATE INDEX idx_usage_wallet_time
  ON usage_ledger (wallet_address, occurred_at DESC);

CREATE INDEX idx_usage_wallet_day
  ON usage_ledger (wallet_address, (occurred_at::date));

-- ============================================================
-- USAGE_SUMMARY (materialized daily rollup)
-- Aggregated daily totals for fast cap checks.
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
-- INVOICES
-- Monthly billing records.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  plan_id         TEXT NOT NULL REFERENCES billing_plans(id),
  plan_cost_usdc  NUMERIC(10,2) NOT NULL DEFAULT 0,
  usage_cost_usdc NUMERIC(10,6) NOT NULL DEFAULT 0,
  total_usdc      NUMERIC(10,6) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'paid', 'failed', 'void')),
  stripe_invoice_id TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invoices"
  ON invoices FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE INDEX idx_invoices_wallet
  ON invoices (wallet_address, period_start DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Increment daily usage summary (called by billing middleware)
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

-- Get current daily spend (for cap enforcement)
CREATE OR REPLACE FUNCTION get_daily_spend(p_wallet TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(total_cost_usdc, 0)
  FROM usage_daily_summary
  WHERE wallet_address = p_wallet AND day = CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current monthly spend
CREATE OR REPLACE FUNCTION get_monthly_spend(p_wallet TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(total_cost_usdc), 0)
  FROM usage_daily_summary
  WHERE wallet_address = p_wallet
    AND day >= date_trunc('month', CURRENT_DATE)::date;
$$ LANGUAGE sql SECURITY DEFINER;

-- Default all existing users to 'free' plan
INSERT INTO subscriptions (wallet_address, plan_id, status, payment_method)
SELECT wallet_address, 'free', 'active', 'free'
FROM users
WHERE wallet_address NOT IN (SELECT wallet_address FROM subscriptions)
ON CONFLICT DO NOTHING;
