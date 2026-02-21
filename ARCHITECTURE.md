# AURA — Technical Architecture

> **AURA** = Autonomous Utility Revenue Agent
> Chain: Base Mainnet | AI: Claude (Anthropic) via Vercel AI SDK | Framework: Next.js 16 + AgentKit pattern

---

## 1. System Overview

AURA is a self-sustaining AI agent that earns more than it spends on compute — achieving economic autonomy on Base mainnet.

### The Self-Sustaining Loop

```
[Seed: ~$150-200 USDC on Base Mainnet]
        |
        +---> Aave V3 USDC Deposit ---> ~3-5% APY passive yield
        |         aUSDC balance         (compounds continuously)
        |
        +---> x402 DeFi Analysis Service ---> 0.01 USDC per request
        |    (Claude analyzes DeFi data       (any agent/client can pay)
        |     on demand, paid per query)
        |
        +---> Compute Cost Tracker
                 | Every Claude API call is logged with cost
                 | Revenue - Cost = Net P&L
                 | isSelfSustaining = (total revenue > total compute cost)
                 | Runway = surplus / hourly_compute_rate
```

### Cost Model (Realistic)

| Item                                                    | Cost                     |
| ------------------------------------------------------- | ------------------------ |
| Haiku tick (~1000 input + ~150 output tokens)           | ~$0.002/tick             |
| 288 ticks/day (every 5 min)                             | ~$0.50/day               |
| Sonnet x402 analysis — short query (~250+75 in, ~300 out) | ~$0.0100 (floor)       |
| Sonnet x402 analysis — typical query (~250+200 in, ~317 out) | ~$0.0115            |
| Sonnet x402 analysis — max query (2000 chars capped)   | ~$0.0189                 |
| Aave yield on $150 at 4% APY                            | ~$0.016/day              |
| Break-even x402 requests needed                         | ~27-50/day (query-size dependent) |

**Strategy:** Haiku handles cheap routine ticks; Aave yield + x402 service fees together cover compute. Dynamic pricing (2x margin on estimated Sonnet cost) ensures every analysis request is profitable regardless of query size. The dashboard shows trajectory toward full self-sustainability.

### Three Services

| Service           | Runtime                      | Purpose                          |
| ----------------- | ---------------------------- | -------------------------------- |
| **Agent Daemon**  | Railway (persistent Node.js) | AI decision loop every 5 min     |
| **Dashboard API** | Vercel (Next.js API routes)  | Serves agent state to frontend   |
| **Dashboard UI**  | Vercel (Next.js React)       | Public read-only view for judges |

State is shared via **Vercel KV** (Redis). Decision history is stored on **0G Storage** (decentralized).

---

## 2. The AI Agent (Vercel AI SDK + Claude)

The agent uses the **Vercel AI SDK v4.x** with **Claude Haiku** (routine ticks) and **Claude Sonnet** (x402 analysis) and explicit Zod tool definitions.

### How It Works

```
Every 5 minutes (Railway cron):
  1. Check aura:paused flag in KV — skip tick if true (manual kill-switch)
  2. Read current state (KV + on-chain)
  3. Call Claude Haiku with tools + decision prompt
  4. Claude reasons -> calls tools (up to 5 steps via maxSteps)
  5. Tools execute on-chain (Aave, balance reads)
  6. Log decision to 0G Storage + KV
  7. Update dashboard state in KV
  8. Track token usage -> compute cost (promptTokens, completionTokens)
```

### Agent Pause (Cost Control)

Set `aura:paused = true` in Vercel KV to skip all ticks without stopping the Railway process. Delete the key or set to `false` to resume. Implemented in `src/lib/agent/loop.ts` + `src/lib/agent/state.ts` (`checkIsPaused` / `PAUSE_KEY`). Saves ~$0.86/day while paused.

### Vercel AI SDK v4.x Specifics

**IMPORTANT:** The project uses `"ai": "^4.1.0"`. These property names are v4-specific:

| Concept              | v4.x (this project)      | v5+ (DO NOT USE)           |
| -------------------- | ------------------------ | -------------------------- |
| Tool schema property | `parameters`             | `inputSchema`              |
| Multi-step control   | `maxSteps: 5`            | `stopWhen: stepCountIs(5)` |
| Input token count    | `usage.promptTokens`     | `usage.inputTokens`        |
| Output token count   | `usage.completionTokens` | `usage.outputTokens`       |

### Model Strings (for `@ai-sdk/anthropic`)

```typescript
import { anthropic } from "@ai-sdk/anthropic";

// Routine agent ticks (cheap)
const tickModel = anthropic(process.env.AGENT_TICK_MODEL || "claude-haiku-4-5");

// x402 analysis service (quality)
const analysisModel = anthropic(
  process.env.AGENT_ANALYSIS_MODEL || "claude-sonnet-4-5",
);
```

### Claude's Available Tools

| Tool                | What It Does                      | On-Chain?     |
| ------------------- | --------------------------------- | ------------- |
| `getWalletBalance`  | Read USDC + ETH balance           | Read (free)   |
| `getAavePosition`   | Read aUSDC balance + APY          | Read (free)   |
| `supplyToAave`      | Approve + Deposit USDC to Aave V3 | Write (gas)   |
| `withdrawFromAave`  | Withdraw USDC from Aave V3        | Write (gas)   |
| `getComputeMetrics` | Return cost vs revenue summary    | No (KV read)  |
| `logDecision`       | Save reasoning to 0G Storage      | No (API call) |

### Claude's System Prompt (Abridged)

```
You are AURA, an Autonomous Utility Revenue Agent on Base mainnet.
Mission: earn more from DeFi yield + x402 services than you spend on compute.

Revenue sources:
  1. Aave V3 USDC lending yield (~3-5% APY)
  2. x402 analysis service fees (0.01 USDC/request from clients)

Safety rules (NON-NEGOTIABLE):
  - Never let total USDC drop below $25
  - Only deposit idle USDC above $35
  - Never use volatile assets for principal
  - Never take leveraged positions
```

---

## 3. Directory Structure

```
aura/
+-- PROGRESS.md              <-- Build tracker -- update constantly
+-- ARCHITECTURE.md          <-- This file
+-- README.md                <-- Public-facing, fill URLs before submit
+-- package.json
+-- tsconfig.json
+-- next.config.ts
+-- tailwind.config.ts
+-- postcss.config.mjs
+-- middleware.ts             <-- x402 payment gate (Next.js middleware)
+-- .env.example             <-- Template -- copy to .env.local
+-- .gitignore
+-- railway.json             <-- Agent daemon deploy config
+-- scripts/
|   +-- test-x402-client.ts  <-- Test script: pays AURA for analysis
+-- src/
    +-- lib/                 <-- All shared logic (agent + dashboard)
    |   +-- wallet/
    |   |   +-- viemClient.ts        <-- viem WalletClient + ERC-8021
    |   +-- defi/
    |   |   +-- aave.ts              <-- Aave V3 supply/withdraw/read (viem-only)
    |   +-- agent/
    |   |   +-- state.ts             <-- AgentState schema + KV I/O
    |   |   +-- tools.ts             <-- Claude tool definitions (Zod)
    |   |   +-- agentRunner.ts       <-- runAgentTick() -- Claude call
    |   |   +-- loop.ts              <-- Railway entry: cron + startup
    |   +-- tracking/
    |   |   +-- compute.ts           <-- Accumulate LLM call costs
    |   |   +-- revenue.ts           <-- Track yield + x402 fees
    |   +-- pricing/
    |   |   +-- estimator.ts         <-- Dynamic x402 price estimation (query length → Sonnet cost)
    |   +-- storage/
    |       +-- zero-g.ts            <-- 0G Storage upload + KV fallback
    +-- app/                 <-- Next.js App Router (Vercel)
    |   +-- layout.tsx
    |   +-- page.tsx                 <-- Main dashboard
    |   +-- api/
    |       +-- stats/route.ts       <-- GET agent state from KV
    |       +-- analyze/route.ts     <-- POST x402-gated DeFi analysis
    +-- components/          <-- React UI components
        +-- WalletCard.tsx
        +-- StatusBadge.tsx
        +-- AavePosition.tsx
        +-- RunwayMeter.tsx
        +-- PLChart.tsx
        +-- DecisionLog.tsx
```

**Changes from original plan:**

- `middleware.ts` at project root replaces `src/lib/x402/server.ts` (uses `@x402/next` library)
- `scripts/test-x402-client.ts` promoted from stretch goal to required
- `@aave/contract-helpers` removed — using viem directly with ABI fragments

---

## 4. ERC-8021 Builder Code Integration (`src/lib/wallet/viemClient.ts`)

**IMPORTANT:** viem does NOT support `dataSuffix` on `createWalletClient`. It must be passed to every individual `writeContract` call. `builderCodeSuffix` is exported from `viemClient.ts` and imported in `aave.ts` for every write.

```typescript
// viemClient.ts
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { Attribution } from "ox/erc8021";
import { privateKeyToAccount } from "viem/accounts";

// Export so aave.ts can pass it to every writeContract call
export const builderCodeSuffix = Attribution.toDataSuffix({
  codes: [process.env.ERC8021_BUILDER_CODE!],
});

export const account = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`,
);

export const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  // NOTE: dataSuffix does NOT go here — viem doesn't support it at client level
});

export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});
```

```typescript
// aave.ts — pass builderCodeSuffix to every writeContract call
import { builderCodeSuffix } from "../wallet/viemClient";

await walletClient.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [AAVE_POOL, maxUint256],
  dataSuffix: builderCodeSuffix, // <-- ERC-8021 applied here
});

await walletClient.writeContract({
  address: AAVE_POOL,
  abi: AAVE_POOL_ABI,
  functionName: "supply",
  args: [USDC, amount, account.address, 0],
  dataSuffix: builderCodeSuffix, // <-- ERC-8021 applied here
});
```

**Verify:** After every tx, paste hash into https://builder-code-checker.vercel.app/

---

## 5. Aave V3 Integration (`src/lib/defi/aave.ts`)

Uses **viem directly** with inline ABI fragments. Does NOT use `@aave/contract-helpers` (it requires ethers).

### Contract Addresses (Base Mainnet)

| Contract                | Address                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Aave V3 Pool            | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`                                        |
| Aave Pool Data Provider | `0x2d8A3C5677189723C4cB8873CfC9C8976dfe292a`                                        |
| USDC (Base)             | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`                                        |
| aUSDC (Base)            | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` (verify via getReserveData at runtime) |

### IMPORTANT: USDC Approval Required Before Supply

You **must** call `USDC.approve(aavePool, amount)` before calling `pool.supply()`. Recommended: approve `maxUint256` once at startup to avoid re-approving each time.

### ABI Fragments (inline — no external package needed)

```typescript
export const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;
```

### Key Functions

```typescript
import { parseUnits, formatUnits, erc20Abi, maxUint256 } from "viem";
import { publicClient, walletClient, account } from "../wallet/viemClient";

const AAVE_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const A_USDC = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB" as const;

// Supply USDC — checks allowance and approves if needed, then supplies
export async function supplyUsdc(amountUsdc: number): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc.toString(), 6);

  // Check and approve if needed
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, AAVE_POOL],
  });
  if (allowance < amount) {
    const approveTx = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [AAVE_POOL, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // Supply
  const supplyTx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [USDC, amount, account.address, 0],
  });
  await publicClient.waitForTransactionReceipt({ hash: supplyTx });
  return supplyTx;
}

// Withdraw USDC
export async function withdrawUsdc(amountUsdc: number): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc.toString(), 6);
  const tx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [USDC, amount, account.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  return tx;
}

// Read current aUSDC balance
// NOTE: "deposited" must be tracked in KV state since aTokens rebase continuously
export async function getAaveBalance(): Promise<{ current: number }> {
  const balance = await publicClient.readContract({
    address: A_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  return { current: Number(formatUnits(balance, 6)) };
}

// Read current USDC supply APY from on-chain data
export async function getAaveAPY(): Promise<number> {
  const reserveData = await publicClient.readContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "getReserveData",
    args: [USDC],
  });
  const RAY = 1e27;
  const SECONDS_PER_YEAR = 31536000;
  const rate = Number(reserveData.currentLiquidityRate) / RAY;
  return (Math.pow(1 + rate / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
}
```

### Yield Tracking

aUSDC balance on-chain = principal + accrued interest (it rebases). To track yield:

- Store `totalDeposited` and `totalWithdrawn` in Vercel KV (`AgentState.aavePosition.depositedUsdc`)
- Update on every supply/withdraw
- `yieldEarned = currentATokenBalance - (totalDeposited - totalWithdrawn)`

---

## 6. Agent State Schema (`src/lib/agent/state.ts`)

```typescript
interface AgentState {
  // Identity
  walletAddress: string;
  startedAt: string;
  lastTickAt: string;
  totalTicks: number;

  // Balances
  liquidUsdcBalance: number;
  ethBalance: number;

  // Aave position
  aavePosition: {
    depositedUsdc: number; // cumulative deposits - withdrawals (tracked in KV)
    currentATokenBalance: number; // live on-chain aUSDC balance
    currentApyPct: number;
    yieldEarnedTotalUsd: number; // currentAToken - depositedUsdc
  } | null;

  // Self-sustaining metrics
  computeCostTodayUsd: number;
  computeCostTotalUsd: number;
  x402RevenueUsd: number;
  yieldRevenueTotalUsd: number;
  totalRevenueUsd: number; // x402 + yield
  netPnlUsd: number; // totalRevenue - computeCostTotal
  isSelfSustaining: boolean; // totalRevenue > computeCostTotal
  runwayHours: number; // surplus / hourlyComputeRate

  // Logs
  decisionLog: DecisionLogEntry[];
  zgStorageRoots: string[]; // 0G Storage tx hashes for audit
}
```

---

## 7. Claude Tool Definitions (`src/lib/agent/tools.ts`)

```typescript
import { tool } from "ai"; // v4.x: "tool" imported from "ai"
import { z } from "zod";

export const auraTools = {
  getWalletBalance: tool({
    description: "Get current USDC and ETH wallet balances",
    parameters: z.object({}), // v4.x: use "parameters" (NOT "inputSchema")
    execute: async () => {
      /* reads from chain */
    },
  }),
  getAavePosition: tool({
    description:
      "Get current Aave V3 USDC deposit, aToken balance, APY, and yield earned",
    parameters: z.object({}),
    execute: async () => {
      /* reads from chain + KV */
    },
  }),
  supplyToAave: tool({
    description:
      "Supply USDC to Aave V3 lending pool to earn yield. Only call if liquid balance is above $35.",
    parameters: z.object({
      amountUsdc: z
        .number()
        .describe("Amount of USDC to supply (max 80% of liquid balance)"),
    }),
    execute: async ({ amountUsdc }) => {
      /* approves + writes to chain */
    },
  }),
  withdrawFromAave: tool({
    description:
      "Withdraw USDC from Aave V3. Only call if liquid balance is below $30.",
    parameters: z.object({
      amountUsdc: z.number().describe("Amount of USDC to withdraw"),
    }),
    execute: async ({ amountUsdc }) => {
      /* writes to chain */
    },
  }),
  getComputeMetrics: tool({
    description:
      "Get current compute cost vs revenue summary to assess sustainability",
    parameters: z.object({}),
    execute: async () => {
      /* reads from KV */
    },
  }),
  logDecision: tool({
    description:
      "Log the agent's decision and reasoning to 0G Storage for transparency",
    parameters: z.object({
      action: z
        .string()
        .describe("Action taken: hold | supply_to_aave | withdraw_from_aave"),
      reasoning: z.string().describe("1-2 sentence explanation"),
      status: z.enum(["SELF_SUSTAINING", "DEFICIT"]),
    }),
    execute: async (entry) => {
      /* uploads to 0G, fallback to KV */
    },
  }),
};
```

### Agent Runner Pattern (v4.x)

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await generateText({
  model: anthropic(process.env.AGENT_TICK_MODEL || "claude-haiku-4-5"),
  system: AURA_SYSTEM_PROMPT,
  prompt: `Current state: ${JSON.stringify(currentState)}. What action should you take?`,
  tools: auraTools,
  maxSteps: parseInt(process.env.AGENT_MAX_STEPS || "5"), // v4.x: maxSteps
});

// Track token usage for cost accounting (v4.x property names)
const inputTokens = result.totalUsage.promptTokens;
const outputTokens = result.totalUsage.completionTokens;
```

---

## 8. x402 Analysis Service (`src/app/api/analyze/route.ts`)

AURA sells DeFi analysis on-demand using the **x402 protocol** with **dynamic per-query pricing**. Payment gating lives in the route handler (NOT middleware.ts) because Next.js middleware runs in Edge Runtime which lacks the Node.js crypto APIs required by `@x402/evm`.

### Why Route-Level, Not Middleware

`middleware.ts` is a pass-through stub. x402 gating is handled by the `withX402` wrapper in the route file, which runs in Node.js runtime. See TROUBLESHOOTING_X402.md for full debug history.

### Dynamic Pricing (`src/lib/pricing/estimator.ts`)

Price is estimated pre-inference from the query text length using a token approximation:

```typescript
// MAX_QUERY_CHARS = 2000 — hard cap for abuse protection
const effectiveChars = Math.min(query.length, MAX_QUERY_CHARS);
const queryTokens = Math.ceil(effectiveChars / 4);
const inputTokens = 250 /*system prompt*/ + queryTokens;
const outputTokens = 300 + Math.ceil(effectiveChars / 12);
// Sonnet: $3/M input, $15/M output — 2x margin
const price = clamp(rawCost * 2.0, min=$0.01, max=$0.10);
```

**Abuse protection:** Any query exceeding 2000 characters is silently truncated before both pricing and inference. Max spend per request is bounded to ~$0.0094 regardless of what the client sends. Response includes `queryTruncated: true` if truncation occurred.

### Body Cache Pattern

`withX402` calls the price function before the handler. `context.adapter.getBody()` consumes the HTTP body stream, so the handler can't call `req.json()` again. Solution: `WeakMap<NextRequest, ...>` populated in the price function, read in the handler.

### Route Handler (Current Implementation)

```typescript
// Body cache — solves double-stream-read problem
const bodyCache = new WeakMap<NextRequest, { query: string; estimatedPrice: number; queryTruncated: boolean }>();

// DynamicPrice function — passed to withX402 instead of a static string
const dynamicPrice = async (context: HTTPRequestContext): Promise<string> => {
  const nextReq = (context.adapter as any).req as NextRequest;
  const body = await context.adapter.getBody?.() as { query?: string } | undefined;
  const rawQuery = (body?.query ?? "").trim();
  const query = rawQuery.slice(0, MAX_QUERY_CHARS); // abuse cap
  const price = estimatePrice(query);
  bodyCache.set(nextReq, { query, estimatedPrice: price, queryTruncated: rawQuery.length > MAX_QUERY_CHARS });
  return formatX402Price(price); // e.g. "$0.0142"
};

async function handler(req: NextRequest) {
  const cached = bodyCache.get(req);
  bodyCache.delete(req);
  const query = cached?.query ?? "";
  const estimatedPrice = cached?.estimatedPrice ?? 0.01;

  const result = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    prompt: `Analyze this DeFi topic: ${query}`,
    maxSteps: 1,
  });

  await trackX402Revenue(estimatedPrice); // actual amount, not hardcoded

  return NextResponse.json({
    analysis: result.text,
    pricePaid: formatX402Price(estimatedPrice),
    estimatedCost: `$${actualCost.toFixed(5)}`,
    margin: `${(estimatedPrice / actualCost).toFixed(2)}x`,
    queryTruncated: cached?.queryTruncated,
  });
}

export const POST = withX402(handler, {
  accepts: [{ scheme: "exact", price: dynamicPrice, network: "eip155:8453", payTo: process.env.AGENT_WALLET_ADDRESS! }],
  description: "AURA DeFi Analysis — dynamic pricing by query complexity",
  mimeType: "application/json",
}, x402Server);
```

### Revenue Tracking

`trackX402Revenue(estimatedPrice)` is called with the actual dynamic amount (not hardcoded $0.01). The amount reflects the pre-inference price estimate used in the 402 response.

### Claude's system prompt (for x402 analysis)
Uses a shorter, analysis-focused system prompt (~250 tokens constant overhead). The `SYSTEM_PROMPT_TOKENS = 250` constant in `estimator.ts` should be updated if the system prompt changes significantly.

### Facilitator URLs

| Environment            | URL                                             | Auth                  |
| ---------------------- | ----------------------------------------------- | --------------------- |
| Base Mainnet           | `https://api.cdp.coinbase.com/platform/v2/x402` | CDP API keys required |
| Base Sepolia (testing) | `https://www.x402.org/facilitator`              | Free, no auth         |

**For production (bounty submission), use the CDP facilitator with credentials from cdp.coinbase.com.**

### Test Client (`scripts/test-x402-client.ts`)

```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`,
);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment("https://YOUR_VERCEL_URL/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "What is the current Aave USDC APY on Base?" }),
});
console.log(await response.json());
```

Run with: `npm run test:x402`

---

## 9. 0G Storage Integration (`src/lib/storage/zero-g.ts`)

Uses `@0glabs/0g-ts-sdk` v0.3.1 + **ethers 6.13.1** (pinned — no caret). Uploads decision logs as JSON to 0G Storage testnet.

### Upload Pattern (Batcher for KV data)

```typescript
import { Batcher, Indexer } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL);
const signer = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, provider);
const indexer = new Indexer(process.env.ZG_INDEXER_URL!);
```

For uploading raw JSON blobs, use the `Batcher` class with `streamDataBuilder.set()`, or write JSON to a temp file and use `indexer.upload()`.

### Decision Entry Schema

```typescript
interface DecisionLogEntry {
  timestamp: string;
  tick: number;
  action: string;
  reasoning: string;
  status: "SELF_SUSTAINING" | "DEFICIT";
  balances: { liquidUsdc: number; aaveDeposit: number };
  computeCostUsd: number;
  revenueUsd: number;
  txHash?: string; // if an on-chain action was taken
  zgStorageRoot?: string; // 0G merkle root of this entry
  storedOn: "0g" | "kv"; // where this entry is stored
}
```

**Fallback:** If 0G Storage is unavailable, entries are stored in Vercel KV with `storedOn: "kv"`. The dashboard shows the storage source for each entry. Implement 0G with try/catch and always fall through to KV.

---

## 10. Dashboard Data Flow

```
[Railway: Agent Daemon]             [Vercel KV]
  Every 5 min:                       <-> read/write
    1. Read chain state          <-- AgentState JSON
    2. Claude (Haiku) decides + acts
    3. Upload log to 0G          --> [0G Storage]
    4. Write state to KV         --> AgentState JSON

[Vercel: Next.js Middleware]
  x402 payment gate on /api/analyze

[Vercel: Next.js API]
  GET /api/stats                 <-- reads KV -> returns AgentState
  POST /api/analyze              <-- x402-gated -> Claude (Sonnet) -> returns analysis

[Vercel: Next.js UI]
  page.tsx polls /api/stats every 30s
    -> WalletCard      (liquid balance)
    -> StatusBadge     (SELF_SUSTAINING / DEFICIT)
    -> AavePosition    (deposit, APY, yield)
    -> RunwayMeter     (hours of compute funded)
    -> PLChart         (yield vs cost over time)
    -> DecisionLog     (last 10 decisions from 0G / KV)
```

---

## 11. Key Contract Addresses (Base Mainnet)

| Contract                 | Address                                      |
| ------------------------ | -------------------------------------------- |
| Aave V3 Pool             | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| Aave Pool Data Provider  | `0x2d8A3C5677189723C4cB8873CfC9C8976dfe292a` |
| USDC (Base)              | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| aUSDC (Base)             | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` |
| WETH (Base)              | `0x4200000000000000000000000000000000000006` |
| Chainlink ETH/USD (Base) | `0x71041dddad3595F9CEd3dCCFBe3D1F4b0a16Bb70` |

---

## 12. Security Notes

- **NEVER commit `.env.local`** — it contains the agent's private key
- Agent private key stored only in Railway + Vercel dashboard env vars
- **NEVER print a private key or api key out to the terminal or chat interface without explicit permission from the human/user**
- Dashboard is fully read-only — no write operations from the frontend
- Agent enforces hard minimum balance: never drops below $25 USDC total
- Maximum single Aave deposit: 80% of liquid balance (preserves gas reserves)
- USDC approval uses `maxUint256` for convenience — acceptable for a hackathon agent wallet
