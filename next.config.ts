import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the agent loop to import Node.js-only modules
  serverExternalPackages: ["@0glabs/0g-ts-sdk", "ethers"],
  // Expose only safe public env vars to the browser
  env: {
    NEXT_PUBLIC_AGENT_WALLET_ADDRESS: process.env.AGENT_WALLET_ADDRESS ?? "",
    NEXT_PUBLIC_BASE_EXPLORER: "https://basescan.org",
  },
};

export default nextConfig;
