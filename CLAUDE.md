# CLAUDE.md — AURA Agent Context

> Skills sourced from https://ethskills.com (verified Feb 2026).
> Read PROGRESS.md + ARCHITECTURE.md before writing any code.

---

## Critical Facts (What AI Models Get Wrong)

- **USDC has 6 decimals, NOT 18.** `1_000_000` = $1. This is the #1 "where did my money go?" bug. Every USDC amount in this project must use 6-decimal units.
- **Gas is 0.05–0.1 gwei**, not 10–30 gwei. ETH ~$1,960 (Feb 2026). Mainnet is cheap. Base is ~50% cheaper than mainnet.
- **Base chain ID: 8453.** RPC: `https://mainnet.base.org`. Explorer: https://basescan.org.
- **ERC-8004 and x402 are live and production-ready** (not "coming soon" or "experimental"). ERC-8004 deployed Jan 29, 2026 on 20+ chains. x402 is the HTTP 402 payment protocol — it is what we're implementing.
- **EIP-7702 is live** (shipped May 7, 2025 with Pectra). EOAs can delegate to smart contracts within a transaction.
- Say **"onchain"** (one word, no hyphen). Ethereum community convention.

---

## Standards Used in This Project

### x402 — HTTP Payment Protocol
- Status code 402 triggers payment negotiation between client and server.
- Payment settled via **EIP-3009** gasless transfer — USDC implements this. Server settles payment without requiring client to hold gas tokens.
- Flow: client hits endpoint → 402 response with payment requirements → client signs EIP-3009 authorization → server submits to facilitator → facilitator settles → endpoint responds.
- We use **`@x402/next`** middleware (`middleware.ts` at project root) with **CDP facilitator** for Base mainnet. The free testnet facilitator does NOT support Base mainnet.
- Key package: `@x402/next` (server), `@x402/fetch` + `@x402/evm` (client/test script).

### ERC-8004 — Onchain Agent Identity
- NFT-based registry for AI agent identity, reputation, and validation.
- Deployed Jan 29, 2026 on 20+ chains including Base.
- Enables agents to establish trust and transact without prior relationships.
- In AURA: stretch goal (Phase 8) — register AURA as an onchain agent identity.

### EIP-3009 — Gasless Token Transfers
- Signed authorizations allow third-party submission of token transfers.
- USDC implements this natively — it's what powers x402 payments.
- Clients don't need ETH for gas; the facilitator pays gas and gets reimbursed.

### ERC-8021 — Builder Codes
- Apply via `ox/erc8021` `Attribution.toDataSuffix` in `viemClient.ts`.
- MUST be on every Base mainnet transaction (required for Base bounty).
- Verify at: https://builder-code-checker.vercel.app

---

## Security — Critical Patterns

### USDC Decimals (6, NOT 18)
```typescript
// USDC = 6 decimals. ALWAYS.
const USDC_DECIMALS = 6;
const oneUSDC = 1_000_000n;  // = $1.00
const oneHundredUSDC = 100_000_000n;  // = $100.00

// Correct: parseUnits("100", 6) = 100_000_000n
// Wrong:   parseUnits("100", 18) → 100x larger → would drain wallet instantly
```

### Always Use SafeERC20 (in Solidity)
```solidity
// USDT doesn't return bool on transfer() — SafeERC20 handles this
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;
token.safeTransfer(to, amount);  // not token.transfer(to, amount)
```

### USDC Approval Before Aave Supply
```typescript
// MUST approve USDC before calling supply on Aave Pool
// Step 1: approve
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [AAVE_POOL_ADDRESS, amount],
  dataSuffix: buildersDataSuffix,
});
// Step 2: supply
await walletClient.writeContract({
  address: AAVE_POOL_ADDRESS,
  abi: AAVE_POOL_ABI,
  functionName: 'supply',
  args: [USDC_ADDRESS, amount, walletAddress, 0],
  dataSuffix: buildersDataSuffix,
});
```

### Never Commit Secrets to Git
**NEVER commit private keys, API keys, or RPC URLs with embedded keys.**
- Bots scrape GitHub in real-time and drain wallets within seconds — even from private repos.
- This is the #1 way AI coding agents lose funds.
- `.env.local` is in `.gitignore`. Keep it there.
- If a key is ever committed: assume compromised, transfer funds immediately, rotate the key.

### No DEX Spot Prices as Oracles
- Flash loans can manipulate DEX spot prices within one transaction.
- Use Chainlink with staleness checks for any price oracle needs.

### Agent Safety Floor
- **Never drop below $25 USDC total** — hardcoded in tools + system prompt.
- Keep separate gas reserve (ETH) — never let gas balance hit zero.

---

## Verified Contract Addresses (Base Mainnet)

> All verified via block explorer cross-reference (Feb 2026). Wrong address = lost funds. Never guess.

| Contract | Address |
|----------|---------|
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| aUSDC (interest-bearing) | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Aerodrome Router (Aero) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Factory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |

> Uniswap V4 PoolManager (mainnet, NOT Base): `0x000000000004444c5dc75cB358380D2e3dE08A90`
> Dominant DEX on Base is **Aero** (formerly Aerodrome), NOT Uniswap.

---

## Gas & Cost Model (Base Mainnet, Feb 2026)

| Action | Base Cost |
|--------|-----------|
| ETH transfer | ~$0.0003 |
| ERC-20 transfer | ~$0.001 |
| ERC-20 approve | ~$0.001 |
| Uniswap/Aero swap | ~$0.002–0.003 |
| ERC-20 deploy | ~$0.020 |

**AURA cost model:**
- Agent tick (Haiku): ~$0.002 in API costs + ~$0.001 in gas = ~$0.003/tick
- At 5-min intervals: ~$0.86/day compute + gas
- Aave yield on $150 USDC at ~5% APY: ~$0.021/day
- x402 service fees needed to close the gap to sustainability

**Fee settings for Base:**
```typescript
maxFeePerGas: parseGwei("0.5"),       // headroom for spikes
maxPriorityFeePerGas: parseGwei("0.01"),
```

---

## Aave V3 Integration (viem-only, no @aave/contract-helpers)

```typescript
// Minimal ABI for supply
const AAVE_POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { name: 'configuration', type: 'uint256' },
      { name: 'liquidityIndex', type: 'uint128' },
      { name: 'currentLiquidityRate', type: 'uint128' },
      // ... full struct in ARCHITECTURE.md
    ],
  },
] as const;

// Current APY from Aave (currentLiquidityRate is RAY-scaled = 1e27)
const RAY = 10n ** 27n;
const currentLiquidityRate = reserveData.currentLiquidityRate;
const apyPercent = Number(currentLiquidityRate * 10000n / RAY) / 100; // e.g. 4.8
```

**aUSDC balance = current value including yield**
Track yield delta: `currentATokenBalance - initialDeposit` = yield earned (in 6-decimal USDC).

---

## AI Agent Design Principles

### Nothing Is Automatic — Design for Incentives
- Smart contracts cannot execute themselves. Every function needs a caller who pays gas.
- For every action: **who calls it? Why would they? What if nobody does?**
- AURA's agent loop (Railway cron) is the "caller" — it must be self-incentivized to keep running.
- The agent must remain self-sustaining: revenue (Aave yield + x402 fees) must exceed costs (Haiku API + gas).

### Agent Key Safety
- Use a **dedicated wallet with limited funds** — never a main wallet.
- Key comes from `AGENT_PRIVATE_KEY` env var → `privateKeyToAccount` (viem).
- Never log the private key. Never put it in code. Never commit it.
- Safety floor: never drop below $25 USDC (hardcoded).

### Vercel AI SDK v4.x Patterns (Critical)
```typescript
// v4.x names — DO NOT use v3.x names
import { generateText, tool } from "ai";
import { z } from "zod";

const result = await generateText({
  model: claude("claude-haiku-4-5-20251001"),  // Haiku for ticks
  tools: {
    myTool: tool({
      description: "...",
      parameters: z.object({ ... }),  // NOT inputSchema (that's v3.x)
      execute: async (args) => { ... },
    }),
  },
  maxSteps: 5,  // NOT stopWhen (that's v3.x)
  messages: [...],
});

// Token usage (v4.x names):
result.totalUsage.promptTokens    // NOT inputTokens
result.totalUsage.completionTokens // NOT outputTokens
```

### Haiku Pricing (for compute cost tracking)
- Input: $1.00 / 1M tokens
- Output: $5.00 / 1M tokens
- Typical tick: ~2000 input + ~500 output tokens = ~$0.0045 / tick
- At 5-min intervals: ~$1.30/day

---

## Base L2 Specifics

- **Chain ID:** 8453 (mainnet), 84532 (Sepolia testnet)
- **Block time:** ~2 seconds
- **Finality:** 7 days (optimistic rollup)
- **Use `block.timestamp`, NOT `block.number`** for time-based logic (L2 block numbers differ from mainnet)
- **Dominant DEX:** Aero (formerly Aerodrome), NOT Uniswap. Uses ve(3,3) model.
- **Coinbase on-ramp:** Direct from Coinbase to Base, no bridge fee.
- **ERC-8004 agent registry:** Deployed on Base.
- **Superchain member:** Shares OP Stack security and upgrade governance.

---

## x402 Middleware Pattern (`middleware.ts`)

```typescript
// Project root: middleware.ts
import { paymentProxy } from "@x402/next";

export const middleware = paymentProxy({
  facilitatorUrl: process.env.X402_FACILITATOR_URL!, // CDP facilitator for mainnet
  routes: {
    "/api/analyze": {
      price: "$0.01",
      network: "base-mainnet",
      asset: "USDC",
    },
  },
});

export const config = {
  matcher: ["/api/analyze"],
};
```

**Revenue flow:** x402 client pays → CDP facilitator validates EIP-3009 auth → settles USDC to agent wallet → middleware passes request → analyze route runs → response returned.

---

## 0G Storage Notes

- SDK: `@0glabs/0g-ts-sdk@0.3.1` (NOT 0.2.1 — outdated)
- Requires **ethers v6 signer** (isolated to `zero-g.ts` only — everywhere else uses viem)
- Indexer URL: `indexer-storage-testnet-turbo.0g.ai`
- Use for: decision log uploads (immutable audit trail for judges)
- Always fallback to Vercel KV if 0G upload fails — don't let storage failure block agent ticks

---

## Key Links

- EthSkills index: https://ethskills.com/SKILL.md
- Standards skill: https://ethskills.com/standards/SKILL.md
- Security skill: https://ethskills.com/security/SKILL.md
- Gas skill: https://ethskills.com/gas/SKILL.md
- L2s skill: https://ethskills.com/l2s/SKILL.md
- Addresses skill: https://ethskills.com/addresses/SKILL.md
- Building blocks skill: https://ethskills.com/building-blocks/SKILL.md
- Wallets skill: https://ethskills.com/wallets/SKILL.md
- Concepts skill: https://ethskills.com/concepts/SKILL.md
- Base docs: https://docs.base.org
- Aave V3 docs: https://docs.aave.com/developers/core-contracts/pool
- x402 docs: https://docs.cdp.coinbase.com/x402/docs/overview
- Builder code checker: https://builder-code-checker.vercel.app
- Basescan: https://basescan.org
