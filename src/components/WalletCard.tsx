import type { AgentState } from "@/lib/agent/state";

export function WalletCard({ state }: { state: AgentState }) {
  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Agent Wallet
        </h2>
        <a
          href={`https://basescan.org/address/${state.walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 font-mono"
        >
          {shortenAddress(state.walletAddress)} ↗
        </a>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Liquid USDC</span>
          <span className="text-xl font-bold text-white">
            ${state.liquidUsdcBalance.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">ETH (gas)</span>
          <span className="text-slate-300 font-mono text-sm">
            {state.ethBalance.toFixed(5)} ETH
          </span>
        </div>

        <div className="border-t border-[#1e2a4a] pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Total USDC</span>
            <span className="text-lg font-semibold text-green-400">
              ${(
                state.liquidUsdcBalance +
                (state.aavePosition?.currentATokenBalance ?? 0)
              ).toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">liquid + Aave deposit</p>
        </div>
      </div>
    </div>
  );
}
