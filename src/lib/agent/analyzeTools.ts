/**
 * Read-only tools for the /api/analyze endpoint.
 *
 * IMPORTANT: Do NOT import from tools.ts — it contains write/transaction tools
 * that must never be exposed to the public analyze endpoint.
 */

import { tool } from "ai";
import { z } from "zod";
import { readState } from "./state";

interface DeFiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
}

interface DeFiLlamaResponse {
  data: DeFiLlamaPool[];
}

export const analyzeTools = {
  getDeFiYields: tool({
    description:
      "Fetch live DeFi yield opportunities from DeFiLlama. Returns APY, TVL, and protocol data for pools matching your criteria. Use for ANY question about yields, APY, interest rates, or DeFi opportunities — not just Aave. Covers Aave, Aerodrome, Compound, Curve, and 1000+ other protocols.",
    parameters: z.object({
      chain: z
        .string()
        .optional()
        .describe(
          "Chain filter, e.g. 'Base', 'Ethereum'. Defaults to 'Base'."
        ),
      token: z
        .string()
        .optional()
        .describe(
          "Token symbol filter, e.g. 'USDC', 'ETH'. Filters pools whose symbol contains this string. Optional."
        ),
      protocol: z
        .string()
        .optional()
        .describe(
          "Protocol slug filter, e.g. 'aave-v3', 'aerodrome-finance'. Optional — omit to get top opportunities across all protocols on the chain."
        ),
      topN: z
        .number()
        .optional()
        .describe("Maximum number of results to return. Defaults to 5."),
    }),
    execute: async ({ chain = "Base", token, protocol, topN = 5 }) => {
      try {
        const res = await fetch("https://yields.llama.fi/pools", {
          headers: { Accept: "application/json" },
          // Next.js fetch cache: revalidate every 5 minutes
          next: { revalidate: 300 },
        } as RequestInit);

        if (!res.ok) {
          return {
            error: `DeFiLlama API returned ${res.status}. Try again shortly.`,
          };
        }

        const json = (await res.json()) as DeFiLlamaResponse;
        const allPools = json.data ?? [];

        const filtered = allPools
          .filter((p) => {
            if (p.chain !== chain) return false;
            if (token && !p.symbol.toUpperCase().includes(token.toUpperCase()))
              return false;
            if (protocol && p.project !== protocol) return false;
            if (p.apy === null || p.apy < 0) return false;
            return true;
          })
          .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
          .slice(0, topN)
          .map((p) => ({
            protocol: p.project,
            chain: p.chain,
            symbol: p.symbol,
            apy: p.apy,
            apyBase: p.apyBase,
            apyReward: p.apyReward,
            tvlUsd: p.tvlUsd,
            poolId: p.pool,
          }));

        return {
          pools: filtered,
          totalFound: filtered.length,
          filters: { chain, token, protocol, topN },
          dataSource: "DeFiLlama yields API",
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          error: "Failed to fetch DeFiLlama data. Try again shortly.",
          details: String(err),
        };
      }
    },
  }),

  getAuraStatus: tool({
    description:
      "Get AURA's current agent status from cached state: wallet balances (USDC + ETH), Aave V3 position (deposited, current value, APY, yield earned), compute costs, x402 revenue, and self-sustainability metrics. Use when asked about AURA's own state, funds, earnings, or performance. Data is at most 5 minutes stale (updated each agent tick).",
    parameters: z.object({}),
    execute: async () => {
      try {
        const state = await readState();
        return {
          walletAddress: state.walletAddress,
          liquidUsdcBalance: state.liquidUsdcBalance,
          ethBalance: state.ethBalance,
          aavePosition: state.aavePosition,
          isSelfSustaining: state.isSelfSustaining,
          netPnlUsd: state.netPnlUsd,
          x402RevenueUsd: state.x402RevenueUsd,
          yieldRevenueTotalUsd: state.yieldRevenueTotalUsd,
          totalRevenueUsd: state.totalRevenueUsd,
          computeCostTotalUsd: state.computeCostTotalUsd,
          totalTicks: state.totalTicks,
          lastTickAt: state.lastTickAt,
          runwayHours: state.runwayHours,
          dataSource: "Vercel KV (updated each agent tick, ~5min cadence)",
        };
      } catch (err) {
        return {
          error: "Failed to read AURA agent state.",
          details: String(err),
        };
      }
    },
  }),
};
