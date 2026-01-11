import { createConfig, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(), // For ENS resolution
  },
  ssr: true,
});
