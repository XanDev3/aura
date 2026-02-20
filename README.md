# AURA — Autonomous Utility Revenue Agent

> **ETHDenver 2026 BUIDLathon** | Built on Base | Powered by Claude AI

AURA is a self-sustaining autonomous AI agent that earns more than it spends on compute — achieving true economic autonomy on Base mainnet.

## Live Demo

| Resource | Link |
|----------|------|
| 📊 Dashboard | **[FILL IN VERCEL URL]** |
| 🔗 Agent Wallet | **[FILL IN BASESCAN LINK]** |
| 🎥 Demo Video | **[FILL IN VIDEO LINK]** |
| 📁 GitHub | **[FILL IN REPO LINK]** |

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
| **Aave V3 Yield** | USDC deposited to Aave lending pool | ~3-5% APY |
| **x402 Analysis Service** | Clients pay 0.01 USDC to query Claude for DeFi analysis | Variable |

### Cost

- Claude Haiku for routine ticks: ~$0.002 per tick
- ~$0.50/day at 5-min intervals (288 ticks/day)
- Claude Sonnet for paid x402 analysis: ~$0.015 per request
- Covered by Aave yield on ~$150-200 USDC seed + x402 service revenue

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
- Dashboard: Next.js 15 + Tailwind on Vercel

---

## Bounties Targeted

- **Base** — Self-Sustaining Autonomous Agents ($10,000)
- **0g Labs** — Best DeFAI Application ($7,000)
- **Track** — FUTURLLAMA: AI + Frontier Tech

---

## Setup (Local Development)

```bash
# 1. Clone and install
git clone https://github.com/YOUR_HANDLE/aura-agent
cd aura-agent
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in all values — see .env.example for instructions

# 3. Start dashboard
npm run dev

# 4. Start agent (separate terminal)
npm run agent:dev
```

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
- **Transparent** — all decisions logged to 0G Storage
- **Observable** — public dashboard, no passwords

---

*Built at ETHDenver 2026 · Solo · ~45 hours*
