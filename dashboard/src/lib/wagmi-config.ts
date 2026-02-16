import { http, createConfig } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { injected, walletConnect } from "@wagmi/connectors";

/**
 * Wagmi config — intentionally does NOT include coinbaseWallet()
 * in the global connectors list. Including it causes the Coinbase
 * SDK to auto-reconnect on page load, which triggers a popup before
 * the user takes any action.
 *
 * Instead, coinbaseWallet() is created on-demand in use-auth.tsx
 * when the user clicks "Sign In with Smart Wallet".
 */
export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: [
    injected(),
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
          }),
        ]
      : []),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});
