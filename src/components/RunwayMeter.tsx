import type { AgentState } from "@/lib/agent/state";

export function RunwayMeter({ state }: { state: AgentState }) {
  const { runwayHours, isSelfSustaining, computeCostTodayUsd, x402RevenueUsd, yieldRevenueTotalUsd } = state;

  const DAILY_COMPUTE_USD = 0.50;
  const todayRevenueUsd = x402RevenueUsd + yieldRevenueTotalUsd;
  // Progress toward today's break-even (capped at 100%)
  const todayProgress = Math.min(100, (todayRevenueUsd / DAILY_COMPUTE_USD) * 100);

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Runway &amp; Sustainability
        </h2>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
          isSelfSustaining
            ? "bg-green-900/50 text-green-400"
            : "bg-red-900/50 text-red-400"
        }`}>
          {isSelfSustaining ? `${runwayHours}h funded` : "building up"}
        </span>
      </div>

      {/* Break-even progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Today&apos;s compute covered</span>
          <span>{todayProgress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-[#1e2a4a] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              todayProgress >= 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${todayProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>$0</span>
          <span>Break-even: ~${DAILY_COMPUTE_USD.toFixed(2)}/day</span>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="text-center">
          <div className="text-yellow-400 font-semibold">
            ${yieldRevenueTotalUsd.toFixed(4)}
          </div>
          <div className="text-slate-500 text-xs">Aave Yield</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 font-semibold">
            ${x402RevenueUsd.toFixed(4)}
          </div>
          <div className="text-slate-500 text-xs">x402 Fees</div>
        </div>
        <div className="text-center">
          <div className="text-red-400 font-semibold">
            ${computeCostTodayUsd.toFixed(4)}
          </div>
          <div className="text-slate-500 text-xs">Compute Today</div>
        </div>
      </div>
    </div>
  );
}
