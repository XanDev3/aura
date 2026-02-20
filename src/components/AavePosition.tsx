import type { AgentState } from "@/lib/agent/state";

export function AavePosition({ state }: { state: AgentState }) {
  const pos = state.aavePosition;

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Aave V3 Position
        </h2>
        <a
          href="https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&marketName=proto_base_v3"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400"
        >
          View on Aave ↗
        </a>
      </div>

      {!pos ? (
        <div className="text-slate-500 text-sm text-center py-4">
          No Aave position yet
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Deposited</span>
            <span className="text-white font-semibold">
              ${pos.depositedUsdc.toFixed(2)} USDC
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">aUSDC Balance</span>
            <span className="text-green-400 font-semibold">
              ${pos.currentATokenBalance.toFixed(4)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Current APY</span>
            <span className="text-yellow-400 font-semibold">
              {pos.currentApyPct.toFixed(2)}%
            </span>
          </div>

          <div className="border-t border-[#1e2a4a] pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Yield Earned</span>
              <span className="text-green-400 font-bold">
                +${pos.yieldEarnedTotalUsd.toFixed(5)} USDC
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Daily est.: ${((pos.depositedUsdc * pos.currentApyPct) / 100 / 365).toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
