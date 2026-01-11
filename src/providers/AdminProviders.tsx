"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { useState, useEffect } from "react";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted and we have the app ID
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!privyAppId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">Privy not configured</p>
          <p className="text-gray-500 text-sm mt-1">NEXT_PUBLIC_PRIVY_APP_ID is missing</p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#FF6B35",
          logo: "/pizza-logo.png",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
