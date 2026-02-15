import * as fs from "fs";
import * as path from "path";

export interface RetryConfig {
  max_attempts: number;
  base_delay_ms: number;
  max_delay_ms: number;
}

export interface ClawSightConfig {
  enabled: boolean;
  api_endpoint: string;
  sync: {
    activity: boolean;
    wallet: boolean;
    status: boolean;
    skill_configs: boolean;
  };
  limits: {
    daily_spend_cap_usdc: number;
    monthly_spend_cap_usdc: number;
  };
  heartbeat_interval_seconds: number;
  sync_batch_size: number;
  offline_queue_max_size: number;
  retry: RetryConfig;
}

const DEFAULT_CONFIG: ClawSightConfig = {
  enabled: true,
  api_endpoint: "https://api.clawsight.app",
  sync: {
    activity: true,
    wallet: true,
    status: true,
    skill_configs: true,
  },
  limits: {
    daily_spend_cap_usdc: 0.1,
    monthly_spend_cap_usdc: 2.0,
  },
  heartbeat_interval_seconds: 30,
  sync_batch_size: 50,
  offline_queue_max_size: 1000,
  retry: {
    max_attempts: 4,
    base_delay_ms: 2000,
    max_delay_ms: 60000,
  },
};

export function loadConfig(): ClawSightConfig {
  const configPath = path.join(__dirname, "..", "config", "clawsight.json");

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    console.warn(
      "[ClawSight] Could not load config, using defaults:",
      configPath
    );
    return DEFAULT_CONFIG;
  }
}

// Enforce minimum heartbeat to prevent wallet drain
const MIN_HEARTBEAT_SECONDS = 30;

export function validateConfig(config: ClawSightConfig): ClawSightConfig {
  if (config.heartbeat_interval_seconds < MIN_HEARTBEAT_SECONDS) {
    console.warn(
      `[ClawSight] heartbeat_interval_seconds (${config.heartbeat_interval_seconds}) below minimum (${MIN_HEARTBEAT_SECONDS}), clamping.`
    );
    config.heartbeat_interval_seconds = MIN_HEARTBEAT_SECONDS;
  }
  return config;
}
