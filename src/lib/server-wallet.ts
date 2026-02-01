import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { USDC_ADDRESS, USDC_DECIMALS, ERC20_ABI } from "./constants";

const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const MAX_PAYMENT_AMOUNT = 50; // $50 limit

function getPrivateKey(): `0x${string}` {
  const key = process.env.PAYMENT_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error("PAYMENT_WALLET_PRIVATE_KEY not configured");
  }
  return key as `0x${string}`;
}

function getAccount() {
  return privateKeyToAccount(getPrivateKey());
}

function getWalletClient() {
  const account = getAccount();
  return createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });
}

function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
}

export function getWalletAddress(): string {
  const account = getAccount();
  return account.address;
}

export async function getWalletBalance(): Promise<number> {
  const publicClient = getPublicClient();
  const address = getWalletAddress();

  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  return Number(balance) / 10 ** USDC_DECIMALS;
}

export async function sendUsdcPayment(
  recipientAddress: `0x${string}`,
  amount: number
): Promise<{ hash: string }> {
  // Validate amount limit
  if (amount > MAX_PAYMENT_AMOUNT) {
    throw new Error(
      `Amount $${amount} exceeds maximum of $${MAX_PAYMENT_AMOUNT}`
    );
  }

  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  // Check balance first
  const balance = await getWalletBalance();
  if (balance < amount) {
    throw new Error(
      `Insufficient balance: $${balance.toFixed(2)} available, $${amount} requested`
    );
  }

  // Convert amount to USDC units (6 decimals)
  const amountInUnits = parseUnits(amount.toString(), USDC_DECIMALS);

  // Send transaction
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipientAddress, amountInUnits],
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("Transaction failed on-chain");
  }

  return { hash };
}

export { MAX_PAYMENT_AMOUNT };
