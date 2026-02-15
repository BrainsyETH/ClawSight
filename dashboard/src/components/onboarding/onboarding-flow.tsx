"use client";

import { useState, useEffect } from "react";
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
  ExternalLink,
  RefreshCw,
  Mail,
  Cloud,
  Server,
  Shield,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  Key,
  Terminal,
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
// Wallet encryption helpers (AES-256-GCM with PBKDF2)
// ============================================================

async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function encryptPrivateKey(
  privateKey: string,
  passphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(privateKey)
  );
  // Pack: salt(16) + iv(12) + ciphertext
  const ctBytes = new Uint8Array(ciphertext);
  const packed = new Uint8Array(salt.length + iv.length + ctBytes.length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(ctBytes, salt.length + iv.length);
  return btoa(String.fromCharCode(...packed));
}

// ============================================================
// Main component
// ============================================================

export function OnboardingFlow({
  onComplete,
  onSaveAgentName,
  onInstallSkill,
}: OnboardingFlowProps) {
  const { connect: authConnect, signUpWithEmail } = useAuth();

  // Track & step state
  const [track, setTrack] = useState<Track>("select");
  const [trackAStep, setTrackAStep] = useState<TrackAStep>("wallet");
  const [trackBStep, setTrackBStep] = useState<TrackBStep>("account");

  // Track A — wallet + gateway
  const [connecting, setConnecting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [detectError, setDetectError] = useState<"network" | "cors" | false>(
    false
  );
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:3080");

  // Track B — email account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signingUp, setSigningUp] = useState(false);

  // Track B — agent wallet
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null);
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(
    null
  );
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [keySecured, setKeySecured] = useState(false);
  const [securingKey, setSecuringKey] = useState(false);

  // Track B — OpenClaw setup
  const [openclawChoice, setOpenclawChoice] = useState<
    "cloud" | "selfhost" | null
  >(null);
  const [openclawGatewayUrl, setOpenclawGatewayUrl] = useState(
    "http://localhost:3080"
  );
  const [openclawDetecting, setOpenclawDetecting] = useState(false);
  const [openclawDetected, setOpenclawDetected] = useState(false);
  const [openclawError, setOpenclawError] = useState<
    "network" | "cors" | false
  >(false);

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
    try {
      await authConnect();
      setTrackAStep("gateway");
    } catch (err) {
      console.error("[onboarding] Wallet connection failed:", err);
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
          setDetectError("cors");
        } else {
          setDetectError("network");
        }
      } catch {
        setDetectError("network");
      }
    } finally {
      setDetecting(false);
    }
  };

  const confirmGateway = (base: string) => {
    setDetected(true);
    localStorage.setItem("clawsight_gateway_url", base);
    setTimeout(() => setTrackAStep("name"), 800);
  };

  // ---- Track B handlers ----

  const handleEmailSignup = async () => {
    setSignupError(null);
    if (password !== passwordConfirm) {
      setSignupError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setSignupError("Password must be at least 8 characters");
      return;
    }

    setSigningUp(true);
    try {
      // Generate wallet first so we can pass the address to signUp
      const { generatePrivateKey, privateKeyToAccount } = await import(
        "viem/accounts"
      );
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);

      await signUpWithEmail(email, password, account.address);

      setGeneratedPrivateKey(pk);
      setGeneratedAddress(account.address);
      setTrackBStep("agent-wallet");
    } catch (err) {
      setSignupError(
        err instanceof Error ? err.message : "Account creation failed"
      );
    } finally {
      setSigningUp(false);
    }
  };

  const handleSecureKey = async () => {
    if (!generatedPrivateKey || !passphrase) return;
    if (passphrase !== passphraseConfirm) return;
    if (passphrase.length < 8) return;

    setSecuringKey(true);
    try {
      const encrypted = await encryptPrivateKey(generatedPrivateKey, passphrase);
      localStorage.setItem("clawsight_agent_wallet_encrypted", encrypted);
      localStorage.setItem("clawsight_agent_wallet_address", generatedAddress!);
      // Clear plaintext from memory
      setGeneratedPrivateKey(null);
      setKeySecured(true);
      setTimeout(() => setTrackBStep("openclaw"), 1000);
    } catch (err) {
      console.error("[onboarding] Key encryption failed:", err);
    } finally {
      setSecuringKey(false);
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
        localStorage.setItem("clawsight_gateway_url", base);
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
          setOpenclawError("cors");
        } else {
          setOpenclawError("network");
        }
      } catch {
        setOpenclawError("network");
      }
    } finally {
      setOpenclawDetecting(false);
    }
  };

  const confirmOpenclawGateway = () => {
    const base = openclawGatewayUrl.replace(/\/+$/, "");
    setOpenclawDetected(true);
    localStorage.setItem("clawsight_gateway_url", base);
    setTimeout(() => setTrackBStep("name"), 800);
  };

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

  const copyToClipboard = async (text: string, type: "key" | "address") => {
    await navigator.clipboard.writeText(text);
    if (type === "key") {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } else {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    }
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
                        Create an account and we&apos;ll set up an agent
                        wallet for you. No crypto experience needed.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-[10px]">
                          Email Signup
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Auto Wallet
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
            onManualConfirm={() => confirmGateway(gatewayUrl.replace(/\/+$/, ""))}
          />
        )}

        {/* ================================================
            TRACK B — STEP 1: CREATE ACCOUNT (EMAIL)
        ================================================ */}
        {track === "b" && trackBStep === "account" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Mail
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold mb-2">Create Account</h2>
                <p className="text-gray-500">
                  Sign up with your email. We&apos;ll generate a secure agent
                  wallet for you automatically.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="signup-email"
                    className="text-sm font-medium text-gray-700 block mb-1"
                  >
                    Email
                  </label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <div>
                  <label
                    htmlFor="signup-password"
                    className="text-sm font-medium text-gray-700 block mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="signup-password-confirm"
                    className="text-sm font-medium text-gray-700 block mb-1"
                  >
                    Confirm Password
                  </label>
                  <Input
                    id="signup-password-confirm"
                    type={showPassword ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>

                {signupError && (
                  <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {signupError}
                  </div>
                )}

                <Button
                  onClick={handleEmailSignup}
                  disabled={
                    signingUp ||
                    !email.trim() ||
                    !password ||
                    !passwordConfirm
                  }
                  size="lg"
                  className="w-full gap-2"
                >
                  {signingUp ? (
                    <>
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        aria-hidden="true"
                      />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
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
            TRACK B — STEP 2: AGENT WALLET
        ================================================ */}
        {track === "b" && trackBStep === "agent-wallet" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Key
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold mb-2">
                  {keySecured ? "Wallet Secured" : "Your Agent Wallet"}
                </h2>
                <p className="text-gray-500">
                  {keySecured
                    ? "Your private key has been encrypted and stored safely."
                    : "We've generated a wallet for your AI agent. Secure it with a passphrase."}
                </p>
              </div>

              {keySecured ? (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Wallet address saved. You&apos;ll need to fund it with USDC
                    on Base to use paid skills.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Wallet address */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Agent Wallet Address
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-800 break-all flex-1">
                        {generatedAddress}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          generatedAddress &&
                          copyToClipboard(generatedAddress, "address")
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

                  {/* Private key reveal */}
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800">
                          Back up your private key
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Save this somewhere safe. If you lose both the key and
                          your passphrase, your funds are unrecoverable.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-800 break-all flex-1">
                        {showKey
                          ? generatedPrivateKey
                          : "••••••••••••••••••••••••••••••••"}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        aria-label={showKey ? "Hide key" : "Reveal key"}
                      >
                        {showKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      {showKey && (
                        <button
                          type="button"
                          onClick={() =>
                            generatedPrivateKey &&
                            copyToClipboard(generatedPrivateKey, "key")
                          }
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                          aria-label="Copy key"
                        >
                          {keyCopied ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Passphrase to encrypt */}
                  <div>
                    <label
                      htmlFor="passphrase"
                      className="text-sm font-medium text-gray-700 block mb-1"
                    >
                      Encryption Passphrase
                    </label>
                    <Input
                      id="passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Choose a strong passphrase (min 8 chars)"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      This encrypts your private key locally. It never leaves
                      your browser.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="passphrase-confirm"
                      className="text-sm font-medium text-gray-700 block mb-1"
                    >
                      Confirm Passphrase
                    </label>
                    <Input
                      id="passphrase-confirm"
                      type="password"
                      value={passphraseConfirm}
                      onChange={(e) => setPassphraseConfirm(e.target.value)}
                      placeholder="Repeat passphrase"
                    />
                  </div>

                  {passphrase &&
                    passphraseConfirm &&
                    passphrase !== passphraseConfirm && (
                      <p className="text-xs text-red-500">
                        Passphrases do not match
                      </p>
                    )}

                  <Button
                    onClick={handleSecureKey}
                    disabled={
                      securingKey ||
                      !passphrase ||
                      passphrase.length < 8 ||
                      passphrase !== passphraseConfirm
                    }
                    size="lg"
                    className="w-full gap-2"
                  >
                    {securingKey ? (
                      <>
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          aria-hidden="true"
                        />
                        Encrypting...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" aria-hidden="true" />
                        Encrypt &amp; Secure Key
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ================================================
            TRACK B — STEP 3: SETUP OPENCLAW
        ================================================ */}
        {track === "b" && trackBStep === "openclaw" && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Cloud
                  className="w-12 h-12 text-red-500 mx-auto mb-4"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold mb-2">
                  Set Up OpenClaw
                </h2>
                <p className="text-gray-500">
                  OpenClaw is the AI agent that ClawSight manages. Choose how
                  you&apos;d like to run it.
                </p>
              </div>

              {!openclawChoice && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOpenclawChoice("cloud")}
                    className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Cloud className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Deploy to cloud
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          One-click deploy to a cloud provider. Easiest option
                          — no hardware needed.
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenclawChoice("selfhost")}
                    className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Server className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Self-host
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Run OpenClaw on your own machine or server. Full
                          control.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Cloud deploy guidance */}
              {openclawChoice === "cloud" && !openclawDetected && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-3">
                      Deploy OpenClaw in minutes
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800 shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Choose a provider
                          </p>
                          <p className="text-xs text-blue-700">
                            Railway, Fly.io, or any Docker host
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800 shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Run the deploy command
                          </p>
                          <div className="mt-1 p-2 bg-gray-900 rounded text-xs font-mono text-green-400 flex items-center gap-2">
                            <Terminal className="w-3 h-3 shrink-0" />
                            <span className="break-all">
                              docker run -d -p 3080:3080 openclaw/openclaw
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800 shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Enter your gateway URL below
                          </p>
                          <p className="text-xs text-blue-700">
                            Use the public URL from your cloud provider
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cloud-gateway-url"
                      className="text-xs font-medium text-gray-600 mb-1 block"
                    >
                      Gateway URL
                    </label>
                    <Input
                      id="cloud-gateway-url"
                      value={openclawGatewayUrl}
                      onChange={(e) => setOpenclawGatewayUrl(e.target.value)}
                      placeholder="https://your-openclaw.up.railway.app"
                      className="font-mono text-sm"
                    />
                  </div>

                  <Button
                    onClick={handleOpenclawDetect}
                    disabled={
                      openclawDetecting || !openclawGatewayUrl.trim()
                    }
                    size="lg"
                    className="w-full gap-2"
                  >
                    {openclawDetecting ? (
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

                  <GatewayErrorFeedback
                    error={openclawError}
                    url={openclawGatewayUrl}
                    onRetry={handleOpenclawDetect}
                    onManualConfirm={confirmOpenclawGateway}
                    detecting={openclawDetecting}
                  />

                  <button
                    type="button"
                    onClick={() => setOpenclawChoice(null)}
                    className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to options
                  </button>
                </div>
              )}

              {/* Self-host guidance */}
              {openclawChoice === "selfhost" && !openclawDetected && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="selfhost-gateway-url"
                      className="text-xs font-medium text-gray-600 mb-1 block"
                    >
                      Gateway URL
                    </label>
                    <Input
                      id="selfhost-gateway-url"
                      value={openclawGatewayUrl}
                      onChange={(e) => setOpenclawGatewayUrl(e.target.value)}
                      placeholder="http://localhost:3080"
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Local: http://localhost:3080 &middot; Remote:
                      http://your-server-ip:3080
                    </p>
                  </div>

                  <Button
                    onClick={handleOpenclawDetect}
                    disabled={
                      openclawDetecting || !openclawGatewayUrl.trim()
                    }
                    size="lg"
                    className="w-full gap-2"
                  >
                    {openclawDetecting ? (
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

                  <GatewayErrorFeedback
                    error={openclawError}
                    url={openclawGatewayUrl}
                    onRetry={handleOpenclawDetect}
                    onManualConfirm={confirmOpenclawGateway}
                    detecting={openclawDetecting}
                  />

                  <button
                    type="button"
                    onClick={() => setOpenclawChoice(null)}
                    className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to options
                  </button>
                </div>
              )}

              {/* Success */}
              {openclawDetected && (
                <div className="space-y-2 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                    <CheckCircle className="w-5 h-5" aria-hidden="true" />
                    Connected to OpenClaw Gateway
                  </div>
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
  onManualConfirm,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  detecting: boolean;
  detected: boolean;
  detectError: "network" | "cors" | false;
  onDetect: () => void;
  onManualConfirm: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Search
          className="w-12 h-12 text-red-500 mx-auto mb-4"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold mb-2">
          {detected ? "OpenClaw Connected!" : "Connect to OpenClaw Gateway"}
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
            <p className="text-xs text-gray-400 font-mono">{url}</p>
          </div>
        ) : (
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

        <GatewayErrorFeedback
          error={detectError}
          url={url}
          onRetry={onDetect}
          onManualConfirm={onManualConfirm}
          detecting={detecting}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================
// Gateway error feedback (shared between Track A and Track B)
// ============================================================

function GatewayErrorFeedback({
  error,
  url,
  onRetry,
  onManualConfirm,
  detecting,
}: {
  error: "network" | "cors" | false;
  url: string;
  onRetry: () => void;
  onManualConfirm: () => void;
  detecting: boolean;
}) {
  if (!error) return null;

  if (error === "cors") {
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
        <div className="flex items-start gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Gateway detected
            </p>
            <p className="text-sm text-green-700 mt-1">
              Something is running at{" "}
              <span className="font-mono text-xs">{url}</span>, but your
              browser blocked the full response (CORS). This is normal for local
              and remote gateways.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          If you&apos;re sure this is your OpenClaw instance, confirm below to
          continue.
        </p>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={onManualConfirm}>
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            Confirm &amp; Continue
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onRetry}
            disabled={detecting}
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
      <p className="text-sm font-medium text-amber-800 mb-2">
        Could not reach gateway
      </p>
      <p className="text-sm text-amber-700 mb-3">
        No response from <span className="font-mono text-xs">{url}</span>. Make
        sure OpenClaw is running and the URL is correct.
      </p>
      <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">&bull;</span>
          <span>Check that your OpenClaw instance is running</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">&bull;</span>
          <span>
            For remote machines, use the IP or hostname (e.g.
            http://192.168.1.100:3080)
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">&bull;</span>
          <span>Ensure port 3080 is open and not blocked by a firewall</span>
        </li>
      </ul>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            window.open("https://github.com/OpenClaw/openclaw", "_blank")
          }
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          View Docs
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={onRetry}
          disabled={detecting}
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Try Again
        </Button>
      </div>
    </div>
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
