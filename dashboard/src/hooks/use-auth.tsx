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

type AuthMethod = "siwe" | "email" | null;

interface AuthContextValue {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  authMethod: AuthMethod;
  connect: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<string>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider supporting two authentication methods:
 *
 * 1. SIWE (Sign-In with Ethereum) — for power users with existing wallets
 * 2. Email + password — for normie users, paired with an auto-generated agent wallet
 *
 * Both methods store wallet_address in Supabase user_metadata so downstream
 * code (RLS, API routes) works identically regardless of auth method.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);

  // Sync wagmi state to our context (SIWE users)
  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
      setAuthMethod("siwe");
      localStorage.setItem("clawsight_wallet", address);
      localStorage.setItem("clawsight_auth_method", "siwe");
    }
  }, [isConnected, address]);

  // Restore session on mount — check localStorage first, then Supabase session
  useEffect(() => {
    const stored = localStorage.getItem("clawsight_wallet");
    const method = localStorage.getItem("clawsight_auth_method") as AuthMethod;
    if (stored && !walletAddress) {
      setWalletAddress(stored);
      setAuthMethod(method || null);
    }

    // Also check Supabase session for email users whose localStorage may be cleared
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.wallet_address && !stored) {
        const addr = user.user_metadata.wallet_address as string;
        setWalletAddress(addr);
        setAuthMethod("email");
        localStorage.setItem("clawsight_wallet", addr);
        localStorage.setItem("clawsight_auth_method", "email");
      }
    };
    checkSession();
  }, [walletAddress]);

  // SIWE connect flow (power users)
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const result = await connectAsync({ connector: injected() });
      const addr = result.accounts[0];

      const nonce = generateNonce();
      const siweMessage = createSiweMessage(addr, nonce);
      const message = siweMessage.prepareMessage();
      const signature = await signMessageAsync({ message });

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google" as never,
        token: JSON.stringify({
          message: siweMessage.toMessage(),
          signature,
          wallet_address: addr,
        }),
      });

      if (error) {
        throw new Error(`SIWE authentication failed: ${error.message}`);
      }

      await supabase.from("users").upsert(
        { wallet_address: addr },
        { onConflict: "wallet_address", ignoreDuplicates: true }
      );

      setWalletAddress(addr);
      setAuthMethod("siwe");
      localStorage.setItem("clawsight_wallet", addr);
      localStorage.setItem("clawsight_auth_method", "siwe");
    } catch (err) {
      console.error("[auth] Connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, signMessageAsync]);

  // Email signup flow (new users)
  // 1. Creates a CDP-managed wallet via server API
  // 2. Creates Supabase auth account with the wallet address
  // 3. Creates user row
  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<string> => {
    setIsConnecting(true);
    try {
      // Step 1: Create CDP wallet via server route
      const walletRes = await fetch("/v1/api/wallet/create", { method: "POST" });
      if (!walletRes.ok) {
        const body = await walletRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create agent wallet");
      }
      const { address: walletAddr } = await walletRes.json();

      // Step 2: Create Supabase auth account
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { wallet_address: walletAddr },
        },
      });

      if (error) {
        throw new Error(`Sign up failed: ${error.message}`);
      }

      // Step 3: Create user row with the CDP wallet address
      await supabase.from("users").upsert(
        { wallet_address: walletAddr },
        { onConflict: "wallet_address", ignoreDuplicates: true }
      );

      setWalletAddress(walletAddr);
      setAuthMethod("email");
      localStorage.setItem("clawsight_wallet", walletAddr);
      localStorage.setItem("clawsight_auth_method", "email");
      localStorage.setItem("clawsight_agent_wallet_address", walletAddr);

      return walletAddr;
    } catch (err) {
      console.error("[auth] Email signup failed:", err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Email sign-in flow (returning email users)
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setIsConnecting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`Sign in failed: ${error.message}`);
      }

      const addr = data.user?.user_metadata?.wallet_address as string;
      if (!addr) {
        throw new Error("No wallet address associated with this account");
      }

      setWalletAddress(addr);
      setAuthMethod("email");
      localStorage.setItem("clawsight_wallet", addr);
      localStorage.setItem("clawsight_auth_method", "email");
    } catch (err) {
      console.error("[auth] Email signin failed:", err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setWalletAddress(null);
    setAuthMethod(null);
    localStorage.removeItem("clawsight_wallet");
    localStorage.removeItem("clawsight_auth_method");
    localStorage.removeItem("clawsight_onboarded");
    createClient().auth.signOut();
  }, [wagmiDisconnect]);

  const signMsg = useCallback(
    async (message: string): Promise<string> => {
      if (!isConnected) {
        throw new Error("Wallet not connected. Cannot sign message.");
      }
      return signMessageAsync({ message });
    },
    [isConnected, signMessageAsync]
  );

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        isAuthenticated: !!walletAddress,
        isConnecting,
        authMethod,
        connect,
        signUpWithEmail,
        signInWithEmail,
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
