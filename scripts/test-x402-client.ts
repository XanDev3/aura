/**
 * AURA x402 Test Client
 *
 * Simulates an AI agent paying AURA for DeFi analysis via the x402 protocol.
 * Uses @x402/fetch (client-side payment) + @x402/evm (EVM signing via EIP-3009).
 *
 * Usage:
 *   npm run test:x402
 *
 * Prerequisites:
 *   - AURA dashboard must be deployed on Vercel (VERCEL_URL set in .env.local)
 *   - Agent wallet must be funded with USDC on Base mainnet
 *   - CDP credentials must be set for mainnet facilitator
 */

import "dotenv/config";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

async function main() {
  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) {
    console.error("Error: VERCEL_URL not set in .env.local");
    console.error("Set it to your deployed Vercel URL, e.g. https://aura-agent.vercel.app");
    process.exit(1);
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("Error: AGENT_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });

  console.log(`[x402 Test] Client wallet: ${account.address}`);
  console.log(`[x402 Test] Target: ${vercelUrl}/api/analyze`);

  // Set up x402 client with EVM payment scheme
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: {
      address: account.address,
      signMessage: async ({ message }: { message: string | Uint8Array }) => {
        const msgStr = typeof message === "string" ? message : Buffer.from(message).toString("hex");
        return walletClient.signMessage({ message: msgStr });
      },
      // EIP-3009 authorization signing for gasless USDC transfer
      signTypedData: async (typedData: Parameters<typeof walletClient.signTypedData>[0]) => {
        return walletClient.signTypedData(typedData);
      },
    },
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const queries = [
    "What is the current Aave USDC supply APY on Base mainnet?",
    "Compare yield opportunities on Base: Aave vs other protocols",
    "What are the risks of supplying USDC to Aave V3 on Base?",
  ];

  for (const query of queries) {
    console.log(`\n[x402 Test] Query: "${query}"`);

    try {
      const response = await fetchWithPayment(
        `${vercelUrl}/api/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[x402 Test] HTTP ${response.status}: ${errText}`);
        continue;
      }

      const data = await response.json() as { analysis: string; tokensUsed: number };
      console.log(`[x402 Test] ✓ Paid 0.01 USDC. Response (${data.tokensUsed} tokens):`);
      console.log(data.analysis.slice(0, 300) + (data.analysis.length > 300 ? "..." : ""));
    } catch (err) {
      console.error(`[x402 Test] Error:`, err);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n[x402 Test] Done. Check /api/stats to see updated x402 revenue.");
}

main().catch((err) => {
  console.error("[x402 Test] Fatal error:", err);
  process.exit(1);
});
