"use client";

import { useState, useEffect, useCallback } from "react";
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
                  ? "text-red-600 border-b-2 border-red-500"
                  : "text-gray-500 hover:text-gray-700"
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
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && submissions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
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

                <div className="text-sm text-gray-600">
                  <p className="font-mono">
                    {submission.ensName || formatAddress(submission.walletAddress)}
                  </p>
                  <p className="text-gray-400">{formatDate(submission.createdAt)}</p>
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

                  {(submission.status === "APPROVED" || submission.status === "PAID") && (
                    <ReimburseButton
                      submissionId={submission.id}
                      walletAddress={submission.walletAddress}
                      amount={parseFloat(submission.finalAmount)}
                      status={submission.status}
                      transactionHash={submission.transactionHash}
                      onStatusChange={fetchSubmissions}
                    />
                  )}
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
