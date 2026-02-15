"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMode } from "@/hooks/use-mode";
import { useAuth } from "@/hooks/use-auth";
import { useEns, formatAddressOrEns } from "@/hooks/use-ens";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { cn, truncateAddress } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Compass,
  User,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/",
    icon: LayoutDashboard,
    funLabel: "Home",
    proLabel: "Dashboard",
  },
  {
    href: "/skills",
    icon: Zap,
    funLabel: "My Skills",
    proLabel: "Skills",
  },
  {
    href: "/learn",
    icon: Compass,
    funLabel: "Learn New Skills",
    proLabel: "Browse Skills",
  },
  {
    href: "/character",
    icon: User,
    funLabel: "Customize Me",
    proLabel: "Agent Settings",
  },
  {
    href: "/settings",
    icon: Settings,
    funLabel: "Settings",
    proLabel: "Settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isFun, agentName } = useMode();
  const { walletAddress } = useAuth();
  const { name: ensName } = useEns(walletAddress);

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 border-r border-gray-200 bg-white flex-col h-screen sticky top-0">
        {/* Brand */}
        <div className="p-6 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-3">
            <AgentAvatar size="sm" />
            <div>
              <h1 className="font-bold text-gray-900">ClawSight</h1>
              <p className="text-xs text-gray-500">{agentName}</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-red-50 text-red-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="w-4 h-4" />
                {isFun ? item.funLabel : item.proLabel}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Wallet</p>
            <p className="text-sm font-mono font-medium text-gray-900">
              {walletAddress
                ? formatAddressOrEns(walletAddress, ensName)
                : "Not connected"}
            </p>
            {walletAddress && (
              <p className="text-xs text-green-600 font-medium mt-1">Connected</p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation - visible only on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const label = isFun ? item.funLabel : item.proLabel;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1 min-w-0",
                  isActive ? "text-red-500" : "text-gray-400"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
