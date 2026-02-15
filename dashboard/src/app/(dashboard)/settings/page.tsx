"use client";

import { useState } from "react";
import { useMode } from "@/hooks/use-mode";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Database, Bell, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { label } = useMode();
  const [dailyCap, setDailyCap] = useState("0.10");
  const [monthlyCap, setMonthlyCap] = useState("2.00");
  const [retentionDays, setRetentionDays] = useState("90");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          {label(
            "Tweak how I work and manage your preferences!",
            "System configuration and preferences."
          )}
        </p>
      </div>

      {/* Spending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            {label("My Spending Limits", "Spending Limits")}
          </CardTitle>
          <CardDescription>
            {label(
              "Set limits so I don't spend too much on ClawSight syncing!",
              "Configure x402 micropayment caps for ClawSight API usage."
            )}
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

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Retention
          </CardTitle>
          <CardDescription>
            {label(
              "How long should I keep my activity history?",
              "Configure how long activity data is stored."
            )}
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

      {/* Sync Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {label("What Should I Sync?", "Sync Preferences")}
          </CardTitle>
          <CardDescription>
            {label(
              "Choose what information I send to the dashboard.",
              "Control which data the plugin syncs to ClawSight."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "activity", label: "Activity events", default: true },
            { key: "wallet", label: "Wallet & transactions", default: true },
            { key: "status", label: "Status heartbeats", default: true },
            { key: "configs", label: "Skill configurations", default: true },
          ].map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-gray-700">{toggle.label}</span>
              <ToggleSwitch defaultChecked={toggle.default} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Plugin Info */}
      <Card>
        <CardHeader>
          <CardTitle>Plugin Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Plugin version</span>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">API version</span>
            <Badge variant="secondary">v1</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gateway URL</span>
            <span className="font-mono text-xs">http://localhost:3080</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Connection</span>
            <Badge variant="success">Connected</Badge>
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
            <Button variant="outline" size="sm">
              Export
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
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg">
        Save Settings
      </Button>
    </div>
  );
}

function ToggleSwitch({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => setChecked(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-red-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
