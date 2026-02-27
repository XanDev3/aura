import { kv } from "@vercel/kv";

const X402_REVENUE_KEY = "aura:revenue:x402";
const X402_REVENUE_TODAY_KEY = "aura:revenue:x402:today";
const X402_DATE_KEY = "aura:revenue:x402:date";

const YIELD_REVENUE_KEY = "aura:revenue:yield";
const YIELD_START_KEY = "aura:revenue:yield:start"; // yield total at start of current day
const YIELD_DATE_KEY = "aura:revenue:yield:date";

const AAVE_DEPOSITED_KEY = "aura:aave:deposited"; // cumulative deposits - withdrawals

/**
 * Record an x402 payment received (called from /api/analyze after successful response).
 * Increments both the all-time total and today's daily counter.
 */
export async function trackX402Revenue(amountUsd: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = await kv.get<string>(X402_DATE_KEY);
  if (storedDate !== today) {
    await kv.set(X402_DATE_KEY, today);
    await kv.set(X402_REVENUE_TODAY_KEY, 0);
  }

  const [current, todayCurrent] = await Promise.all([
    kv.get<number>(X402_REVENUE_KEY),
    kv.get<number>(X402_REVENUE_TODAY_KEY),
  ]);

  const updated = (current ?? 0) + amountUsd;
  const todayUpdated = (todayCurrent ?? 0) + amountUsd;

  await Promise.all([
    kv.set(X402_REVENUE_KEY, updated),
    kv.set(X402_REVENUE_TODAY_KEY, todayUpdated),
  ]);

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
 *
 * Returns both the all-time yield total and today's yield delta.
 * Today's delta = totalYield - yield recorded at start of current day.
 */
export async function updateYieldSnapshot(
  currentATokenBalance: number,
  depositedUsdc: number,
): Promise<{ totalYield: number; todayYield: number }> {
  const yieldEarned = Math.max(0, currentATokenBalance - depositedUsdc);

  const today = new Date().toISOString().slice(0, 10);
  const storedDate = await kv.get<string>(YIELD_DATE_KEY);

  if (storedDate !== today) {
    // New day — snapshot today's starting yield baseline
    await kv.set(YIELD_DATE_KEY, today);
    await kv.set(YIELD_START_KEY, yieldEarned);
  }

  const startOfDayYield = (await kv.get<number>(YIELD_START_KEY)) ?? 0;
  const todayYield = Math.max(0, yieldEarned - startOfDayYield);

  await kv.set(YIELD_REVENUE_KEY, yieldEarned);

  return { totalYield: yieldEarned, todayYield };
}

export async function getRevenueSummary(): Promise<{
  x402RevenueUsd: number;
  x402RevenueTodayUsd: number;
  yieldRevenueTotalUsd: number;
  yieldRevenueTodayUsd: number;
  totalRevenueUsd: number;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const [x402Date, x402, x402Today, yield_, yieldStart, yieldDate] =
    await Promise.all([
      kv.get<string>(X402_DATE_KEY),
      kv.get<number>(X402_REVENUE_KEY),
      kv.get<number>(X402_REVENUE_TODAY_KEY),
      kv.get<number>(YIELD_REVENUE_KEY),
      kv.get<number>(YIELD_START_KEY),
      kv.get<string>(YIELD_DATE_KEY),
    ]);

  const x402RevenueUsd = x402 ?? 0;
  const x402RevenueTodayUsd = x402Date === today ? (x402Today ?? 0) : 0;
  const yieldRevenueTotalUsd = yield_ ?? 0;
  const yieldRevenueTodayUsd =
    yieldDate === today
      ? Math.max(0, yieldRevenueTotalUsd - (yieldStart ?? 0))
      : 0;

  return {
    x402RevenueUsd,
    x402RevenueTodayUsd,
    yieldRevenueTotalUsd,
    yieldRevenueTodayUsd,
    totalRevenueUsd: x402RevenueUsd + yieldRevenueTotalUsd,
  };
}
