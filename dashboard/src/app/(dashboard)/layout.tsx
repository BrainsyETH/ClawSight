"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-supabase-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}

/**
 * Inner shell that can access AuthProvider context.
 * Fetches the user profile so downstream components can use it.
 * Redirects to /onboarding if the user hasn't completed setup.
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { walletAddress, isAuthenticated } = useAuth();
  const { loading } = useUser(walletAddress ?? undefined);
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    // Check onboarding status from localStorage.
    // If the user hasn't completed onboarding, redirect them.
    const onboarded = localStorage.getItem("clawsight_onboarded");
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }
    setOnboardingChecked(true);
  }, [router]);

  if (loading || !onboardingChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
        {!isAuthenticated ? (
          <UnauthenticatedBanner />
        ) : (
          <>
            <GatewayBanner />
            {children}
          </>
        )}
      </main>
    </div>
  );
}

function GatewayBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const url = localStorage.getItem("clawsight_gateway_url");
    if (!url) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          OpenClaw not connected
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Connect your OpenClaw agent to start using skills and monitoring activity.
        </p>
      </div>
      <Link
        href="/settings"
        className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors"
      >
        Set up
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function UnauthenticatedBanner() {
  const router = useRouter();

  const handleGoToOnboarding = () => {
    // Clear the flag so they re-enter the full flow
    localStorage.removeItem("clawsight_onboarded");
    router.push("/onboarding");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <span className="text-6xl mb-4" aria-hidden="true">&#x1F99E;</span>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ClawSight</h2>
      <p className="text-gray-500 mb-6 max-w-md">
        Connect your wallet or create an account to manage your AI agent.
      </p>
      <button
        onClick={handleGoToOnboarding}
        className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
