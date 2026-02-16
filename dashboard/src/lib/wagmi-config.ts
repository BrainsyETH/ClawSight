import { http, createConfig } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { injected, coinbaseWallet, walletConnect } from "@wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "ClawSight",
      preference: { options: "smartWalletOnly" },
    }),
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
