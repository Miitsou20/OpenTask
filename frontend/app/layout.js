import RainbowKitAndWagmiProvider from "./RainbowKitAndWagmiProvider";
import { Inter as FontSans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/shared/Layout";
import { cn } from "@/lib/utils";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "OpenTask",
  description: "OpenTask is a decentralized marketplace for tasks and services built on the Ethereum blockchain. It connects task providers with developers and auditors in a trustless environment.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <RainbowKitAndWagmiProvider>
          <Layout>{children}</Layout>
          <Toaster />
        </RainbowKitAndWagmiProvider>
      </body>
    </html>
  );
}
