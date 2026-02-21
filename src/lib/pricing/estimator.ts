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
 */

/** Maximum characters sent to the model. Queries beyond this are truncated. */
export const MAX_QUERY_CHARS = 2000;

// Constant system prompt overhead (measured from analyze route's system prompt)
const SYSTEM_PROMPT_TOKENS = 400;

// Claude Sonnet 4.5 pricing (Feb 2026)
const SONNET_INPUT_PER_M = 3.0;   // $3.00 per million input tokens
const SONNET_OUTPUT_PER_M = 15.0; // $15.00 per million output tokens

// 3x margin: covers output token uncertainty + contributes to self-sustainability
const MARGIN_MULTIPLIER = 3.0;

/** Minimum charge — floor ensures every call contributes meaningfully to sustainability */
export const PRICE_FLOOR = 0.02;

/** Maximum charge — defense-in-depth if estimation formula is ever wrong */
export const PRICE_CAP = 0.10;

/**
 * Estimate x402 price for a DeFi analysis query.
 *
 * Query is capped at MAX_QUERY_CHARS for estimation — the same cap applied before
 * sending to the model. This ensures pricing and inference costs are always aligned.
 *
 * @param query - raw query string from the request body (may be any length)
 * @returns price in USD (e.g. 0.0142), clamped to [PRICE_FLOOR, PRICE_CAP]
 */
export function estimatePrice(query: string): number {
  const effectiveChars = Math.min(query.length, MAX_QUERY_CHARS);
  const queryTokens = Math.ceil(effectiveChars / 4);
  const inputTokens = SYSTEM_PROMPT_TOKENS + queryTokens;
  // Longer queries tend to produce longer answers
  const outputTokens = 300 + Math.ceil(effectiveChars / 12);
  const rawCost =
    (inputTokens / 1_000_000) * SONNET_INPUT_PER_M +
    (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_M;
  const withMargin = rawCost * MARGIN_MULTIPLIER;
  return Math.min(PRICE_CAP, Math.max(PRICE_FLOOR, withMargin));
}

/**
 * Format a price number as an x402-compatible price string.
 * @example formatX402Price(0.0142) → "$0.0142"
 */
export function formatX402Price(price: number): string {
  return `$${price.toFixed(4)}`;
}
