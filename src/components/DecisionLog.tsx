import type { AgentState, DecisionLogEntry } from "@/lib/agent/state";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  hold: { label: "HOLD", color: "text-slate-400" },
  supply_to_aave: { label: "SUPPLY", color: "text-green-400" },
  withdraw_from_aave: { label: "WITHDRAW", color: "text-yellow-400" },
};

function EntryRow({ entry }: { entry: DecisionLogEntry }) {
  const actionStyle = ACTION_LABELS[entry.action] ?? {
    label: entry.action.toUpperCase(),
    color: "text-slate-400",
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1e2a4a] last:border-0">
      <div className="flex-none text-sm text-slate-400 w-14 text-right pt-0.5">
        #{entry.tick}
      </div>

      <div className={`flex-none text-sm font-mono font-bold w-16 ${actionStyle.color}`}>
        {actionStyle.label}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-300 leading-snug">{entry.reasoning}</div>
        <div className="flex gap-3 mt-1 text-sm text-slate-400">
          <span>Liquid: ${entry.balances.liquidUsdc.toFixed(2)}</span>
          <span>Aave: ${entry.balances.aaveDeposit.toFixed(2)}</span>
          {entry.txHash && (
            <a
              href={`https://basescan.org/tx/${entry.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400"
            >
              tx ↗
            </a>
          )}
          <span className={`ml-auto ${entry.storedOn === "0g" ? "text-purple-500" : "text-slate-700"}`}>
            {entry.storedOn === "0g" ? "0G" : "KV"}
          </span>
        </div>
      </div>

      <div className="flex-none text-sm text-slate-400">
        {timeAgo(entry.timestamp)}
      </div>
    </div>
  );
}

export function DecisionLog({ state }: { state: AgentState }) {
  const entries = [...state.decisionLog].reverse().slice(0, 10);

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Agent Decision Log
        </h2>
        <div className="text-sm text-slate-400">
          Last 10 of {state.decisionLog.length} decisions
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-slate-400 text-sm text-center py-6">
          No decisions logged yet — agent starting up...
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <EntryRow key={`${entry.tick}-${i}`} entry={entry} />
          ))}
        </div>
      )}

      {state.zgStorageRoots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1e2a4a] text-sm text-slate-400">
          {state.zgStorageRoots.length} entries stored on 0G Storage (decentralized)
        </div>
      )}
    </div>
  );
}
