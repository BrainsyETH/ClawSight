-- Add openclaw_gateway_url to users table.
-- Persists the OpenClaw gateway link so it survives browser storage clears
-- and is available server-side for plugin sync operations.
ALTER TABLE users ADD COLUMN openclaw_gateway_url TEXT;
