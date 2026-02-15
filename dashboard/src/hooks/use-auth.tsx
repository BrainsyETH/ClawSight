"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

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
 * Auth provider using Sign-In with Ethereum (SIWE).
 *
 * In production, this integrates with wagmi/viem for wallet connection
 * and Supabase for session management. For now, it uses localStorage
 * to simulate auth state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("clawsight_wallet");
    if (stored) setWalletAddress(stored);
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Production: use wagmi's useConnect + useSignMessage
      // const { address } = await connectAsync({ connector: injected() });
      // const message = createSiweMessage({ address, ... });
      // const signature = await signMessageAsync({ message });
      // const { data } = await supabase.auth.signInWithIdToken({ ... });

      // For now, simulate connection
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];
        const address = accounts[0];
        setWalletAddress(address);
        localStorage.setItem("clawsight_wallet", address);
      } else {
        // Demo fallback
        const demoAddress = "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12";
        setWalletAddress(demoAddress);
        localStorage.setItem("clawsight_wallet", demoAddress);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
    localStorage.removeItem("clawsight_wallet");
    localStorage.removeItem("clawsight_onboarded");
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (typeof window !== "undefined" && window.ethereum && walletAddress) {
        return (await window.ethereum.request({
          method: "personal_sign",
          params: [message, walletAddress],
        })) as string;
      }
      // Demo fallback: return a deterministic fake signature
      return `0xdemo_signature_${message.slice(0, 16)}`;
    },
    [walletAddress]
  );

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        isAuthenticated: !!walletAddress,
        isConnecting,
        connect,
        disconnect,
        signMessage,
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

// Extend Window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
