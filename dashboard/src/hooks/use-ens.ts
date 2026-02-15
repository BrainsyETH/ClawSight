"use client";

import { useEffect, useState } from "react";

interface EnsData {
  name: string | null;
  avatar: string | null;
  loading: boolean;
}

/**
 * Resolve ENS name and avatar for a wallet address.
 * Uses the Ethereum mainnet ENS registry via public RPC.
 * Falls back gracefully if ENS is not available.
 */
export function useEns(address?: string | null): EnsData {
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    setLoading(true);

    async function resolve() {
      try {
        // Use public ENS API for resolution
        const res = await fetch(
          `https://api.ensideas.com/ens/resolve/${address}`
        );
        if (!res.ok) throw new Error("ENS lookup failed");

        const data = await res.json();

        if (!cancelled) {
          setName(data.name || null);
          setAvatar(data.avatar || null);
        }
      } catch {
        // ENS resolution is optional — fail silently
        if (!cancelled) {
          setName(null);
          setAvatar(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { name, avatar, loading };
}

/**
 * Format a wallet address with ENS name if available.
 * Returns "vitalik.eth" or "0x1a2b...3c4d"
 */
export function formatAddressOrEns(
  address: string,
  ensName?: string | null
): string {
  if (ensName) return ensName;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
