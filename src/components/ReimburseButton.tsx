"use client";

import { useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  const handlePay = async () => {
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
            setError("Server wallet needs funding. Contact admin.");
            break;
          case "ALREADY_PAID":
            setError("Already paid");
            onStatusChange();
            break;
          case "TX_FAILED":
            setError(data.error || "Transaction failed");
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
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Paid</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
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

  // Just completed payment - show success
  if (successHash) {
    return (
      <a
        href={getBaseScanUrl(successHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Paid</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
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

  // Processing payment
  if (isLoading) {
    return (
      <button
        disabled
        className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg"
      >
        <div className="w-4 h-4 border-2 border-orange-700 border-t-transparent rounded-full animate-spin" />
        <span>Processing...</span>
      </button>
    );
  }

  // Amount over limit warning
  if (amount > MAX_AMOUNT) {
    return (
      <div>
        <button
          disabled
          className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
        >
          Reimburse ${amount.toFixed(2)}
        </button>
        <p className="mt-1 text-xs text-amber-600">
          Exceeds ${MAX_AMOUNT} limit. Requires manual payment.
        </p>
      </div>
    );
  }

  // Ready to pay
  return (
    <div>
      <button
        onClick={handlePay}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
      >
        Reimburse ${amount.toFixed(2)}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
