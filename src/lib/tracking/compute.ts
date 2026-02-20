import { kv } from "@vercel/kv";

// Haiku pricing (Feb 2026)
const HAIKU_INPUT_COST_PER_M = 1.0;   // $1.00 per million input tokens
const HAIKU_OUTPUT_COST_PER_M = 5.0;  // $5.00 per million output tokens

// Sonnet pricing (for x402 analysis endpoint)
const SONNET_INPUT_COST_PER_M = 3.0;  // $3.00 per million input tokens
const SONNET_OUTPUT_COST_PER_M = 15.0; // $15.00 per million output tokens

const COMPUTE_TODAY_KEY = "aura:compute:today";
const COMPUTE_TOTAL_KEY = "aura:compute:total";
const COMPUTE_DATE_KEY = "aura:compute:date";

export interface ComputeUsage {
  promptTokens: number;
  completionTokens: number;
  model: "haiku" | "sonnet";
}

function costUsd(usage: ComputeUsage): number {
  const inputRate =
    usage.model === "haiku" ? HAIKU_INPUT_COST_PER_M : SONNET_INPUT_COST_PER_M;
  const outputRate =
    usage.model === "haiku" ? HAIKU_OUTPUT_COST_PER_M : SONNET_OUTPUT_COST_PER_M;

  return (
    (usage.promptTokens / 1_000_000) * inputRate +
    (usage.completionTokens / 1_000_000) * outputRate
  );
}

export async function recordComputeCost(usage: ComputeUsage): Promise<{
  costUsd: number;
  todayUsd: number;
  totalUsd: number;
}> {
  const cost = costUsd(usage);

  // Reset daily counter if day has changed
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = await kv.get<string>(COMPUTE_DATE_KEY);
  if (storedDate !== today) {
    await kv.set(COMPUTE_DATE_KEY, today);
    await kv.set(COMPUTE_TODAY_KEY, 0);
  }

  const [todayRaw, totalRaw] = await Promise.all([
    kv.get<number>(COMPUTE_TODAY_KEY),
    kv.get<number>(COMPUTE_TOTAL_KEY),
  ]);

  const todayUsd = (todayRaw ?? 0) + cost;
  const totalUsd = (totalRaw ?? 0) + cost;

  await Promise.all([
    kv.set(COMPUTE_TODAY_KEY, todayUsd),
    kv.set(COMPUTE_TOTAL_KEY, totalUsd),
  ]);

  return { costUsd: cost, todayUsd, totalUsd };
}

export async function getComputeCosts(): Promise<{
  todayUsd: number;
  totalUsd: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = await kv.get<string>(COMPUTE_DATE_KEY);

  const [todayRaw, totalRaw] = await Promise.all([
    kv.get<number>(COMPUTE_TODAY_KEY),
    kv.get<number>(COMPUTE_TOTAL_KEY),
  ]);

  return {
    todayUsd: storedDate === today ? (todayRaw ?? 0) : 0,
    totalUsd: totalRaw ?? 0,
  };
}
