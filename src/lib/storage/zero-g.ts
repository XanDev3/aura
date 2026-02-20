/**
 * 0G Storage integration for AURA decision logs.
 *
 * Uses @0glabs/0g-ts-sdk@0.3.1 + ethers v6 signer.
 * Ethers is isolated to this file — everything else uses viem.
 *
 * Falls back to Vercel KV if 0G Storage is unavailable.
 */
import { kv } from "@vercel/kv";
import type { DecisionLogEntry } from "../agent/state";

const ZG_LOGS_KEY = "aura:zg:logs";

/**
 * Upload a decision log entry to 0G Storage.
 * Falls back to KV on any error.
 * Returns the storage root (txHash on 0G) or "kv" if KV fallback was used.
 */
export async function uploadDecisionLog(
  entry: DecisionLogEntry
): Promise<{ storedOn: "0g" | "kv"; root: string }> {
  // Only attempt 0G if credentials are configured
  if (
    process.env.ZG_RPC_URL &&
    process.env.ZG_PRIVATE_KEY &&
    process.env.ZG_INDEXER_URL
  ) {
    try {
      const result = await uploadTo0G(entry);
      return result;
    } catch (err) {
      console.warn("[0G Storage] Upload failed, falling back to KV:", err);
    }
  }

  // KV fallback
  return storeInKV(entry);
}

async function uploadTo0G(
  entry: DecisionLogEntry
): Promise<{ storedOn: "0g"; root: string }> {
  // Dynamic import — ethers is only needed here
  const { ethers } = await import("ethers");
  const { Indexer } = await import("@0glabs/0g-ts-sdk");

  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL);
  const signer = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, provider);
  const indexer = new Indexer(process.env.ZG_INDEXER_URL!);

  const content = JSON.stringify(entry, null, 2);
  const bytes = new TextEncoder().encode(content);

  // Upload as a blob via the indexer
  const [tx, err] = await indexer.upload(
    { content: bytes, size: bytes.length },
    0,   // segment index
    process.env.ZG_RPC_URL!,
    signer
  );

  if (err !== null) throw new Error(`0G upload error: ${err}`);

  return { storedOn: "0g", root: tx };
}

async function storeInKV(
  entry: DecisionLogEntry
): Promise<{ storedOn: "kv"; root: string }> {
  const logs = (await kv.get<DecisionLogEntry[]>(ZG_LOGS_KEY)) ?? [];
  logs.push({ ...entry, storedOn: "kv" });
  // Keep last 200 entries
  await kv.set(ZG_LOGS_KEY, logs.slice(-200));
  return { storedOn: "kv", root: `kv-${entry.tick}-${Date.now()}` };
}

/**
 * Read decision logs — tries 0G indexer query first, falls back to KV.
 */
export async function readDecisionLogs(limit = 10): Promise<DecisionLogEntry[]> {
  const kvLogs = (await kv.get<DecisionLogEntry[]>(ZG_LOGS_KEY)) ?? [];
  return kvLogs.slice(-limit).reverse();
}
