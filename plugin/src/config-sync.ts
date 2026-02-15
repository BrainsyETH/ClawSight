import * as fs from "fs";
import * as path from "path";
import { ApiClient } from "./api-client";

const OPENCLAW_CONFIG_PATH = path.join(
  process.env.HOME || "~",
  ".openclaw",
  "openclaw.json"
);

/**
 * Two-way config sync between ClawSight dashboard and OpenClaw.
 *
 * - Subscribes to Supabase Realtime for config changes from dashboard
 * - Watches local openclaw.json for manual edits
 * - Writes dashboard config changes to openclaw.json
 * - Reports sync status back to the API
 *
 * Conflict resolution: Local file wins. Manual edits are synced back
 * to ClawSight on detection.
 */
export class ConfigSync {
  private api: ApiClient;
  private apiEndpoint: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastKnownHash: string = "";
  /** Track the last-applied timestamp per skill to avoid redundant applies. */
  private lastAppliedTimestamps: Map<string, string> = new Map();

  constructor(api: ApiClient, apiEndpoint: string) {
    this.api = api;
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Start listening for config changes from both dashboard and local file.
   */
  startListening(): void {
    // Watch local config file for manual edits
    this.watchLocalConfig();

    // Poll for dashboard changes (fallback — Supabase Realtime preferred)
    this.pollTimer = setInterval(() => this.pollDashboardConfigs(), 60_000);

    console.log("[ClawSight] Config sync started");
  }

  stopListening(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Apply a config update from the dashboard to OpenClaw.
   */
  async applyConfig(
    skillSlug: string,
    config: Record<string, unknown>
  ): Promise<boolean> {
    try {
      // Read current openclaw.json
      const openclawConfig = this.readOpenClawConfig();
      if (!openclawConfig) {
        await this.api.updateConfigSyncStatus(
          skillSlug,
          "failed",
          "Could not read openclaw.json"
        );
        return false;
      }

      // Merge skill config
      if (!openclawConfig.skills) {
        openclawConfig.skills = {};
      }
      (openclawConfig.skills as Record<string, unknown>)[skillSlug] = config;

      // Write back
      this.writeOpenClawConfig(openclawConfig);

      // Verify the write by reading back
      const verified = this.readOpenClawConfig();
      const appliedConfig = (verified?.skills as Record<string, unknown>)?.[
        skillSlug
      ];
      const success = JSON.stringify(appliedConfig) === JSON.stringify(config);

      await this.api.updateConfigSyncStatus(
        skillSlug,
        success ? "applied" : "failed",
        success ? undefined : "Config verification failed after write"
      );

      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await this.api.updateConfigSyncStatus(skillSlug, "failed", message);
      return false;
    }
  }

  // ----------------------------------------------------------
  // Local file watching
  // ----------------------------------------------------------

  private watchLocalConfig(): void {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return;

    this.lastKnownHash = this.hashFile(OPENCLAW_CONFIG_PATH);

    this.fileWatcher = fs.watch(OPENCLAW_CONFIG_PATH, async () => {
      const newHash = this.hashFile(OPENCLAW_CONFIG_PATH);
      if (newHash !== this.lastKnownHash) {
        this.lastKnownHash = newHash;
        console.log("[ClawSight] Local config changed, syncing to dashboard...");
        await this.syncLocalToDashboard();
      }
    });
  }

  /**
   * Read local openclaw.json and push any skill configs back to the dashboard.
   * Local file always wins in a conflict.
   */
  private async syncLocalToDashboard(): Promise<void> {
    try {
      const config = this.readOpenClawConfig();
      if (!config?.skills) return;

      const skills = config.skills as Record<string, Record<string, unknown>>;

      for (const [slug, skillConfig] of Object.entries(skills)) {
        if (typeof skillConfig !== "object" || skillConfig === null) continue;

        try {
          const res = await fetch(`${this.apiEndpoint}/v1/api/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skill_slug: slug,
              config: skillConfig,
              config_source: "manual",
            }),
          });

          if (res.ok) {
            console.log(`[ClawSight] Synced local config for ${slug} to dashboard`);
          } else {
            console.warn(`[ClawSight] Failed to sync ${slug} to dashboard: ${res.status}`);
          }
        } catch (err) {
          console.warn(`[ClawSight] Failed to sync ${slug}:`, err);
        }
      }
    } catch (err) {
      console.error("[ClawSight] Local-to-dashboard sync failed:", err);
    }
  }

  // ----------------------------------------------------------
  // Dashboard polling (fallback for Supabase Realtime)
  // ----------------------------------------------------------

  private async pollDashboardConfigs(): Promise<void> {
    const configs = await this.api.getSkillConfigs();
    if (!configs) return;

    for (const config of configs) {
      const slug = config.skill_slug as string;
      const newConfig = config.config as Record<string, unknown>;
      const updatedAt = config.updated_at as string;
      const syncStatus = config.sync_status as string;

      // Skip configs that are already applied or don't need syncing
      if (syncStatus === "applied") continue;

      // Skip if we already applied this version
      const lastApplied = this.lastAppliedTimestamps.get(slug);
      if (lastApplied && lastApplied >= updatedAt) continue;

      const success = await this.applyConfig(slug, newConfig);
      if (success) {
        this.lastAppliedTimestamps.set(slug, updatedAt);
      }
    }
  }

  // ----------------------------------------------------------
  // File helpers
  // ----------------------------------------------------------

  private readOpenClawConfig(): Record<string, unknown> | null {
    try {
      const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private writeOpenClawConfig(config: Record<string, unknown>): void {
    fs.writeFileSync(
      OPENCLAW_CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  }

  private hashFile(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      // Simple hash for change detection
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return hash.toString(36);
    } catch {
      return "";
    }
  }
}
