import { kv } from "@vercel/kv";

const X402_REVENUE_KEY = "aura:revenue:x402";
const YIELD_REVENUE_KEY = "aura:revenue:yield";
const AAVE_DEPOSITED_KEY = "aura:aave:deposited";  // cumulative deposits - withdrawals

/**
 * Record an x402 payment received (called from /api/analyze after successful response).
 */
export async function trackX402Revenue(amountUsd: number): Promise<number> {
  const current = (await kv.get<number>(X402_REVENUE_KEY)) ?? 0;
  const updated = current + amountUsd;
  await kv.set(X402_REVENUE_KEY, updated);
  return updated;
}

/**
 * Track a USDC deposit to Aave (increases deposited principal).
 */
export async function recordAaveDeposit(amountUsdc: number): Promise<void> {
  const current = (await kv.get<number>(AAVE_DEPOSITED_KEY)) ?? 0;
  await kv.set(AAVE_DEPOSITED_KEY, current + amountUsdc);
}

/**
 * Track a USDC withdrawal from Aave (decreases deposited principal).
 */
export async function recordAaveWithdrawal(amountUsdc: number): Promise<void> {
  const current = (await kv.get<number>(AAVE_DEPOSITED_KEY)) ?? 0;
  await kv.set(AAVE_DEPOSITED_KEY, Math.max(0, current - amountUsdc));
}

/**
 * Get the cumulative deposited USDC (principal only, excludes yield).
 */
export async function getDepositedUsdc(): Promise<number> {
  return (await kv.get<number>(AAVE_DEPOSITED_KEY)) ?? 0;
}

/**
 * Update the snapshot of total yield earned (called each tick after reading on-chain aUSDC balance).
 * yieldEarned = currentATokenBalance - depositedUsdc
 */
export async function updateYieldSnapshot(currentATokenBalance: number, depositedUsdc: number): Promise<number> {
  const yieldEarned = Math.max(0, currentATokenBalance - depositedUsdc);
  await kv.set(YIELD_REVENUE_KEY, yieldEarned);
  return yieldEarned;
}

export async function getRevenueSummary(): Promise<{
  x402RevenueUsd: number;
  yieldRevenueTotalUsd: number;
  totalRevenueUsd: number;
}> {
  const [x402, yield_] = await Promise.all([
    kv.get<number>(X402_REVENUE_KEY),
    kv.get<number>(YIELD_REVENUE_KEY),
  ]);

  const x402RevenueUsd = x402 ?? 0;
  const yieldRevenueTotalUsd = yield_ ?? 0;
  return {
    x402RevenueUsd,
    yieldRevenueTotalUsd,
    totalRevenueUsd: x402RevenueUsd + yieldRevenueTotalUsd,
  };
}
