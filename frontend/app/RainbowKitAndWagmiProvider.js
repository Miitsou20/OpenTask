"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { hardhat , sepolia, polygon } from "wagmi/chains";
// import { sepolia, hardhat, polygon } from "@/utils/sepolia";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: "OpenTask",
  projectId: "9292829e9db6cbc5a6dd8e50334ed502",
  chains: [
    {
      ...hardhat,
      rpcUrls: {
        default: {
          http: ['http://127.0.0.1:8545'],
        },
        public: {
          http: ['http://127.0.0.1:8545'],
        },
      },
    },
    sepolia,
    polygon
  ],
  ssr: true
});

const queryClient = new QueryClient({});

const RainbowKitAndWagmiProvider = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default RainbowKitAndWagmiProvider;
