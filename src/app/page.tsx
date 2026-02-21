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
        <div className="flex items-start justify-between">
          {/* Left: wordmark + full name */}
          <div>
            <h1 className="text-7xl font-bold tracking-[0.15em] aura-glow leading-none mb-3">
              AURA
            </h1>
            <div className="flex items-center gap-0 text-[11px] font-mono tracking-wider text-slate-500 uppercase select-none">
              <span className="text-green-400/80">A</span><span>utonomous</span>
              <span className="mx-2 text-slate-700">/</span>
              <span className="text-green-400/80">U</span><span>tility</span>
              <span className="mx-2 text-slate-700">/</span>
              <span className="text-green-400/80">R</span><span>evenue</span>
              <span className="mx-2 text-slate-700">/</span>
              <span className="text-green-400/80">A</span><span>gent</span>
            </div>
          </div>

          {/* Right: system status readout */}
          <div className="text-right text-[11px] font-mono space-y-1.5 pt-1">
            <div className="flex items-center justify-end gap-2">
              <span className="text-slate-600">STATUS</span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  state?.isPaused ? "bg-yellow-500" : "bg-green-500 pulse-dot"
                }`}
              />
              <span className={state?.isPaused ? "text-yellow-400" : "text-green-400"}>
                {state?.isPaused ? "PAUSED" : "LIVE"}
              </span>
            </div>
            <div className="text-slate-600">BASE / 8453</div>
            <div className="text-slate-600">AAVE V3 · x402</div>
            <div className="text-slate-700">
              {lastUpdated
                ? `SYNC ${lastUpdated.toLocaleTimeString()}`
                : "CONNECTING..."}
            </div>
          </div>
        </div>

        {/* Divider: left green accent fading into dark */}
        <div className="mt-2 h-px w-full bg-slate-800 relative">
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-green-500/50 to-transparent" />
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
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
          <footer className="text-center text-xs text-slate-400 pt-4 pb-8 space-y-1">
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
