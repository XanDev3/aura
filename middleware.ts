import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

// CDP facilitator for Base mainnet — requires cdp.coinbase.com credentials
// For local/testnet development, swap to: "https://www.x402.org/facilitator"
const facilitatorClient = new HTTPFacilitatorClient({
  url:
    process.env.X402_FACILITATOR_URL ||
    "https://api.cdp.coinbase.com/platform/v2/x402",
  // CDP API key auth is injected by the facilitator SDK from env vars automatically
});

// Register Base mainnet (chain ID 8453) with the exact payment scheme
const server = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453",
  new ExactEvmScheme()
);

export const middleware = paymentProxy(
  {
    "/api/analyze": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: "eip155:8453",
          payTo: process.env.AGENT_WALLET_ADDRESS!,
        },
      ],
      description: "AURA DeFi Analysis — 0.01 USDC per query",
      mimeType: "application/json",
    },
  },
  server
);

export const config = {
  matcher: ["/api/analyze/:path*"],
};
