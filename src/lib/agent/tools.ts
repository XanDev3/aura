import { tool } from "ai";
import { z } from "zod";
import { getUsdcBalance, getEthBalance, getAaveBalance, getAaveAPY, supplyUsdc, withdrawUsdc } from "../defi/aave";
import { getComputeCosts } from "../tracking/compute";
import { getDepositedUsdc, getRevenueSummary, updateYieldSnapshot, recordAaveDeposit, recordAaveWithdrawal } from "../tracking/revenue";
import { uploadDecisionLog } from "../storage/zero-g";
import type { DecisionLogEntry } from "./state";

// Safety floor — never drop below this total USDC (liquid + deposited)
const SAFETY_FLOOR_USD = 25;
// Minimum liquid balance before we consider supplying to Aave
const MIN_LIQUID_TO_SUPPLY = 35;

// Shared tick counter (set by agentRunner before tool execution)
let currentTick = 0;
export function setCurrentTick(tick: number) { currentTick = tick; }

export const auraTools = {
  getWalletBalance: tool({
    description: "Get current USDC and ETH wallet balances from the blockchain",
    parameters: z.object({}),
    execute: async () => {
      const [usdc, eth] = await Promise.all([getUsdcBalance(), getEthBalance()]);
      return {
        liquidUsdcBalance: usdc,
        ethBalance: eth,
        ethBalanceFormatted: `${eth.toFixed(6)} ETH`,
        usdcBalanceFormatted: `$${usdc.toFixed(2)} USDC`,
      };
    },
  }),

  getAavePosition: tool({
    description: "Get current Aave V3 USDC deposit position, aToken balance, APY, and yield earned",
    parameters: z.object({}),
    execute: async () => {
      const [aTokenBalance, apyPct, depositedUsdc] = await Promise.all([
        getAaveBalance(),
        getAaveAPY(),
        getDepositedUsdc(),
      ]);
      const yieldEarned = await updateYieldSnapshot(aTokenBalance, depositedUsdc);
      return {
        depositedUsdc,
        currentATokenBalance: aTokenBalance,
        currentApyPct: apyPct,
        yieldEarnedTotalUsd: yieldEarned,
        summary: `Deposited: $${depositedUsdc.toFixed(2)}, Current value: $${aTokenBalance.toFixed(2)}, APY: ${apyPct.toFixed(2)}%, Yield earned: $${yieldEarned.toFixed(4)}`,
      };
    },
  }),

  supplyToAave: tool({
    description: `Supply USDC to Aave V3 to earn yield. Safety rules: only call if liquid USDC > $${MIN_LIQUID_TO_SUPPLY}, never let total USDC (liquid + deposited) drop below $${SAFETY_FLOOR_USD}.`,
    parameters: z.object({
      amountUsdc: z
        .number()
        .positive()
        .describe("Amount of USDC to supply. Must leave at least $30 liquid after supply."),
    }),
    execute: async ({ amountUsdc }) => {
      const [liquid, deposited] = await Promise.all([
        getUsdcBalance(),
        getDepositedUsdc(),
      ]);
      const totalAfter = (liquid - amountUsdc) + deposited;

      if (liquid < MIN_LIQUID_TO_SUPPLY) {
        return { success: false, error: `Liquid balance $${liquid.toFixed(2)} below minimum $${MIN_LIQUID_TO_SUPPLY}. No action taken.` };
      }
      if (amountUsdc > liquid - 30) {
        return { success: false, error: `Supply amount would leave less than $30 liquid. Reduced amount required.` };
      }
      if (totalAfter < SAFETY_FLOOR_USD) {
        return { success: false, error: `Total USDC would drop below safety floor $${SAFETY_FLOOR_USD}. No action taken.` };
      }

      const txHash = await supplyUsdc(amountUsdc);
      await recordAaveDeposit(amountUsdc);
      return {
        success: true,
        txHash,
        amountSupplied: amountUsdc,
        message: `Supplied $${amountUsdc} USDC to Aave V3. Tx: ${txHash}`,
      };
    },
  }),

  withdrawFromAave: tool({
    description: "Withdraw USDC from Aave V3. Only call if liquid USDC balance is dangerously low (< $30) or gas funds are needed.",
    parameters: z.object({
      amountUsdc: z
        .number()
        .positive()
        .describe("Amount of USDC to withdraw from Aave"),
    }),
    execute: async ({ amountUsdc }) => {
      const deposited = await getDepositedUsdc();
      if (amountUsdc > deposited) {
        return { success: false, error: `Cannot withdraw $${amountUsdc} — only $${deposited.toFixed(2)} deposited.` };
      }
      const txHash = await withdrawUsdc(amountUsdc);
      await recordAaveWithdrawal(amountUsdc);
      return {
        success: true,
        txHash,
        amountWithdrawn: amountUsdc,
        message: `Withdrew $${amountUsdc} USDC from Aave V3. Tx: ${txHash}`,
      };
    },
  }),

  getComputeMetrics: tool({
    description: "Get current compute cost vs revenue summary to assess whether AURA is self-sustaining",
    parameters: z.object({}),
    execute: async () => {
      const [costs, revenue] = await Promise.all([
        getComputeCosts(),
        getRevenueSummary(),
      ]);
      const netPnl = revenue.totalRevenueUsd - costs.totalUsd;
      const isSelfSustaining = revenue.totalRevenueUsd > costs.totalUsd;
      const HOURLY_RATE = 0.50 / 24;
      const runwayHours = netPnl > 0 ? Math.floor(netPnl / HOURLY_RATE) : 0;
      return {
        computeCostTodayUsd: costs.todayUsd,
        computeCostTotalUsd: costs.totalUsd,
        x402RevenueUsd: revenue.x402RevenueUsd,
        yieldRevenueTotalUsd: revenue.yieldRevenueTotalUsd,
        totalRevenueUsd: revenue.totalRevenueUsd,
        netPnlUsd: netPnl,
        isSelfSustaining,
        runwayHours,
        status: isSelfSustaining ? "SELF_SUSTAINING" : "DEFICIT",
        summary: `${isSelfSustaining ? "✓ SELF-SUSTAINING" : "⚠ DEFICIT"} | Revenue: $${revenue.totalRevenueUsd.toFixed(4)} | Cost: $${costs.totalUsd.toFixed(4)} | Net: $${netPnl.toFixed(4)} | Runway: ${runwayHours}h`,
      };
    },
  }),

  logDecision: tool({
    description: "Log the agent's decision and reasoning to 0G Storage for transparency and auditing",
    parameters: z.object({
      action: z
        .enum(["hold", "supply_to_aave", "withdraw_from_aave"])
        .describe("Action taken this tick"),
      reasoning: z
        .string()
        .describe("1-2 sentence explanation of the decision"),
      status: z
        .enum(["SELF_SUSTAINING", "DEFICIT"])
        .describe("Current sustainability status"),
      liquidUsdc: z.number().describe("Current liquid USDC balance"),
      aaveDeposit: z.number().describe("Current Aave deposited amount"),
      txHash: z.string().optional().describe("Transaction hash if an on-chain action was taken"),
    }),
    execute: async ({ action, reasoning, status, liquidUsdc, aaveDeposit, txHash }) => {
      const [costs, revenue] = await Promise.all([
        getComputeCosts(),
        getRevenueSummary(),
      ]);

      const entry: DecisionLogEntry = {
        timestamp: new Date().toISOString(),
        tick: currentTick,
        action,
        reasoning,
        status,
        balances: { liquidUsdc, aaveDeposit },
        computeCostUsd: costs.totalUsd,
        revenueUsd: revenue.totalRevenueUsd,
        txHash,
        storedOn: "kv", // will be updated by uploadDecisionLog
      };

      const { storedOn, root } = await uploadDecisionLog(entry);
      return {
        logged: true,
        storedOn,
        root,
        message: `Decision logged (${storedOn}): ${action} — ${reasoning}`,
      };
    },
  }),
};
