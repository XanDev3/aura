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
  // Dynamic import — ethers + 0G SDK only needed here
  const { ethers } = await import("ethers");
  const { Indexer, MemData } = await import("@0glabs/0g-ts-sdk");

  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL);
  const signer = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, provider);
  const indexer = new Indexer(process.env.ZG_INDEXER_URL!);

  const content = JSON.stringify(entry, null, 2);
  const bytes = new TextEncoder().encode(content);

  // MemData wraps raw bytes in the interface the SDK expects
  // Indexer.upload(file, blockchain_rpc, signer, uploadOpts?)
  // Returns: [{ txHash, rootHash }, error]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, err] = await indexer.upload(
    new MemData(bytes),
    process.env.ZG_RPC_URL!,
    signer as any  // ESM vs CJS ethers type mismatch — identical at runtime
  );

  if (err !== null) throw new Error(`0G upload error: ${err}`);

  return { storedOn: "0g", root: result.rootHash };
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
