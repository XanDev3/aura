import { parseUnits, formatUnits, erc20Abi, maxUint256 } from "viem";
import { publicClient, walletClient, account } from "../wallet/viemClient";

// Base mainnet addresses — verified Feb 2026
export const AAVE_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const A_USDC = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB" as const;

// USDC has 6 decimals — not 18
const USDC_DECIMALS = 6;

const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

/**
 * Supply USDC to Aave V3. Checks allowance and approves maxUint256 if needed.
 * Returns the supply transaction hash.
 */
export async function supplyUsdc(amountUsdc: number): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc.toString(), USDC_DECIMALS);

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, AAVE_POOL],
  });

  if (allowance < amount) {
    const approveTx = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [AAVE_POOL, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const supplyTx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [USDC, amount, account.address, 0],
  });
  await publicClient.waitForTransactionReceipt({ hash: supplyTx });
  return supplyTx;
}

/**
 * Withdraw USDC from Aave V3. Returns the withdraw transaction hash.
 */
export async function withdrawUsdc(amountUsdc: number): Promise<`0x${string}`> {
  const amount = parseUnits(amountUsdc.toString(), USDC_DECIMALS);
  const tx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [USDC, amount, account.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  return tx;
}

/**
 * Read the live aUSDC balance (principal + accrued interest).
 * aUSDC rebases continuously — this is always the current value.
 */
export async function getAaveBalance(): Promise<number> {
  const balance = await publicClient.readContract({
    address: A_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  return Number(formatUnits(balance, USDC_DECIMALS));
}

/**
 * Read the current USDC supply APY from Aave V3 on-chain data.
 * Returns APY as a percentage (e.g. 4.8 means 4.8%).
 */
export async function getAaveAPY(): Promise<number> {
  const reserveData = await publicClient.readContract({
    address: AAVE_POOL,
    abi: AAVE_POOL_ABI,
    functionName: "getReserveData",
    args: [USDC],
  });
  // currentLiquidityRate is a RAY-scaled per-second rate (1e27 = 100%)
  const RAY = 1e27;
  const SECONDS_PER_YEAR = 31_536_000;
  const rate = Number(reserveData.currentLiquidityRate) / RAY;
  const apy = (Math.pow(1 + rate / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
  return Math.round(apy * 100) / 100;
}

/**
 * Read liquid USDC balance in the agent wallet.
 */
export async function getUsdcBalance(): Promise<number> {
  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  return Number(formatUnits(balance, USDC_DECIMALS));
}

/**
 * Read ETH balance in the agent wallet (for gas monitoring).
 */
export async function getEthBalance(): Promise<number> {
  const balance = await publicClient.getBalance({ address: account.address });
  return Number(formatUnits(balance, 18));
}
