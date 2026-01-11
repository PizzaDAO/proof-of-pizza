"use client";

import { useState, useCallback } from "react";

interface AnalysisResult {
  amount: number;
  currency: string;
  confidence: number;
  items?: string[];
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  conversionNote?: string;
}

interface AnalysisState {
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  error: string | null;
}

interface UseReceiptAnalysisOptions {
  onSuccess?: (result: AnalysisResult) => void;
  onError?: (error: string) => void;
}

export function useReceiptAnalysis(options?: UseReceiptAnalysisOptions) {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    result: null,
    error: null,
  });

  const analyze = useCallback(
    async (imageUrl: string) => {
      setState({ isAnalyzing: true, result: null, error: null });

      try {
        const response = await fetch("/api/analyze-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to analyze receipt");
        }

        const result: AnalysisResult = await response.json();

        setState({
          isAnalyzing: false,
          result,
          error: null,
        });

        options?.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to analyze receipt";
        setState({
          isAnalyzing: false,
          result: null,
          error: errorMessage,
        });
        options?.onError?.(errorMessage);
        throw error;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    analyze,
    reset,
  };
}
