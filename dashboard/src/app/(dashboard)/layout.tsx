"use client";

import { ModeProvider } from "@/hooks/use-mode";
import { AuthProvider } from "@/hooks/use-auth";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ModeProvider>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-5xl">{children}</main>
        </div>
      </ModeProvider>
    </AuthProvider>
  );
}
