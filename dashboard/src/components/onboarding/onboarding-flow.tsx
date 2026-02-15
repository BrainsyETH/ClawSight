"use client";

import { useState } from "react";
import { DisplayMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet, Search, Sparkles, BarChart3, CheckCircle, Loader2 } from "lucide-react";

// ============================================================
// 3-step onboarding: Connect Wallet → Detect OpenClaw → Choose Style
// ============================================================

type Step = "connect" | "detect" | "style";

interface OnboardingFlowProps {
  onComplete: (mode: DisplayMode) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>("connect");
  const [connecting, setConnecting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DisplayMode>("fun");

  const handleConnect = async () => {
    setConnecting(true);
    // In production: trigger SIWE via wagmi
    await new Promise((r) => setTimeout(r, 1500));
    setConnecting(false);
    setStep("detect");
  };

  const handleDetect = async () => {
    setDetecting(true);
    // In production: check for OpenClaw gateway
    await new Promise((r) => setTimeout(r, 2000));
    setDetected(true);
    setDetecting(false);
    setTimeout(() => setStep("style"), 800);
  };

  const handleFinish = () => {
    onComplete(selectedMode);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block">🦞</span>
          <h1 className="text-3xl font-bold text-gray-900">ClawSight</h1>
          <p className="text-gray-500 mt-2">
            The control panel for your AI agent
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["connect", "detect", "style"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s
                    ? "bg-red-500 text-white"
                    : (["connect", "detect", "style"].indexOf(step) > i)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                )}
              >
                {["connect", "detect", "style"].indexOf(step) > i ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "w-12 h-0.5",
                    ["connect", "detect", "style"].indexOf(step) > i
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
              {!detecting && !detected && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Don&apos;t have OpenClaw?
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>Mac/Linux: Install via the official docs (5 min)</li>
                    <li>Windows: Use WSL2 (10 min)</li>
                    <li>Cloud: DigitalOcean 1-click deploy</li>
                  </ul>
                  <Button variant="link" size="sm" className="mt-2 px-0">
                    Enter gateway URL manually
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Choose Style */}
        {step === "style" && (
          <Card>
            <CardContent className="p-8">
              <Sparkles className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-center">
                Choose Your Style
              </h2>
              <p className="text-gray-500 mb-6 text-center">
                How should your dashboard look and feel? You can change this
                anytime in settings.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setSelectedMode("fun")}
                  className={cn(
                    "p-5 rounded-xl border-2 text-left transition-all",
                    selectedMode === "fun"
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="text-3xl mb-3 block">🦞</span>
                  <h3 className="font-semibold">Fun Mode</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Meet Mrs. Claws! Personality-driven UI with a playful touch.
                  </p>
                  <div className="mt-3 p-2 bg-white rounded-lg text-xs text-gray-600 italic">
                    &quot;Good morning! I&apos;ve been busy today.&quot;
                  </div>
                </button>
                <button
                  onClick={() => setSelectedMode("professional")}
                  className={cn(
                    "p-5 rounded-xl border-2 text-left transition-all",
                    selectedMode === "professional"
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="text-3xl mb-3 block">
                    <BarChart3 className="w-8 h-8 text-gray-600" />
                  </span>
                  <h3 className="font-semibold">Professional</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Clean, data-focused dashboard. All business, no fluff.
                  </p>
                  <div className="mt-3 p-2 bg-white rounded-lg text-xs text-gray-600">
                    Agent status: Active. 23 tasks completed.
                  </div>
                </button>
              </div>
              <Button onClick={handleFinish} size="lg" className="w-full">
                Let&apos;s Go!
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
