import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Attribution } from "ox/erc8021";

// ERC-8021 builder code — sourced from base.dev -> Settings -> Builder Codes
// Exported so it can be passed as dataSuffix on every writeContract call (the correct pattern).
// viem does NOT support dataSuffix on createWalletClient — it must be per-transaction.
export const builderCodeSuffix = Attribution.toDataSuffix({
  codes: [process.env.ERC8021_BUILDER_CODE!],
});

export const account = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`
);

// Wallet client — pass builderCodeSuffix to every writeContract call in aave.ts
export const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

// Public client — for reads, balance checks, receipts
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});
