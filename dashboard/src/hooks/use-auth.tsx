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
import { injected, coinbaseWallet } from "@wagmi/connectors";
import { createSiweMessage, generateNonce } from "@/lib/siwe";
import { createClient } from "@/lib/supabase";

type AuthMethod = "siwe" | null;

interface AuthContextValue {
  walletAddress: string | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  authMethod: AuthMethod;
  /** Connect with an injected wallet (MetaMask, etc.) via SIWE */
  connect: () => Promise<void>;
  /** Connect with Coinbase Smart Wallet (passkey-based, no extension) via SIWE */
  connectSmartWallet: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Unified wallet-based auth provider.
 *
 * Both power users (MetaMask) and new users (Coinbase Smart Wallet)
 * authenticate via SIWE. The wallet address IS the user's identity.
 * No email or password involved.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);

  // Sync wagmi state to our context
  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
      setAuthMethod("siwe");
      localStorage.setItem("clawsight_wallet", address);
      localStorage.setItem("clawsight_auth_method", "siwe");
    }
  }, [isConnected, address]);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem("clawsight_wallet");
    if (stored && !walletAddress) {
      setWalletAddress(stored);
      setAuthMethod("siwe");
    }
  }, [walletAddress]);

  /**
   * Core SIWE auth flow — shared by both connect methods.
   * Connects via the given wagmi connector, signs a SIWE message,
   * and creates a Supabase session + user row.
   */
  const connectWithConnector = useCallback(
    async (connector: ReturnType<typeof injected> | ReturnType<typeof coinbaseWallet>) => {
      setIsConnecting(true);
      try {
        const result = await connectAsync({ connector });
        const addr = result.accounts[0];

        // SIWE signature — send the exact string the wallet signed
        const nonce = generateNonce();
        const siweMessage = createSiweMessage(addr, nonce);
        const message = siweMessage.prepareMessage();
        const signature = await signMessageAsync({ message });

        // Verify SIWE server-side and get a signed JWT
        const res = await fetch("/v1/api/auth/siwe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            `SIWE authentication failed: ${body.error || res.statusText}`
          );
        }

        const { access_token } = await res.json();

        // Set Supabase session with the server-signed JWT
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: "",
        });

        if (error) {
          throw new Error(`Failed to set session: ${error.message}`);
        }

        // Create user row (wallet_address is the PK)
        await supabase.from("users").upsert(
          { wallet_address: addr.toLowerCase() },
          { onConflict: "wallet_address", ignoreDuplicates: true }
        );

        setWalletAddress(addr);
        setAuthMethod("siwe");
        localStorage.setItem("clawsight_wallet", addr);
        localStorage.setItem("clawsight_auth_method", "siwe");
      } catch (err) {
        console.error("[auth] Connection failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("eth_requestAccounts") ||
          msg.includes("No provider") ||
          msg.includes("window.ethereum")
        ) {
          throw new Error(
            "No wallet extension found. Please install MetaMask or another Ethereum wallet browser extension."
          );
        }
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectAsync, signMessageAsync]
  );

  // Connect with injected wallet (MetaMask, etc.)
  const connect = useCallback(
    () => connectWithConnector(injected()),
    [connectWithConnector]
  );

  // Connect with Coinbase Smart Wallet (passkey-based)
  const connectSmartWallet = useCallback(
    () =>
      connectWithConnector(
        coinbaseWallet({ appName: "ClawSight", preference: { options: "smartWalletOnly" } })
      ),
    [connectWithConnector]
  );

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
        connectSmartWallet,
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
