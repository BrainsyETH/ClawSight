-- Track whether the user has completed the onboarding flow.
-- Checked on every dashboard load so onboarding state survives
-- browser storage clears, logouts, and multi-device sessions.
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;
