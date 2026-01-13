"use client";

import { useState, useCallback } from "react";
import { ImageUpload } from "./ImageUpload";
import { WalletAddressInput } from "./WalletAddressInput";
import { useReceiptAnalysis } from "@/hooks/useReceiptAnalysis";

interface FormState {
  pizzaPhotoUrl: string | null;
  receiptPhotoUrl: string | null;
  walletInput: string;
  resolvedAddress: string | null;
  amount: number | null;
  isSubmitting: boolean;
  submitted: boolean;
  error: string | null;
}

export function SubmissionForm() {
  const [form, setForm] = useState<FormState>({
    pizzaPhotoUrl: null,
    receiptPhotoUrl: null,
    walletInput: "",
    resolvedAddress: null,
    amount: null,
    isSubmitting: false,
    submitted: false,
    error: null,
  });

  const { isAnalyzing, result: analysisResult, analyze } = useReceiptAnalysis({
    onSuccess: (result) => {
      setForm((prev) => ({ ...prev, amount: result.amount }));
    },
  });

  const handleReceiptUpload = useCallback(
    async (url: string) => {
      setForm((prev) => ({ ...prev, receiptPhotoUrl: url }));
      await analyze(url);
    },
    [analyze]
  );

  const handleWalletChange = useCallback(
    (input: string, resolved: string | null) => {
      setForm((prev) => ({
        ...prev,
        walletInput: input,
        resolvedAddress: resolved,
      }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForm((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: form.resolvedAddress,
          ensName: form.walletInput.endsWith(".eth") ? form.walletInput : undefined,
          pizzaPhotoUrl: form.pizzaPhotoUrl,
          receiptPhotoUrl: form.receiptPhotoUrl,
          extractedAmount: analysisResult?.amount || form.amount,
          finalAmount: form.amount,
          currency: "USD",
          originalAmount: analysisResult?.originalAmount,
          originalCurrency: analysisResult?.originalCurrency,
          exchangeRate: analysisResult?.exchangeRate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit");
      }

      setForm((prev) => ({ ...prev, submitted: true, isSubmitting: false }));
    } catch (error) {
      setForm((prev) => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : "Failed to submit",
      }));
    }
  };

  const isFormValid =
    form.pizzaPhotoUrl &&
    form.receiptPhotoUrl &&
    form.resolvedAddress &&
    form.amount &&
    form.amount > 0;

  if (form.submitted) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-500"
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
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Proof Submitted!
        </h2>
        <p className="text-gray-600 mb-6">
          Your Proof of Pizza has been submitted for review.
          You&apos;ll receive USDC to your wallet once approved.
        </p>
        <button
          onClick={() =>
            setForm({
              pizzaPhotoUrl: null,
              receiptPhotoUrl: null,
              walletInput: "",
              resolvedAddress: null,
              amount: null,
              isSubmitting: false,
              submitted: false,
              error: null,
            })
          }
          className="text-orange-600 hover:text-orange-500 font-medium"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
      <div className="text-center mb-8">
        <img
          src="/pizzadao-logo.png"
          alt="PizzaDAO"
          className="w-22 h-auto mx-auto mb-4 invert"
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Proof of Pizza
        </h1>
        <p className="text-gray-600">
          Upload your pizza and receipt to get reimbursed in USDC
        </p>
        <a
          href="/admin"
          className="inline-block mt-3 text-sm text-gray-500 hover:text-orange-500 transition-colors"
        >
          Admin Panel →
        </a>
      </div>

      <ImageUpload
        type="receipt"
        label="Receipt Photo"
        onUploadComplete={handleReceiptUpload}
        onClear={() => setForm((prev) => ({ ...prev, receiptPhotoUrl: null, amount: null }))}
      />

      <ImageUpload
        type="pizza"
        label="Pizza Photo"
        onUploadComplete={(url) =>
          setForm((prev) => ({ ...prev, pizzaPhotoUrl: url }))
        }
        onClear={() => setForm((prev) => ({ ...prev, pizzaPhotoUrl: null }))}
      />

      <WalletAddressInput value={form.walletInput} onChange={handleWalletChange} />

      {(isAnalyzing || form.receiptPhotoUrl) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          {isAnalyzing ? (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing receipt...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-2xl text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    amount: parseFloat(e.target.value) || null,
                  }))
                }
                placeholder="0.00"
                className="text-2xl font-bold w-32 border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none bg-transparent"
              />
              <span className="text-gray-500">USD</span>
            </div>
          )}
          {analysisResult?.conversionNote && (
            <p className="mt-2 text-sm text-blue-600">
              {analysisResult.conversionNote}
            </p>
          )}
          {analysisResult && analysisResult.confidence < 0.8 && (
            <p className="mt-2 text-sm text-amber-600">
              Low confidence extraction. Please verify the amount.
            </p>
          )}
          {!isAnalyzing && !form.amount && (
            <p className="mt-2 text-sm text-gray-500">
              Enter the receipt total manually
            </p>
          )}
        </div>
      )}

      {form.error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          {form.error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || form.isSubmitting}
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition-colors
          ${
            isFormValid && !form.isSubmitting
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }
        `}
      >
        {form.isSubmitting ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Submitting...</span>
          </span>
        ) : (
          "Submit for Reimbursement"
        )}
      </button>
    </form>
  );
}
