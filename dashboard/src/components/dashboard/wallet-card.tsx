"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatUSDC } from "@/lib/utils";
import { Wallet, TrendingDown, Copy, CheckCircle, ExternalLink } from "lucide-react";

interface WalletCardProps {
  balance: number;
  todaySpending: number;
  weekSpending: number;
  /** Agent wallet address from DB (preferred) or localStorage fallback. */
  agentWalletAddress?: string | null;
}

export function WalletCard({
  balance,
  todaySpending,
  weekSpending,
  agentWalletAddress: agentWalletProp,
}: WalletCardProps) {
  const [agentAddress, setAgentAddress] = useState<string | null>(agentWalletProp ?? null);
  const [copied, setCopied] = useState(false);

  // Use prop from DB if available, otherwise fall back to localStorage
  useEffect(() => {
    if (agentWalletProp) {
      setAgentAddress(agentWalletProp);
    } else {
      const stored = localStorage.getItem("clawsight_agent_wallet_address");
      if (stored) setAgentAddress(stored);
    }
  }, [agentWalletProp]);

  const handleCopy = async () => {
    if (!agentAddress) return;
    await navigator.clipboard.writeText(agentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncated = agentAddress
    ? `${agentAddress.slice(0, 6)}...${agentAddress.slice(-4)}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="w-4 h-4" />
          Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-900">
          {formatUSDC(balance)}
          <span className="text-sm font-normal text-gray-500 ml-1">USDC</span>
        </p>
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1 text-gray-500">
            <TrendingDown className="w-3 h-3" />
            <span>Today: {formatUSDC(todaySpending)}</span>
          </div>
          <div className="text-gray-500">
            Week: {formatUSDC(weekSpending)}
          </div>
        </div>

        {/* Agent wallet address (for Track B email users) */}
        {agentAddress && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-gray-400">Agent:</span>
                <code className="text-xs font-mono text-gray-600 truncate">
                  {truncated}
                </code>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Copy agent wallet address"
                >
                  {copied ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://basescan.org/address/${agentAddress}`,
                      "_blank"
                    )
                  }
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label="View on BaseScan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Fund with USDC on Base to enable paid skills
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
