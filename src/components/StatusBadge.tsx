import type { AgentState } from "@/lib/agent/state";

export function StatusBadge({ state }: { state: AgentState }) {
  const { isSelfSustaining, netPnlUsd, totalRevenueUsd, computeCostTotalUsd } = state;

  return (
    <div
      className={`rounded-xl border p-6 text-center ${
        isSelfSustaining
          ? "bg-green-950/30 border-green-800"
          : "bg-red-950/20 border-red-900"
      }`}
    >
      <div className={`text-3xl font-bold tracking-tight mb-1 ${
        isSelfSustaining ? "text-green-400" : "text-red-400"
      }`}>
        {isSelfSustaining ? "SELF-SUSTAINING" : "DEFICIT"}
      </div>

      <div className="text-slate-400 text-sm mb-4">
        {isSelfSustaining
          ? "Revenue exceeds compute cost — AURA is economically autonomous"
          : "Compute cost exceeds revenue — building toward self-sustainability"}
      </div>

      <div className="flex justify-center gap-8 text-sm">
        <div className="text-center">
          <div className="text-green-400 font-semibold">
            ${totalRevenueUsd.toFixed(4)}
          </div>
          <div className="text-slate-400 text-sm">Total Revenue</div>
        </div>
        <div className="text-center">
          <div className="text-red-400 font-semibold">
            ${computeCostTotalUsd.toFixed(4)}
          </div>
          <div className="text-slate-400 text-sm">Compute Cost</div>
        </div>
        <div className="text-center">
          <div className={`font-semibold ${netPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
            {netPnlUsd >= 0 ? "+" : ""}${netPnlUsd.toFixed(4)}
          </div>
          <div className="text-slate-400 text-sm">Net P&amp;L</div>
        </div>
        <div className="text-center">
          <div className="text-slate-300 font-semibold">
            Tick #{state.totalTicks}
          </div>
          <div className="text-slate-400 text-sm">
            {new Date(state.lastTickAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
