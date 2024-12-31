"use client";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import { sepolia } from "@/utils/sepolia";
import { WagmiProvider } from "wagmi";

const config = getDefaultConfig({
  appName: "OpenTask",
  projectId: "9292829e9db6cbc5a6dd8e50334ed502",
  chains: [sepolia],
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
