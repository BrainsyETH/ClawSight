"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFeaturedSkills } from "@/lib/skill-catalog";
import { SkillListing } from "@/types";
import {
  Wallet,
  Search,
  CheckCircle,
  Loader2,
  User,
  Zap,
  Download,
  Star,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

// ============================================================
// 4-step onboarding: Wallet → Gateway → Name → Skills
// None of these steps can be skipped.
// ============================================================

const STEPS = ["connect", "detect", "name", "skills"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  connect: "Wallet",
  detect: "Gateway",
  name: "Agent",
  skills: "Skills",
};

interface OnboardingFlowProps {
  onComplete: () => void;
  onSaveAgentName: (name: string) => Promise<void>;
  onInstallSkill: (slug: string) => Promise<void>;
}

export function OnboardingFlow({
  onComplete,
  onSaveAgentName,
  onInstallSkill,
}: OnboardingFlowProps) {
  const { connect: authConnect } = useAuth();
  const [step, setStep] = useState<Step>("connect");
  const [connecting, setConnecting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [detectError, setDetectError] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:3080");
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [installingSkills, setInstallingSkills] = useState(false);

  const currentStepIndex = STEPS.indexOf(step);
  const featured = getFeaturedSkills();

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await authConnect();
      setStep("detect");
    } catch (err) {
      console.error("[onboarding] Wallet connection failed:", err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDetect = async (urlOverride?: string) => {
    setDetecting(true);
    setDetectError(false);
    const url = urlOverride ?? gatewayUrl;
    try {
      // Normalize: strip trailing slash, append /health
      const base = url.replace(/\/+$/, "");
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      if (res?.ok) {
        setDetected(true);
        // Persist the working gateway URL for the rest of the app
        localStorage.setItem("clawsight_gateway_url", base);
        setTimeout(() => setStep("name"), 800);
      } else {
        setDetectError(true);
        // If localhost failed, show the custom URL input
        if (!showCustomUrl) setShowCustomUrl(true);
      }
    } catch {
      setDetectError(true);
      if (!showCustomUrl) setShowCustomUrl(true);
    } finally {
      setDetecting(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = agentName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await onSaveAgentName(trimmed);
      setStep("skills");
    } catch (err) {
      console.error("[onboarding] Save name failed:", err);
    } finally {
      setSavingName(false);
    }
  };

  const toggleSkill = (slug: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const handleInstallSkills = async () => {
    if (selectedSkills.size === 0) return;
    setInstallingSkills(true);
    try {
      for (const slug of selectedSkills) {
        await onInstallSkill(slug);
      }
      onComplete();
    } catch (err) {
      console.error("[onboarding] Skill install failed:", err);
    } finally {
      setInstallingSkills(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block" aria-hidden="true">
            &#x1F99E;
          </span>
          <h1 className="text-3xl font-bold text-gray-900">ClawSight</h1>
          <p className="text-gray-500 mt-2">
            Set up your AI agent in a few steps
          </p>
        </div>

        {/* Progress */}
        <nav aria-label="Onboarding progress" className="mb-8">
          <ol className="flex items-center justify-center gap-1">
            {STEPS.map((s, i) => {
              const isCompleted = currentStepIndex > i;
              const isCurrent = step === s;
              return (
                <li key={s} className="flex items-center gap-1">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                        isCurrent
                          ? "bg-red-500 text-white"
                          : isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-500"
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isCurrent
                          ? "text-red-600"
                          : isCompleted
                            ? "text-green-600"
                            : "text-gray-400"
                      )}
                    >
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "w-8 h-0.5 mb-5",
                        isCompleted ? "bg-green-500" : "bg-gray-200"
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step 1: Connect Wallet */}
        {step === "connect" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet
                className="w-12 h-12 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-gray-500 mb-6">
                Sign in with Ethereum to get started. Your wallet is your
                identity — no passwords needed.
              </p>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                size="lg"
                className="w-full gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" aria-hidden="true" />
                    Sign In with Ethereum
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Detect OpenClaw Gateway */}
        {step === "detect" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Search
                className="w-12 h-12 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold mb-2">
                {detected
                  ? "OpenClaw Connected!"
                  : "Connect to OpenClaw Gateway"}
              </h2>
              <p className="text-gray-500 mb-6">
                {detected
                  ? "Your OpenClaw instance is running and ready."
                  : "Enter your OpenClaw gateway URL, or auto-detect if it\u2019s running locally."}
              </p>
              {detected ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                    <CheckCircle className="w-5 h-5" aria-hidden="true" />
                    Connected to OpenClaw Gateway
                  </div>
                  <p className="text-xs text-gray-400 font-mono">
                    {gatewayUrl}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Gateway URL input */}
                  <div className="text-left">
                    <label
                      htmlFor="gateway-url"
                      className="text-xs font-medium text-gray-600 mb-1 block"
                    >
                      Gateway URL
                    </label>
                    <Input
                      id="gateway-url"
                      value={gatewayUrl}
                      onChange={(e) => setGatewayUrl(e.target.value)}
                      placeholder="http://localhost:3080"
                      className="font-mono text-sm"
                      aria-label="OpenClaw gateway URL"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Local: http://localhost:3080 &middot; Remote: http://your-server-ip:3080
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDetect()}
                    disabled={detecting || !gatewayUrl.trim()}
                    size="lg"
                    className="w-full gap-2"
                  >
                    {detecting ? (
                      <>
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          aria-hidden="true"
                        />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" aria-hidden="true" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              )}
              {detectError && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Could not reach gateway
                  </p>
                  <p className="text-sm text-amber-700 mb-3">
                    No response from <span className="font-mono text-xs">{gatewayUrl}/health</span>.
                    Make sure OpenClaw is running and the URL is correct.
                  </p>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Common fixes
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">&bull;</span>
                      <span>
                        Check that your OpenClaw instance is running
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">&bull;</span>
                      <span>
                        For remote machines, use the IP or hostname (e.g. http://192.168.1.100:3080)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">&bull;</span>
                      <span>
                        Ensure port 3080 is open and not blocked by a firewall
                      </span>
                    </li>
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        window.open(
                          "https://github.com/OpenClaw/openclaw",
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      View Docs
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleDetect()}
                      disabled={detecting}
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Name Your Agent */}
        {step === "name" && (
          <Card>
            <CardContent className="p-8 text-center">
              <User
                className="w-12 h-12 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold mb-2">Name Your Agent</h2>
              <p className="text-gray-500 mb-6">
                Give your AI agent an identity. This name appears throughout the
                dashboard.
              </p>
              {/* Live preview */}
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-3xl mx-auto">
                  {(agentName || "C").charAt(0).toUpperCase()}
                </div>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  {agentName || "Your Agent"}
                </p>
              </div>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Mrs. Claws, Jarvis, Friday..."
                maxLength={30}
                className="mb-4 text-center"
                aria-label="Agent name"
                autoFocus
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || !agentName.trim()}
                size="lg"
                className="w-full gap-2"
              >
                {savingName ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Install Your First Skills */}
        {step === "skills" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Zap
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold mb-2">
                  Install Your First Skills
                </h2>
                <p className="text-gray-500">
                  Skills give your agent abilities. Pick at least one to get
                  started.
                </p>
              </div>
              <div className="space-y-3 mb-6">
                {featured.map((skill) => (
                  <SkillPickerCard
                    key={skill.slug}
                    skill={skill}
                    selected={selectedSkills.has(skill.slug)}
                    onToggle={() => toggleSkill(skill.slug)}
                  />
                ))}
              </div>
              <Button
                onClick={handleInstallSkills}
                disabled={installingSkills || selectedSkills.size === 0}
                size="lg"
                className="w-full gap-2"
              >
                {installingSkills ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    Installing {selectedSkills.size} skill
                    {selectedSkills.size !== 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Install {selectedSkills.size} skill
                    {selectedSkills.size !== 1 ? "s" : ""} &amp; finish setup
                  </>
                )}
              </Button>
              {selectedSkills.size === 0 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Select at least one skill to continue
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SkillPickerCard({
  skill,
  selected,
  onToggle,
}: {
  skill: SkillListing;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
        selected
          ? "border-red-300 bg-red-50 ring-1 ring-red-200"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          selected ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500"
        )}
      >
        {selected ? (
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Zap className="w-4 h-4" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{skill.name}</p>
          {skill.featured && (
            <Badge variant="warning" className="text-[10px] gap-0.5 px-1.5">
              <Star className="w-2.5 h-2.5" aria-hidden="true" />
              Popular
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 line-clamp-1">
          {skill.description}
        </p>
      </div>
    </button>
  );
}
