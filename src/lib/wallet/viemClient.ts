import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Attribution } from "ox/erc8021";

// ERC-8021 builder code — sourced from base.dev -> Settings -> Builder Codes
const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [process.env.ERC8021_BUILDER_CODE!],
});

export const account = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`
);

// Wallet client — all writeContract calls auto-append ERC-8021 attribution suffix
export const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  // @ts-expect-error — dataSuffix is a viem extension field for ERC-8021
  dataSuffix: DATA_SUFFIX,
});

// Public client — for reads, balance checks, receipts
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});
