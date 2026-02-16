"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected, coinbaseWallet } from "@wagmi/connectors";
import { createSiweMessage } from "@/lib/siwe";
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

/** How long before JWT expiry to trigger a silent re-auth (5 minutes). */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Unified wallet-based auth provider.
 *
 * Both power users (MetaMask) and new users (Coinbase Smart Wallet)
 * authenticate via SIWE. The wallet address IS the user's identity.
 *
 * Session persistence:
 * - JWT is stored in Supabase httpOnly cookies via @supabase/ssr
 * - On mount, we validate the existing Supabase session JWT
 * - If the JWT is expired but the wallet is still connected via wagmi,
 *   we silently re-authenticate with SIWE (no user interaction needed
 *   since the wallet connector is already approved)
 * - A timer refreshes the session before the 1-hour JWT expires
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRestored = useRef(false);

  /**
   * Perform SIWE auth against the server and set the Supabase session.
   * Returns the expiry timestamp (ms) of the new JWT, or null on failure.
   */
  const authenticateWithSiwe = useCallback(
    async (addr: string): Promise<number | null> => {
      // Fetch server-issued nonce (prevents replay attacks)
      const nonceRes = await fetch("/v1/api/auth/nonce");
      if (!nonceRes.ok) return null;
      const { nonce } = await nonceRes.json();
      const siweMessage = createSiweMessage(addr, nonce);
      const message = siweMessage.prepareMessage();
      const signature = await signMessageAsync({ message });

      const res = await fetch("/v1/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!res.ok) return null;

      const { access_token, refresh_token, expires_in } = await res.json();

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) return null;

      // Create user row if needed
      await supabase.from("users").upsert(
        { wallet_address: addr.toLowerCase() },
        { onConflict: "wallet_address", ignoreDuplicates: true }
      );

      return Date.now() + (expires_in || 3600) * 1000;
    },
    [signMessageAsync]
  );

  /**
   * Schedule a silent re-auth before the JWT expires.
   */
  const scheduleRefresh = useCallback(
    (expiresAt: number, addr: string) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      const delay = Math.max(expiresAt - Date.now() - REFRESH_BUFFER_MS, 30_000);
      refreshTimer.current = setTimeout(async () => {
        try {
          const newExpiry = await authenticateWithSiwe(addr);
          if (newExpiry) {
            scheduleRefresh(newExpiry, addr);
          }
        } catch {
          // Silent failure — user will need to re-auth manually on next API call
        }
      }, delay);
    },
    [authenticateWithSiwe]
  );

  // Restore session on mount: check if Supabase session is still valid
  useEffect(() => {
    if (sessionRestored.current) return;
    sessionRestored.current = true;

    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        // Decode JWT to check expiry and extract wallet
        try {
          const [, payloadB64] = session.access_token.split(".");
          const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
          const wallet =
            payload.wallet_address ??
            payload.user_metadata?.wallet_address ??
            null;
          const exp = (payload.exp || 0) * 1000;

          if (wallet && exp > Date.now()) {
            // Session is still valid
            setWalletAddress(wallet);
            setAuthMethod("siwe");
            localStorage.setItem("clawsight_wallet", wallet);
            scheduleRefresh(exp, wallet);
            return;
          }
        } catch {
          // Malformed JWT — fall through to re-auth
        }
      }

      // No valid session — try silent re-auth if wallet is connected via wagmi
      if (isConnected && address) {
        try {
          const expiry = await authenticateWithSiwe(address);
          if (expiry) {
            setWalletAddress(address);
            setAuthMethod("siwe");
            localStorage.setItem("clawsight_wallet", address);
            scheduleRefresh(expiry, address);
            return;
          }
        } catch {
          // Re-auth failed — wallet may require user approval again
        }
      }

      // Last resort: show stored wallet address so UI doesn't flash
      const storedWallet = localStorage.getItem("clawsight_wallet");
      if (storedWallet) {
        setWalletAddress(storedWallet);
        setAuthMethod("siwe");
      }
    })();
  }, [isConnected, address, authenticateWithSiwe, scheduleRefresh]);

  // When wagmi reconnects (e.g. page reload with persistent connector),
  // sync state and refresh JWT if needed
  useEffect(() => {
    if (isConnected && address && !walletAddress) {
      (async () => {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          try {
            const expiry = await authenticateWithSiwe(address);
            if (expiry) {
              setWalletAddress(address);
              setAuthMethod("siwe");
              localStorage.setItem("clawsight_wallet", address);
              scheduleRefresh(expiry, address);
            }
          } catch {
            // Will need manual reconnect
          }
        } else {
          setWalletAddress(address);
          setAuthMethod("siwe");
          localStorage.setItem("clawsight_wallet", address);
        }
      })();
    }
  }, [isConnected, address, walletAddress, authenticateWithSiwe, scheduleRefresh]);

  // Clean up refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  /**
   * Core SIWE auth flow — shared by both connect methods.
   */
  const connectWithConnector = useCallback(
    async (connector: ReturnType<typeof injected> | ReturnType<typeof coinbaseWallet>) => {
      setIsConnecting(true);
      try {
        const result = await connectAsync({ connector });
        const addr = result.accounts[0];

        const expiry = await authenticateWithSiwe(addr);
        if (!expiry) {
          throw new Error("SIWE authentication failed");
        }

        setWalletAddress(addr);
        setAuthMethod("siwe");
        localStorage.setItem("clawsight_wallet", addr);
        localStorage.setItem("clawsight_auth_method", "siwe");
        scheduleRefresh(expiry, addr);
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
    [connectAsync, authenticateWithSiwe, scheduleRefresh]
  );

  const connect = useCallback(
    () => connectWithConnector(injected()),
    [connectWithConnector]
  );

  const connectSmartWallet = useCallback(
    () =>
      connectWithConnector(
        coinbaseWallet({ appName: "ClawSight", preference: { options: "smartWalletOnly" } })
      ),
    [connectWithConnector]
  );

  const disconnect = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    // Clear local state first so the UI updates immediately
    setWalletAddress(null);
    setAuthMethod(null);
    localStorage.removeItem("clawsight_wallet");
    localStorage.removeItem("clawsight_auth_method");
    localStorage.removeItem("clawsight_onboarded");
    localStorage.removeItem("clawsight_agent_wallet_address");

    // Sign out from Supabase (non-blocking)
    createClient().auth.signOut().catch(() => {});

    // Disconnect wagmi last — wrapped in try/catch because
    // Coinbase Smart Wallet may trigger a passkey prompt on
    // disconnect, and if the user cancels it we still want
    // the sign-out to complete.
    try {
      wagmiDisconnect();
    } catch {
      // Ignored — local state is already cleared
    }
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
