import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { trackX402Revenue } from "@/lib/tracking/revenue";
import { recordComputeCost } from "@/lib/tracking/compute";
import { readState, writeState, computeDerivedFields } from "@/lib/agent/state";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { HTTPRequestContext } from "@x402/core/server";
import { getAuthHeaders } from "@coinbase/cdp-sdk/auth";
import { estimatePrice, formatX402Price, MAX_QUERY_CHARS } from "@/lib/pricing/estimator";
import { analyzeTools } from "@/lib/agent/analyzeTools";

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

const ANALYZE_SYSTEM_PROMPT = `You are AURA, an expert DeFi analyst running on Base mainnet.

You have access to tools with LIVE data. Use them proactively:
- ANY question about yields, APY, interest rates, or DeFi opportunities → getDeFiYields
  (Covers all protocols: Aave, Aerodrome, Compound, Curve, and 1000+ more. Filter by chain/token/protocol as needed.)
- Questions about AURA's wallet, Aave position, earnings, compute costs, or sustainability → getAuraStatus

Never say you lack real-time access — you have it via these tools.
After fetching live data, provide insightful analysis: what the rates mean, how they compare, what risks exist, and what implications exist for DeFi strategy on Base. Be concise and accurate. Always note that DeFi carries risk.`;

// Body cache: populated by dynamicPrice(), read by handler().
// WeakMap ensures GC when the request goes out of scope — no memory leak.
// Required because context.adapter.getBody() consumes the body stream, preventing
// the handler from calling req.json() afterward.
const bodyCache = new WeakMap<
  NextRequest,
  { query: string; estimatedPrice: number; queryTruncated: boolean }
>();

/**
 * Dynamic price function for withX402.
 * Called on Phase 1 (402 quote) and Phase 2 (payment verification).
 * Reads the query body, caps at MAX_QUERY_CHARS, estimates Sonnet inference cost,
 * and caches the parsed body so handler() can read it without double-consuming the stream.
 */
const dynamicPrice = async (context: HTTPRequestContext): Promise<string> => {
  try {
    // Access the underlying NextRequest to use as WeakMap key.
    // context.adapter is NextAdapter with a private .req field — stable across @x402/next 2.x.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextReq = (context.adapter as any).req as NextRequest;
    const body = await context.adapter.getBody?.() as { query?: string } | undefined;
    const rawQuery = (typeof body?.query === "string" ? body.query : "").trim();
    const queryTruncated = rawQuery.length > MAX_QUERY_CHARS;
    // Cap to MAX_QUERY_CHARS — this is what will actually be sent to the model
    const query = rawQuery.slice(0, MAX_QUERY_CHARS);
    const price = estimatePrice(query);
    bodyCache.set(nextReq, { query, estimatedPrice: price, queryTruncated });
    return formatX402Price(price);
  } catch {
    // On any parse error, return floor price — handler will 400 on invalid body
    return formatX402Price(0.01);
  }
};

/**
 * POST /api/analyze
 * x402-gated DeFi analysis endpoint with dynamic per-query pricing.
 * Payment is validated by withX402 (Node.js runtime). Query length is capped at
 * MAX_QUERY_CHARS to prevent token-drain abuse regardless of what the client sends.
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  try {
    // Read from body cache populated by dynamicPrice() — body stream already consumed.
    const cached = bodyCache.get(req);
    bodyCache.delete(req); // cleanup: handler only runs once per settled request

    // query is already sliced to MAX_QUERY_CHARS by dynamicPrice()
    let query = cached?.query ?? "";
    const estimatedPrice = cached?.estimatedPrice ?? 0.01;
    const queryTruncated = cached?.queryTruncated ?? false;

    // Fallback if the WeakMap key access failed (e.g. private field renamed in future package version)
    if (!cached) {
      try {
        const body = await req.json();
        const raw = (typeof body?.query === "string" ? body.query : "").trim();
        query = raw.slice(0, MAX_QUERY_CHARS);
      } catch { /* ignore — validation below handles empty query */ }
    }

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
      system: ANALYZE_SYSTEM_PROMPT,
      prompt: `Analyze this DeFi topic: ${query}`,
      tools: analyzeTools,
      maxSteps: 5,
    });

    // Track actual dynamic revenue (not hardcoded $0.01)
    const newX402Total = await trackX402Revenue(estimatedPrice);

    // Record compute cost for this Sonnet call
    const { totalUsd } = await recordComputeCost({
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      model: "sonnet",
    });

    // Compute actual inference cost for transparency metrics
    const actualCost =
      (result.usage.promptTokens / 1_000_000) * 3.0 +
      (result.usage.completionTokens / 1_000_000) * 15.0;

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
      pricePaid: formatX402Price(estimatedPrice),
      estimatedCost: `$${actualCost.toFixed(5)}`,
      margin: `${(estimatedPrice / Math.max(actualCost, 0.0001)).toFixed(2)}x`,
      queryTruncated,
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
        price: dynamicPrice,
        network: "eip155:8453",
        payTo: process.env.AGENT_WALLET_ADDRESS!,
      },
    ],
    description: "AURA DeFi Analysis — dynamic pricing by query complexity",
    mimeType: "application/json",
  },
  x402Server
);
