import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { trackX402Revenue } from "@/lib/tracking/revenue";
import { recordComputeCost } from "@/lib/tracking/compute";
import { readState, writeState, computeDerivedFields } from "@/lib/agent/state";

/**
 * POST /api/analyze
 * x402-gated DeFi analysis endpoint.
 * Payment is validated by middleware.ts BEFORE this handler executes.
 * Uses Claude Sonnet for quality analysis (this is a paid endpoint).
 */
export async function POST(req: Request) {
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

    // Track x402 revenue — $0.01 per request (matches middleware price)
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
