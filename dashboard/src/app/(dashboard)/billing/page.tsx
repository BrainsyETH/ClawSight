"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUSDC } from "@/lib/utils";
import {
  CreditCard,
  Zap,
  TrendingUp,
  ArrowUpRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Receipt,
  BarChart3,
} from "lucide-react";
import { BillingPlan, Invoice } from "@/types";

interface UsageData {
  usage: {
    daily_spend: number;
    monthly_spend: number;
    daily_calls: number;
    monthly_calls: number;
  };
  caps: {
    daily_cap: number;
    monthly_cap: number;
  };
  subscription: {
    plan_id: string;
    status: string;
    payment_method: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    plan: BillingPlan | null;
  };
  invoices: Invoice[];
}

export default function BillingPage() {
  const { walletAddress } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usageRes, plansRes] = await Promise.all([
          fetch("/v1/api/billing/usage"),
          fetch("/v1/api/billing/plans"),
        ]);
        if (usageRes.ok) setUsageData(await usageRes.json());
        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.plans || []);
        }
      } catch (err) {
        console.error("[billing] Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }
    if (walletAddress) fetchData();
  }, [walletAddress]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await fetch("/v1/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/v1/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to open billing portal.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const sub = usageData?.subscription;
  const usage = usageData?.usage;
  const caps = usageData?.caps;
  const currentPlan = sub?.plan;
  const currentPlanId = sub?.plan_id || "free";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Billing & Usage
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your plan, monitor usage, and view invoices.
        </p>
      </div>

      {/* Current plan + usage meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current plan card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {currentPlan?.name || "Free"}
                </p>
                <p className="text-sm text-gray-500">
                  {currentPlan?.description || "Basic agent monitoring"}
                </p>
              </div>
              <Badge
                variant={sub?.status === "active" ? "default" : "destructive"}
                className="capitalize"
              >
                {sub?.status || "active"}
              </Badge>
            </div>
            {sub?.payment_method === "stripe" && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  {sub.cancel_at_period_end
                    ? `Cancels on ${new Date(sub.current_period_end).toLocaleDateString()}`
                    : `Renews on ${new Date(sub.current_period_end).toLocaleDateString()}`}
                </p>
                <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              </div>
            )}
            {currentPlanId !== "free" && (
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {formatUSDC(currentPlan?.price_usdc || 0)}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Usage meters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Usage This Period
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Daily spending */}
            <UsageMeter
              label="Daily Spending"
              current={usage?.daily_spend || 0}
              max={caps?.daily_cap || 0.10}
              format="usdc"
            />
            {/* Monthly spending */}
            <UsageMeter
              label="Monthly Spending"
              current={usage?.monthly_spend || 0}
              max={caps?.monthly_cap || 2.00}
              format="usdc"
            />
            {/* API calls today */}
            <UsageMeter
              label="API Calls Today"
              current={usage?.daily_calls || 0}
              max={currentPlan?.daily_api_calls || 100}
              format="number"
            />
          </CardContent>
        </Card>
      </div>

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Plans
          </CardTitle>
          <CardDescription>
            Choose the plan that fits your usage. Pay with credit card or USDC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <div
                  key={plan.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    isCurrent
                      ? "border-red-300 bg-red-50/50 ring-1 ring-red-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px]">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  </div>

                  <p className="text-2xl font-bold text-gray-900">
                    {plan.price_usdc === 0 ? (
                      "Free"
                    ) : (
                      <>
                        ${plan.price_usdc}
                        <span className="text-sm font-normal text-gray-500">/mo</span>
                      </>
                    )}
                  </p>

                  <ul className="space-y-1.5 text-xs text-gray-600">
                    <PlanFeature text={`${plan.daily_api_calls.toLocaleString()} API calls/day`} />
                    <PlanFeature text={`${plan.max_skills} skills`} />
                    {plan.has_cloud_agent ? (
                      <PlanFeature text={`${plan.max_agents} cloud agent${plan.max_agents > 1 ? "s" : ""}`} />
                    ) : (
                      <PlanFeature text="Local agent only" muted />
                    )}
                    <PlanFeature text={`${plan.data_retention_days}d data retention`} />
                    {plan.has_priority_support && (
                      <PlanFeature text="Priority support" />
                    )}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Current Plan
                    </Button>
                  ) : plan.price_usdc === 0 ? null : (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading === plan.id}
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3" />
                      )}
                      {currentPlanId === "free" ? "Upgrade" : "Switch"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      {usageData?.invoices && usageData.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageData.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(inv.period_start).toLocaleDateString()} &ndash;{" "}
                      {new Date(inv.period_end).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{inv.plan_id} plan</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatUSDC(inv.total_usdc)}
                    </span>
                    <Badge
                      variant={inv.status === "paid" ? "default" : "destructive"}
                      className="text-[10px] capitalize"
                    >
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsageMeter({
  label,
  current,
  max,
  format,
}: {
  label: string;
  current: number;
  max: number;
  format: "usdc" | "number";
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-gray-900"}`}>
          {format === "usdc" ? formatUSDC(current) : current.toLocaleString()}
          <span className="text-gray-400 font-normal">
            {" / "}
            {format === "usdc" ? formatUSDC(max) : max.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isDanger ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isDanger && (
        <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approaching limit
        </p>
      )}
    </div>
  );
}

function PlanFeature({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <li className={`flex items-center gap-1.5 ${muted ? "text-gray-400" : ""}`}>
      <CheckCircle className={`w-3 h-3 shrink-0 ${muted ? "text-gray-300" : "text-green-500"}`} />
      {text}
    </li>
  );
}
