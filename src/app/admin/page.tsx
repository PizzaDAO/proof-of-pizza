"use client";

import { usePrivy } from "@privy-io/react-auth";
import { SubmissionQueue } from "@/components/SubmissionQueue";
import { AdminProviders } from "@/providers/AdminProviders";

function AdminContent() {
  const { login, logout, authenticated, ready, user } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <a
              href="/"
              className="text-gray-400 hover:text-orange-500 transition-colors"
              title="Back to submission form"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Proof of Pizza Admin
              </h1>
              <p className="text-sm text-gray-500">Review and process reimbursements</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {authenticated ? (
              <>
                <span className="text-sm text-gray-600 font-mono">
                  {user?.wallet?.address
                    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
                    : "Connected"}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {authenticated ? (
          <SubmissionQueue />
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Connect your wallet to access the admin panel and process pizza
              reimbursements.
            </p>
            <button
              onClick={login}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminProviders>
      <AdminContent />
    </AdminProviders>
  );
}
