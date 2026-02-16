-- ============================================================
-- 006: Persist agent wallet address to database
--
-- The CDP-managed agent wallet address was previously only stored
-- in the browser's localStorage, meaning it was lost on cache clear,
-- device switch, or logout. This column stores it server-side.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS agent_wallet_address TEXT;

-- Also store it on the agent_registry for cloud-provisioned agents
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS agent_wallet_address TEXT;
