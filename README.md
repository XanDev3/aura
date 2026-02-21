# AURA — Autonomous Utility Revenue Agent

> **ETHDenver 2026 BUIDLathon** | Built on Base | Powered by Claude AI

AURA is a self-sustaining autonomous AI agent that earns more than it spends on compute — achieving true economic autonomy on Base mainnet.

## Live Demo

| Resource | Link |
|----------|------|
| 📊 Dashboard | **[aura-two-gules.vercel.app](https://aura-two-gules.vercel.app/)** |
| 🔗 Agent Wallet | **[basescan.org/address/0x0968452513515636e0BE413d93Af64e101b299B0](https://basescan.org/address/0x0968452513515636e0BE413d93Af64e101b299B0)** |
| 🎥 Demo Video | **[FILL IN VIDEO LINK]** |
| 📁 GitHub | **[github.com/XanDev3/aura](https://github.com/XanDev3/aura)** |

---

## What Is AURA?

AURA is an AI agent (Claude via Vercel AI SDK) running autonomously on Base mainnet. Every 5 minutes it:

1. **Reads** its on-chain state — wallet balance, Aave position, compute costs, revenue
2. **Reasons** — Claude evaluates whether to deposit more USDC, withdraw, or hold
3. **Acts** — executes the decision on-chain (every tx tagged with ERC-8021 builder code)
4. **Logs** — uploads its reasoning to 0G Storage for a tamper-proof audit trail
5. **Reports** — dashboard updates so humans can observe without intervening

### Revenue Sources

| Source | Mechanism | Est. Return |
|--------|-----------|-------------|
| **Aave V3 Yield** | USDC deposited to Aave lending pool | ~3-5% APY (~$0.016/day on $150) |
| **x402 Analysis Service** | Clients pay per query — price scales with query complexity | $0.01–$0.10/query |

### Cost

- Claude Haiku for routine ticks: ~$0.002 per tick, ~$0.50/day
- Claude Sonnet for paid x402 analysis: ~\$0.010–\$0.015 per request for typical queries (including tool overhead)
- x402 pricing uses 3x margin on estimated Sonnet cost → every request profitable
- Queries capped at 2000 chars — prevents adversarial token-drain
- Covered by Aave yield + x402 revenue

---

## Architecture

```
[Railway: Agent Daemon]  ←→  [Vercel KV]  ←→  [Vercel: Dashboard]
        ↓                                              ↑
   [Base Mainnet]                             [0G Storage (logs)]
   Aave V3 / x402
```

**Stack:**
- Agent: Node.js + Vercel AI SDK + Claude (Haiku for ticks, Sonnet for analysis)
- Wallet: viem + ERC-8021 builder codes (every transaction)
- DeFi: Aave V3 on Base (USDC supply/withdraw)
- Payments: x402 protocol (sell DeFi analysis)
- Storage: 0G Storage for decentralized decision logs
- State: Vercel KV (Redis)
- Dashboard: Next.js 16 + Tailwind on Vercel

---

## Bounties Targeted

- **Base** — Self-Sustaining Autonomous Agents ($10,000)
- **0g Labs** — Best DeFAI Application ($7,000)
- **Track** — FUTURLLAMA: AI + Frontier Tech

---

## Setup (Local Development)

```bash
# 1. Clone and install
git clone https://github.com/XanDev3/aura
cd aura-agent
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in all values — see .env.example for instructions

# 3. Start dashboard
npm run dev

# 4. Start agent (separate terminal)
npm run agent:dev

# 5. (Optional) Test x402 payment flow
npm run test:x402          # runs 1 query (default — cheapest)
npm run test:x402 -- 2    # runs 2 queries
npm run test:x402 -- 3    # runs all 3 queries
```

> **npm arg quirk:** flags like `--count` are consumed by npm before reaching the script.
> Always use the bare `-- N` form (with the `--` separator) when running via `npm run`.
> For direct invocation: `tsx scripts/test-x402-client.ts --count 3`

### Required Credentials

| Credential | Where to Get |
|-----------|-------------|
| `AGENT_PRIVATE_KEY` | Create fresh wallet (MetaMask, cast) |
| `AGENT_WALLET_ADDRESS` | Derived from private key |
| `ERC8021_BUILDER_CODE` | base.dev → Settings → Builder Codes |
| `ANTHROPIC_API_KEY` | platform.anthropic.com |
| `KV_*` | Vercel Dashboard → Storage → KV |
| `ZG_*` | build.0g.ai + faucet.0g.ai |

---

## How Judges Can Verify Self-Sustainability

1. Open the dashboard at the live URL (no login required)
2. Look at the **StatusBadge** — shows `SELF-SUSTAINING ✓` or `DEFICIT ✗`
3. Check **PLChart** — yield earned line should be above compute cost line
4. Check **Runway Meter** — shows hours of compute the agent can fund itself
5. Click any transaction in **DecisionLog** to verify ERC-8021 code on Basescan

---

## Safety Design

AURA is designed to be safe by construction:

- **Only USDC** — principal never in volatile assets
- **Hard floor** — never lets total USDC drop below $25
- **No leverage** — only simple lending, no borrowing
- **Abuse-resistant** — x402 queries capped at 2000 chars; dynamic pricing ensures margin on every request
- **Transparent** — all decisions logged to 0G Storage
- **Observable** — public dashboard, no passwords
- **Pausable** — manual kill-switch via Vercel KV, no Railway restart needed

---

## Pausing the Agent

The agent can be paused without touching Railway. It will keep running but skip every tick until unpaused.

**To pause:**
1. Go to [vercel.com](https://vercel.com) → your project → **Storage** → select your KV store
2. Click **Open in Upstash** — this opens the Upstash console for your KV store
3. In the Upstash console, click the **CLI** tab
4. Run: `SET aura:paused true`
5. Within 5 minutes the Railway logs will show: `Agent is paused — skipping tick`

**To resume:**
1. Return to the same Upstash CLI tab
2. Run: `DEL aura:paused`
3. The next interval the agent ticks normally

> Cost saved while paused: ~$0.86/day (288 Haiku ticks). Aave yield continues accruing onchain regardless.

---

*Built at ETHDenver 2026 · Solo · ~45 hours*
