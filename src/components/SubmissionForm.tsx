"use client";

import { useState, useCallback, useRef } from "react";
import { MultiImageUpload } from "./MultiImageUpload";
import { WalletAddressInput } from "./WalletAddressInput";

interface ReceiptBreakdown {
  url: string;
  amount: number | null;
  currency: string;
  confidence: number;
  isAnalyzing: boolean;
  error: string | null;
  conversionNote?: string;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
}

interface FormState {
  pizzaPhotoUrls: string[];
  receiptPhotoUrls: string[];
  notes: string;
  walletInput: string;
  resolvedAddress: string | null;
  amount: number | null;
  isSubmitting: boolean;
  submitted: boolean;
  error: string | null;
}

export function SubmissionForm() {
  const [form, setForm] = useState<FormState>({
    pizzaPhotoUrls: [],
    receiptPhotoUrls: [],
    notes: "",
    walletInput: "",
    resolvedAddress: null,
    amount: null,
    isSubmitting: false,
    submitted: false,
    error: null,
  });

  const [receiptBreakdowns, setReceiptBreakdowns] = useState<ReceiptBreakdown[]>([]);
  const analyzedUrlsRef = useRef<Set<string>>(new Set());

  const analyzeReceipt = useCallback(async (url: string) => {
    // Mark as analyzing
    setReceiptBreakdowns((prev) => [
      ...prev,
      {
        url,
        amount: null,
        currency: "USD",
        confidence: 0,
        isAnalyzing: true,
        error: null,
      },
    ]);

    try {
      const response = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze receipt");
      }

      const result = await response.json();

      setReceiptBreakdowns((prev) =>
        prev.map((rb) =>
          rb.url === url
            ? {
                ...rb,
                amount: result.amount,
                currency: result.currency || "USD",
                confidence: result.confidence,
                isAnalyzing: false,
                error: null,
                conversionNote: result.conversionNote,
                originalAmount: result.originalAmount,
                originalCurrency: result.originalCurrency,
                exchangeRate: result.exchangeRate,
              }
            : rb
        )
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to analyze receipt";
      setReceiptBreakdowns((prev) =>
        prev.map((rb) =>
          rb.url === url
            ? { ...rb, isAnalyzing: false, error: errorMessage }
            : rb
        )
      );
    }
  }, []);

  // Recalculate total whenever breakdowns change
  const totalFromReceipts = receiptBreakdowns.reduce((sum, rb) => {
    return sum + (rb.amount || 0);
  }, 0);

  const isAnyAnalyzing = receiptBreakdowns.some((rb) => rb.isAnalyzing);

  const handleReceiptUrlsChange = useCallback(
    (urls: string[]) => {
      setForm((prev) => ({ ...prev, receiptPhotoUrls: urls }));

      // Analyze any new URLs that haven't been analyzed yet
      urls.forEach((url) => {
        if (!analyzedUrlsRef.current.has(url)) {
          analyzedUrlsRef.current.add(url);
          analyzeReceipt(url);
        }
      });

      // Remove breakdowns for URLs that were removed
      setReceiptBreakdowns((prev) =>
        prev.filter((rb) => urls.includes(rb.url))
      );

      // Clean up analyzed set
      const urlSet = new Set(urls);
      analyzedUrlsRef.current.forEach((analyzedUrl) => {
        if (!urlSet.has(analyzedUrl)) {
          analyzedUrlsRef.current.delete(analyzedUrl);
        }
      });
    },
    [analyzeReceipt]
  );

  const handlePizzaUrlsChange = useCallback((urls: string[]) => {
    setForm((prev) => ({ ...prev, pizzaPhotoUrls: urls }));
  }, []);

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

  // Use receipt total if available, otherwise manual amount
  const effectiveAmount =
    totalFromReceipts > 0 ? totalFromReceipts : form.amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForm((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: form.resolvedAddress,
          ensName: form.walletInput.endsWith(".eth")
            ? form.walletInput
            : undefined,
          notes: form.notes || undefined,
          pizzaPhotoUrls: form.pizzaPhotoUrls,
          receiptPhotoUrls: form.receiptPhotoUrls,
          // Keep legacy fields for backward compat
          pizzaPhotoUrl: form.pizzaPhotoUrls[0],
          receiptPhotoUrl: form.receiptPhotoUrls[0],
          extractedAmount: totalFromReceipts || effectiveAmount,
          finalAmount: effectiveAmount,
          currency: "USD",
          // Use first receipt's conversion info if applicable
          originalAmount: receiptBreakdowns[0]?.originalAmount,
          originalCurrency: receiptBreakdowns[0]?.originalCurrency,
          exchangeRate: receiptBreakdowns[0]?.exchangeRate,
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
    form.pizzaPhotoUrls.length > 0 &&
    form.receiptPhotoUrls.length > 0 &&
    form.resolvedAddress &&
    effectiveAmount &&
    effectiveAmount > 0;

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
          Your Proof of Pizza has been submitted for review. You&apos;ll receive
          USDC to your wallet once approved.
        </p>
        <button
          onClick={() => {
            setForm({
              pizzaPhotoUrls: [],
              receiptPhotoUrls: [],
              notes: "",
              walletInput: "",
              resolvedAddress: null,
              amount: null,
              isSubmitting: false,
              submitted: false,
              error: null,
            });
            setReceiptBreakdowns([]);
            analyzedUrlsRef.current.clear();
          }}
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
          Admin Panel &rarr;
        </a>
      </div>

      <MultiImageUpload
        type="receipt"
        label="Receipt Photos"
        onUrlsChange={handleReceiptUrlsChange}
        onClear={() => {
          setForm((prev) => ({
            ...prev,
            receiptPhotoUrls: [],
            amount: null,
          }));
          setReceiptBreakdowns([]);
          analyzedUrlsRef.current.clear();
        }}
      />

      <MultiImageUpload
        type="pizza"
        label="Pizza Photos"
        onUrlsChange={handlePizzaUrlsChange}
        onClear={() =>
          setForm((prev) => ({ ...prev, pizzaPhotoUrls: [] }))
        }
      />

      <WalletAddressInput
        value={form.walletInput}
        onChange={handleWalletChange}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Who's requesting? Who gave you proof of pizza?"
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">{form.notes.length}/500</p>
      </div>

      {(isAnyAnalyzing || receiptBreakdowns.length > 0) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>

          {/* Per-receipt breakdown */}
          {receiptBreakdowns.length > 1 && (
            <div className="mb-3 space-y-1">
              {receiptBreakdowns.map((rb, index) => (
                <div key={rb.url} className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">
                    Receipt {index + 1}:
                  </span>
                  {rb.isAnalyzing ? (
                    <div className="flex items-center space-x-1 text-gray-400">
                      <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                  ) : rb.error ? (
                    <span className="text-red-500 text-xs">{rb.error}</span>
                  ) : (
                    <span className="font-medium">
                      ${rb.amount?.toFixed(2) || "0.00"}
                      {rb.conversionNote && (
                        <span className="ml-1 text-xs text-blue-600">
                          ({rb.conversionNote})
                        </span>
                      )}
                      {rb.confidence < 0.8 && (
                        <span className="ml-1 text-xs text-amber-600">
                          (low confidence)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ))}
              {totalFromReceipts > 0 && (
                <div className="flex items-center text-sm font-bold border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-600 w-20">Total:</span>
                  <span>${totalFromReceipts.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {isAnyAnalyzing && receiptBreakdowns.length <= 1 ? (
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
                value={
                  totalFromReceipts > 0
                    ? totalFromReceipts.toFixed(2)
                    : form.amount || ""
                }
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

          {/* Show single receipt conversion note when only 1 receipt */}
          {receiptBreakdowns.length === 1 &&
            receiptBreakdowns[0].conversionNote && (
              <p className="mt-2 text-sm text-blue-600">
                {receiptBreakdowns[0].conversionNote}
              </p>
            )}
          {receiptBreakdowns.length === 1 &&
            receiptBreakdowns[0].confidence < 0.8 &&
            !receiptBreakdowns[0].isAnalyzing && (
              <p className="mt-2 text-sm text-amber-600">
                Low confidence extraction. Please verify the amount.
              </p>
            )}

          {!isAnyAnalyzing && !effectiveAmount && (
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
