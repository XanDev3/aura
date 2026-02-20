# AURA -- Build Progress Tracker

> **Project:** AURA -- Autonomous Utility Revenue Agent
> **Hackathon:** ETHDenver 2026 BUIDLathon
> **Deadline:** Saturday Feb 21, 2026 at 8:00 AM MST
> **Build window:** Thu Feb 19 ~11AM -> Sat Feb 21 8:00 AM ~ 45 hours
> **Builder:** Solo
> **Last updated:** Feb 19, 2026 ~5PM MST

---

## Bounties Targeted

| Bounty | Prize Pool | Our Target |
|--------|-----------|------------|
| Base -- Self-Sustaining Autonomous Agents | $10,000 (3 prizes: $5k/$3k/$2k) | 1st place |
| 0g Labs -- Best DeFAI Application | $7,000 (2 prizes: $5k/$2k) | 1st place |
| Track: FUTURLLAMA (AI + Frontier Tech) | Track finalist | Finalist |

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | TODO -- not started |
| `[~]`  | IN PROGRESS -- currently being worked on |
| `[x]`  | DONE -- complete and verified |
| `[!]`  | BLOCKED -- waiting on something external |
| `[s]`  | STRETCH -- only if time permits |

---

## BLOCKERS (Resolve Before Writing DeFi Code)

| # | Blocker | Status | Action |
|---|---------|--------|--------|
| B1 | ERC-8021 Builder Code | `[x]` | Go to **base.dev** -> Settings -> Builder Codes -> copy into `.env.local` |
| B2 | Claude API key | `[x]` | **platform.anthropic.com** -> API Keys -> create key |
| B3 | Agent wallet private key | `[x]` | Create a fresh wallet (MetaMask, cast, or CDP portal) |
| B4 | Base mainnet funded: ~0.01 ETH + **$150-200 USDC** | `[ ]` | Bridge or buy directly on Base |
| B5 | Vercel account + KV store created | `[ ]` | Vercel Dashboard -> Storage -> KV -> Create -> copy env vars |
| B6 | Railway account for agent daemon | `[ ]` | railway.app -> New Project -> link GitHub repo |
| B7 | 0G account + testnet tokens | `[ ]` | **build.0g.ai** -> get account + faucet tokens at faucet.0g.ai |
| B8 | GitHub repo created and pushed | `[x]` | `gh repo create aura-agent --public` then push `/aura` |
| B9 | **CDP account + API keys (for x402 mainnet)** | `[x]` | **cdp.coinbase.com** -> create account -> get API key ID + secret (free tier: 1000 tx/mo) |

---

## File Completion Status

### Config & Root Files
| File | Status | Notes |
|------|--------|-------|
| `package.json` | `[x]` | Updated: added `@x402/*` packages, removed `@aave/contract-helpers`, bumped 0G SDK to 0.3.1, moved `tsx` to deps |
| `tsconfig.json` | `[x]` | Next.js + strict mode |
| `next.config.ts` | `[x]` | serverExternalPackages for 0G + ethers |
| `tailwind.config.ts` | `[x]` | AURA dark theme (space blue) |
| `postcss.config.mjs` | `[x]` | |
| `.env.example` | `[x]` | Updated: added CDP credentials, x402 facilitator URL, model config, fixed 0G indexer URL |
| `.gitignore` | `[x]` | Excludes `.env.local` and build artifacts |
| `railway.json` | `[x]` | Agent daemon deploy config -- `npm run agent:start` |

### Documentation
| File | Status | Notes |
|------|--------|-------|
| `PROGRESS.md` | `[x]` | This file -- update constantly |
| `ARCHITECTURE.md` | `[x]` | **Rewritten** with verified code patterns: viem-only Aave, @x402/next middleware, AI SDK v4.x specifics, realistic cost model |
| `README.md` | `[x]` | Public-facing -- fill live URLs before submission |

### Core Library -- Wallet
| File | Status | Notes |
|------|--------|-------|
| `src/lib/wallet/viemClient.ts` | `[x]` | viem WalletClient + PublicClient + ERC-8021 `dataSuffix` via `ox/erc8021` |

### Core Library -- DeFi
| File | Status | Notes |
|------|--------|-------|
| `src/lib/defi/aave.ts` | `[x]` | **viem-only** (no @aave/contract-helpers). Includes USDC approve step before supply. supplyUsdc/withdrawUsdc/getAaveBalance/getAaveAPY/getUsdcBalance/getEthBalance |

### Core Library -- Agent (AI Brain)
| File | Status | Notes |
|------|--------|-------|
| `src/lib/agent/state.ts` | `[x]` | `AgentState` interface + Vercel KV read/write helpers. Track `depositedUsdc` for yield calc. |
| `src/lib/agent/tools.ts` | `[x]` | Vercel AI SDK v4.x tool definitions: use `parameters` (NOT `inputSchema`), `tool` from `"ai"` |
| `src/lib/agent/agentRunner.ts` | `[x]` | `runAgentTick()` -- calls Claude Haiku with tools, uses `maxSteps` (v4.x), tracks `totalUsage.promptTokens`/`completionTokens` |
| `src/lib/agent/loop.ts` | `[x]` | Entry point for Railway daemon -- cron every 5 min, try/catch per tick |

### Core Library -- Tracking
| File | Status | Notes |
|------|--------|-------|
| `src/lib/tracking/compute.ts` | `[x]` | Accumulate Claude API call costs to Vercel KV. Haiku pricing: $1/M input, $5/M output |
| `src/lib/tracking/revenue.ts` | `[x]` | Track Aave yield delta (currentAToken - depositedUsdc) + x402 service fees |

### Core Library -- Storage
| File | Status | Notes |
|------|--------|-------|
| `src/lib/storage/zero-g.ts` | `[x]` | Upload decision logs to 0G Storage via `Indexer`; always fallback to Vercel KV. Uses ethers v6 signer (dynamic import). |

### x402 Payment Gate
| File | Status | Notes |
|------|--------|-------|
| `middleware.ts` (project root) | `[x]` | Uses `@x402/next` `paymentProxy` + `x402ResourceServer` with CDP facilitator. eip155:8453. |

### Test Scripts
| File | Status | Notes |
|------|--------|-------|
| `scripts/test-x402-client.ts` | `[x]` | Uses `@x402/fetch` + `@x402/evm` to pay AURA for analysis. Run with `npm run test:x402`. Sends 3 queries. |

### App Layer -- API Routes
| File | Status | Notes |
|------|--------|-------|
| `src/app/api/stats/route.ts` | `[x]` | `GET /api/stats` -- returns full `AgentState` from Vercel KV |
| `src/app/api/analyze/route.ts` | `[x]` | `POST /api/analyze` -- x402-gated DeFi analysis. Payment handled by middleware.ts. Uses Claude Sonnet for quality. Tracks revenue in KV. |

### App Layer -- Dashboard
| File | Status | Notes |
|------|--------|-------|
| `src/app/layout.tsx` | `[x]` | Root layout with metadata |
| `src/app/page.tsx` | `[x]` | Main dashboard -- polls `/api/stats` every 30s |
| `src/app/globals.css` | `[x]` | Tailwind base styles |

### Components
| File | Status | Notes |
|------|--------|-------|
| `src/components/WalletCard.tsx` | `[x]` | Wallet address + USDC balance + ETH gas balance |
| `src/components/StatusBadge.tsx` | `[x]` | "SELF-SUSTAINING" or "DEFICIT" big badge |
| `src/components/AavePosition.tsx` | `[x]` | Deposited amount, aUSDC balance, APY, yield earned |
| `src/components/RunwayMeter.tsx` | `[x]` | "Agent self-funded for X hours" metric + progress bar |
| `src/components/PLChart.tsx` | `[x]` | SVG line chart: cumulative yield earned vs compute cost |
| `src/components/DecisionLog.tsx` | `[x]` | Last 10 agent decisions -- fetched from 0G Storage / KV |

---

## Build Phases

### PHASE 0 -- Pre-Flight (~2h) `[ ]`
> Resolve all blockers. Nothing else starts until B1-B9 are done.

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Register ERC-8021 builder code on **base.dev** | 5 min |
| `[ ]` | Get Claude API key | 5 min |
| `[ ]` | Create and fund agent wallet (ETH + **$150-200 USDC** on Base mainnet) | 15 min |
| `[ ]` | Create GitHub repo, push `aura/` directory | 10 min |
| `[ ]` | Create Vercel project + KV store, copy env vars | 15 min |
| `[ ]` | Create Railway project, link to GitHub | 10 min |
| `[ ]` | Create 0G account, get testnet tokens from faucet.0g.ai | 15 min |
| `[ ]` | **Create CDP account at cdp.coinbase.com, get API keys** | 10 min |
| `[ ]` | Fill `.env.local` with all values | 10 min |
| `[ ]` | Run `npm install` -- verify zero errors | 5 min |

**Exit criteria:** `.env.local` fully populated. `npm install` succeeds.

---

### PHASE 1 -- Scaffold Complete `[x]`
> Config files, docs, and directory structure all written.
> **Sanity check pass completed** -- ARCHITECTURE.md rewritten with verified patterns.

**Exit criteria:** All config files present. `npm run dev` will start once deps are installed.

---

### PHASE 2 -- Wallet + DeFi Foundation (~3h) `[x]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Write `src/lib/wallet/viemClient.ts` | 20 min |
| `[ ]` | Write `src/lib/defi/aave.ts` (viem-only, with USDC approve logic) | 45 min |
| `[ ]` | Send test tx on Base mainnet -- verify ERC-8021 code on Basescan | 15 min |
| `[ ]` | Test `supplyUsdc(10)` with real USDC on Base mainnet | 20 min |
| `[ ]` | Verify aUSDC balance appears in wallet | 10 min |
| `[ ]` | Test `withdrawUsdc(5)` | 10 min |

**Exit criteria:** Real USDC earning yield in Aave V3 on Base mainnet. ERC-8021 confirmed on-chain.

---

### PHASE 3 -- AI Agent Brain (~3h) `[x]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Write `src/lib/agent/state.ts` | 20 min |
| `[ ]` | Write `src/lib/tracking/compute.ts` (Haiku pricing: $1/M in, $5/M out) | 15 min |
| `[ ]` | Write `src/lib/tracking/revenue.ts` | 15 min |
| `[ ]` | Write `src/lib/storage/zero-g.ts` (with KV fallback) | 30 min |
| `[ ]` | Write `src/lib/agent/tools.ts` (v4.x: `parameters`, not `inputSchema`) | 30 min |
| `[ ]` | Write `src/lib/agent/agentRunner.ts` (v4.x: `maxSteps`, `totalUsage.promptTokens`) | 45 min |
| `[ ]` | Write `src/lib/agent/loop.ts` | 20 min |
| `[ ]` | Run one local agent tick -- verify state writes to KV | 20 min |

**Exit criteria:** `npm run agent:dev` runs one tick successfully. State visible in Vercel KV.

---

### PHASE 4 -- x402 Analysis Service (~2h) `[x]`

| Status | Task | Est. |
|--------|------|-------|
| `[ ]` | Write `middleware.ts` (project root) using `@x402/next` `paymentProxy` | 30 min |
| `[ ]` | Write `src/app/api/analyze/route.ts` (Sonnet for analysis, track revenue in KV) | 20 min |
| `[ ]` | Write `scripts/test-x402-client.ts` using `@x402/fetch` + `@x402/evm` | 20 min |
| `[ ]` | Test x402 flow: run test script -> verify 402 -> payment -> response | 15 min |
| `[ ]` | Confirm payment credited to revenue tracker in KV | 10 min |

**Exit criteria:** `/api/analyze` endpoint live. At least one paid request completed via test script.

---

### PHASE 5 -- Dashboard (~4h) `[x]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Write `src/app/api/stats/route.ts` | 15 min |
| `[ ]` | Write `src/app/layout.tsx` + `src/app/globals.css` | 15 min |
| `[ ]` | Write `src/app/page.tsx` | 20 min |
| `[ ]` | Write all 6 components | 90 min |
| `[ ]` | Deploy to Vercel -> confirm public URL loads | 15 min |
| `[ ]` | Verify auto-poll every 30s with live data | 10 min |

**Exit criteria:** Public Vercel URL live. All panels show real on-chain data.

---

### PHASE 6 -- Deploy Agent Daemon (~1h) `[ ]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Push code to GitHub | 5 min |
| `[ ]` | Set all env vars in Railway dashboard | 15 min |
| `[ ]` | Deploy -- watch Railway logs for first successful tick | 20 min |
| `[ ]` | Confirm dashboard updates after Railway tick | 10 min |

**Exit criteria:** Agent running on Railway, ticking autonomously every 5 min, dashboard updating.

---

### PHASE 7 -- Integration Testing (~2h) `[ ]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Let agent run unattended for 2+ hours | 2h |
| `[ ]` | Run `npm run test:x402` multiple times to generate x402 revenue | 10 min |
| `[ ]` | Spot-check 3 txs on builder-code-checker.vercel.app | 10 min |
| `[ ]` | Verify `isSelfSustaining` flag logic is correct | 10 min |
| `[ ]` | Verify 0G Storage logs readable in dashboard | 10 min |
| `[ ]` | Verify Railway auto-restarts cleanly | 5 min |

**Exit criteria:** 2+ hours autonomous operation confirmed. x402 revenue visible.

---

### PHASE 8 -- Polish + Submission (~3h) `[ ]`

| Status | Task | Est. |
|--------|------|------|
| `[ ]` | Fill live URLs in `README.md` (Vercel, wallet, repo) | 10 min |
| `[ ]` | Record <3 min demo video | 30 min |
| `[ ]` | Final ERC-8021 verification (all txs have builder code) | 10 min |
| `[ ]` | Final check: public URL requires no login | 5 min |
| `[ ]` | Submit on **Devfolio** -- tag: Base + 0G Labs + FUTURLLAMA | 15 min |
| `[ ]` | **SUBMIT BEFORE 8:00 AM SAT FEB 21** | DEADLINE |

---

## MVP Checklist (Non-Negotiable)

- `[ ]` Agent wallet transacting on **Base mainnet** (not testnet)
- `[ ]` Every tx has **ERC-8021 builder code** (verify on builder-code-checker.vercel.app)
- `[ ]` Agent is **fully autonomous** -- no human input during judging window
- `[ ]` Dashboard at **public Vercel URL** -- no login, no password
- `[ ]` Dashboard prominently shows: **wallet balance** + **compute cost**
- `[ ]` At least one real **Aave V3 deposit** on Base mainnet
- `[ ]` At least one real **x402 payment** made or received
- `[ ]` **Public GitHub repo** with README + live URL
- `[ ]` **Devfolio submission** before deadline

---

## Win Checklist (Above MVP)

- `[ ]` `isSelfSustaining: true` provable on dashboard (revenue > compute cost)
- `[ ]` Dual revenue: Aave yield + x402 service fees both showing
- `[ ]` 0G Storage decision logs visible in dashboard (decentralized AI reasoning)
- `[ ]` Runway meter: "Agent self-funded for X more hours"
- `[ ]` All ERC-8021 builder codes verified on Basescan

---

## Stretch Goals (Only After Phases 0-7 Complete)

- `[s]` Register AURA with ERC-8004 agent identity on-chain
- `[s]` Add Limitless prediction market monitoring (read-only)
- `[s]` Multi-agent demo: second agent buys analysis from AURA via x402

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Feb 19 | **Vercel AI SDK + Claude** as AI agent framework | `generateText` with Zod tools -- proper AI agent tool-calling |
| Feb 19 | Aave USDC only (no Uni V3 LP) | Uni V3 adds IL risk + 5h complexity -- too risky solo/45h |
| Feb 19 | Railway for agent daemon, Vercel for dashboard | Vercel serverless can't run persistent cron loop |
| Feb 19 | Vercel KV as primary state, 0G Storage as decentralized log | Fast reads from KV; 0G provides immutable audit trail |
| Feb 19 | `ethers` added for 0G SDK compatibility only | 0G TS SDK requires ethers signer; isolated to `zero-g.ts` |
| Feb 19 | **Haiku for ticks, Sonnet for x402 analysis** | Haiku is ~$0.002/tick ($0.50/day). Sonnet for paid analysis quality. |
| Feb 19 | **$150-200 USDC seed capital** | $75 yield too low; $150-200 + x402 revenue makes sustainability credible |
| Feb 19 | **viem-only for Aave** (removed `@aave/contract-helpers`) | `@aave/contract-helpers` requires ethers; raw viem is simpler |
| Feb 19 | **`@x402/next` middleware** replaces custom x402 logic | Library handles payment validation, facilitator communication, 402 responses |
| Feb 19 | **CDP facilitator for mainnet x402** | Free testnet facilitator doesn't support Base mainnet; CDP required |
| Feb 19 | **0G SDK bumped to v0.3.1** | v0.2.1 outdated; v0.3.1 is latest with Batcher API for KV data |
| Feb 19 | **`tsx` moved to deps** (not devDeps) | Railway needs tsx at runtime for `npm run agent:start` |
| Feb 19 | **test-x402-client.ts promoted to required** | Need at least one x402 payment for MVP; can't rely on external clients |

---

## Sanity Check Notes (Feb 19 ~2PM)

**Verified correct:**
- ERC-8021 via `ox/erc8021` `Attribution.toDataSuffix` + viem `dataSuffix` -- confirmed working
- Aave V3 Pool address `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` -- confirmed Base mainnet
- USDC address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` -- confirmed
- aUSDC address `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` -- confirmed (also verify via getReserveData)
- Vercel AI SDK v4.x tool pattern: `tool()` from `"ai"`, `parameters` (Zod), `maxSteps`, `totalUsage.promptTokens`/`completionTokens`

**Fixed in this session:**
- Removed `@aave/contract-helpers` + `@aave/math-utils` (don't work with viem)
- Added `@x402/next`, `@x402/core`, `@x402/evm`, `@x402/fetch` packages
- Bumped `@0glabs/0g-ts-sdk` from 0.2.1 to 0.3.1
- Moved `tsx` from devDeps to deps
- Added USDC approval step to Aave integration
- Replaced custom x402 server.ts with `@x402/next` middleware.ts pattern
- Added B9 blocker (CDP credentials for mainnet x402)
- Updated seed capital from $75 to $150-200
- Added dual-model strategy (Haiku ticks + Sonnet analysis)
- Fixed 0G indexer URL to `indexer-storage-testnet-turbo.0g.ai`
- Removed `LLM_PROVIDER` toggle (always use Claude; 0G for storage only)
- Added `scripts/test-x402-client.ts` as required (not stretch)

---

## Time Budget

| Phase | Est. Hours | Status |
|-------|-----------|--------|
| 0 -- Pre-flight (credentials) | 2h | `[ ]` |
| 1 -- Scaffold (config + docs) | 2h | `[x]` |
| 2 -- Wallet + DeFi | 3h | `[x]` |
| 3 -- AI Agent Brain | 3h | `[x]` |
| 4 -- x402 Service | 2h | `[x]` |
| 5 -- Dashboard | 4h | `[x]` |
| 6 -- Deploy Agent Daemon | 1h | `[ ]` |
| 7 -- Integration Testing | 2h | `[ ]` |
| 8 -- Polish + Submit | 3h | `[ ]` |
| **Total build** | **22h** | |
| Sleep + buffer | ~23h | |

---

## Key Links (fill in as you go)

| Resource | URL |
|----------|-----|
| Live dashboard | -- |
| GitHub repo | -- |
| Railway agent logs | -- |
| Agent wallet on Basescan | -- |
| Builder code checker | https://builder-code-checker.vercel.app |
| Devfolio submission | -- |
| Demo video | -- |

---

## How to Resume This Session

Start a new Claude Code session and say exactly this:

> "Continue building the AURA project for ETHDenver 2026. Please read these two files in order before writing any code:
> 1. `/Users/xandev/Desktop/Solidity_Project_Files/EthDenver/Buidlathon2026/aura/PROGRESS.md` -- what's done, what's left, key decisions, and sanity check notes
> 2. `/Users/xandev/Desktop/Solidity_Project_Files/EthDenver/Buidlathon2026/aura/ARCHITECTURE.md` -- full technical spec with verified code patterns and contract addresses
>
> Then write all remaining files marked `[ ]` in PROGRESS.md, starting with the core lib files."

### What a new agent needs to know (summary)
- **Stack:** Next.js 15, Vercel AI SDK v4.x + Claude Haiku (ticks) / Sonnet (analysis), viem, Aave V3, x402, 0G Storage, Vercel KV
- **Agent pattern:** `generateText` with Zod tools using `parameters` (NOT `inputSchema`) and `maxSteps` (NOT `stopWhen`) -- this is v4.x
- **Token tracking:** `result.totalUsage.promptTokens` and `result.totalUsage.completionTokens` (v4.x names)
- **ERC-8021:** Applied via `ox/erc8021` `Attribution.toDataSuffix` in `viemClient.ts` -- auto-tags ALL txs
- **Wallet:** Private key in env var -> viem `privateKeyToAccount` (simple, reliable for hackathon)
- **Aave:** viem-only with inline ABI fragments. MUST approve USDC before supply. No `@aave/contract-helpers`.
- **x402:** Uses `@x402/next` middleware at project root (`middleware.ts`), NOT custom logic. CDP facilitator for mainnet.
- **State shared via:** Vercel KV (Railway agent daemon <-> Vercel dashboard)
- **0G Storage:** Decision logs only -- uses `@0glabs/0g-ts-sdk@0.3.1` + `ethers` signer, KV fallback if unavailable
- **Safety floor:** Never drop below $25 USDC total -- hardcoded in tools + system prompt
- **Cost model:** Haiku ~$0.002/tick, ~$0.50/day. Yield ~$0.02/day on $150. x402 test script needed to close gap.
