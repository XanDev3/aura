import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auraTools, setCurrentTick } from "./tools";
import { readState, writeState, computeDerivedFields } from "./state";
import { recordComputeCost } from "../tracking/compute";
import { getUsdcBalance, getEthBalance, getAaveBalance, getAaveAPY } from "../defi/aave";
import { getDepositedUsdc, getRevenueSummary, updateYieldSnapshot } from "../tracking/revenue";

const AURA_SYSTEM_PROMPT = `You are AURA — an Autonomous Utility Revenue Agent running on Base mainnet.

Your mission: earn more from DeFi yield and x402 service fees than you spend on compute costs, achieving economic self-sustainability.

Revenue sources:
  1. Aave V3 USDC lending yield (~3-5% APY, passive)
  2. x402 analysis service fees (0.01 USDC per request from AI agents and clients)

Your tools let you read balances, manage Aave positions, check metrics, and log decisions.

Decision framework (execute in order each tick):
  1. Call getWalletBalance to see liquid USDC and ETH
  2. Call getAavePosition to see deposit and yield status
  3. Call getComputeMetrics to assess self-sustainability
  4. Decide: hold | supply_to_aave | withdraw_from_aave
  5. Execute action if needed (supplyToAave or withdrawFromAave)
  6. Call logDecision with your action and reasoning

Safety rules (NON-NEGOTIABLE — never violate these):
  - Never let total USDC (liquid + deposited) drop below $25
  - Only supply to Aave if liquid balance > $35 AND you keep at least $30 liquid after
  - Supply no more than 80% of liquid balance at once
  - Only withdraw from Aave if liquid balance < $30 (need gas or operations buffer)
  - Never take leveraged or volatile positions
  - Never transfer funds out of the agent wallet

Optimization goals:
  - Keep most idle USDC earning in Aave (only keep $30-40 liquid for ops)
  - Stay alive and keep ticking — a dead agent earns nothing
  - Log every decision for transparency (judges and users can see your reasoning)

Current date/time: ${new Date().toISOString()}`;

export interface TickResult {
  success: boolean;
  tick: number;
  costUsd: number;
  error?: string;
}

export async function runAgentTick(): Promise<TickResult> {
  const state = await readState();
  const tick = state.totalTicks + 1;
  setCurrentTick(tick);

  console.log(`[AURA] Starting tick #${tick} at ${new Date().toISOString()}`);

  try {
    const result = await generateText({
      model: anthropic(process.env.AGENT_TICK_MODEL || "claude-haiku-4-5"),
      system: AURA_SYSTEM_PROMPT,
      prompt: `Tick #${tick}. Assess current state, take action if needed, and log your decision.`,
      tools: auraTools,
      maxSteps: parseInt(process.env.AGENT_MAX_STEPS || "6"),
    });

    // Record compute cost using v4.x token usage property names
    const { costUsd, todayUsd, totalUsd } = await recordComputeCost({
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      model: "haiku",
    });

    console.log(`[AURA] Tick #${tick} done. Tokens: ${result.usage.promptTokens}in/${result.usage.completionTokens}out. Cost: $${costUsd.toFixed(5)}`);

    // Rebuild full state snapshot from live data
    const [
      liquidUsdcBalance,
      ethBalance,
      aTokenBalance,
      apyPct,
      depositedUsdc,
      revenue,
    ] = await Promise.all([
      getUsdcBalance(),
      getEthBalance(),
      getAaveBalance(),
      getAaveAPY(),
      getDepositedUsdc(),
      getRevenueSummary(),
    ]);

    const yieldEarned = await updateYieldSnapshot(aTokenBalance, depositedUsdc);

    const updatedState = computeDerivedFields({
      ...state,
      lastTickAt: new Date().toISOString(),
      totalTicks: tick,
      liquidUsdcBalance,
      ethBalance,
      aavePosition: {
        depositedUsdc,
        currentATokenBalance: aTokenBalance,
        currentApyPct: apyPct,
        yieldEarnedTotalUsd: yieldEarned,
      },
      computeCostTodayUsd: todayUsd,
      computeCostTotalUsd: totalUsd,
      x402RevenueUsd: revenue.x402RevenueUsd,
      yieldRevenueTotalUsd: revenue.yieldRevenueTotalUsd,
    });

    await writeState(updatedState);

    console.log(`[AURA] State saved. Status: ${updatedState.isSelfSustaining ? "SELF_SUSTAINING" : "DEFICIT"}. Net P&L: $${updatedState.netPnlUsd.toFixed(4)}`);

    return { success: true, tick, costUsd };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[AURA] Tick #${tick} failed:`, error);
    return { success: false, tick, costUsd: 0, error };
  }
}
