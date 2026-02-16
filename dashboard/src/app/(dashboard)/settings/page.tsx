"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-supabase-data";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Database, Bell, Trash2, CheckCircle, Download, AlertTriangle, Wifi, Loader2, RefreshCw, Key, Copy, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { walletAddress, authMethod, disconnect } = useAuth();
  const { user, updateUser } = useUser(walletAddress ?? undefined);
  const agentStatus = useAgentStatus(walletAddress ?? undefined);
  const push = usePushNotifications();

  const [dailyCap, setDailyCap] = useState("0.10");
  const [monthlyCap, setMonthlyCap] = useState("2.00");
  const [retentionDays, setRetentionDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Agent wallet — prefer DB value, fall back to localStorage
  const agentWalletAddress =
    user?.agent_wallet_address ??
    (typeof window !== "undefined"
      ? localStorage.getItem("clawsight_agent_wallet_address")
      : null);
  const [walletCopied, setWalletCopied] = useState(false);

  const handleCopyWallet = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  // Gateway connection
  const [gatewayUrl, setGatewayUrl] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("clawsight_gateway_url") || "http://localhost:3080"
      : "http://localhost:3080"
  );
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<"idle" | "ok" | "cors" | "error">("idle");

  // Hydrate from DB
  useEffect(() => {
    if (user) {
      setDailyCap(String(user.daily_spend_cap_usdc));
      setMonthlyCap(String(user.monthly_spend_cap_usdc));
      setRetentionDays(String(user.data_retention_days));
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateUser({
        daily_spend_cap_usdc: parseFloat(dailyCap),
        monthly_spend_cap_usdc: parseFloat(monthlyCap),
        data_retention_days: parseInt(retentionDays),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("[settings] Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/v1/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clawsight-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[settings] Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/v1/api/users", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete account");
      }
      // Clear local state and redirect
      disconnect();
      router.push("/onboarding");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmText, disconnect, router]);

  const handleTestGateway = async () => {
    setGatewayTesting(true);
    setGatewayStatus("idle");
    const base = gatewayUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setGatewayStatus("ok");
        localStorage.setItem("clawsight_gateway_url", base);
        fetch("/v1/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openclaw_gateway_url: base }),
        }).catch(() => {});
        return;
      }
      setGatewayStatus("error");
    } catch {
      // CORS probe
      try {
        const probe = await fetch(`${base}/health`, {
          mode: "no-cors",
          signal: AbortSignal.timeout(5000),
        });
        if (probe.type === "opaque") {
          setGatewayStatus("cors");
          localStorage.setItem("clawsight_gateway_url", base);
          fetch("/v1/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ openclaw_gateway_url: base }),
          }).catch(() => {});
          return;
        }
      } catch {
        // genuinely unreachable
      }
      setGatewayStatus("error");
    } finally {
      setGatewayTesting(false);
    }
  };

  const handleSaveGateway = () => {
    const base = gatewayUrl.replace(/\/+$/, "");
    localStorage.setItem("clawsight_gateway_url", base);
    fetch("/v1/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openclaw_gateway_url: base }),
    }).catch(() => {});
    setGatewayStatus("ok");
    setTimeout(() => setGatewayStatus("idle"), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          System configuration and preferences.
        </p>
      </div>

      {/* Spending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Spending Limits
          </CardTitle>
          <CardDescription>
            Configure x402 micropayment caps for ClawSight API usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Daily spending cap (USDC)
            </label>
            <Input
              type="number"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              min="0.01"
              max="10"
              step="0.01"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Monthly spending cap (USDC)
            </label>
            <Input
              type="number"
              value={monthlyCap}
              onChange={(e) => setMonthlyCap(e.target.value)}
              min="0.10"
              max="100"
              step="0.10"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Wallet — visible if user has a generated wallet (Track B) or always shows the connected address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Agent Wallet
          </CardTitle>
          <CardDescription>
            {agentWalletAddress
              ? "Your agent\u2019s payment wallet, generated during signup. Fund it with USDC on Base to enable paid skills."
              : "The wallet address linked to your ClawSight account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Address display */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Wallet Address
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-gray-800 break-all flex-1">
                {agentWalletAddress || walletAddress}
              </code>
              <button
                type="button"
                onClick={() => handleCopyWallet(agentWalletAddress || walletAddress || "")}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Copy wallet address"
              >
                {walletCopied ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* How to fund — explainer */}
          <details className="group">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-900">
              <span className="text-gray-400 group-open:rotate-90 transition-transform inline-block">&#9654;</span>
              How do I fund this wallet?
            </summary>
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-800 shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Copy your wallet address above</p>
                  <p className="text-xs text-blue-700">This is a standard Ethereum address on the Base L2 network.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-800 shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Send USDC to this address on Base</p>
                  <p className="text-xs text-blue-700">Use Coinbase, a centralized exchange, or bridge from another chain. Make sure you send on the <strong>Base</strong> network, not Ethereum mainnet.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-800 shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Your agent will use it for x402 payments</p>
                  <p className="text-xs text-blue-700">Micropayments are deducted automatically when skills make API calls. Your spending limits (above) cap the maximum.</p>
                </div>
              </div>
            </div>
          </details>

          {/* How to view in external wallet — explainer */}
          <details className="group">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-900">
              <span className="text-gray-400 group-open:rotate-90 transition-transform inline-block">&#9654;</span>
              How do I view this in my wallet app?
            </summary>
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <p className="text-sm text-gray-700">You can monitor your agent wallet balance from any Ethereum-compatible wallet:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">&bull;</span>
                  <p className="text-sm text-gray-600"><strong>Watch-only:</strong> Add the address to MetaMask or Coinbase Wallet as a watch-only account to track your balance</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">&bull;</span>
                  <p className="text-sm text-gray-600"><strong>BaseScan:</strong> Search your address on BaseScan to see all transactions and token balances</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Your wallet&apos;s private key is managed by Coinbase Developer Platform in a Trusted Execution Environment. No seed phrase or private key to manage.</p>
            </div>
          </details>

          {/* View on explorer */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              window.open(
                `https://basescan.org/address/${agentWalletAddress || walletAddress}`,
                "_blank"
              )
            }
          >
            <ExternalLink className="w-3 h-3" />
            View on BaseScan
          </Button>

          {/* Auth method indicator */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Auth method</span>
              <Badge variant="secondary">
                {authMethod === "siwe" ? "Wallet (SIWE)" : "Unknown"}
              </Badge>
            </div>
            {agentWalletAddress && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Agent wallet</span>
                <Badge variant="secondary">CDP (x402)</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Retention
          </CardTitle>
          <CardDescription>
            Configure how long activity data is stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Keep data for (days)
            </label>
            <div className="flex gap-2 mt-1">
              {["30", "60", "90", "180", "365"].map((d) => (
                <Button
                  key={d}
                  variant={retentionDays === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRetentionDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications & Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications & Sync
          </CardTitle>
          <CardDescription>
            Manage push notifications and data sync preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Push notification toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm text-gray-700">Push notifications</span>
              {!push.supported && (
                <p className="text-xs text-gray-400">Not supported in this browser</p>
              )}
              {push.supported && push.permission === "denied" && (
                <p className="text-xs text-red-400">Blocked by browser — update in browser settings</p>
              )}
            </div>
            <ToggleSwitch
              checked={push.subscribed}
              disabled={!push.supported || push.permission === "denied" || push.loading}
              onChange={push.toggle}
            />
          </div>

          {/* Sync toggles — wired to DB */}
          {([
            { key: "sync_activity", label: "Activity events" },
            { key: "sync_wallet", label: "Wallet & transactions" },
            { key: "sync_status", label: "Status heartbeats" },
            { key: "sync_configs", label: "Skill configurations" },
          ] as const).map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-gray-700">{toggle.label}</span>
              <ToggleSwitch
                checked={user?.[toggle.key] ?? true}
                onChange={() => {
                  const current = user?.[toggle.key] ?? true;
                  updateUser({ [toggle.key]: !current });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Gateway Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            Gateway Connection
          </CardTitle>
          <CardDescription>
            Connect to your OpenClaw gateway. Works with local and remote instances.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Gateway URL
            </label>
            <div className="flex gap-2 mt-1">
              <Input
                value={gatewayUrl}
                onChange={(e) => {
                  setGatewayUrl(e.target.value);
                  setGatewayStatus("idle");
                }}
                placeholder="http://localhost:3080"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="default"
                onClick={handleTestGateway}
                disabled={gatewayTesting || !gatewayUrl.trim()}
                className="gap-1.5 shrink-0"
              >
                {gatewayTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Test
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Local: http://localhost:3080 &middot; Remote: http://your-server-ip:3080
            </p>
          </div>

          {gatewayStatus === "ok" && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Connected — gateway is reachable
            </div>
          )}
          {gatewayStatus === "cors" && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-1">
                <CheckCircle className="w-4 h-4" />
                Gateway detected (CORS)
              </div>
              <p className="text-xs text-green-600">
                Something is running at this URL but the browser blocked the full response.
                This is normal — the URL has been saved.
              </p>
            </div>
          )}
          {gatewayStatus === "error" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 font-medium mb-1">
                Could not reach gateway
              </p>
              <p className="text-xs text-amber-600">
                Make sure OpenClaw is running and the URL is correct.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleSaveGateway}
              >
                Save URL anyway
              </Button>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Plugin version</span>
              <Badge variant="secondary">v0.1.0</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">API version</span>
              <Badge variant="secondary">v1</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Agent status</span>
              <Badge variant={agentStatus.status === "online" ? "default" : "secondary"}>
                {agentStatus.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export all data</p>
              <p className="text-xs text-gray-500">
                Download a copy of all your ClawSight data (GDPR)
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="w-3 h-3 mr-1" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">
                Delete all data
              </p>
              <p className="text-xs text-gray-500">
                Permanently remove all activity, configs, and account data
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>

          {/* Delete confirmation inline panel */}
          {showDeleteConfirm && (
            <div className="mt-4 border border-red-300 rounded-lg p-4 bg-red-50 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    This action is irreversible
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    This will permanently delete your account, all activity events,
                    skill configurations, and agent status data. This cannot be undone.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-red-600 font-medium">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleting}
                >
                  {deleting ? "Deleting..." : "Permanently Delete Everything"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </Button>
      {saved && (
        <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Settings saved!
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  defaultChecked,
  checked: controlledChecked,
  disabled,
  onChange,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (onChange) onChange();
        if (!isControlled) setInternalChecked(!internalChecked);
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-red-500" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
