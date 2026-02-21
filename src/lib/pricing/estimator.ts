/**
 * x402 Dynamic Pricing — Token Cost Estimator
 *
 * Estimates the Claude Sonnet inference cost for a DeFi analysis query BEFORE running it.
 * x402 requires the price to be quoted in the 402 response before inference — we can't
 * charge based on actual usage. This estimator runs pre-inference and uses a 3x margin
 * to cover output token uncertainty and contribute to agent self-sustainability.
 *
 * Abuse protection: all queries are capped at MAX_QUERY_CHARS before both pricing and
 * inference. An adversary sending 100k chars still only causes us to process 2000 chars.
 *
 * --- Why the previous formula underpriced ---
 * The old formula only counted system prompt + query tokens.  A real /api/analyze call has
 * several additional token sources that dwarf the raw query:
 *   1. Tool definitions  — both tool schemas are serialized into every request (~400 tok).
 *   2. Multi-step growth — with maxSteps=5, step N re-sends the full context from steps 1…N-1.
 *                          A single tool call roughly doubles total input tokens.
 *   3. Tool result body  — a DeFiLlama response (topN=5 pools, 8 fields each) ≈ 350 tok.
 *   4. Output length     — a proper DeFi analysis is 450–700 tokens, not 300.
 * Together these pushed real costs 2–4x above what the old formula predicted, causing
 * the 0.67x and 1.03x margins seen in production.
 */

/** Maximum characters sent to the model. Queries beyond this are truncated. */
export const MAX_QUERY_CHARS = 2000;

// ── Baseline token constants ──────────────────────────────────────────────────

/** System prompt token count (measured from ANALYZE_SYSTEM_PROMPT). */
const SYSTEM_PROMPT_TOKENS = 400;

/**
 * Combined token overhead for tool definitions injected into every request.
 * analyzeTools has two tools (getDeFiYields + getAuraStatus) with descriptions
 * and parameter schemas. Measured at ~380 tokens; use 400 as a round ceiling.
 */
const TOOL_DEFINITION_TOKENS = 400;

/**
 * Average tool result size in tokens.
 * A getDeFiYields call with topN=5 returns ~350 tokens of pool JSON.
 * Using 400 as a conservative estimate covering metadata fields.
 */
const TOOL_RESULT_TOKENS = 400;

/**
 * Multi-step context growth factor.
 * When the model makes one tool call (the common case), step 2 re-sends the full
 * step-1 context. Total input is ~1.7x what a single-pass would be.
 * Using 1.7 here; MARGIN_MULTIPLIER covers variance above this.
 */
const MULTISTEP_FACTOR = 1.7;

// ── Model pricing (Sonnet 4.5, Feb 2026) ─────────────────────────────────────
const SONNET_INPUT_PER_M  = 3.0;   // $3.00 per million input tokens
const SONNET_OUTPUT_PER_M = 15.0;  // $15.00 per million output tokens

// ── Pricing parameters ────────────────────────────────────────────────────────

/**
 * Margin multiplier applied to the raw estimated cost.
 * 3x covers: remaining output uncertainty, occasional >1 tool call, and
 * the profit margin needed for agent self-sustainability.
 */
const MARGIN_MULTIPLIER = 3.0;

/**
 * Floor price per query.
 * Raised from $0.02 to $0.03: even a trivial query costs ~$0.010–$0.015 in
 * actual inference once tool overhead is included, so $0.02 left no margin.
 * $0.03 provides ~2x margin on the simplest possible query.
 */
export const PRICE_FLOOR = 0.03;

/** Cap prevents sticker-shock on pathologically long queries. */
export const PRICE_CAP = 0.15;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate x402 price for a DeFi analysis query.
 *
 * Formula:
 *   effectiveInputTokens = (system + tools + query) * MULTISTEP_FACTOR + toolResult
 *   effectiveOutputTokens = 450 + floor(chars / 8)   ← longer than old 300+chars/12
 *   rawCost = input * $3/M + output * $15/M
 *   price   = clamp(rawCost * 3x, PRICE_FLOOR, PRICE_CAP)
 *
 * @param query - raw query string (may be any length; capped internally)
 * @returns price in USD, clamped to [PRICE_FLOOR, PRICE_CAP]
 */
export function estimatePrice(query: string): number {
  const effectiveChars = Math.min(query.length, MAX_QUERY_CHARS);
  const queryTokens    = Math.ceil(effectiveChars / 4);

  // Base input tokens before multi-step multiplier
  const baseInputTokens = SYSTEM_PROMPT_TOKENS + TOOL_DEFINITION_TOKENS + queryTokens;

  // Account for context re-send on tool call steps, then add the tool result body
  const inputTokens  = Math.ceil(baseInputTokens * MULTISTEP_FACTOR) + TOOL_RESULT_TOKENS;

  // Output grows with query length — longer context → longer answer
  const outputTokens = 450 + Math.ceil(effectiveChars / 8);

  const rawCost =
    (inputTokens  / 1_000_000) * SONNET_INPUT_PER_M +
    (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_M;

  return Math.min(PRICE_CAP, Math.max(PRICE_FLOOR, rawCost * MARGIN_MULTIPLIER));
}

/**
 * Format a price number as an x402-compatible price string.
 * @example formatX402Price(0.0382) → "$0.0382"
 */
export function formatX402Price(price: number): string {
  return `$${price.toFixed(4)}`;
}
