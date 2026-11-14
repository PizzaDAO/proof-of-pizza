import { base, mainnet } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { createWalletConnectors } from "@/lib/wallet/connectors";

// No WalletConnect / Reown project ID: see lib/wallet/connectors.ts.
export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: createWalletConnectors({
    name: "Proof of Pizza",
    url: "https://proofof.pizza",
    icon: "https://proofof.pizza/pizzadao-logo.png",
  }),
  transports: {
    [base.id]: http(),
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com", { batch: false }),
  },
  ssr: true,
});
