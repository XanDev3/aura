/**
 * AURA Agent Daemon — Railway entry point.
 *
 * Runs a tick every AGENT_TICK_INTERVAL_MS (default: 5 min).
 * Each tick is independently try/caught — a single failure never kills the loop.
 * Railway will auto-restart the process if it crashes entirely.
 */
import { runAgentTick } from "./agentRunner";
import { checkIsPaused } from "./state";

// ---------------------------------------------------------------------------
// FUTURE: Option 2 — Adaptive Backoff (TODO when time permits)
// See also: PROGRESS.md "Future Work" section for the full plan.
// ---------------------------------------------------------------------------
// Instead of a fixed 5-min interval, slow down ticking when idle:
//   1. In revenue.ts `trackX402Revenue()`, add: kv.set("aura:last_x402_at", Date.now())
//   2. Replace `setInterval` below with a recursive `setTimeout`
//   3. After each tick, read `aura:last_x402_at`:
//        - If < 1h ago  → next tick in TICK_INTERVAL_MS (5 min, normal)
//        - If ≥ 1h ago  → next tick in 30 * 60 * 1000 ms (30 min, idle)
//   4. Log the chosen interval so Railway logs show the backoff clearly.
// Estimated savings: ~$0.72/day during idle vs current fixed-interval.
// ---------------------------------------------------------------------------

// Accept AGENT_INTERVAL_MINUTES (from .env.example) or AGENT_TICK_INTERVAL_MS (in ms)
const TICK_INTERVAL_MS = process.env.AGENT_TICK_INTERVAL_MS
  ? parseInt(process.env.AGENT_TICK_INTERVAL_MS)
  : parseInt(process.env.AGENT_INTERVAL_MINUTES || "5") * 60 * 1000;

async function loop() {
  console.log(`[AURA Loop] Starting. Tick interval: ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`[AURA Loop] Wallet: ${process.env.AGENT_WALLET_ADDRESS}`);

  // Run first tick immediately on startup
  await safeTick();

  // Then schedule recurring ticks
  setInterval(safeTick, TICK_INTERVAL_MS);
}

async function safeTick() {
  try {
    if (await checkIsPaused()) {
      console.log("[AURA Loop] Agent is paused (aura:paused=true in KV). Skipping tick.");
      return;
    }
    const result = await runAgentTick();
    if (!result.success) {
      console.error(`[AURA Loop] Tick #${result.tick} failed: ${result.error}`);
    }
  } catch (err) {
    // Belt-and-suspenders: runAgentTick already catches internally,
    // but we catch here too to ensure the interval never dies.
    console.error("[AURA Loop] Unexpected error in safeTick:", err);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[AURA Loop] SIGTERM received — shutting down cleanly.");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[AURA Loop] SIGINT received — shutting down cleanly.");
  process.exit(0);
});

loop().catch((err) => {
  console.error("[AURA Loop] Fatal error in loop startup:", err);
  process.exit(1);
});
