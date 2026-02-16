"use client";

import { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Server,
  Shield,
  Copy,
  AlertTriangle,
  HelpCircle,
  Cloud,
} from "lucide-react";

// ============================================================
// Dual-track onboarding
//
// Track A — Power Users: Wallet (SIWE) → Gateway → Profile
// Track B — New Users:   Account (Smart Wallet) → Agent Wallet → Provision → Profile
//
// Both tracks converge on the Profile step (combined name + skills).
// ============================================================

type Track = "select" | "a" | "b";

const TRACK_A_STEPS = ["wallet", "gateway", "profile"] as const;
type TrackAStep = (typeof TRACK_A_STEPS)[number];

const TRACK_B_STEPS = [
  "account",
  "agent-wallet",
  "provision",
  "profile",
] as const;
type TrackBStep = (typeof TRACK_B_STEPS)[number];

const STEP_LABELS: Record<string, string> = {
  wallet: "Wallet",
  gateway: "Gateway",
  account: "Account",
  "agent-wallet": "Wallet",
  provision: "Agent",
  profile: "Profile",
};

interface OnboardingFlowProps {
  onComplete: () => void;
  onSaveAgentName: (name: string) => Promise<void>;
  onInstallSkill: (slug: string) => Promise<void>;
}

// Provisioning stage labels for the progress animation
const PROVISION_STAGES = [
  "Selecting region...",
  "Spinning up container...",
  "Running health checks...",
  "Configuring agent...",
  "Almost ready...",
] as const;

// ============================================================
// Main component
// ============================================================

export function OnboardingFlow({
  onComplete,
  onSaveAgentName,
  onInstallSkill,
}: OnboardingFlowProps) {
  const { connect: authConnect, connectSmartWallet } = useAuth();

  // Track & step state
  const [track, setTrack] = useState<Track>("select");
  const [trackAStep, setTrackAStep] = useState<TrackAStep>("wallet");
  const [trackBStep, setTrackBStep] = useState<TrackBStep>("account");

  // Track A — wallet + gateway
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [detectError, setDetectError] = useState<"network" | "cors" | false>(
    false
  );
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:3080");

  // Track B — Smart Wallet connection + agent wallet
  const [connectingSmartWallet, setConnectingSmartWallet] = useState(false);
  const [smartWalletError, setSmartWalletError] = useState<string | null>(null);
  const [agentWalletAddress, setAgentWalletAddress] = useState<string | null>(
    null
  );
  const [creatingAgentWallet, setCreatingAgentWallet] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  // Track B — Cloud provisioning
  const [provisioning, setProvisioning] = useState(false);
  const [provisionStage, setProvisionStage] = useState(0);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionedUrl, setProvisionedUrl] = useState<string | null>(null);

  // Shared — profile (name + skills)
  const [agentName, setAgentName] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [finishingSetup, setFinishingSetup] = useState(false);

  const featured = getFeaturedSkills();

  // Determine which steps to show in progress bar
  const steps = track === "a" ? TRACK_A_STEPS : TRACK_B_STEPS;
  const currentStep = track === "a" ? trackAStep : trackBStep;
  const currentStepIndex = (steps as readonly string[]).indexOf(currentStep);

  // ---- Track A handlers ----

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await authConnect();
      setTrackAStep("gateway");
    } catch (err) {
      console.error("[onboarding] Wallet connection failed:", err);
      const msg =
        err instanceof Error ? err.message : "Wallet connection failed";
      setConnectError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDetect = async (url?: string) => {
    setDetecting(true);
    setDetectError(false);
    const base = (url || gatewayUrl).replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        confirmGateway(base);
        return;
      }
      setDetectError("network");
    } catch {
      try {
        const probe = await fetch(`${base}/health`, {
          mode: "no-cors",
          signal: AbortSignal.timeout(5000),
        });
        if (probe.type === "opaque") {
          confirmGateway(base);
          return;
        }
        setDetectError("network");
      } catch {
        setDetectError("network");
      }
    } finally {
      setDetecting(false);
    }
  };

  const saveGatewayUrl = (base: string) => {
    localStorage.setItem("clawsight_gateway_url", base);
    fetch("/v1/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openclaw_gateway_url: base }),
    }).catch(() => {});
  };

  const confirmGateway = (base: string) => {
    setDetected(true);
    saveGatewayUrl(base);
    setTimeout(() => setTrackAStep("profile"), 800);
  };

  const handleSkipGateway = () => {
    setTrackAStep("profile");
  };

  // ---- Track B handlers ----

  const handleSmartWalletConnect = async () => {
    setSmartWalletError(null);
    setConnectingSmartWallet(true);
    try {
      await connectSmartWallet();
      setCreatingAgentWallet(true);
      const walletRes = await fetch("/v1/api/wallet/create", {
        method: "POST",
      });
      if (!walletRes.ok) {
        const body = await walletRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create agent wallet");
      }
      const { address } = await walletRes.json();
      setAgentWalletAddress(address);
      localStorage.setItem("clawsight_agent_wallet_address", address);
      setTrackBStep("agent-wallet");
    } catch (err) {
      setSmartWalletError(
        err instanceof Error ? err.message : "Connection failed"
      );
    } finally {
      setConnectingSmartWallet(false);
      setCreatingAgentWallet(false);
    }
  };

  const handleProvision = async () => {
    setProvisioning(true);
    setProvisionError(null);
    setProvisionStage(0);
    try {
      const res = await fetch("/v1/api/agent/provision", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Provisioning failed");
      }
      const { gateway_url } = await res.json();
      setProvisionedUrl(gateway_url);
      saveGatewayUrl(gateway_url);
      setTimeout(() => setTrackBStep("profile"), 1200);
    } catch (err) {
      setProvisionError(
        err instanceof Error
          ? err.message
          : "Provisioning failed. Please try again."
      );
    } finally {
      setProvisioning(false);
    }
  };

  // Progress through provisioning stages while API call is in flight
  useEffect(() => {
    if (!provisioning) return;
    const interval = setInterval(() => {
      setProvisionStage((s) =>
        s < PROVISION_STAGES.length - 1 ? s + 1 : s
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [provisioning]);

  // Auto-start provisioning when step mounts
  const provisionStarted = useRef(false);
  useEffect(() => {
    if (
      track === "b" &&
      trackBStep === "provision" &&
      !provisionStarted.current &&
      !provisionedUrl
    ) {
      provisionStarted.current = true;
      handleProvision();
    }
  }, [trackBStep, track]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Shared handlers ----

  const toggleSkill = (slug: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleFinishSetup = async () => {
    const trimmed = agentName.trim();
    if (!trimmed || selectedSkills.size === 0) return;
    setFinishingSetup(true);
    try {
      await onSaveAgentName(trimmed);
      for (const slug of selectedSkills) {
        await onInstallSkill(slug);
      }
      onComplete();
    } catch (err) {
      console.error("[onboarding] Finish setup failed:", err);
    } finally {
      setFinishingSetup(false);
    }
  };

  const copyAddress = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // ============================================================
  // Render
  // ============================================================

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
            {track === "select"
              ? "Your AI agent command center"
              : "Set up your AI agent in a few steps"}
          </p>
        </div>

        {/* Progress bar (only show after track selection) */}
        {track !== "select" && (
          <nav aria-label="Onboarding progress" className="mb-8">
            <ol className="flex items-center justify-center gap-1">
              {steps.map((s, i) => {
                const isCompleted = currentStepIndex > i;
                const isCurrent = currentStep === s;
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
                          <CheckCircle
                            className="w-4 h-4"
                            aria-hidden="true"
                          />
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
                    {i < steps.length - 1 && (
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
        )}

        {/* ================================================
            TRACK SELECTION
        ================================================ */}
        {track === "select" && (
          <div className="space-y-4">
            {/* Track A: Power User */}
            <button
              type="button"
              onClick={() => setTrack("a")}
              className="w-full text-left"
            >
              <Card className="transition-all hover:border-red-300 hover:shadow-md cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <Server className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        I already run OpenClaw
                      </h2>
                      <p className="text-sm text-gray-500">
                        Connect your existing wallet and OpenClaw gateway. For
                        users who have a local or remote OpenClaw instance.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-[10px]">
                          SIWE Auth
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Existing Wallet
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Track B: New User */}
            <button
              type="button"
              onClick={() => setTrack("b")}
              className="w-full text-left"
            >
              <Card className="transition-all hover:border-red-300 hover:shadow-md cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        I&apos;m new here
                      </h2>
                      <p className="text-sm text-gray-500">
                        Sign in with Coinbase Smart Wallet using Face ID or
                        fingerprint. We&apos;ll set up everything for you in the
                        cloud.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-[10px]">
                          Smart Wallet
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Cloud Hosted
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Auto Setup
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            <p className="text-xs text-gray-400 text-center pt-2">
              Not sure? Choose &quot;I&apos;m new here&quot; for a guided
              experience.
            </p>

            <Explainer question="What is ClawSight?">
              <p className="mb-2">
                <strong>ClawSight</strong> is a dashboard that lets you monitor
                and manage your <strong>OpenClaw</strong> AI agent. Think of it
                as mission control for your AI assistant.
              </p>
              <p className="mb-2">
                <strong>OpenClaw</strong> is the AI agent itself &mdash; it runs
                in the cloud (or on your computer), and can perform tasks, search
                the web, send messages, and make micropayments on your behalf.
              </p>
              <p>
                <strong>Skills</strong> are plugins that give your agent specific
                abilities (web search, email, trading, etc.). You choose which
                skills to install, and you control how much your agent can spend.
              </p>
            </Explainer>
          </div>
        )}

        {/* ================================================
            TRACK A — STEP 1: CONNECT WALLET (SIWE)
        ================================================ */}
        {track === "a" && trackAStep === "wallet" && (
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
              {connectError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-left flex items-start gap-2">
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{connectError}</span>
                </div>
              )}
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
              <Explainer question="What is Sign-In with Ethereum (SIWE)?">
                <p className="mb-2">
                  SIWE lets you use your Ethereum wallet (like MetaMask) as your
                  login. Instead of a username and password, you prove your
                  identity by signing a message with your wallet.
                </p>
                <p>
                  Your wallet address becomes your account ID across ClawSight.
                  No personal data is collected &mdash; just your public wallet
                  address.
                </p>
              </Explainer>

              <button
                type="button"
                onClick={() => setTrack("select")}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
            </CardContent>
          </Card>
        )}

        {/* ================================================
            TRACK A — STEP 2: DETECT GATEWAY
        ================================================ */}
        {track === "a" && trackAStep === "gateway" && (
          <GatewayStep
            url={gatewayUrl}
            onUrlChange={setGatewayUrl}
            detecting={detecting}
            detected={detected}
            detectError={detectError}
            onDetect={() => handleDetect()}
            onSkip={handleSkipGateway}
          />
        )}

        {/* ================================================
            TRACK B — STEP 1: CONNECT SMART WALLET
        ================================================ */}
        {track === "b" && trackBStep === "account" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet
                className="w-12 h-12 text-amber-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold mb-2">
                Create Your Wallet
              </h2>
              <p className="text-gray-500 mb-6">
                Sign in with Coinbase Smart Wallet. It uses your fingerprint or
                Face ID &mdash; no passwords, no browser extensions, no seed
                phrases.
              </p>

              {smartWalletError && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-4 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {smartWalletError}
                </div>
              )}

              <Button
                onClick={handleSmartWalletConnect}
                disabled={connectingSmartWallet}
                size="lg"
                className="w-full gap-2"
              >
                {connectingSmartWallet ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    {creatingAgentWallet
                      ? "Creating agent wallet..."
                      : "Connecting..."}
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" aria-hidden="true" />
                    Sign In with Smart Wallet
                  </>
                )}
              </Button>

              <Explainer question="What is a Smart Wallet?">
                <p className="mb-2">
                  A <strong>Coinbase Smart Wallet</strong> is a crypto wallet
                  that uses passkeys (Face ID, fingerprint, or PIN) instead of
                  passwords or seed phrases. It&apos;s created instantly in your
                  browser &mdash; no app download needed.
                </p>
                <p className="mb-2">
                  Your wallet address becomes your identity across ClawSight. No
                  email, no password &mdash; just your biometric.
                </p>
                <p>
                  Behind the scenes, we also create a separate{" "}
                  <strong>agent wallet</strong> for your AI agent to use for
                  micropayments. This keeps your personal funds separate from
                  your agent&apos;s spending budget.
                </p>
              </Explainer>

              <button
                type="button"
                onClick={() => setTrack("select")}
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
            </CardContent>
          </Card>
        )}

        {/* ================================================
            TRACK B — STEP 2: AGENT WALLET (CDP-managed)
        ================================================ */}
        {track === "b" && trackBStep === "agent-wallet" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  Agent Wallet Created
                </h2>
                <p className="text-gray-500">
                  Your wallet is secured by Coinbase&apos;s infrastructure. No
                  private keys to manage.
                </p>
              </div>

              <div className="space-y-4">
                {/* Wallet address */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Agent Wallet Address
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-800 break-all flex-1">
                      {agentWalletAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        agentWalletAddress && copyAddress(agentWalletAddress)
                      }
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                      aria-label="Copy address"
                    >
                      {addressCopied ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Base L2 (USDC) &middot; Fund this address to enable paid
                    skills
                  </p>
                </div>

                {/* Security explainer */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-green-800">
                        Secured by Coinbase Developer Platform
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Your wallet&apos;s private key is managed in a Trusted
                        Execution Environment (TEE). It never touches your
                        browser or our servers.
                      </p>
                    </div>
                  </div>
                </div>

                <Explainer question="How do I fund this wallet?">
                  <p className="mb-2">
                    Your agent wallet address can receive USDC on the{" "}
                    <strong>Base</strong> network (an Ethereum Layer 2). To fund
                    it:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 mb-2">
                    <li>Copy your wallet address above</li>
                    <li>
                      Send USDC to it from Coinbase, an exchange, or another
                      wallet
                    </li>
                    <li>
                      Make sure you select the <strong>Base</strong> network (not
                      Ethereum mainnet)
                    </li>
                  </ol>
                  <p>
                    Even $1-5 of USDC is enough to get started. Skills use tiny
                    micropayments (fractions of a cent per API call).
                  </p>
                </Explainer>

                <Explainer question="How is this different from MetaMask?">
                  <p className="mb-2">
                    Traditional wallets like MetaMask give you a private key that
                    you must secure yourself. If you lose it, your funds are
                    gone.
                  </p>
                  <p className="mb-2">
                    Your <strong>CDP wallet</strong> uses Coinbase&apos;s
                    infrastructure to manage the key securely. You don&apos;t
                    need to back up a seed phrase or worry about key management.
                  </p>
                  <p>
                    You can view your balance anytime in Settings or on{" "}
                    <strong>BaseScan</strong> by searching your address.
                  </p>
                </Explainer>

                <Button
                  onClick={() => setTrackBStep("provision")}
                  size="lg"
                  className="w-full gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================
            TRACK B — STEP 3: CLOUD PROVISIONING
        ================================================ */}
        {track === "b" && trackBStep === "provision" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                {/* Provisioning in progress */}
                {provisioning && !provisionedUrl && (
                  <div className="animate-slide-in">
                    <div className="relative mx-auto mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto animate-pulse-glow">
                        <Cloud
                          className="w-10 h-10 text-red-500"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      Launching Your Agent
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                      We&apos;re spinning up a dedicated cloud instance for your
                      AI agent. This takes about 10 seconds.
                    </p>

                    {/* Staged progress */}
                    <div className="space-y-2 text-left mb-6">
                      {PROVISION_STAGES.map((label, i) => (
                        <div
                          key={label}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-300",
                            i < provisionStage
                              ? "text-green-700 bg-green-50"
                              : i === provisionStage
                                ? "text-gray-900 bg-gray-50"
                                : "text-gray-300"
                          )}
                        >
                          {i < provisionStage ? (
                            <CheckCircle
                              className="w-4 h-4 text-green-500 shrink-0"
                              aria-hidden="true"
                            />
                          ) : i === provisionStage ? (
                            <Loader2
                              className="w-4 h-4 animate-spin text-red-500 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          )}
                          {label}
                        </div>
                      ))}
                    </div>

                    {/* Security callout */}
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                      <Shield
                        className="w-4 h-4 text-green-600 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-xs text-green-700">
                        Your agent runs in an isolated container with encrypted
                        storage. Only you can access it.
                      </p>
                    </div>
                  </div>
                )}

                {/* Provisioning success */}
                {provisionedUrl && (
                  <div className="animate-slide-in">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle
                        className="w-10 h-10 text-green-600"
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      Agent is Live!
                    </h2>
                    <p className="text-gray-500 mb-2">
                      Your cloud agent is provisioned and ready to go.
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {provisionedUrl}
                    </p>
                  </div>
                )}

                {/* Provisioning error */}
                {provisionError && !provisioning && (
                  <div className="animate-slide-in">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle
                        className="w-8 h-8 text-red-500"
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      Something went wrong
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                      {provisionError}
                    </p>
                    <Button
                      onClick={() => {
                        provisionStarted.current = false;
                        setProvisionError(null);
                        handleProvision();
                      }}
                      size="lg"
                      className="w-full gap-2"
                    >
                      <Cloud className="w-4 h-4" aria-hidden="true" />
                      Try again
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================
            SHARED — PROFILE (Name + Skills)
        ================================================ */}
        {((track === "a" && trackAStep === "profile") ||
          (track === "b" && trackBStep === "profile")) && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <User
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold mb-2">
                  Set Up Your Agent
                </h2>
                <p className="text-gray-500">
                  Give your agent a name and choose its first skills.
                </p>
              </div>

              {/* Agent name with live preview */}
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-3xl mx-auto mb-3">
                  {(agentName || "C").charAt(0).toUpperCase()}
                </div>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Mrs. Claws, Jarvis, Friday..."
                  maxLength={30}
                  className="text-center"
                  aria-label="Agent name"
                  autoFocus
                />
              </div>

              {/* Skill picker */}
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                  <Zap
                    className="w-4 h-4 text-red-500"
                    aria-hidden="true"
                  />
                  Choose skills
                </p>
                <div className="space-y-2">
                  {featured.map((skill) => (
                    <SkillPickerCard
                      key={skill.slug}
                      skill={skill}
                      selected={selectedSkills.has(skill.slug)}
                      onToggle={() => toggleSkill(skill.slug)}
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={handleFinishSetup}
                disabled={
                  finishingSetup ||
                  !agentName.trim() ||
                  selectedSkills.size === 0
                }
                size="lg"
                className="w-full gap-2 mt-4"
              >
                {finishingSetup ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Install {selectedSkills.size} skill
                    {selectedSkills.size !== 1 ? "s" : ""} &amp; finish setup
                  </>
                )}
              </Button>
              {(!agentName.trim() || selectedSkills.size === 0) && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  {!agentName.trim()
                    ? "Enter an agent name to continue"
                    : "Select at least one skill to continue"}
                </p>
              )}

              <Explainer question="What are skills and do they cost money?">
                <p className="mb-2">
                  <strong>Skills</strong> are plugins that give your agent
                  specific abilities. For example, a web search skill lets your
                  agent search the internet, and an email skill lets it send
                  messages.
                </p>
                <p className="mb-2">
                  Some skills are <strong>free</strong> (they use local
                  processing only). Others make API calls that cost tiny amounts
                  of USDC via <strong>x402 micropayments</strong> &mdash;
                  typically fractions of a cent per request.
                </p>
                <p>
                  You control exactly how much your agent can spend via the
                  spending limits in Settings. You can add or remove skills
                  anytime from the Skill Store.
                </p>
              </Explainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Shared gateway detection step (used by Track A)
// ============================================================

function GatewayStep({
  url,
  onUrlChange,
  detecting,
  detected,
  detectError,
  onDetect,
  onSkip,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  detecting: boolean;
  detected: boolean;
  detectError: "network" | "cors" | false;
  onDetect: () => void;
  onSkip: () => void;
}) {
  // Auto-probe localhost on mount
  const autoProbed = useRef(false);
  useEffect(() => {
    if (!autoProbed.current && !detected) {
      autoProbed.current = true;
      onDetect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardContent className="p-8 text-center">
        {detecting && !detectError && (
          <>
            <Loader2
              className="w-12 h-12 text-red-500 mx-auto mb-4 animate-spin"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold mb-2">
              Looking for OpenClaw...
            </h2>
            <p className="text-gray-500 mb-6">
              Checking {url} for a running instance.
            </p>
          </>
        )}

        {detected && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              OpenClaw Connected!
            </h2>
            <p className="text-gray-500 mb-2">
              Your OpenClaw instance is running and ready.
            </p>
            <p className="text-xs text-gray-400 font-mono">{url}</p>
          </>
        )}

        {!detecting && !detected && (
          <>
            <Search
              className="w-12 h-12 text-red-500 mx-auto mb-4"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold mb-2">
              Connect to OpenClaw Gateway
            </h2>
            <p className="text-gray-500 mb-6">
              We couldn&apos;t auto-detect a local instance. Enter your gateway
              URL below.
            </p>

            {detectError === "network" && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Could not reach gateway
                </p>
                <p className="text-xs text-amber-700">
                  No response from <span className="font-mono">{url}</span>.
                  Make sure OpenClaw is running.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-left">
                <label
                  htmlFor="gateway-url"
                  className="text-xs font-medium text-gray-600 mb-1 block"
                >
                  Gateway URL
                </label>
                <Input
                  id="gateway-url"
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="http://localhost:3080"
                  className="font-mono text-sm"
                  aria-label="OpenClaw gateway URL"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Local: http://localhost:3080 &middot; Remote:
                  http://your-server-ip:3080
                </p>
              </div>
              <Button
                onClick={onDetect}
                disabled={detecting || !url.trim()}
                size="lg"
                className="w-full gap-2"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                Connect
              </Button>
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-gray-400 hover:text-gray-600 mx-auto block"
              >
                I&apos;ll set this up later
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Collapsible explainer component
// ============================================================

function Explainer({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-4">
      <summary className="text-xs font-medium text-gray-500 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-700">
        <HelpCircle className="w-3.5 h-3.5" />
        {question}
      </summary>
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

// ============================================================
// Skill picker card
// ============================================================

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
