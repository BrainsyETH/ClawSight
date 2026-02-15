"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            {error.message || "An unexpected error occurred while loading the dashboard."}
          </p>

          {error.digest && (
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          <Button onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
