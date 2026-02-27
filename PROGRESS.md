# AURA — Build Progress Tracker

> **Project:** AURA — Autonomous Utility Revenue Agent
> **Hackathon:** ETHDenver 2026 BUIDLathon
> **Result:** 🥈 2nd Place — Base: Self-Sustaining Autonomous Agents ($3,000)
> **Builder:** Solo
> **Last updated:** Feb 26, 2026

---

## Key Links

| Resource | URL |
|----------|-----|
| Live dashboard | https://aura-two-gules.vercel.app/ |
| GitHub repo | https://github.com/XanDev3/aura |
| Agent wallet on Basescan | [0x0968452513515636e0BE413d93Af64e101b299B0](https://basescan.org/address/0x0968452513515636e0BE413d93Af64e101b299B0) |
| Builder code checker | https://builder-code-checker.vercel.app |

---

## What Was Built

Full autonomous DeFi agent on Base mainnet:

- **Agent loop** (Railway daemon, 5-min ticks): Claude Haiku decides when to supply/withdraw USDC from Aave V3
- **x402 payment gate**: `/api/analyze` requires USDC micropayment via EIP-3009 before serving Claude Sonnet DeFi analysis
- **Dual revenue**: Aave V3 yield + x402 service fees tracked in real-time
- **Dashboard**: Public Vercel URL — wallet balance, compute cost, P&L chart, agent decision log
- **0G Storage**: Immutable decision log uploads (KV fallback)
- **ERC-8021**: Builder code on every Base mainnet transaction

### File Map

| File | Purpose |
|------|---------|
| `middleware.ts` | Pass-through (x402 moved to route — Edge Runtime can't run `@x402/evm`) |
| `src/lib/wallet/viemClient.ts` | viem WalletClient + PublicClient + ERC-8021 `builderCodeSuffix` |
| `src/lib/defi/aave.ts` | Aave V3 supply/withdraw/balance/APY (viem-only, no `@aave/contract-helpers`) |
| `src/lib/agent/state.ts` | `AgentState` interface + Vercel KV read/write helpers |
| `src/lib/agent/tools.ts` | Vercel AI SDK v4.x tool definitions (Zod `parameters`, `tool` from `"ai"`) |
| `src/lib/agent/agentRunner.ts` | `runAgentTick()` — Claude Haiku + tools, `maxSteps`, `result.usage` |
| `src/lib/agent/loop.ts` | Railway entry point — 5-min cron, pause check, safe tick wrapper |
| `src/lib/tracking/compute.ts` | Accumulate Claude API costs to KV (Haiku: $1/M in, $5/M out) |
| `src/lib/tracking/revenue.ts` | Track Aave yield delta + x402 fees |
| `src/lib/pricing/estimator.ts` | Dynamic x402 pricing: query-length-based Sonnet cost estimate, 2x margin, $0.01 floor |
| `src/lib/storage/zero-g.ts` | 0G Storage decision log uploads; KV fallback |
| `src/app/api/analyze/route.ts` | x402-gated DeFi analysis via `withX402` + CDP JWT auth + dynamic pricing |
| `src/app/api/stats/route.ts` | `GET /api/stats` — full AgentState from KV + decision logs |
| `src/app/page.tsx` | Dashboard — polls `/api/stats` every 30s |
| `src/components/` | WalletCard, StatusBadge, AavePosition, RunwayMeter, PLChart, DecisionLog |
| `scripts/test-x402-client.ts` | x402 test buyer — uses `@x402/fetch` + `@x402/evm`, sends 3 queries |

---

## Post-Hackathon

### Bugs / Investigations

| # | Issue | Status |
|---|-------|--------|
| I1 | **Runway & Sustainability bar does not appear to reset daily** — investigate whether it should reset on a calendar-day boundary, after a rolling 24h window, or is this a display bug in `RunwayMeter.tsx` | `[ ]` |

### Cost Control

#### Agent Pause (implemented Feb 20)
Manual kill-switch via Vercel KV. Set `aura:paused = true` to skip all ticks; delete or set `false` to resume.
- Code: `src/lib/agent/loop.ts` (`safeTick`) + `src/lib/agent/state.ts` (`checkIsPaused`, `PAUSE_KEY`)
- Savings: $0.86/day → $0.00 while paused

#### TODO — Adaptive Backoff
> Full implementation plan in `src/lib/agent/loop.ts` at top of file.
> Replace `setInterval` with recursive `setTimeout`; 30-min ticks when no x402 traffic for >1h.
> Net savings: ~$0.07/day vs. always-on.

| # | Task | Status |
|---|------|--------|
| C1 | Implement adaptive backoff in `loop.ts` | `[ ]` |

### Stretch Goals

| # | Goal | Status |
|---|------|--------|
| S1 | Register AURA with ERC-8004 agent identity on-chain | `[ ]` |
| S2 | Add Limitless prediction market monitoring (read-only) | `[ ]` |
| S3 | Multi-agent demo: second agent buys analysis from AURA via x402 | `[ ]` |
| S4 | Drive `isSelfSustaining: true` — needs more x402 traffic (last seen: $0.11 rev / $0.35 cost) | `[ ]` |

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Feb 19 | Vercel AI SDK + Claude as AI agent framework | `generateText` with Zod tools — proper AI agent tool-calling |
| Feb 19 | Aave USDC only (no Uni V3 LP) | Uni V3 adds IL risk + 5h complexity — too risky solo/45h |
| Feb 19 | Railway for agent daemon, Vercel for dashboard | Vercel serverless can't run persistent cron loop |
| Feb 19 | Vercel KV as primary state, 0G Storage as decentralized log | Fast reads from KV; 0G provides immutable audit trail |
| Feb 19 | `ethers` added for 0G SDK compatibility only | 0G TS SDK requires ethers signer; isolated to `zero-g.ts` |
| Feb 20 | Next.js upgraded to v16 (`^16.0.10`), `ethers` pinned to `6.13.1` | Railway deployment blocked by CVE in older versions |
| Feb 19 | Haiku for ticks, Sonnet for x402 analysis | Haiku is ~$0.002/tick. Sonnet for paid analysis quality. |
| Feb 19 | viem-only for Aave (removed `@aave/contract-helpers`) | `@aave/contract-helpers` requires ethers; raw viem is simpler |
| Feb 19 | `@x402/next` middleware replaces custom x402 logic | Library handles payment validation, facilitator comms, 402 responses |
| Feb 20 | Dynamic x402 pricing via `DynamicPrice` function | Flat $0.01 was a loss on large queries; now estimates Sonnet cost per query (2x margin) |
| Feb 20 | Query length cap: `MAX_QUERY_CHARS=2000` | Prevents adversarial token-drain; max cost per request bounded to ~$0.0094 |
| Feb 19 | CDP facilitator for mainnet x402 | Free testnet facilitator doesn't support Base mainnet |
| Feb 20 | x402 gating in route handler, not `middleware.ts` | Edge Runtime can't import `@x402/evm` (Node.js crypto dependency) |
| Feb 20 | ERC-8021 `builderCodeSuffix` exported from `viemClient.ts`, applied per `writeContract` call | `dataSuffix` on `createWalletClient` is not supported by viem — was silently a no-op |

---

## How to Resume

Start a new Claude Code session and say:

> "Continue post-hackathon work on the AURA project. Read PROGRESS.md and ARCHITECTURE.md before touching any code."

### What a new agent needs to know
- **Stack:** Next.js 16, Vercel AI SDK v4.x + Claude Haiku (ticks) / Sonnet (analysis), viem, Aave V3, x402, 0G Storage, Vercel KV
- **Agent pattern:** `generateText` with Zod tools using `parameters` (NOT `inputSchema`) and `maxSteps` (NOT `stopWhen`) — v4.x API
- **Token tracking:** `result.usage.promptTokens` and `result.usage.completionTokens` (v4.x — NOT `totalUsage`)
- **ERC-8021:** `builderCodeSuffix` exported from `viemClient.ts`; must be passed as `dataSuffix` on every `writeContract` call in `aave.ts`
- **x402:** Gating is in `src/app/api/analyze/route.ts` via `withX402` (NOT `middleware.ts` — Edge Runtime limitation). CDP facilitator + explicit CDP JWT auth headers via `@coinbase/cdp-sdk/auth`.
- **State shared via:** Vercel KV (Railway daemon ↔ Vercel dashboard). Decision logs at `aura:zg:logs` key (separate from `aura:state`).
- **0G Storage:** Decision logs only — `@0glabs/0g-ts-sdk@0.3.1` + ethers v6 signer, KV fallback if upload fails.
- **Safety floor:** Never drop below $25 USDC — hardcoded in tools + agent system prompt.
- **USDC is 6 decimals.** `1_000_000 = $1.00`. This is the #1 bug risk.
