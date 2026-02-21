import { NextResponse } from "next/server";
import { readState, checkIsPaused } from "@/lib/agent/state";
import { readDecisionLogs } from "@/lib/storage/zero-g";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats
 * Returns the full AgentState from Vercel KV plus live isPaused flag.
 * Decision logs are stored separately in aura:zg:logs (written by logDecision tool)
 * and merged here into the response.
 * Called by the dashboard every 30 seconds.
 */
export async function GET() {
  try {
    const [state, isPaused, decisionLog] = await Promise.all([
      readState(),
      checkIsPaused(),
      readDecisionLogs(10),
    ]);
    return NextResponse.json({ ...state, isPaused, decisionLog }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[/api/stats] Error reading state:", err);
    return NextResponse.json(
      { error: "Failed to read agent state" },
      { status: 500 }
    );
  }
}
