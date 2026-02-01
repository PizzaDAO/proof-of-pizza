"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
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

const MAX_AMOUNT = 50;

export function ReimburseButton({
  submissionId,
  walletAddress,
  amount,
  status,
  transactionHash,
  onStatusChange,
}: ReimburseButtonProps) {
  const { isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const isOnBase = chainId === base.id;
  const isOnEthereum = chainId === 1;

  // Check admin wallet balance
  useEffect(() => {
    fetch("/api/admin/wallet-balance")
      .then((res) => res.json())
      .then((data) => setWalletBalance(data.balance ?? 0))
      .catch(() => setWalletBalance(0));
  }, []);

  const canPayFromAdmin = walletBalance !== null && walletBalance >= amount && amount <= MAX_AMOUNT;

  // Manual wallet payment hook
  const { transfer, hash, isPending, isConfirming, isConfirmed } = useUsdcTransfer({
    onSuccess: async (txHash) => {
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
      const msg = err.message || String(err);
      if (msg.includes("User rejected") || msg.includes("User denied")) {
        setError("User rejected the request.");
      } else if (msg.includes("insufficient funds")) {
        setError("Insufficient funds for transfer.");
      } else {
        setError(msg.split("\n")[0]);
      }
    },
  });

  // Pay from admin server wallet
  const handlePayFromAdmin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const adminPassword = localStorage.getItem("admin_token");
      if (!adminPassword) {
        setError("Session expired. Please log in again.");
        return;
      }

      const response = await fetch("/api/admin/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          adminPassword,
          amount,
          recipientAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        switch (data.code) {
          case "LIMIT_EXCEEDED":
            setError(`Amount exceeds $${MAX_AMOUNT} limit`);
            break;
          case "UNAUTHORIZED":
            setError("Session expired. Please log in again.");
            break;
          case "INSUFFICIENT_BALANCE":
            setError("Admin wallet needs funding.");
            break;
          case "ALREADY_PAID":
            setError("Already paid");
            onStatusChange();
            break;
          default:
            setError(data.error || "Payment failed");
        }
        return;
      }

      setSuccessHash(data.transactionHash);
      onStatusChange();
    } catch (err) {
      console.error("Payment error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }

  // Just completed payment - show success
  if (successHash || (isConfirmed && hash)) {
    const txHash = successHash || hash;
    return (
      <a
        href={getBaseScanUrl(txHash!)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Paid</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }

  // Processing states
  if (isLoading || isConfirming || isUpdating) {
    return (
      <button disabled className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg">
        <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin" />
        <span>Confirming...</span>
      </button>
    );
  }

  if (isPending) {
    return (
      <button disabled className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg">
        <div className="w-4 h-4 border-2 border-orange-700 border-t-transparent rounded-full animate-spin" />
        <span>Sign in wallet...</span>
      </button>
    );
  }

  // Show both payment options
  return (
    <div className="space-y-2">
      {/* Pay from Admin button */}
      {canPayFromAdmin ? (
        <button
          onClick={handlePayFromAdmin}
          className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Pay from Admin
        </button>
      ) : (
        <button
          disabled
          className="w-full px-4 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed"
          title={amount > MAX_AMOUNT ? `Exceeds $${MAX_AMOUNT} limit` : "Insufficient admin wallet balance"}
        >
          Pay from Admin
        </button>
      )}

      {/* Pay with Wallet button */}
      {!isConnected ? (
        isConnecting ? (
          <button disabled className="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg">
            Connecting...
          </button>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Pay With Wallet
              </button>
            )}
          </ConnectButton.Custom>
        )
      ) : !isOnBase ? (
        <div>
          {isOnEthereum && (
            <p className="mb-1 text-xs text-amber-600">⚠️ Switch to Base network</p>
          )}
          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Switch to Base
          </button>
        </div>
      ) : (
        <button
          onClick={() => transfer(walletAddress.trim(), amount)}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Pay With Wallet
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
