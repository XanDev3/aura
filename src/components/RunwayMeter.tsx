import type { AgentState } from "@/lib/agent/state";

export function RunwayMeter({ state }: { state: AgentState }) {
  const { runwayHours, isSelfSustaining, computeCostTodayUsd, x402RevenueUsd, yieldRevenueTotalUsd } = state;

  const DAILY_COMPUTE_USD = 0.50;
  const MIN_X402_PRICE_USD = 0.01;
  const todayRevenueUsd = x402RevenueUsd + yieldRevenueTotalUsd;
  // Progress toward today's break-even (capped at 100%)
  const todayProgress = Math.min(100, (todayRevenueUsd / DAILY_COMPUTE_USD) * 100);

  // Gap-to-sustainability: x402 requests needed to cover today's remaining deficit
  const dailyGap = Math.max(0, DAILY_COMPUTE_USD - todayRevenueUsd);
  const x402RequestsNeeded = Math.ceil(dailyGap / MIN_X402_PRICE_USD);

  // Gap-to-sustainability: additional USDC in Aave to self-sustain on yield alone
  const currentApyPct = state.aavePosition?.currentApyPct ?? 4.0;
  const currentATokenBalance = state.aavePosition?.currentATokenBalance ?? 0;
  const dailyYieldRate = currentApyPct / 100 / 365;
  const requiredAaveTotal = DAILY_COMPUTE_USD / dailyYieldRate;
  const additionalAaveNeeded = Math.max(0, requiredAaveTotal - currentATokenBalance);

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
        <div className="flex justify-between text-sm text-slate-400 mb-1">
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
        <div className="flex justify-between text-sm text-slate-400 mt-1">
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
          <div className="text-slate-400 text-sm">Aave Yield</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 font-semibold">
            ${x402RevenueUsd.toFixed(4)}
          </div>
          <div className="text-slate-400 text-sm">x402 Fees</div>
        </div>
        <div className="text-center">
          <div className="text-red-400 font-semibold">
            ${computeCostTodayUsd.toFixed(4)}
          </div>
          <div className="text-slate-400 text-sm">Compute Today</div>
        </div>
      </div>

      {/* Gap-to-sustainability */}
      <div className="mt-4 pt-4 border-t border-[#1e2a4a] space-y-2">
        <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">To cover today&apos;s compute</div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">via x402 requests</span>
          {todayProgress >= 100 ? (
            <span className="text-green-400 font-semibold">Covered ✓</span>
          ) : (
            <span className="text-blue-300 font-semibold">
              {x402RequestsNeeded} more req
              <span className="text-slate-400 font-normal ml-1">@ ${MIN_X402_PRICE_USD}/req min</span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">via Aave yield only</span>
          {additionalAaveNeeded === 0 ? (
            <span className="text-green-400 font-semibold">Covered ✓</span>
          ) : state.aavePosition == null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="text-yellow-300 font-semibold">
              +${additionalAaveNeeded.toFixed(0)} USDC more
              <span className="text-slate-400 font-normal ml-1">@ {currentApyPct.toFixed(1)}% APY</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
