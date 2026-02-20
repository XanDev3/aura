import { kv } from "@vercel/kv";
import { account } from "../wallet/viemClient";

export interface DecisionLogEntry {
  timestamp: string;
  tick: number;
  action: string;
  reasoning: string;
  status: "SELF_SUSTAINING" | "DEFICIT";
  balances: { liquidUsdc: number; aaveDeposit: number };
  computeCostUsd: number;
  revenueUsd: number;
  txHash?: string;
  zgStorageRoot?: string;
  storedOn: "0g" | "kv";
}

export interface AgentState {
  // Identity
  walletAddress: string;
  startedAt: string;
  lastTickAt: string;
  totalTicks: number;

  // Balances
  liquidUsdcBalance: number;
  ethBalance: number;

  // Aave position
  aavePosition: {
    depositedUsdc: number;         // cumulative deposits minus withdrawals (KV-tracked)
    currentATokenBalance: number;  // live on-chain aUSDC balance
    currentApyPct: number;
    yieldEarnedTotalUsd: number;   // currentAToken - depositedUsdc
  } | null;

  // Self-sustaining metrics
  computeCostTodayUsd: number;
  computeCostTotalUsd: number;
  x402RevenueUsd: number;
  yieldRevenueTotalUsd: number;
  totalRevenueUsd: number;        // x402 + yield
  netPnlUsd: number;              // totalRevenue - computeCostTotal
  isSelfSustaining: boolean;      // totalRevenue > computeCostTotal
  runwayHours: number;            // surplus / hourlyComputeRate

  // Logs
  decisionLog: DecisionLogEntry[];
  zgStorageRoots: string[];
}

const STATE_KEY = "aura:state";

export function defaultState(): AgentState {
  return {
    walletAddress: account.address,
    startedAt: new Date().toISOString(),
    lastTickAt: new Date().toISOString(),
    totalTicks: 0,
    liquidUsdcBalance: 0,
    ethBalance: 0,
    aavePosition: null,
    computeCostTodayUsd: 0,
    computeCostTotalUsd: 0,
    x402RevenueUsd: 0,
    yieldRevenueTotalUsd: 0,
    totalRevenueUsd: 0,
    netPnlUsd: 0,
    isSelfSustaining: false,
    runwayHours: 0,
    decisionLog: [],
    zgStorageRoots: [],
  };
}

export async function readState(): Promise<AgentState> {
  const stored = await kv.get<AgentState>(STATE_KEY);
  return stored ?? defaultState();
}

export async function writeState(state: AgentState): Promise<void> {
  // Keep only the last 50 decision log entries to bound KV size
  const trimmed: AgentState = {
    ...state,
    decisionLog: state.decisionLog.slice(-50),
    zgStorageRoots: state.zgStorageRoots.slice(-100),
  };
  await kv.set(STATE_KEY, trimmed);
}

export function computeDerivedFields(state: AgentState): AgentState {
  const totalRevenue = state.x402RevenueUsd + state.yieldRevenueTotalUsd;
  const netPnl = totalRevenue - state.computeCostTotalUsd;
  const isSelfSustaining = totalRevenue > state.computeCostTotalUsd;

  // Hourly compute rate based on $0.50/day estimate
  const HOURLY_COMPUTE_RATE_USD = 0.50 / 24;
  const runwayHours =
    netPnl > 0 ? Math.floor(netPnl / HOURLY_COMPUTE_RATE_USD) : 0;

  return {
    ...state,
    totalRevenueUsd: totalRevenue,
    netPnlUsd: netPnl,
    isSelfSustaining,
    runwayHours,
  };
}
