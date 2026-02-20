import { NextResponse } from "next/server";
import { readState } from "@/lib/agent/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats
 * Returns the full AgentState from Vercel KV.
 * Called by the dashboard every 30 seconds.
 */
export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json(state, {
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
