"use client";

import { useState, useEffect } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

// USDC on Base L2
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const client = createPublicClient({
  chain: base,
  transport: http(),
});

interface WalletBalanceState {
  balance: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Read on-chain USDC balance on Base L2 using viem.
 * Polls every 30 seconds while mounted.
 */
export function useWalletBalance(walletAddress?: string | null): WalletBalanceState {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchBalance() {
      setLoading(true);
      setError(null);
      try {
        const raw = await client.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        });
        if (!cancelled) {
          // USDC has 6 decimals
          setBalance(parseFloat(formatUnits(raw, 6)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to read balance");
          // Keep previous balance on error
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBalance();

    // Poll every 30 seconds
    const interval = setInterval(fetchBalance, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [walletAddress, tick]);

  return { balance, loading, error, refetch };
}
