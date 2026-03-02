# AURA — Agent Context Guide

> For deep technical details: `ARCHITECTURE.md`
> For current todos and open investigations: `PROGRESS.md`

---

## Mental Model

AURA is an autonomous DeFi agent on Base mainnet that tries to be self-sustaining.
It earns money two ways: (1) Aave V3 USDC yield (~5% APY on deposited principal),
(2) x402 micropayment fees when AI agents pay for DeFi analysis at `/api/analyze`.
A Railway daemon runs every 5 min, asks Claude Haiku whether to supply/withdraw USDC.
A Vercel Next.js dashboard shows live P&L. Both share state via Vercel KV.
Goal: `isSelfSustaining = true` (revenue > compute costs).

---

## Codebase Map

```
src/lib/
  wallet/viemClient.ts     — viem WalletClient, PublicClient, ERC-8021 builderCodeSuffix
  defi/aave.ts             — Aave V3 supply/withdraw/balance/APY (6-decimal USDC)
  agent/
    state.ts               — AgentState interface, Vercel KV read/write, defaultState()
    tools.ts               — 6 Vercel AI SDK v4.x tool definitions (Zod parameters)
    agentRunner.ts         — runAgentTick(): Claude Haiku + tools, state snapshot
    loop.ts                — Railway entry: 5-min cron, pause check [adaptive backoff TODO]
  tracking/
    revenue.ts             — x402 fee + Aave yield tracking (daily + all-time KV)
    compute.ts             — Claude API cost accumulation to KV
  pricing/estimator.ts     — Dynamic x402 price: Sonnet cost × 2x margin, $0.01 floor
  storage/zero-g.ts        — 0G Storage decision log upload (ethers v6 signer, KV fallback)

src/app/api/
  analyze/route.ts         — POST /api/analyze: x402 gate, dynamic pricing, body cache pattern
  stats/route.ts           — GET /api/stats: full AgentState + decision logs from KV

src/app/page.tsx           — Dashboard, polls /api/stats every 30s
src/components/            — WalletCard, AavePosition, RunwayMeter, PLChart, DecisionLog
middleware.ts              — Pass-through stub (x402 moved to route; Edge Runtime limitation)
scripts/test-x402-client.ts — x402 test buyer (uses VERCEL_URL from .env.local)
```

---

## Key Decisions (why, not just what)

| Decision | Why |
|----------|-----|
| x402 gating in `analyze/route.ts`, NOT `middleware.ts` | `@x402/evm` needs Node.js crypto — Edge Runtime can't run it |
| viem-only for Aave | `@aave/contract-helpers` needs ethers; raw viem is simpler and we already have viem |
| ethers isolated to `zero-g.ts` only | 0G SDK requires ethers signer; all other code stays viem |
| Haiku for agent ticks, Sonnet for x402 analysis | Haiku ~$0.002/tick keeps costs low; paying users get Sonnet quality |
| Railway daemon + Vercel dashboard | Vercel serverless can't run a persistent loop |
| Vercel KV for state + 0G Storage for logs | KV is fast reads/writes; 0G provides immutable audit trail for judges |
| Dynamic x402 pricing via query length | Flat $0.01 was a loss on large queries; estimate Sonnet cost × 2x margin |
| CDP facilitator for x402 | Free testnet facilitator doesn't support Base mainnet |
| `ERC-8021` suffix per `writeContract`, not `createWalletClient` | Passing to createWalletClient is silently a no-op in viem |
| Aave USDC only (no Uni V3 LP) | Uni V3 adds IL risk + 5h complexity — too risky for solo 45h build |

---

## Landmines & Gotchas

1. **USDC = 6 decimals.** `1_000_000 = $1.00`. Wrong decimals silently drains the wallet.

2. **`updateYieldSnapshot` returns an object, not a number.**
   ```typescript
   // Right:
   const { totalYield: yieldEarned, todayYield } = await updateYieldSnapshot(a, b);
   // Wrong — was a number before Feb 26 refactor:
   const yieldEarned = await updateYieldSnapshot(a, b); // now an object!
   ```

3. **Adding a new field to `AgentState`?** Also add it to `defaultState()` with a zero
   value. `readState()` does `{ ...defaultState(), ...stored }` — without a default,
   old KV data causes `undefined` on the new field (runtime TypeError).

4. **x402 test script hits production** (`VERCEL_URL` in `.env.local`), not localhost.
   To test locally: temporarily set `VERCEL_URL=http://localhost:3000`.

5. **x402 self-payment is rejected by CDP.** `from === to` causes `invalid_payload`.
   Use `TEST_BUYER_PRIVATE_KEY` (a separate wallet) for test runs.

6. **Vercel AI SDK v4.x names differ from v3.x.** Use `parameters` (not `inputSchema`),
   `maxSteps` (not `stopWhen`), `result.usage.promptTokens` (not `totalUsage.inputTokens`).

7. **`ERC-8021 dataSuffix` must be per `writeContract` call.** Export `builderCodeSuffix`
   from `viemClient.ts` and pass it as `dataSuffix` in `aave.ts`. Silently no-op otherwise.

8. **0G Storage signer is ethers v6, not viem.** Isolated to `zero-g.ts`. Don't bleed
   ethers into other files. Always fall back to KV if 0G upload fails.

---

## Investigation Starting Points

| Symptom | Look here |
|---------|-----------|
| x402 payment errors | `TROUBLESHOOTING_X402.md` (19KB of debug history) |
| Revenue not updating in dashboard | `src/lib/tracking/revenue.ts` + `src/app/api/analyze/route.ts` |
| Agent not ticking / wrong interval | `src/lib/agent/loop.ts` |
| Wrong Aave balance or APY | `src/lib/defi/aave.ts` (check 6-decimal conversion) |
| AgentState field undefined at runtime | `src/lib/agent/state.ts` → add to `defaultState()` |
| Dashboard stale / not updating | `src/app/api/stats/route.ts` + `src/app/page.tsx` (30s poll) |
| 0G Storage upload failing | `src/lib/storage/zero-g.ts` (check KV fallback path) |
| x402 pricing wrong | `src/lib/pricing/estimator.ts` |
