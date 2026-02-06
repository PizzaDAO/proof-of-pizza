"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer";
import { ReimburseButton } from "./ReimburseButton";

type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

interface Submission {
  id: string;
  walletAddress: string;
  ensName: string | null;
  pizzaPhotoUrl: string;
  receiptPhotoUrl: string;
  extractedAmount: string;
  finalAmount: string;
  currency: string;
  status: SubmissionStatus;
  transactionHash: string | null;
  createdAt: string;
}

const STATUS_TABS: { label: string; value: SubmissionStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Paid", value: "PAID" },
  { label: "Rejected", value: "REJECTED" },
];

export function SubmissionQueue() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTab, setActiveTab] = useState<SubmissionStatus | "ALL">("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [adminWallet, setAdminWallet] = useState<{ balance: number; address: string } | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  // Wallet connection for funding
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isOnBase = chainId === base.id;

  const { transfer: fundTransfer, isPending: isFundPending, isConfirming: isFundConfirming, isConfirmed: isFundConfirmed } = useUsdcTransfer({
    onSuccess: () => {
      setFundAmount("");
      setShowFundForm(false);
      // Refresh balance after a short delay
      setTimeout(() => {
        fetch("/api/admin/wallet-balance")
          .then((res) => res.json())
          .then((data) => setAdminWallet({ balance: data.balance ?? 0, address: data.address ?? "" }));
      }, 2000);
    },
    onError: (err) => {
      const msg = err.message || String(err);
      if (msg.includes("User rejected")) {
        setFundError("Transaction cancelled");
      } else {
        setFundError(msg.split("\n")[0]);
      }
    },
  });

  // Fetch admin wallet balance
  useEffect(() => {
    fetch("/api/admin/wallet-balance")
      .then((res) => res.json())
      .then((data) => setAdminWallet({ balance: data.balance ?? 0, address: data.address ?? "" }))
      .catch(() => setAdminWallet({ balance: 0, address: "" }));
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const url =
        activeTab === "ALL"
          ? "/api/submissions"
          : `/api/submissions?status=${activeTab}`;
      const response = await fetch(url);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      fetchSubmissions();
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Rejection reason (optional):");
    try {
      await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
      });
      fetchSubmissions();
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this submission? This cannot be undone.")) {
      return;
    }
    try {
      await fetch(`/api/submissions/${id}`, {
        method: "DELETE",
      });
      fetchSubmissions();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Convert R2 URL to proxy URL
  const getProxyUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.slice(1); // Remove leading slash
      return `/api/images/${path}`;
    } catch {
      return url;
    }
  };

  return (
    <div>
      {/* Admin Wallet Balance */}
      {adminWallet && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm flex items-center gap-2">
              <span className="text-gray-800">Admin Wallet: </span>
              {adminWallet.address ? (
                <>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(adminWallet.address);
                      alert("Address copied!");
                    }}
                    className="font-mono text-xs text-gray-700 hover:text-gray-900 hover:underline"
                    title="Click to copy"
                  >
                    {`${adminWallet.address.slice(0, 6)}...${adminWallet.address.slice(-4)}`}
                  </button>
                  <a
                    href={`https://basescan.org/address/${adminWallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                    title="View on BaseScan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </>
              ) : (
                <span className="text-gray-700">Not configured</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold text-orange-600">
                ${adminWallet.balance.toFixed(2)} <span className="text-sm font-normal text-gray-700">USDC</span>
              </div>
              <button
                onClick={() => setShowFundForm(!showFundForm)}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                {showFundForm ? "Cancel" : "Fund"}
              </button>
            </div>
          </div>

          {/* Fund Form */}
          {showFundForm && adminWallet.address && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <div className="flex items-center gap-2">
                <span className="text-gray-700">$</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="Amount"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                {!isConnected ? (
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={openConnectModal}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                ) : !isOnBase ? (
                  <button
                    onClick={() => switchChain({ chainId: base.id })}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Switch to Base
                  </button>
                ) : isFundPending || isFundConfirming ? (
                  <button disabled className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                    {isFundConfirming ? "Confirming..." : "Sign..."}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const amount = parseFloat(fundAmount);
                      if (amount > 0) {
                        setFundError(null);
                        fundTransfer(adminWallet.address, amount);
                      }
                    }}
                    disabled={!fundAmount || parseFloat(fundAmount) <= 0}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:text-gray-700"
                  >
                    Send USDC
                  </button>
                )}
              </div>
              {fundError && <p className="mt-1 text-xs text-red-600">{fundError}</p>}
              {isFundConfirmed && <p className="mt-1 text-xs text-green-600">Funded successfully!</p>}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`
              px-4 py-2 text-sm font-medium transition-colors
              ${
                activeTab === tab.value
                  ? "text-orange-600 border-b-2 border-orange-500"
                  : "text-gray-700 hover:text-gray-900"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && submissions.length === 0 && (
        <div className="text-center py-12 text-gray-700">
          No submissions found
        </div>
      )}

      {/* Submissions grid */}
      {!isLoading && submissions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
            >
              {/* Images */}
              <div className="grid grid-cols-2 gap-1 p-2">
                <button
                  onClick={() => setSelectedImage(getProxyUrl(submission.pizzaPhotoUrl))}
                  className="aspect-square overflow-hidden rounded bg-gray-100"
                >
                  <img
                    src={getProxyUrl(submission.pizzaPhotoUrl)}
                    alt="Pizza"
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </button>
                <button
                  onClick={() => setSelectedImage(getProxyUrl(submission.receiptPhotoUrl))}
                  className="aspect-square overflow-hidden rounded bg-gray-100"
                >
                  <img
                    src={getProxyUrl(submission.receiptPhotoUrl)}
                    alt="Receipt"
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </button>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    ${parseFloat(submission.finalAmount).toFixed(2)}
                  </span>
                  <span
                    className={`
                      px-2 py-1 text-xs font-medium rounded-full
                      ${submission.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : ""}
                      ${submission.status === "APPROVED" ? "bg-blue-100 text-blue-700" : ""}
                      ${submission.status === "PAID" ? "bg-green-100 text-green-700" : ""}
                      ${submission.status === "REJECTED" ? "bg-red-100 text-red-700" : ""}
                    `}
                  >
                    {submission.status}
                  </span>
                </div>

                <div className="text-sm text-gray-800">
                  <p className="font-mono">
                    {submission.ensName || formatAddress(submission.walletAddress)}
                  </p>
                  <p className="text-gray-600">{formatDate(submission.createdAt)}</p>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-gray-100">
                  {submission.status === "PENDING" && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApprove(submission.id)}
                        className="flex-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(submission.id)}
                        className="flex-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {submission.status === "APPROVED" && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex items-center gap-1 pt-2">
                          <span className="text-gray-600">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={parseFloat(submission.finalAmount).toFixed(2)}
                            value={editingAmounts[submission.id] ?? ""}
                            onChange={(e) =>
                              setEditingAmounts((prev) => ({
                                ...prev,
                                [submission.id]: e.target.value,
                              }))
                            }
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
                        <div className="flex-1">
                          <ReimburseButton
                            submissionId={submission.id}
                            walletAddress={submission.walletAddress}
                            amount={editingAmounts[submission.id]
                              ? parseFloat(editingAmounts[submission.id]) || parseFloat(submission.finalAmount)
                              : parseFloat(submission.finalAmount)}
                            status={submission.status}
                            transactionHash={submission.transactionHash}
                            onStatusChange={fetchSubmissions}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleReject(submission.id)}
                        className="w-full px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {submission.status === "PAID" && (
                    <ReimburseButton
                      submissionId={submission.id}
                      walletAddress={submission.walletAddress}
                      amount={parseFloat(submission.finalAmount)}
                      status={submission.status}
                      transactionHash={submission.transactionHash}
                      onStatusChange={fetchSubmissions}
                    />
                  )}

                  {/* Delete button - always visible */}
                  <button
                    onClick={() => handleDelete(submission.id)}
                    className="w-full mt-2 px-3 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
