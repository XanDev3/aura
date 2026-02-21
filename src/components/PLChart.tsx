"use client";

import type { AgentState } from "@/lib/agent/state";

/**
 * Simple SVG line chart showing cumulative yield vs compute cost over ticks.
 * Uses only the decision log entries available in state — no external charting lib needed.
 */
export function PLChart({ state }: { state: AgentState }) {
  const entries = state.decisionLog;

  if (entries.length < 2) {
    return (
      <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          P&amp;L Chart — Revenue vs Compute Cost
        </h2>
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
          Accumulating data... ({entries.length} ticks logged)
        </div>
      </div>
    );
  }

  const WIDTH = 600;
  const HEIGHT = 120;
  const PADDING = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const revenues = entries.map((e) => e.revenueUsd);
  const costs = entries.map((e) => e.computeCostUsd);
  const allValues = [...revenues, ...costs];
  const maxVal = Math.max(...allValues, 0.001);
  const minVal = 0;

  const toX = (i: number) => (i / (entries.length - 1)) * chartW;
  const toY = (v: number) => chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const polyline = (values: number[]) =>
    values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          P&amp;L Chart — Revenue vs Compute Cost
        </h2>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-green-500 inline-block" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-red-500 inline-block" />
            Compute
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ minWidth: 300 }}
          aria-label="P&L chart"
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = pct * chartH;
              const val = maxVal * (1 - pct);
              return (
                <g key={pct}>
                  <line x1={0} y1={y} x2={chartW} y2={y} stroke="#1e2a4a" strokeDasharray="2 4" />
                  <text x={-4} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={10}>
                    ${val.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* Revenue line */}
            <polyline
              points={polyline(revenues)}
              fill="none"
              stroke="#22c55e"
              strokeWidth={1.5}
            />

            {/* Compute cost line */}
            <polyline
              points={polyline(costs)}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
            />

            {/* Latest values */}
            {entries.length > 0 && (
              <>
                <circle
                  cx={toX(entries.length - 1)}
                  cy={toY(revenues[revenues.length - 1])}
                  r={2.5}
                  fill="#22c55e"
                />
                <circle
                  cx={toX(entries.length - 1)}
                  cy={toY(costs[costs.length - 1])}
                  r={2.5}
                  fill="#ef4444"
                />
              </>
            )}

            {/* X-axis labels */}
            <text x={0} y={chartH + 14} fill="#475569" fontSize={8}>
              Tick #{entries[0]?.tick ?? 0}
            </text>
            <text x={chartW} y={chartH + 14} textAnchor="end" fill="#475569" fontSize={8}>
              Tick #{entries[entries.length - 1]?.tick ?? 0}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
