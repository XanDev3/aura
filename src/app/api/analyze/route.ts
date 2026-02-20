import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { trackX402Revenue } from "@/lib/tracking/revenue";
import { recordComputeCost } from "@/lib/tracking/compute";
import { readState, writeState, computeDerivedFields } from "@/lib/agent/state";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { getAuthHeaders } from "@coinbase/cdp-sdk/auth";

// Build CDP JWT auth headers for each x402 facilitator endpoint.
// HTTPFacilitatorClient does NOT auto-detect CDP credentials — must be explicit.
async function buildCdpAuthHeaders() {
  const apiKeyId = process.env.CDP_API_KEY_ID!;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET!;
  const host = "api.cdp.coinbase.com";
  const base = "/platform/v2/x402";
  const [verify, settle, supported] = await Promise.all([
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "POST", requestHost: host, requestPath: `${base}/verify` }),
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "POST", requestHost: host, requestPath: `${base}/settle` }),
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "GET",  requestHost: host, requestPath: `${base}/supported` }),
  ]);
  return { verify, settle, supported };
}

// x402 server initialized here (Node.js runtime) instead of middleware.ts (Edge Runtime).
// Edge Runtime lacks the Node.js crypto APIs required by @x402/evm.
const facilitatorClient = new HTTPFacilitatorClient({
  url:
    process.env.X402_FACILITATOR_URL ||
    "https://api.cdp.coinbase.com/platform/v2/x402",
  createAuthHeaders: buildCdpAuthHeaders,
});

const x402Server = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453",
  new ExactEvmScheme()
);

/**
 * POST /api/analyze
 * x402-gated DeFi analysis endpoint.
 * Payment is validated by withX402 wrapper (runs in Node.js runtime, not Edge).
 * Uses Claude Sonnet for quality analysis (this is a paid endpoint).
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const body = await req.json();
    const query: string = body?.query ?? "";

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: "query field is required and must be at least 3 characters" },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: anthropic(
        process.env.AGENT_ANALYSIS_MODEL || "claude-sonnet-4-5"
      ),
      system:
        "You are AURA, an expert DeFi analyst running on Base mainnet. Provide concise, accurate analysis of DeFi topics. Focus on current yields, protocols, and strategies relevant to Base. Always note that DeFi carries risks.",
      prompt: `Analyze this DeFi topic: ${query}`,
      maxSteps: 1,
    });

    // Track x402 revenue — $0.01 per request (matches route price)
    const newX402Total = await trackX402Revenue(0.01);

    // Record compute cost for this Sonnet call
    const { totalUsd } = await recordComputeCost({
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      model: "sonnet",
    });

    // Update KV state to reflect the new revenue
    const state = await readState();
    const updatedState = computeDerivedFields({
      ...state,
      x402RevenueUsd: newX402Total,
      computeCostTotalUsd: totalUsd,
    });
    await writeState(updatedState);

    return NextResponse.json({
      analysis: result.text,
      model: process.env.AGENT_ANALYSIS_MODEL || "claude-sonnet-4-5",
      tokensUsed: result.usage.promptTokens + result.usage.completionTokens,
    });
  } catch (err) {
    console.error("[/api/analyze] Error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}

export const POST = withX402(
  handler,
  {
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
  x402Server
);
