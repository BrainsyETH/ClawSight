"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatUSDC } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

interface SpendingCategory {
  label: string;
  amount: number;
  color: string;
}

interface SpendingChartProps {
  categories: SpendingCategory[];
  totalSpend: number;
  period: "today" | "week" | "month";
}

export function SpendingChart({
  categories,
  totalSpend,
  period,
}: SpendingChartProps) {
  const maxAmount = useMemo(
    () => Math.max(...categories.map((c) => c.amount), 0.001),
    [categories]
  );

  const periodLabel = {
    today: "Today",
    week: "This Week",
    month: "This Month",
  }[period];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Spending Breakdown
          </span>
          <span className="text-sm font-normal text-gray-500">
            {periodLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No spending data yet
          </p>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => {
              const percentage =
                totalSpend > 0
                  ? Math.round((cat.amount / totalSpend) * 100)
                  : 0;
              const barWidth = Math.max(
                (cat.amount / maxAmount) * 100,
                2
              );

              return (
                <div key={cat.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">
                      {cat.label}
                    </span>
                    <span className="text-gray-500">
                      {formatUSDC(cat.amount)}{" "}
                      <span className="text-xs text-gray-400">
                        ({percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Total */}
            <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatUSDC(totalSpend)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
