"use client";

import { useMode } from "@/hooks/use-mode";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatUSDC } from "@/lib/utils";
import { Wallet, TrendingDown } from "lucide-react";

interface WalletCardProps {
  balance: number;
  todaySpending: number;
  weekSpending: number;
}

export function WalletCard({
  balance,
  todaySpending,
  weekSpending,
}: WalletCardProps) {
  const { isFun, label } = useMode();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="w-4 h-4" />
          {label("My Wallet", "Wallet")}
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
        {isFun && balance < 1 && (
          <p className="text-xs text-yellow-600 mt-2">
            Running a bit low! Consider topping up my wallet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
