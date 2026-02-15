"use client";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-supabase-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Loader2 } from "lucide-react";

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
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { walletAddress, isAuthenticated } = useAuth();
  const { loading } = useUser(walletAddress ?? undefined);

  if (loading) {
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
        {!isAuthenticated ? <UnauthenticatedBanner /> : children}
      </main>
    </div>
  );
}

function UnauthenticatedBanner() {
  const { connect, isConnecting } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <span className="text-6xl mb-4">&#x1F99E;</span>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ClawSight</h2>
      <p className="text-gray-500 mb-6 max-w-md">
        Connect your wallet to access your dashboard and manage your AI agent.
      </p>
      <button
        onClick={connect}
        disabled={isConnecting}
        className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {isConnecting ? "Connecting..." : "Sign In with Ethereum"}
      </button>
    </div>
  );
}
