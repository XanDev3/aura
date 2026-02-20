"use client";

import { useEffect, useState, useCallback } from "react";
import type { AgentState } from "@/lib/agent/state";
import { WalletCard } from "@/components/WalletCard";
import { StatusBadge } from "@/components/StatusBadge";
import { AavePosition } from "@/components/AavePosition";
import { RunwayMeter } from "@/components/RunwayMeter";
import { PLChart } from "@/components/PLChart";
import { DecisionLog } from "@/components/DecisionLog";

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export default function Dashboard() {
  const [state, setState] = useState<(AgentState & { isPaused?: boolean }) | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AgentState = await res.json();
      setState(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch state");
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchState]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-2 h-2 rounded-full ${state?.isPaused ? "bg-yellow-500" : "bg-green-500 pulse-dot"}`} />
          <h1 className="text-2xl font-bold tracking-tight">AURA</h1>
          <span className="text-slate-400 text-sm">Autonomous Utility Revenue Agent</span>
          {state?.isPaused && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-900/50 border border-yellow-700 text-yellow-400 text-xs font-medium">
              PAUSED
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Base Mainnet</span>
          <span>·</span>
          <span>Aave V3 + x402</span>
          <span>·</span>
          {lastUpdated ? (
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          ) : (
            <span>Loading...</span>
          )}
          <span>·</span>
          <span className="text-slate-600">Refreshes every 30s</span>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-3 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {!state ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="text-center">
            <div className="text-4xl mb-4">⟳</div>
            <div>Loading agent state...</div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top row: Status badge (full width) */}
          <StatusBadge state={state} />

          {/* Second row: Wallet + Aave side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WalletCard state={state} />
            <AavePosition state={state} />
          </div>

          {/* Third row: Runway meter (full width) */}
          <RunwayMeter state={state} />

          {/* Fourth row: P&L chart (full width) */}
          <PLChart state={state} />

          {/* Fifth row: Decision log (full width) */}
          <DecisionLog state={state} />

          {/* Footer */}
          <footer className="text-center text-xs text-slate-600 pt-4 pb-8 space-y-1">
            <div>
              Agent wallet:{" "}
              <a
                href={`https://basescan.org/address/${state.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 font-mono"
              >
                {state.walletAddress.slice(0, 6)}...{state.walletAddress.slice(-4)}
              </a>
            </div>
            <div>
              Running since {new Date(state.startedAt).toLocaleDateString()} ·{" "}
              {state.totalTicks} ticks completed
            </div>
            <div>ETHDenver 2026 BUIDLathon · Base + 0G Labs bounties</div>
          </footer>
        </div>
      )}
    </main>
  );
}
