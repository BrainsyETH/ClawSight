"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet, Search, CheckCircle, Loader2 } from "lucide-react";

// ============================================================
// 2-step onboarding: Connect Wallet → Detect OpenClaw
// ============================================================

type Step = "connect" | "detect";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { connect: authConnect, isConnecting: authConnecting } = useAuth();
  const [step, setStep] = useState<Step>("connect");
  const [connecting, setConnecting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [detectError, setDetectError] = useState(false);

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

  const handleDetect = async () => {
    setDetecting(true);
    setDetectError(false);
    try {
      // Check for OpenClaw gateway on common ports
      const res = await fetch("http://localhost:3080/health", {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      if (res?.ok) {
        setDetected(true);
        setTimeout(() => onComplete(), 800);
      } else {
        // Gateway not found — let user skip or retry
        setDetectError(true);
      }
    } catch {
      setDetectError(true);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block">&#x1F99E;</span>
          <h1 className="text-3xl font-bold text-gray-900">ClawSight</h1>
          <p className="text-gray-500 mt-2">
            The control panel for your AI agent
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["connect", "detect"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s
                    ? "bg-red-500 text-white"
                    : (["connect", "detect"].indexOf(step) > i)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                )}
              >
                {["connect", "detect"].indexOf(step) > i ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 1 && (
                <div
                  className={cn(
                    "w-12 h-0.5",
                    ["connect", "detect"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Connect Wallet */}
        {step === "connect" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Sign In with Ethereum
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Detect OpenClaw */}
        {step === "detect" && (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                {detected ? "OpenClaw Found!" : "Looking for OpenClaw..."}
              </h2>
              <p className="text-gray-500 mb-6">
                {detected
                  ? "Great! Your OpenClaw instance is running and ready to connect."
                  : "We'll check if OpenClaw is running on your machine."}
              </p>
              {detected ? (
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  Connected to OpenClaw Gateway
                </div>
              ) : (
                <Button
                  onClick={handleDetect}
                  disabled={detecting}
                  size="lg"
                  className="w-full gap-2"
                >
                  {detecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Detect OpenClaw
                    </>
                  )}
                </Button>
              )}
              {detectError && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-sm font-medium text-amber-700 mb-1">
                    Could not detect OpenClaw
                  </p>
                  <p className="text-xs text-amber-600 mb-3">
                    No gateway found at localhost:3080. You can still use ClawSight — just connect your plugin later.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => onComplete()}>
                    Skip for now
                  </Button>
                </div>
              )}
              {!detecting && !detected && !detectError && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Don&apos;t have OpenClaw?
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>Mac/Linux: Install via the official docs (5 min)</li>
                    <li>Windows: Use WSL2 (10 min)</li>
                    <li>Cloud: DigitalOcean 1-click deploy</li>
                  </ul>
                  <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => onComplete()}>
                    Skip and set up later
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
