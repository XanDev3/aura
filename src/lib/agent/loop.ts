/**
 * AURA Agent Daemon — Railway entry point.
 *
 * Runs a tick every AGENT_TICK_INTERVAL_MS (default: 5 min).
 * Each tick is independently try/caught — a single failure never kills the loop.
 * Railway will auto-restart the process if it crashes entirely.
 */
import { runAgentTick } from "./agentRunner";

const TICK_INTERVAL_MS = parseInt(
  process.env.AGENT_TICK_INTERVAL_MS || String(5 * 60 * 1000) // 5 minutes
);

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
