"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, isAddress } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";

interface EnsState {
  address: string | null;
  isEns: boolean;
  isLoading: boolean;
  isValid: boolean;
  error: string | null;
}

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

export function useEnsResolution(input: string) {
  const [state, setState] = useState<EnsState>({
    address: null,
    isEns: false,
    isLoading: false,
    isValid: false,
    error: null,
  });

  useEffect(() => {
    if (!input || input.trim() === "") {
      setState({
        address: null,
        isEns: false,
        isLoading: false,
        isValid: false,
        error: null,
      });
      return;
    }

    const trimmedInput = input.trim();

    // Check if it's a valid Ethereum address
    if (isAddress(trimmedInput)) {
      setState({
        address: trimmedInput,
        isEns: false,
        isLoading: false,
        isValid: true,
        error: null,
      });
      return;
    }

    // Check if it looks like an ENS name
    if (trimmedInput.endsWith(".eth")) {
      setState((prev) => ({ ...prev, isLoading: true, isEns: true, error: null }));

      let cancelled = false;

      const resolveEns = async () => {
        try {
          const normalizedName = normalize(trimmedInput);

          // Add timeout
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          );

          const address = await Promise.race([
            publicClient.getEnsAddress({ name: normalizedName }),
            timeoutPromise,
          ]);

          if (cancelled) return;

          if (address) {
            setState({
              address,
              isEns: true,
              isLoading: false,
              isValid: true,
              error: null,
            });
          } else {
            setState({
              address: null,
              isEns: true,
              isLoading: false,
              isValid: false,
              error: "ENS name not found",
            });
          }
        } catch (err) {
          if (cancelled) return;
          setState({
            address: null,
            isEns: true,
            isLoading: false,
            isValid: false,
            error: err instanceof Error && err.message === "Timeout"
              ? "ENS lookup timed out"
              : "Failed to resolve ENS name",
          });
        }
      };

      // Debounce the ENS lookup
      const timeoutId = setTimeout(resolveEns, 500);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    // Invalid input
    setState({
      address: null,
      isEns: false,
      isLoading: false,
      isValid: false,
      error: "Enter a valid address or ENS name",
    });
  }, [input]);

  return state;
}
