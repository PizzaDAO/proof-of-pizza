"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsResolution } from "@/hooks/useEnsResolution";

interface WalletAddressInputProps {
  value: string;
  onChange: (value: string, resolvedAddress: string | null) => void;
  className?: string;
}

export function WalletAddressInput({
  value,
  onChange,
  className = "",
}: WalletAddressInputProps) {
  const [input, setInput] = useState(value);
  const { address: connectedAddress, isConnected } = useAccount();
  const { address, isEns, isLoading, isValid, error } = useEnsResolution(input);

  useEffect(() => {
    onChange(input, address);
  }, [input, address, onChange]);

  const useConnectedWallet = () => {
    if (connectedAddress) {
      setInput(connectedAddress);
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Wallet Address or ENS Name
      </label>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x... or vitalik.eth"
          className={`
            w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors
            ${error ? "border-red-300 focus:ring-red-500" : "border-gray-300 focus:ring-red-500"}
            ${isValid ? "border-green-300" : ""}
          `}
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isValid && !isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="w-5 h-5 text-green-500"
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
        )}
      </div>

      {/* Connect wallet option */}
      <div className="mt-3 flex items-center gap-3">
        {isConnected ? (
          <button
            type="button"
            onClick={useConnectedWallet}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Use connected wallet ({connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)})
          </button>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                type="button"
                onClick={openConnectModal}
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Or connect wallet
              </button>
            )}
          </ConnectButton.Custom>
        )}
      </div>

      {isEns && address && (
        <p className="mt-2 text-sm text-gray-600">
          Resolves to:{" "}
          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
