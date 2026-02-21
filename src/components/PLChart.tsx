"use client";

import type { AgentState } from "@/lib/agent/state";

/**
 * SVG line chart showing cumulative revenue vs compute cost over ticks.
 * Both lines share a single USD Y-axis so positions are directly comparable —
 * the gap closing over time shows the agent trending toward self-sustainability.
 */
export function PLChart({ state }: { state: AgentState }) {
  // Ensure oldest-first so the chart reads left→right as time moves forward.
  // readDecisionLogs() returns newest-first, so we sort defensively here.
  const entries = [...state.decisionLog].sort((a, b) => a.tick - b.tick);

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
  const HEIGHT = 140;
  // Extra right padding so endpoint labels render inside the SVG viewBox.
  const PADDING = { top: 14, right: 72, bottom: 20, left: 46 };
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const revenues = entries.map((e) => e.revenueUsd);
  const costs = entries.map((e) => e.computeCostUsd);

  // Shared Y-axis: both lines on the same USD scale.
  // This means revenue shows its true proportion relative to cost.
  // The gap between lines is the real deficit; watching it close tells the story.
  const maxVal = Math.max(...costs, ...revenues, 0.001);

  const toX = (i: number) => (i / (entries.length - 1)) * chartW;
  const toY = (v: number) => chartH - (v / maxVal) * chartH;

  const buildPath = (values: number[]) =>
    values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  const lastRevenue = revenues[revenues.length - 1];
  const lastCost = costs[costs.length - 1];
  const dotX = toX(entries.length - 1);
  // Labels go to the right of the final dot, inside the right padding.
  const labelX = dotX + 5;

  // Y-axis label precision: use enough digits so labels aren't all "$0.000".
  const yLabelFmt = (v: number) =>
    v === 0 ? "$0" : v < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`;

  return (
    <div className="bg-[#0f1628] border border-[#1e2a4a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          P&amp;L Chart — Revenue vs Compute Cost
        </h2>
        <div className="flex gap-4 text-xs text-slate-400">
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
            {/* Grid lines + Y-axis USD labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = pct * chartH;
              const val = maxVal * (1 - pct);
              return (
                <g key={pct}>
                  <line
                    x1={0} y1={y} x2={chartW} y2={y}
                    stroke="#1e2a4a" strokeDasharray="2 4"
                  />
                  <text x={-4} y={y + 4} textAnchor="end" fill="#475569" fontSize={9}>
                    {yLabelFmt(val)}
                  </text>
                </g>
              );
            })}

            {/* Revenue line */}
            <polyline
              points={buildPath(revenues)}
              fill="none"
              stroke="#22c55e"
              strokeWidth={1.5}
            />

            {/* Compute cost line */}
            <polyline
              points={buildPath(costs)}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
            />

            {/* Endpoint dots — positioned at actual USD heights on shared scale */}
            <circle cx={dotX} cy={toY(lastRevenue)} r={2.5} fill="#22c55e" />
            <circle cx={dotX} cy={toY(lastCost)} r={2.5} fill="#ef4444" />

            {/* Endpoint labels to the right of their dots, inside right padding */}
            <text
              x={labelX} y={toY(lastRevenue) + 4}
              textAnchor="start" fill="#22c55e" fontSize={9} fontWeight={600}
            >
              ${lastRevenue.toFixed(4)}
            </text>
            <text
              x={labelX} y={toY(lastCost) + 4}
              textAnchor="start" fill="#ef4444" fontSize={9} fontWeight={600}
            >
              ${lastCost.toFixed(4)}
            </text>

            {/* X-axis tick labels */}
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
