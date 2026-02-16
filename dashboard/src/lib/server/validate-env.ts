/**
 * Validate required environment variables at module load time.
 *
 * Import this file early in server-side code (e.g. instrumentation.ts
 * or layout.tsx server component) to surface misconfigurations immediately
 * rather than at random request time.
 */

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
] as const;

const RECOMMENDED_VARS = [
  "CLAWSIGHT_PAYMENT_ADDRESS",
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
] as const;

const missing: string[] = [];
const warnings: string[] = [];

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

for (const key of RECOMMENDED_VARS) {
  if (!process.env[key]) {
    warnings.push(key);
  }
}

if (missing.length > 0) {
  console.error(
    `[env] CRITICAL: Missing required environment variables: ${missing.join(", ")}. ` +
    `The application will not function correctly.`
  );
}

if (warnings.length > 0) {
  console.warn(
    `[env] WARNING: Missing recommended environment variables: ${warnings.join(", ")}. ` +
    `Some features (payments, wallet creation) will be degraded.`
  );
}

export const envValid = missing.length === 0;
export const envMissing = missing;
export const envWarnings = warnings;
