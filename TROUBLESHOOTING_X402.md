# TROUBLESHOOTING: x402 Payment Gate — End-to-End Debug Log

> **Status: FULLY RESOLVED — x402 END-TO-END CONFIRMED WORKING**
> All 3 test queries paid 0.01 USDC each via EIP-3009 on Base mainnet. CDP facilitator settled successfully.
> `npm run test:x402` returns HTTP 200 with analysis responses. Phase 4 complete (Feb 2026).

---

## Context

- **Goal:** `POST /api/analyze` should gate access behind an x402 micropayment (0.01 USDC on Base mainnet via EIP-3009).
- **Test script:** `scripts/test-x402-client.ts` — run via `npm run test:x402`
- **Vercel URL:** `https://aura-two-gules.vercel.app/`
- **Active branch:** `begin-testing-post-deployment` — both Vercel and Railway are watching this branch, NOT `main`
- **⚠️ REMINDER:** Before final submission, merge `begin-testing-post-deployment` → `main` and switch Vercel + Railway back to `main`.

---

## Chronological Failure History

### Failure 1: `Cannot find module 'dotenv/config'`

**When:** First run of `npm run test:x402`
**Error output:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'dotenv/config'
```

**Root cause:** `dotenv` was not installed. The original import was:
```typescript
import "dotenv/config";
```
This loads `.env` (not `.env.local`), and the package wasn't in `package.json` at all.

**Fix applied (commit `ef19b76`):**
```typescript
// scripts/test-x402-client.ts
import { config } from "dotenv";
config({ path: ".env.local" });  // Must come before any other imports that read env vars
```
Also ran `npm install dotenv` and added `"dotenv": "^17.3.1"` to `package.json`.

**Status: RESOLVED**

---

### Failure 2: `MIDDLEWARE_INVOCATION_FAILED` (HTTP 500 from Vercel)

**When:** After dotenv fix — all 3 test queries returned HTTP 500
**Error output from test script:**
```
[x402 Test] HTTP 500: MIDDLEWARE_INVOCATION_FAILED
```

**Root cause:** `middleware.ts` was importing `@x402/next` and `@x402/evm/exact/server`. Next.js `middleware.ts` **always runs in Edge Runtime**, which is a restricted JS environment that lacks Node.js crypto APIs (`crypto.createSign`, etc.). The `@x402/evm` package uses these Node.js crypto APIs — so the middleware crashed before any request could be processed.

**The key distinction:**
- `middleware.ts` → **Edge Runtime** → no Node.js crypto → `@x402/evm` CRASHES
- `src/app/api/*/route.ts` → **Node.js Runtime** → full Node.js APIs → `@x402/evm` works fine

**Fix applied (commit `87c3d9f`):**
Moved ALL x402 server logic from `middleware.ts` to `src/app/api/analyze/route.ts`. Used `withX402()` wrapper from `@x402/next` around the route handler instead of middleware.

`middleware.ts` was stripped to a pure pass-through:
```typescript
// middleware.ts (project root) — STRIPPED to pass-through
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [], // no routes intercepted — x402 gating is in the route handler
};
```

**Status: RESOLVED** (but revealed Failure 3)

---

### Failure 3: Next.js Build Error — Missing Middleware Function Export

**When:** After stripping `middleware.ts`, Vercel build failed
**Error output (Vercel build log):**
```
Error: Middleware is missing expected function export name
```

**Root cause:** The initial stripped version of `middleware.ts` only exported `config`, not a `middleware` function. Next.js 16 / Turbopack requires the file to export a function named `middleware` even if it's a no-op.

**Fix applied (commit `857bd57`):**
Added the required function export (shown in Failure 2 fix above — already includes it).

**Status: RESOLVED**

---

### Failure 4: HTTP 500 with Empty Body (post-middleware fix)

**When:** After branch switch + build succeeded — all 3 queries returned HTTP 500 with empty response body
**Error output from test script:**
```
[x402 Test] HTTP 500:
```
(empty body — crucially different from Failure 2 which had `MIDDLEWARE_INVOCATION_FAILED` as the body)

**Diagnosis process:**

The empty body pointed to the x402 route module failing at initialization time (not per-request). When Next.js route modules throw during initialization, requests return 500 with no body.

Traced through `@x402/next` source:
1. `withX402(handler, routeConfig, server)` is called at module load
2. By default, `syncFacilitatorOnStart: true` → calls `server.initialize()`
3. `x402HTTPResourceServer.initialize()` calls `facilitatorClient.getSupported()`
4. `getSupported()` sends `GET https://api.cdp.coinbase.com/platform/v2/x402/supported`
5. Without auth headers → CDP returns 401
6. `supportedResponsesMap` stays empty (or errors out)
7. `validateRouteConfiguration()` is then called — with empty map, it throws `RouteConfigurationError`
8. Module initialization fails → every request returns 500 with empty body

**Root cause:** `HTTPFacilitatorClient` does **NOT** auto-detect CDP credentials from environment variables. It requires an explicit `createAuthHeaders` callback. Without it, all requests to the CDP facilitator are unauthenticated.

**Fix applied (commit `ef89a23`):**

Added CDP JWT auth generation using `@coinbase/cdp-sdk/auth` (already installed as a transitive dep):

```typescript
// src/app/api/analyze/route.ts
import { getAuthHeaders } from "@coinbase/cdp-sdk/auth";

async function buildCdpAuthHeaders() {
  const apiKeyId = process.env.CDP_API_KEY_ID!;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET!;
  const host = "api.cdp.coinbase.com";
  const base = "/platform/v2/x402";
  const [verify, settle, supported] = await Promise.all([
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "POST", requestHost: host, requestPath: `${base}/verify` }),
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "POST", requestHost: host, requestPath: `${base}/settle` }),
    getAuthHeaders({ apiKeyId, apiKeySecret, requestMethod: "GET",  requestHost: host, requestPath: `${base}/supported` }),
  ]);
  return { verify, settle, supported };
}

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402",
  createAuthHeaders: buildCdpAuthHeaders,
});
```

**Status: ROOT CAUSE FOUND + FIXED**

**Actual root cause: `CDP_API_KEY_SECRET` had 1 extra character (89 chars instead of 88).**

The `@coinbase/cdp-sdk` Ed25519 validator: `Buffer.from(secret, "base64").length === 64`.
- 88-char base64 string (with `==` padding) → decodes to exactly 64 bytes ✓
- 89-char string → decodes to 66 bytes ✗ → throws `UserInputValidationError: Invalid key format`

This exception was thrown inside `buildCdpAuthHeaders()` → caught by `x402ResourceServer.initialize()` → `supportedResponsesMap` stays empty → `validateRouteConfiguration()` throws `RouteConfigurationError` → module init fails → HTTP 500 empty body.

**Fix applied:** Removed the extra character from `CDP_API_KEY_SECRET` in `.env.local`.
**⚠️ ALSO UPDATE VERCEL:** Go to Vercel dashboard → Settings → Environment Variables → update `CDP_API_KEY_SECRET` to the correct 88-char value → Vercel will auto-redeploy → then run `npm run test:x402`.

Code review also confirms (Feb 2026):
- `buildCdpAuthHeaders` return shape `{verify, settle, supported}` is type-compatible with `HTTPFacilitatorClient.createAuthHeaders`
- CDP facilitator does support `exact/eip155:8453` (confirmed via `/supported` endpoint)
- All import paths and V2 protocol IDs are correct

---

### Failure 5: HTTP 500 Empty Body — `CDP_API_KEY_SECRET` Wrong Format

**When:** After `ef89a23` deployed — all 3 test queries still returned HTTP 500 with empty body
**Error output from test script:**
```
[x402 Test] HTTP 500:
```

**Diagnosis process:**

Ran `scripts/diag-cdp-auth.ts` (now deleted). CDP auth threw immediately:
```
UserInputValidationError: Invalid key format - must be either PEM EC key or base64 Ed25519 key
```

The secret length was 89 chars. The `@coinbase/cdp-sdk/auth` Ed25519 validator: `Buffer.from(secret, "base64").length === 64`. 89 chars decodes to 66 bytes ≠ 64 → invalid. The JWT was never generated, causing `getSupported()` to throw inside `buildCdpAuthHeaders()`.

**Error propagation chain:**
1. `buildCdpAuthHeaders()` → `getAuthHeaders()` → throws `UserInputValidationError`
2. `facilitatorClient.getSupported()` → calls `createAuthHeaders("supported")` → calls `buildCdpAuthHeaders()` → throws
3. `x402ResourceServer.initialize()` → `getSupported()` throws → **caught** (`console.warn`) → `supportedResponsesMap` stays empty
4. `x402HTTPResourceServer.initialize()` → `validateRouteConfiguration()` → `getSupportedKind()` returns undefined → throws `RouteConfigurationError`
5. Next.js route module fails to initialize → HTTP 500 empty body on all requests

**Fix applied:** Removed the extra character from `CDP_API_KEY_SECRET` in `.env.local` (now 88 chars).

**Status: FIXED LOCALLY — UPDATE VERCEL ENV VAR + REDEPLOY NEEDED**

---

## Current State of Modified Files

### `middleware.ts` (project root)
Pure pass-through. No x402 logic. Required `middleware` function export for Next.js 16 compatibility.

### `src/app/api/analyze/route.ts`
All x402 logic lives here now (Node.js runtime). Key structure:
```typescript
// 1. CDP auth builder
async function buildCdpAuthHeaders() { ... }

// 2. Facilitator client with explicit auth
const facilitatorClient = new HTTPFacilitatorClient({
  url: ...,
  createAuthHeaders: buildCdpAuthHeaders,
});

// 3. x402 server registered for Base mainnet
const x402Server = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme());

// 4. The actual route handler
async function handler(req: NextRequest): Promise<NextResponse<unknown>> { ... }

// 5. Exported with x402 wrapper
export const POST = withX402(handler, {
  accepts: [{ scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: process.env.AGENT_WALLET_ADDRESS! }],
  description: "AURA DeFi Analysis — 0.01 USDC per query",
  mimeType: "application/json",
}, x402Server);
```

### `scripts/test-x402-client.ts`
Fixed dotenv loading. Uses `@x402/fetch` + `@x402/evm/exact/client` (client-side only — no Node.js crypto needed). Agent wallet signs EIP-3009 auth via viem's `signTypedData`.

---

## Parallel Issue: Aave Nonce Race Condition

**Not blocking x402, but caused first Railway logs error.**

**Symptom (Railway logs):**
```
Details: nonce too low: next nonce 1, tx nonce 0
```

**Root cause:** After `waitForTransactionReceipt` for the USDC approve TX, Base L2 RPC returned a stale pending nonce (still 0) for the supply TX. Both TXs tried to use nonce 0.

**Fix applied (commit `f8774ed`):**
```typescript
// src/lib/defi/aave.ts — after approve waitForTransactionReceipt
const nonce = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: "latest",  // "latest" confirmed block, not "pending"
});
const supplyTx = await walletClient.writeContract({
  nonce,  // explicit nonce overrides RPC default
  address: AAVE_POOL,
  ...
});
```

**Status: RESOLVED**

---

## Parallel Issue: 0G Storage `require(false)` Reverts

**Not blocking x402 or Aave — KV fallback is operational.**

**Symptom (Railway logs):**
```
[0G Storage] Upload failed, falling back to KV: Error: execution reverted: require(false)
```

**Root cause:** 0G testnet Flow contract rejecting the submission. The agent wallet has 0.1 A0GI testnet tokens (balance is not the issue). Likely a testnet/SDK version compatibility problem — the testnet contract may expect a different SDK version or call format.

**Fix attempted (commit `c283ad8`):** Upgraded `@0glabs/0g-ts-sdk` from `0.3.1` to `0.3.3` (exact version, no caret, to prevent future semver drift).

**Status: POSSIBLY UNRESOLVED** — testnet may simply be unstable. KV fallback works correctly. Don't spend more time on this unless 0G judges specifically ask about it. Note it in the submission.

---

## Environment Variables Required (verify all are set in both Vercel and Railway)

For x402 to work, these must be set in the Vercel environment (not just `.env.local`):
```
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
AGENT_WALLET_ADDRESS=0x0968452513515636e0BE413d93Af64e101b299B0
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402  # (optional, this is the default)
```

For the test script (`.env.local` only):
```
VERCEL_URL=https://aura-two-gules.vercel.app
AGENT_PRIVATE_KEY=0x...       # Agent wallet private key — NEVER commit this
TEST_BUYER_PRIVATE_KEY=0x...  # Separate test buyer wallet — must differ from AGENT_WALLET_ADDRESS
TEST_BUYER_ADDRESS=0x...      # Corresponding address (informational)
BASE_RPC_URL=https://mainnet.base.org  # (optional, this is the default)
```

**Critical:** `TEST_BUYER_PRIVATE_KEY` must correspond to a DIFFERENT wallet from `AGENT_WALLET_ADDRESS`.
The test buyer wallet needs USDC on Base mainnet (sent 0.05 USDC from agent wallet, Feb 2026).

---

## If Failure 4 Persists After `ef89a23` Deploys

### Debugging steps (in order):

1. **Check Vercel function logs** — go to Vercel dashboard → Functions tab → click the `/api/analyze` function → look at real-time logs. The actual error from `RouteConfigurationError` or `HTTPFacilitatorClient` will appear there.

2. **Check if CDP credentials are set in Vercel environment** — Vercel dashboard → Settings → Environment Variables. Confirm `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are set for the Production environment AND the `begin-testing-post-deployment` branch.

3. **Test the CDP facilitator directly** — curl the supported endpoint manually to confirm your CDP keys work:
   ```bash
   # First get a JWT — use CDP dashboard or test via SDK
   curl https://api.cdp.coinbase.com/platform/v2/x402/supported \
     -H "Authorization: Bearer <your-jwt>"
   ```

4. **Check `getAuthHeaders` signature** — the `@coinbase/cdp-sdk/auth` export may have changed. Read [node_modules/@coinbase/cdp-sdk/auth/index.ts](node_modules/@coinbase/cdp-sdk/auth/index.ts) to verify `getAuthHeaders` exists and check its exact parameter shape.

5. **Check `HTTPFacilitatorClient` `createAuthHeaders` expected return type** — the callback must return `{ verify: Headers, settle: Headers, supported: Headers }`. If `getAuthHeaders` returns a `Headers` object or plain object in a different shape, it may not be compatible. Check: `node_modules/@x402/core/dist/server/HTTPFacilitatorClient.js`

6. **Try disabling syncFacilitatorOnStart** — if CDP auth works but initialization still fails:
   ```typescript
   const x402Server = new x402ResourceServer(facilitatorClient, {
     syncFacilitatorOnStart: false,
   }).register("eip155:8453", new ExactEvmScheme());
   ```
   This defers the `getSupported()` call until first request — could help diagnose timing issues.

7. **Hardcode test headers** — temporarily replace `buildCdpAuthHeaders` with a function that returns empty objects `{}` to confirm whether the auth generation or the route config validation is failing:
   ```typescript
   async function buildCdpAuthHeaders() {
     return { verify: {}, settle: {}, supported: {} };
   }
   ```
   If this makes initialization succeed (even if individual requests fail), the issue is in `getAuthHeaders`, not in the route config.

---

## Failure 6: `invalid_payload` from CDP — Self-Payment (from === to)

**When:** After Failure 5 was fixed (correct CDP key length) — test returned HTTP 402 with `invalid_payload` on every retry.

**Error output:**
```
[x402 Test] HTTP 402: {}
[x402 DEBUG] payment-response: { "invalidReason": "invalid_payload", "isValid": false }
```

**Root cause:** The test script (`test-x402-client.ts`) used `AGENT_PRIVATE_KEY` to sign payments. The AURA server's `payTo` address IS the agent wallet (`AGENT_WALLET_ADDRESS`). So:
- EIP-3009 `from` = agent wallet = `0x0968452513515636e0BE413d93Af64e101b299B0`
- EIP-3009 `to` = payTo = `0x0968452513515636e0BE413d93Af64e101b299B0`
- **`from === to` — the agent wallet was paying itself.**

CDP facilitator rejects self-payment as `invalid_payload` (structurally invalid — no economic transfer occurs).

**Fix applied:**
1. Generated a new "test buyer" wallet (separate from agent wallet):
   - Address: `0xA8AA0B655D6a4977A2E71b3A87B4b494F0ae05aF`
   - Key stored as `TEST_BUYER_PRIVATE_KEY` in `.env.local`
2. Transferred 0.05 USDC from agent wallet to buyer wallet (tx: `0xc7f5401058125c9385be516c556f19492ee9fb740891455721e6355cb8706f1e`)
3. Updated `test-x402-client.ts` to use `TEST_BUYER_PRIVATE_KEY` with a warning guard if keys match.

**Result:** All 3 test queries succeeded. Buyer paid 0.01 USDC each → agent wallet received payment → 200 response with DeFi analysis returned.

**Important rule:** The x402 test client MUST use a different wallet from the server's `payTo`. In production, this is never an issue (real users have their own wallets). Only affects self-hosted test scripts.

**Status: RESOLVED**

---

## Key Lessons Learned

1. **Next.js `middleware.ts` is Edge Runtime only** — never put packages that use Node.js crypto APIs there. x402 server setup MUST be in route handlers.

2. **`HTTPFacilitatorClient` requires explicit auth** — it does not read CDP env vars automatically. Always pass `createAuthHeaders`.

3. **`@coinbase/cdp-sdk/auth` `getAuthHeaders` is path-specific** — each endpoint (verify, settle, supported) needs its own JWT because JWTs are signed over the specific request path.

4. **Empty 500 body = module initialization failure** — when Next.js returns 500 with no body, the route module itself crashed during module evaluation (not during request handling). The error appears in Vercel function logs, not in the HTTP response.

5. **Base L2 nonce caching** — after `waitForTransactionReceipt`, always re-fetch nonce with `blockTag: "latest"` before issuing another TX. The pending nonce cache can lag on L2s.

6. **0G testnet is unreliable** — build with KV fallback from day one. Don't block on 0G testnet stability.

7. **x402 test client cannot use the same wallet as the server's `payTo`** — CDP rejects `from === to` EIP-3009 authorizations as `invalid_payload`. Always use a separate buyer wallet for testing. Add a warning guard in the test script to catch this early.

---

## Branch + Deployment Reminder

```
Current active branch:  begin-testing-post-deployment
Vercel watching:        begin-testing-post-deployment  ← needs to switch to main before submission
Railway watching:       begin-testing-post-deployment  ← needs to switch to main before submission

Before final submission:
  1. git checkout main
  2. git merge begin-testing-post-deployment
  3. git push origin main
  4. Vercel: Settings → Git → change Production Branch → main
  5. Railway: Settings → source branch → main
  6. Verify both redeploy cleanly from main
```

---

## Commit History for This Debug Session

| Commit | Description |
|--------|-------------|
| `f8774ed` | fix: fetch explicit nonce after approve to avoid L2 RPC cache issue |
| `c283ad8` | fix: upgrade 0G SDK to 0.3.3 to address testnet contract compatibility |
| `ef19b76` | fix: install dotenv and load .env.local in x402 test script |
| `87c3d9f` | fix: move x402 gating from middleware to API route (Edge Runtime fix) |
| `857bd57` | fix: add required middleware function export (Next.js 16 build error) |
| `ef89a23` | fix: add CDP JWT auth to x402 HTTPFacilitatorClient (**LAST COMMIT — UNVERIFIED**) |
