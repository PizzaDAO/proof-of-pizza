"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { USDC_ADDRESS, USDC_DECIMALS, ERC20_ABI } from "@/lib/constants";

interface UseUsdcTransferOptions {
  onSuccess?: (hash: string) => void;
  onError?: (error: Error) => void;
}

export function useUsdcTransfer(options?: UseUsdcTransferOptions) {
  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const transfer = async (to: string, amount: number) => {
    try {
      const amountInUnits = parseUnits(amount.toString(), USDC_DECIMALS);

      writeContract(
        {
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to as `0x${string}`, amountInUnits],
        },
        {
          onSuccess: (hash) => {
            options?.onSuccess?.(hash);
          },
          onError: (error) => {
            options?.onError?.(error);
          },
        }
      );
    } catch (error) {
      options?.onError?.(error as Error);
    }
  };

  const reset = () => {
    resetWrite();
  };

  return {
    transfer,
    hash,
    isPending: isWritePending,
    isConfirming,
    isConfirmed,
    error: writeError || confirmError,
    reset,
  };
}
