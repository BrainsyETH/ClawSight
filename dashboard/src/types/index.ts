// ============================================================
// Core domain types for ClawSight
// ============================================================

export type AgentStatus = "online" | "thinking" | "idle" | "offline";

export type EventType =
  | "tool_call"
  | "message_sent"
  | "payment"
  | "error"
  | "status_change"
  | "skill_installed"
  | "config_changed";

export type SyncStatus = "pending" | "syncing" | "applied" | "failed";

export type ConfigSource = "clawsight" | "manual" | "preset" | "default";

// ============================================================
// Database row types
// ============================================================

export interface User {
  wallet_address: string;
  agent_name: string;
  onboarding_completed: boolean;
  daily_spend_cap_usdc: number;
  monthly_spend_cap_usdc: number;
  data_retention_days: number;
  sync_activity: boolean;
  sync_wallet: boolean;
  sync_status: boolean;
  sync_configs: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentRegistryRow {
  id: string;
  wallet_address: string;
  fly_app_name: string;
  fly_machine_id: string;
  region: string;
  gateway_url: string;
  status: "starting" | "running" | "stopped" | "failed";
  created_at: string;
  updated_at: string;
}

export interface ClawHubSkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  category: string;
  tags: string[];
  icon?: string;
  repository?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillConfig {
  id: string;
  wallet_address: string;
  skill_slug: string;
  enabled: boolean;
  config: Record<string, unknown>;
  config_source: ConfigSource;
  config_schema_version: number;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  wallet_address: string;
  skill_slug: string | null;
  session_id: string | null;
  event_type: EventType;
  event_data: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface AgentStatusRow {
  wallet_address: string;
  status: AgentStatus;
  last_heartbeat: string | null;
  session_id: string | null;
  session_start: string | null;
  updated_at: string;
}

// ============================================================
// Skill form registry types
// ============================================================

export type FieldType =
  | "text"
  | "secret"
  | "number"
  | "select"
  | "toggle"
  | "slider"
  | "currency"
  | "multiselect"
  | "textarea";

export interface FormFieldBase {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
}

export interface TextField extends FormFieldBase {
  type: "text";
  pattern?: string;
  maxLength?: number;
}

export interface SecretField extends FormFieldBase {
  type: "secret";
}

export interface NumberField extends FormFieldBase {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export interface SelectField extends FormFieldBase {
  type: "select";
  options: { value: string; label: string }[];
  default?: string;
}

export interface ToggleField extends FormFieldBase {
  type: "toggle";
  default?: boolean;
}

export interface SliderField extends FormFieldBase {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  default?: number;
  suffix?: string;
}

export interface CurrencyField extends FormFieldBase {
  type: "currency";
  min?: number;
  max?: number;
  default?: number;
  currency?: string;
}

export interface MultiselectField extends FormFieldBase {
  type: "multiselect";
  options: { value: string; label: string }[];
  default?: string[];
}

export interface TextareaField extends FormFieldBase {
  type: "textarea";
  rows?: number;
  maxLength?: number;
}

export type FormField =
  | TextField
  | SecretField
  | NumberField
  | SelectField
  | ToggleField
  | SliderField
  | CurrencyField
  | MultiselectField
  | TextareaField;

export interface SkillFormDefinition {
  slug: string;
  name: string;
  icon: string;
  description: string;
  category: SkillCategory;
  fields: FormField[];
  defaultConfig: Record<string, unknown>;
}

// Keep for backwards compat with DB columns that may still exist
export type DisplayMode = "fun" | "professional";

export type SkillCategory =
  | "search"
  | "memory"
  | "communication"
  | "development"
  | "productivity"
  | "trading"
  | "documents"
  | "other";

// ============================================================
// Skill browser types
// ============================================================

export interface SkillListing {
  slug: string;
  name: string;
  icon: string;
  description: string;
  category: SkillCategory;
  installed: boolean;
  hasCustomForm: boolean;
  featured: boolean;
  installs?: number;
}

// ============================================================
// UI state types
// ============================================================

export interface DashboardState {
  agentStatus: AgentStatus;
  lastHeartbeat: string | null;
  sessionDuration: number | null;
  walletBalance: number | null;
  todaySpending: number;
  weekSpending: number;
  recentEvents: ActivityEvent[];
  skills: SkillConfig[];
}

// ============================================================
// Billing types
// ============================================================

export type UsageOperation =
  | "api_call"
  | "config_write"
  | "config_read"
  | "sync"
  | "heartbeat"
  | "export"
  | "compute_minute"
  | "skill_install"
  | "x402_payment";

export interface UsageLedgerEntry {
  id: string;
  wallet_address: string;
  operation: UsageOperation;
  cost_usdc: number;
  skill_slug: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface UsageDailySummary {
  wallet_address: string;
  day: string;
  total_cost_usdc: number;
  api_calls: number;
}
