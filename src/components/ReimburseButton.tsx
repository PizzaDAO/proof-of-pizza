"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer";
import { getBaseScanUrl } from "@/lib/constants";

interface ReimburseButtonProps {
  submissionId: string;
  walletAddress: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  transactionHash?: string | null;
  onStatusChange: () => void;
}

export function ReimburseButton({
  submissionId,
  walletAddress,
  amount,
  status,
  transactionHash,
  onStatusChange,
}: ReimburseButtonProps) {
  const { isConnected, isConnecting } = useAccount();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { transfer, hash, isPending, isConfirming, isConfirmed } = useUsdcTransfer({
    onSuccess: async (txHash) => {
      // Update submission in database
      setIsUpdating(true);
      try {
        await fetch(`/api/submissions/${submissionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "PAID",
            transactionHash: txHash,
            paidAmount: amount,
          }),
        });
        onStatusChange();
      } catch (err) {
        setError("Failed to update submission status");
        console.error(err);
      } finally {
        setIsUpdating(false);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Already paid - show link
  if (status === "PAID" && transactionHash) {
    return (
      <a
        href={getBaseScanUrl(transactionHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Paid</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    );
  }

  // Transaction just confirmed
  if (isConfirmed && hash) {
    return (
      <a
        href={getBaseScanUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Paid</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    );
  }

  // Confirming transaction
  if (isConfirming || isUpdating) {
    return (
      <button
        disabled
        className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg"
      >
        <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin" />
        <span>Confirming...</span>
      </button>
    );
  }

  // Pending wallet signature
  if (isPending) {
    return (
      <button
        disabled
        className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg"
      >
        <div className="w-4 h-4 border-2 border-orange-700 border-t-transparent rounded-full animate-spin" />
        <span>Sign in wallet...</span>
      </button>
    );
  }

  // Not connected
  if (isConnecting) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg"
      >
        Loading...
      </button>
    );
  }

  if (!isConnected) {
    return <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <button
          onClick={openConnectModal}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Connect Wallet
        </button>
      )}
    </ConnectButton.Custom>;
  }

  // Ready to reimburse
  return (
    <div>
      <button
        onClick={() => transfer(walletAddress.trim(), amount)}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
      >
        Reimburse ${amount.toFixed(2)}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
