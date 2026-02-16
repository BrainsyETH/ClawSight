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
  Monitor,
  ExternalLink,
  ChevronRight,
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

  // Track B — OpenClaw visual setup wizard (slides 0-3)
  const [wizardSlide, setWizardSlide] = useState(0);
  const [openclawGatewayUrl, setOpenclawGatewayUrl] = useState(
    "http://localhost:3080"
  );
  const [openclawDetecting, setOpenclawDetecting] = useState(false);
  const [openclawDetected, setOpenclawDetected] = useState(false);
  const [openclawError, setOpenclawError] = useState<
    "network" | "cors" | false
  >(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [detectedOS, setDetectedOS] = useState<"mac" | "windows" | "linux">(
    "mac"
  );
  const WIZARD_TOTAL_SLIDES = 4;

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

  // Auto-probe localhost when wizard reaches the connect slide (slide 3)
  const openclawAutoProbed = useRef(false);
  useEffect(() => {
    if (
      track === "b" &&
      trackBStep === "openclaw" &&
      wizardSlide === 3 &&
      !openclawDetected
    ) {
      if (!openclawAutoProbed.current) {
        openclawAutoProbed.current = true;
        handleOpenclawDetect();
      }
    }
    // Reset the ref when leaving the connect slide
    if (wizardSlide !== 3) {
      openclawAutoProbed.current = false;
    }
  }, [wizardSlide, trackBStep, track]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user OS for platform-specific instructions
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("mac") || ua.includes("darwin")) setDetectedOS("mac");
      else if (ua.includes("win")) setDetectedOS("windows");
      else setDetectedOS("linux");
    }
  }, []);

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
            TRACK B — STEP 3: VISUAL OPENCLAW SETUP WIZARD
        ================================================ */}
        {track === "b" && trackBStep === "openclaw" && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* ---- Slide 0: How It Works (Architecture) ---- */}
              {wizardSlide === 0 && !openclawDetected && (
                <div key="slide-0" className="animate-slide-in p-8">
                  <div className="text-center mb-2">
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">
                      How it works
                    </p>
                    <h2 className="text-xl font-semibold mb-1">
                      Meet Your AI Agent
                    </h2>
                    <p className="text-sm text-gray-500">
                      Two pieces that work together
                    </p>
                  </div>

                  {/* Architecture Diagram */}
                  <ArchitectureDiagram />

                  {/* Key insight callout */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Why two parts?
                        </p>
                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                          Your agent runs on <strong>your machine</strong> for
                          privacy and control. This dashboard is just a window
                          into what it&apos;s doing &mdash; like a TV remote for
                          your AI.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => setWizardSlide(1)}
                      size="lg"
                      className="w-full gap-2"
                    >
                      Got it, let&apos;s set it up
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        openclawAutoProbed.current = false;
                        setWizardSlide(3);
                      }}
                      size="lg"
                      className="w-full"
                    >
                      I already have OpenClaw running
                    </Button>
                    <button
                      type="button"
                      onClick={handleSkipGateway}
                      className="text-sm text-gray-400 hover:text-gray-600 mx-auto block mt-1"
                    >
                      I&apos;ll set this up later
                    </button>
                  </div>

                  <SlideIndicator
                    total={WIZARD_TOTAL_SLIDES}
                    current={0}
                    onChange={(i) => setWizardSlide(i)}
                  />
                </div>
              )}

              {/* ---- Slide 1: What You'll Need (Requirements) ---- */}
              {wizardSlide === 1 && !openclawDetected && (
                <div key="slide-1" className="animate-slide-in p-8">
                  <div className="text-center mb-6">
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">
                      Before we start
                    </p>
                    <h2 className="text-xl font-semibold mb-1">
                      Quick Pre-Flight Check
                    </h2>
                    <p className="text-sm text-gray-500">
                      This takes about 5 minutes
                    </p>
                  </div>

                  <div className="space-y-3 stagger-children mb-6">
                    {/* OS — auto-detected */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-200">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          A computer
                        </p>
                        <p className="text-xs text-green-700">
                          You&apos;re on{" "}
                          {detectedOS === "mac"
                            ? "macOS"
                            : detectedOS === "windows"
                              ? "Windows"
                              : "Linux"}{" "}
                          &mdash; perfect!
                        </p>
                      </div>
                      <Badge variant="success" className="text-[10px]">
                        Detected
                      </Badge>
                    </div>

                    {/* Node.js */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Download className="w-5 h-5 text-gray-500" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          Node.js
                        </p>
                        <p className="text-xs text-gray-500">
                          Free runtime &mdash; needed to run OpenClaw
                        </p>
                      </div>
                      <a
                        href="https://nodejs.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1 shrink-0"
                      >
                        Get it
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>

                    {/* Terminal */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-200">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          A terminal app
                        </p>
                        <p className="text-xs text-green-700">
                          {detectedOS === "mac"
                            ? "Use Spotlight \u2192 type \"Terminal\""
                            : detectedOS === "windows"
                              ? "Search for \"PowerShell\" in Start"
                              : "Press Ctrl+Alt+T"}
                        </p>
                      </div>
                      <Badge variant="success" className="text-[10px]">
                        Built in
                      </Badge>
                    </div>
                  </div>

                  <Explainer question="Already have Node.js? How to check">
                    <p className="mb-2">
                      Open your terminal and type{" "}
                      <code className="bg-blue-100 px-1 rounded">
                        node --version
                      </code>{" "}
                      then press Enter.
                    </p>
                    <p>
                      If you see a version number (like <code className="bg-blue-100 px-1 rounded">v20.11.0</code>),
                      you&apos;re good! If you see &quot;command not found&quot;, click the &quot;Get it&quot;
                      link above to install it.
                    </p>
                  </Explainer>

                  <Button
                    onClick={() => setWizardSlide(2)}
                    size="lg"
                    className="w-full gap-2 mt-4"
                  >
                    I&apos;m ready
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      type="button"
                      onClick={() => setWizardSlide(0)}
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

                  <SlideIndicator
                    total={WIZARD_TOTAL_SLIDES}
                    current={1}
                    onChange={(i) => setWizardSlide(i)}
                  />
                </div>
              )}

              {/* ---- Slide 2: Install & Start (Terminal Mockup) ---- */}
              {wizardSlide === 2 && !openclawDetected && (
                <div key="slide-2" className="animate-slide-in p-8">
                  <div className="text-center mb-6">
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">
                      Install &amp; start
                    </p>
                    <h2 className="text-xl font-semibold mb-1">
                      One Command, That&apos;s It
                    </h2>
                    <p className="text-sm text-gray-500">
                      Copy this into your terminal and press Enter
                    </p>
                  </div>

                  {/* Copy command */}
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

                  {/* What you'll see - terminal mockup */}
                  <div className="mt-5 mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                      What you&apos;ll see in your terminal
                    </p>
                    <TerminalMockup
                      title={
                        detectedOS === "mac"
                          ? "Terminal"
                          : detectedOS === "windows"
                            ? "PowerShell"
                            : "Terminal"
                      }
                      lines={[
                        {
                          text: "$ npx openclaw@latest init && npx openclaw start",
                          color: "text-gray-400",
                        },
                        { text: "" },
                        {
                          text: "\u2713 Downloading OpenClaw...",
                          color: "text-green-400",
                        },
                        {
                          text: "\u2713 Creating configuration...",
                          color: "text-green-400",
                        },
                        {
                          text: "\u2713 Starting agent...",
                          color: "text-green-400",
                        },
                        { text: "" },
                        {
                          text: "\uD83E\uDD9E OpenClaw ready on port 3080",
                          color: "text-green-300 font-bold",
                        },
                      ]}
                    />
                  </div>

                  {/* Callout */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-amber-800">
                      <strong>Wait for the last line.</strong> When you see
                      &quot;Ready on port 3080&quot;, your agent is running.
                      Click Next below.
                    </p>
                  </div>

                  <Explainer question="What does this command do?">
                    <p className="mb-2">
                      <code className="bg-blue-100 px-1 rounded">npx</code>{" "}
                      downloads and runs OpenClaw without permanently installing
                      anything. It&apos;s safe and official.
                    </p>
                    <p>
                      Everything stays on your machine. Nothing is sent
                      externally unless you enable specific skills later.
                    </p>
                  </Explainer>

                  <Explainer question="Getting an error?">
                    <p className="mb-2">
                      <strong>&quot;command not found: npx&quot;</strong> &mdash; You need
                      to install Node.js first.{" "}
                      <a
                        href="https://nodejs.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Download it here
                      </a>
                      , then close and re-open your terminal.
                    </p>
                    <p>
                      <strong>Permission denied</strong> &mdash; Try adding{" "}
                      <code className="bg-blue-100 px-1 rounded">sudo</code> before the
                      command (Mac/Linux), or run PowerShell as Administrator (Windows).
                    </p>
                  </Explainer>

                  <Button
                    onClick={() => {
                      openclawAutoProbed.current = false;
                      setWizardSlide(3);
                    }}
                    size="lg"
                    className="w-full gap-2 mt-4"
                  >
                    I see &quot;Ready&quot; &mdash; connect now
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Button>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      type="button"
                      onClick={() => setWizardSlide(1)}
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

                  <SlideIndicator
                    total={WIZARD_TOTAL_SLIDES}
                    current={2}
                    onChange={(i) => setWizardSlide(i)}
                  />
                </div>
              )}

              {/* ---- Slide 3: Connect (auto-probes) ---- */}
              {wizardSlide === 3 && !openclawDetected && (
                <div key="slide-3" className="animate-slide-in p-8">
                  <div className="text-center mb-6">
                    <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">
                      Almost done
                    </p>
                    <h2 className="text-xl font-semibold mb-1">
                      Connecting to Your Agent
                    </h2>
                    <p className="text-sm text-gray-500">
                      {openclawDetecting
                        ? "Searching for OpenClaw on your machine..."
                        : "Let\u2019s find your running agent."}
                    </p>
                  </div>

                  {/* Connection animation */}
                  {openclawDetecting && (
                    <div className="flex flex-col items-center gap-4 py-6 mb-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center animate-pulse-glow">
                          <Search className="w-8 h-8 text-red-500" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Checking {openclawGatewayUrl}...
                      </div>
                    </div>
                  )}

                  {/* Error state */}
                  {openclawError && !openclawDetecting && (
                    <div className="mb-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start gap-3 mb-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">
                              Not found yet
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                              Make sure your terminal shows &quot;Ready on port 3080&quot;
                              before retrying.
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            openclawAutoProbed.current = false;
                            setOpenclawError(false);
                            handleOpenclawDetect();
                          }}
                          disabled={openclawDetecting}
                          size="sm"
                          className="w-full gap-2 mb-3"
                        >
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                          Try again
                        </Button>

                        <Explainer question="Running on a different address?">
                          <div className="space-y-2">
                            <p className="mb-2">
                              By default, OpenClaw runs at{" "}
                              <code className="bg-blue-100 px-1 rounded">
                                http://localhost:3080
                              </code>
                              . If you changed this, enter your custom URL below.
                            </p>
                            <Input
                              value={openclawGatewayUrl}
                              onChange={(e) =>
                                setOpenclawGatewayUrl(e.target.value)
                              }
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
                              className="w-full gap-1.5"
                            >
                              <Search className="w-3 h-3" aria-hidden="true" />
                              Connect to this address
                            </Button>
                          </div>
                        </Explainer>
                      </div>
                    </div>
                  )}

                  {/* Idle state (shouldn't show often due to auto-probe) */}
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
                        setWizardSlide(2);
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

                  <SlideIndicator
                    total={WIZARD_TOTAL_SLIDES}
                    current={3}
                    onChange={(i) => setWizardSlide(i)}
                  />
                </div>
              )}

              {/* ---- Success state (auto-advance) ---- */}
              {openclawDetected && (
                <div key="slide-success" className="animate-slide-in p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    Agent Connected!
                  </h2>
                  <p className="text-gray-500 mb-2">
                    Your OpenClaw agent is live and linked to this dashboard.
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
// Architecture diagram (inline visual)
// ============================================================

function ArchitectureDiagram() {
  return (
    <div className="flex items-center justify-center gap-3 py-6 mb-4">
      {/* Your Computer */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-[88px] h-[88px] rounded-2xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 flex flex-col items-center justify-center shadow-sm">
          <Terminal className="w-7 h-7 text-red-500" aria-hidden="true" />
          <span className="text-[10px] font-bold text-red-600 mt-1">
            OpenClaw
          </span>
        </div>
        <span className="text-[10px] text-gray-400 font-medium">
          Your computer
        </span>
      </div>

      {/* Connection */}
      <div className="flex flex-col items-center gap-1 px-1">
        <div className="relative w-12 flex items-center">
          <div className="w-full h-[2px] bg-gradient-to-r from-red-300 to-blue-300" />
          <div className="absolute -right-0.5 w-0 h-0 border-l-[5px] border-l-blue-300 border-y-[3px] border-y-transparent" />
        </div>
        <span className="text-[8px] text-gray-400 whitespace-nowrap">
          talks to
        </span>
      </div>

      {/* This Dashboard */}
      <div className="flex flex-col items-center gap-1.5 relative">
        <div className="w-[88px] h-[88px] rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 flex flex-col items-center justify-center shadow-sm">
          <Monitor className="w-7 h-7 text-blue-500" aria-hidden="true" />
          <span className="text-[10px] font-bold text-blue-600 mt-1">
            ClawSight
          </span>
        </div>
        {/* "You are here" badge */}
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
          YOU
        </div>
        <span className="text-[10px] text-gray-400 font-medium">
          This dashboard
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Terminal mockup (visual representation)
// ============================================================

function TerminalMockup({
  lines,
  title,
}: {
  lines: { text: string; color?: string }[];
  title?: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900 shadow-lg">
      {/* Title bar with traffic lights */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        {title && (
          <span className="text-[10px] text-gray-500 ml-2 font-mono">
            {title}
          </span>
        )}
      </div>
      {/* Content */}
      <div className="p-3 font-mono text-[11px] leading-relaxed space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className={line.color || "text-gray-300"}>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Slide indicator dots
// ============================================================

function SlideIndicator({
  total,
  current,
  onChange,
}: {
  total: number;
  current: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current
              ? "bg-red-500 w-6"
              : i < current
                ? "bg-green-400 w-1.5"
                : "bg-gray-300 w-1.5"
          )}
          aria-label={`Go to step ${i + 1}`}
        />
      ))}
    </div>
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
    <div className="flex items-center gap-2 p-3.5 bg-gray-900 rounded-xl border border-gray-700">
      <Terminal className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
      <code className="text-sm font-mono text-green-400 flex-1 break-all select-all">
        {command}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1",
          copied
            ? "bg-green-500/20 text-green-400"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
        )}
        aria-label="Copy command"
      >
        {copied ? (
          <>
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" aria-hidden="true" />
            Copy
          </>
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
