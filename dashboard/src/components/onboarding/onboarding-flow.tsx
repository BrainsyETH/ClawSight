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
  RefreshCw,
  Server,
  Shield,
  Copy,
  AlertTriangle,
  Terminal,
  HelpCircle,
} from "lucide-react";

// ============================================================
// Dual-track onboarding
//
// Track A — Power Users: Wallet (SIWE) → Gateway → Name → Skills
// Track B — New Users:   Account (email) → Agent Wallet → OpenClaw → Name → Skills
//
// Both tracks converge on the Name and Skills steps.
// ============================================================

type Track = "select" | "a" | "b";

const TRACK_A_STEPS = ["wallet", "gateway", "name", "skills"] as const;
type TrackAStep = (typeof TRACK_A_STEPS)[number];

const TRACK_B_STEPS = [
  "account",
  "agent-wallet",
  "openclaw",
  "name",
  "skills",
] as const;
type TrackBStep = (typeof TRACK_B_STEPS)[number];

const STEP_LABELS: Record<string, string> = {
  wallet: "Wallet",
  gateway: "Gateway",
  account: "Account",
  "agent-wallet": "Wallet",
  openclaw: "OpenClaw",
  name: "Agent",
  skills: "Skills",
};

interface OnboardingFlowProps {
  onComplete: () => void;
  onSaveAgentName: (name: string) => Promise<void>;
  onInstallSkill: (slug: string) => Promise<void>;
}

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
  const [agentWalletAddress, setAgentWalletAddress] = useState<string | null>(null);
  const [creatingAgentWallet, setCreatingAgentWallet] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  // Track B — OpenClaw guided setup
  const [openclawGuideStep, setOpenclawGuideStep] = useState<
    "intro" | "install" | "connect"
  >("intro");
  const [openclawGatewayUrl, setOpenclawGatewayUrl] = useState(
    "http://localhost:3080"
  );
  const [openclawDetecting, setOpenclawDetecting] = useState(false);
  const [openclawDetected, setOpenclawDetected] = useState(false);
  const [openclawError, setOpenclawError] = useState<
    "network" | "cors" | false
  >(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Shared — name + skills
  const [agentName, setAgentName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [installingSkills, setInstallingSkills] = useState(false);

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
      const msg = err instanceof Error ? err.message : "Wallet connection failed";
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
          // Something is responding at this address — treat as success
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
    // Persist to DB so wallet is durably linked to this OpenClaw instance
    fetch("/v1/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openclaw_gateway_url: base }),
    }).catch(() => {
      // Best-effort — localStorage is the fallback
    });
  };

  const confirmGateway = (base: string) => {
    setDetected(true);
    saveGatewayUrl(base);
    setTimeout(() => setTrackAStep("name"), 800);
  };

  // ---- Track B handlers ----

  const handleSmartWalletConnect = async () => {
    setSmartWalletError(null);
    setConnectingSmartWallet(true);
    try {
      await connectSmartWallet();
      // After wallet connects, create the CDP agent wallet for x402 payments
      setCreatingAgentWallet(true);
      const walletRes = await fetch("/v1/api/wallet/create", { method: "POST" });
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

  const handleOpenclawDetect = async () => {
    setOpenclawDetecting(true);
    setOpenclawError(false);
    const base = openclawGatewayUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setOpenclawDetected(true);
        saveGatewayUrl(base);
        setTimeout(() => setTrackBStep("name"), 800);
        return;
      }
      setOpenclawError("network");
    } catch {
      try {
        const probe = await fetch(`${base}/health`, {
          mode: "no-cors",
          signal: AbortSignal.timeout(5000),
        });
        if (probe.type === "opaque") {
          // Something is responding — treat as success
          setOpenclawDetected(true);
          saveGatewayUrl(base);
          setTimeout(() => setTrackBStep("name"), 800);
          return;
        }
        setOpenclawError("network");
      } catch {
        setOpenclawError("network");
      }
    } finally {
      setOpenclawDetecting(false);
    }
  };

  const handleSkipGateway = () => {
    // Let user skip gateway setup — they can configure it later in Settings
    if (track === "a") setTrackAStep("name");
    else setTrackBStep("name");
  };

  // Auto-probe localhost when Track B enters the connect sub-step
  const openclawAutoProbed = useRef(false);
  useEffect(() => {
    if (
      track === "b" &&
      trackBStep === "openclaw" &&
      openclawGuideStep === "connect" &&
      !openclawDetected
    ) {
      if (!openclawAutoProbed.current) {
        openclawAutoProbed.current = true;
        handleOpenclawDetect();
      }
    }
    // Reset the ref when leaving the connect step
    if (openclawGuideStep !== "connect") {
      openclawAutoProbed.current = false;
    }
  }, [openclawGuideStep, trackBStep, track]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Shared handlers ----

  const handleSaveName = async () => {
    const trimmed = agentName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await onSaveAgentName(trimmed);
      if (track === "a") setTrackAStep("skills");
      else setTrackBStep("skills");
    } catch (err) {
      console.error("[onboarding] Save name failed:", err);
    } finally {
      setSavingName(false);
    }
  };

  const toggleSkill = (slug: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
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
                        Connect your existing wallet and OpenClaw gateway.
                        For users who have a local or remote OpenClaw instance.
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
                        Sign in with Coinbase Smart Wallet using Face ID
                        or fingerprint. No extensions, no seed phrases.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-[10px]">
                          Smart Wallet
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Passkey Auth
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Guided Setup
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
                <strong>ClawSight</strong> is a dashboard that lets you monitor and manage your <strong>OpenClaw</strong> AI agent.
                Think of it as mission control for your AI assistant.
              </p>
              <p className="mb-2">
                <strong>OpenClaw</strong> is the AI agent itself &mdash; it runs on your computer or in the cloud, and can perform tasks,
                search the web, send messages, and make micropayments on your behalf.
              </p>
              <p>
                <strong>Skills</strong> are plugins that give your agent specific abilities (web search, email, trading, etc.).
                You choose which skills to install, and you control how much your agent can spend.
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
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
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
                  SIWE lets you use your Ethereum wallet (like MetaMask) as your login.
                  Instead of a username and password, you prove your identity by signing
                  a message with your wallet.
                </p>
                <p>
                  Your wallet address becomes your account ID across ClawSight. No personal
                  data is collected &mdash; just your public wallet address.
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
              <h2 className="text-xl font-semibold mb-2">Create Your Wallet</h2>
              <p className="text-gray-500 mb-6">
                Sign in with Coinbase Smart Wallet. It uses your fingerprint
                or Face ID &mdash; no passwords, no browser extensions, no
                seed phrases.
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
                    {creatingAgentWallet ? "Creating agent wallet..." : "Connecting..."}
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
                  A <strong>Coinbase Smart Wallet</strong> is a crypto wallet that uses
                  passkeys (Face ID, fingerprint, or PIN) instead of passwords or seed phrases.
                  It&apos;s created instantly in your browser &mdash; no app download needed.
                </p>
                <p className="mb-2">
                  Your wallet address becomes your identity across ClawSight.
                  No email, no password &mdash; just your biometric.
                </p>
                <p>
                  Behind the scenes, we also create a separate <strong>agent wallet</strong> for
                  your AI agent to use for micropayments. This keeps your personal funds
                  separate from your agent&apos;s spending budget.
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
                  Your wallet is secured by Coinbase&apos;s infrastructure.
                  No private keys to manage.
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
                    Base L2 (USDC) &middot; Fund this address to enable paid skills
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
                        Your wallet&apos;s private key is managed in a Trusted Execution
                        Environment (TEE). It never touches your browser or our servers.
                      </p>
                    </div>
                  </div>
                </div>

                <Explainer question="How do I fund this wallet?">
                  <p className="mb-2">
                    Your agent wallet address can receive USDC on the <strong>Base</strong> network
                    (an Ethereum Layer 2). To fund it:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 mb-2">
                    <li>Copy your wallet address above</li>
                    <li>Send USDC to it from Coinbase, an exchange, or another wallet</li>
                    <li>Make sure you select the <strong>Base</strong> network (not Ethereum mainnet)</li>
                  </ol>
                  <p>
                    Even $1-5 of USDC is enough to get started. Skills use tiny micropayments
                    (fractions of a cent per API call).
                  </p>
                </Explainer>

                <Explainer question="How is this different from MetaMask?">
                  <p className="mb-2">
                    Traditional wallets like MetaMask give you a private key that you must secure
                    yourself. If you lose it, your funds are gone.
                  </p>
                  <p className="mb-2">
                    Your <strong>CDP wallet</strong> uses Coinbase&apos;s infrastructure to manage the
                    key securely. You don&apos;t need to back up a seed phrase or worry about
                    key management.
                  </p>
                  <p>
                    You can view your balance anytime in Settings or on{" "}
                    <strong>BaseScan</strong> by searching your address.
                  </p>
                </Explainer>

                <Button
                  onClick={() => setTrackBStep("openclaw")}
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
            TRACK B — STEP 3: GUIDED OPENCLAW SETUP
        ================================================ */}
        {track === "b" && trackBStep === "openclaw" && (
          <Card>
            <CardContent className="p-8">
              {/* ---- Sub-step: Intro ---- */}
              {openclawGuideStep === "intro" && (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-red-500" aria-hidden="true" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                      Connect Your AI Agent
                    </h2>
                    <p className="text-gray-500">
                      One last thing &mdash; your AI agent needs a home.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 text-sm">
                        &#x1F9E0;
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Think of it like this</p>
                        <p className="text-xs text-gray-500 mt-1">
                          <strong>OpenClaw</strong> = your AI agent (the brain)<br />
                          <strong>ClawSight</strong> = this dashboard (the remote control)
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          OpenClaw runs on your computer. ClawSight lets you
                          monitor it, pick skills, and set spending limits.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => setOpenclawGuideStep("install")}
                      size="lg"
                      className="w-full gap-2"
                    >
                      Set up OpenClaw
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setOpenclawGuideStep("connect")}
                      size="lg"
                      className="w-full gap-2"
                    >
                      I already have OpenClaw running
                    </Button>
                    <button
                      type="button"
                      onClick={handleSkipGateway}
                      className="text-sm text-gray-400 hover:text-gray-600 mx-auto block mt-2"
                    >
                      I&apos;ll set this up later
                    </button>
                  </div>
                </div>
              )}

              {/* ---- Sub-step: Install ---- */}
              {openclawGuideStep === "install" && (
                <div>
                  <div className="text-center mb-6">
                    <Download
                      className="w-12 h-12 text-red-500 mx-auto mb-4"
                      aria-hidden="true"
                    />
                    <h2 className="text-xl font-semibold mb-2">
                      Install OpenClaw
                    </h2>
                    <p className="text-gray-500">
                      Three quick steps and your agent is running.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Open a terminal
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            <strong>Mac:</strong> Spotlight &rarr; type &quot;Terminal&quot;<br />
                            <strong>Windows:</strong> search &quot;PowerShell&quot;<br />
                            <strong>Linux:</strong> Ctrl+Alt+T
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          2
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 mb-2">
                            Paste this command and press Enter
                          </p>
                          <CopyCommand
                            command="npx openclaw@latest init && npx openclaw start"
                            copied={commandCopied}
                            onCopy={() => {
                              navigator.clipboard.writeText(
                                "npx openclaw@latest init && npx openclaw start"
                              );
                              setCommandCopied(true);
                              setTimeout(() => setCommandCopied(false), 2000);
                            }}
                          />
                          <p className="text-xs text-gray-400 mt-2">
                            This downloads and starts OpenClaw. It may take a minute.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Wait for &quot;Ready&quot; in the terminal
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            You&apos;ll see something like{" "}
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                              OpenClaw ready on port 3080
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        openclawAutoProbed.current = false;
                        setOpenclawGuideStep("connect");
                      }}
                      size="lg"
                      className="w-full gap-2"
                    >
                      I see &quot;Ready&quot; &mdash; connect now
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Button>

                    <Explainer question="What does this command do?">
                      <p className="mb-2">
                        <code className="bg-blue-100 px-1 rounded">npx</code> is a tool
                        that comes with Node.js. It downloads and runs OpenClaw without
                        permanently installing anything.
                      </p>
                      <p className="mb-2">
                        <code className="bg-blue-100 px-1 rounded">init</code> creates a
                        config file. <code className="bg-blue-100 px-1 rounded">start</code>{" "}
                        launches your AI agent.
                      </p>
                      <p>
                        Everything runs locally on your machine. Nothing is sent to
                        external servers unless you enable specific skills.
                      </p>
                    </Explainer>

                    <Explainer question="Don't have Node.js installed?">
                      <p className="mb-2">
                        Node.js is a free tool needed to run OpenClaw. To install it:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 mb-2">
                        <li>
                          Visit <strong>nodejs.org</strong> and download the LTS version
                        </li>
                        <li>Run the installer (just click Next through the steps)</li>
                        <li>Close and re-open your terminal</li>
                        <li>Then paste the command from Step 2 above</li>
                      </ol>
                    </Explainer>

                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setOpenclawGuideStep("intro")}
                        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipGateway}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Sub-step: Connect (auto-probes on enter) ---- */}
              {openclawGuideStep === "connect" && !openclawDetected && (
                <div>
                  <div className="text-center mb-6">
                    <Search
                      className="w-12 h-12 text-red-500 mx-auto mb-4"
                      aria-hidden="true"
                    />
                    <h2 className="text-xl font-semibold mb-2">
                      Connecting to Your Agent
                    </h2>
                    <p className="text-gray-500">
                      {openclawDetecting
                        ? "Looking for OpenClaw on your machine..."
                        : "Let\u2019s find your running OpenClaw instance."}
                    </p>
                  </div>

                  {openclawDetecting && (
                    <div className="flex flex-col items-center gap-3 mb-6">
                      <Loader2 className="w-8 h-8 animate-spin text-red-500" aria-hidden="true" />
                      <p className="text-sm text-gray-500">
                        Checking {openclawGatewayUrl}...
                      </p>
                    </div>
                  )}

                  {openclawError && !openclawDetecting && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        Not detected yet
                      </p>
                      <p className="text-sm text-amber-700 mb-3">
                        Make sure OpenClaw is running and showing &quot;Ready&quot;
                        in your terminal.
                      </p>
                      <div className="space-y-3">
                        <Button
                          onClick={() => {
                            openclawAutoProbed.current = false;
                            setOpenclawError(false);
                            handleOpenclawDetect();
                          }}
                          disabled={openclawDetecting}
                          size="sm"
                          className="w-full gap-2"
                        >
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                          Try again
                        </Button>

                        <details className="text-left">
                          <summary className="text-xs font-medium text-gray-500 cursor-pointer flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5" />
                            Running OpenClaw on a different address?
                          </summary>
                          <div className="mt-2 space-y-2">
                            <Input
                              value={openclawGatewayUrl}
                              onChange={(e) => setOpenclawGatewayUrl(e.target.value)}
                              placeholder="http://your-server:3080"
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              onClick={() => {
                                openclawAutoProbed.current = false;
                                setOpenclawError(false);
                                handleOpenclawDetect();
                              }}
                              disabled={openclawDetecting}
                              size="sm"
                              className="w-full gap-2"
                            >
                              <Search className="w-3 h-3" aria-hidden="true" />
                              Connect to this address
                            </Button>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {!openclawDetecting && !openclawError && (
                    <Button
                      onClick={handleOpenclawDetect}
                      disabled={openclawDetecting}
                      size="lg"
                      className="w-full gap-2"
                    >
                      <Search className="w-4 h-4" aria-hidden="true" />
                      Check connection
                    </Button>
                  )}

                  <div className="flex justify-between items-center mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenclawGuideStep("install");
                        setOpenclawError(false);
                      }}
                      className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipGateway}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )}

              {/* ---- Success state ---- */}
              {openclawDetected && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    Agent Connected!
                  </h2>
                  <p className="text-gray-500 mb-2">
                    Your OpenClaw agent is running and linked to this dashboard.
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {openclawGatewayUrl}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ================================================
            SHARED — NAME YOUR AGENT
        ================================================ */}
        {((track === "a" && trackAStep === "name") ||
          (track === "b" && trackBStep === "name")) && (
          <Card>
            <CardContent className="p-8 text-center">
              <User
                className="w-12 h-12 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold mb-2">Name Your Agent</h2>
              <p className="text-gray-500 mb-6">
                Give your AI agent an identity. This name appears throughout
                the dashboard.
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

        {/* ================================================
            SHARED — INSTALL SKILLS
        ================================================ */}
        {((track === "a" && trackAStep === "skills") ||
          (track === "b" && trackBStep === "skills")) && (
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

              <Explainer question="What are skills and do they cost money?">
                <p className="mb-2">
                  <strong>Skills</strong> are plugins that give your agent specific abilities.
                  For example, a web search skill lets your agent search the internet, and an
                  email skill lets it send messages.
                </p>
                <p className="mb-2">
                  Some skills are <strong>free</strong> (they use local processing only).
                  Others make API calls that cost tiny amounts of USDC via <strong>x402 micropayments</strong> &mdash;
                  typically fractions of a cent per request.
                </p>
                <p>
                  You control exactly how much your agent can spend via the spending limits
                  in Settings. You can add or remove skills anytime from the Skill Store.
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
              We couldn&apos;t auto-detect a local instance. Enter your gateway URL below.
            </p>

            {detectError === "network" && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Could not reach gateway
                </p>
                <p className="text-xs text-amber-700">
                  No response from <span className="font-mono">{url}</span>. Make sure OpenClaw is running.
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
// Copy-able terminal command
// ============================================================

function CopyCommand({
  command,
  copied,
  onCopy,
}: {
  command: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg">
      <Terminal className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
      <code className="text-sm font-mono text-green-400 flex-1 break-all select-all">
        {command}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="text-gray-400 hover:text-white shrink-0 transition-colors"
        aria-label="Copy command"
      >
        {copied ? (
          <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
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
