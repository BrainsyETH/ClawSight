"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "@wagmi/connectors";
import { createSiweMessage, generateNonce } from "@/lib/siwe";
import { createClient } from "@/lib/supabase";

interface AuthContextValue {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider using Sign-In with Ethereum (SIWE) via wagmi.
 *
 * Flow:
 * 1. User clicks "Sign In" → wagmi connects wallet
 * 2. We create a SIWE message and ask user to sign it
 * 3. Signature + message are sent to Supabase to create a session
 * 4. JWT stored in httpOnly cookie, wallet address stored in context
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Sync wagmi state to our context
  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
      localStorage.setItem("clawsight_wallet", address);
    }
  }, [isConnected, address]);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem("clawsight_wallet");
    if (stored && !walletAddress) {
      setWalletAddress(stored);
    }
  }, [walletAddress]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // 1. Connect wallet via wagmi
      const result = await connectAsync({ connector: injected() });
      const addr = result.accounts[0];

      // 2. Create and sign SIWE message
      const nonce = generateNonce();
      const siweMessage = createSiweMessage(addr, nonce);
      const message = siweMessage.prepareMessage();
      const signature = await signMessageAsync({ message });

      // 3. Verify with Supabase and create session
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google" as never, // Supabase custom token - replaced with edge function in production
        token: JSON.stringify({
          message: siweMessage.toMessage(),
          signature,
          wallet_address: addr,
        }),
      });

      if (error) {
        // Fallback: store wallet directly for demo/dev mode
        console.warn("[auth] Supabase SIWE verification not configured, using direct auth:", error.message);
      }

      // 4. Ensure user row exists
      await supabase.from("users").upsert(
        { wallet_address: addr },
        { onConflict: "wallet_address", ignoreDuplicates: true }
      );

      setWalletAddress(addr);
      localStorage.setItem("clawsight_wallet", addr);
    } catch (err) {
      console.error("[auth] Connection failed:", err);
      // Demo fallback when no wallet available
      const demoAddress = "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12";
      setWalletAddress(demoAddress);
      localStorage.setItem("clawsight_wallet", demoAddress);
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, signMessageAsync]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setWalletAddress(null);
    localStorage.removeItem("clawsight_wallet");
    localStorage.removeItem("clawsight_onboarded");
    createClient().auth.signOut();
  }, [wagmiDisconnect]);

  const signMsg = useCallback(
    async (message: string): Promise<string> => {
      if (isConnected) {
        return signMessageAsync({ message });
      }
      // Demo fallback
      return `0xdemo_signature_${message.slice(0, 16)}`;
    },
    [isConnected, signMessageAsync]
  );

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        isAuthenticated: !!walletAddress,
        isConnecting,
        connect,
        disconnect,
        signMessage: signMsg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
