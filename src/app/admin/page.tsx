"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SubmissionQueue } from "@/components/SubmissionQueue";
import { AdminProviders } from "@/providers/AdminProviders";

function AdminContent() {
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

          <ConnectButton />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SubmissionQueue />
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
