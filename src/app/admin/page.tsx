"use client";

import { useState, useEffect } from "react";
import { SubmissionQueue } from "@/components/SubmissionQueue";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminManager } from "@/components/AdminManager";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showAdminManager, setShowAdminManager] = useState(false);

  useEffect(() => {
    const authState = localStorage.getItem("admin_authenticated");
    const storedName = localStorage.getItem("admin_name");
    const storedSuperAdmin = localStorage.getItem("admin_is_super");
    setIsAuthenticated(authState === "true");
    setAdminName(storedName);
    setIsSuperAdmin(storedSuperAdmin === "true");
  }, []);

  const handleLogin = (name: string, superAdmin?: boolean) => {
    setAdminName(name);
    setIsSuperAdmin(!!superAdmin);
    setIsAuthenticated(true);
    if (superAdmin) {
      localStorage.setItem("admin_is_super", "true");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_authenticated");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_is_super");
    setIsAuthenticated(false);
    setAdminName(null);
    setIsSuperAdmin(false);
    setShowAdminManager(false);
  };

  const handleSyncSheets = async () => {
    setSyncStatus("Syncing...");
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/sync-sheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setSyncStatus(data.message);
      } else {
        setSyncStatus(`Error: ${data.error}`);
      }
    } catch {
      setSyncStatus("Failed to sync");
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  // Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <a
              href="/"
              className="text-gray-600 hover:text-orange-500 transition-colors"
              title="Back to submission form"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Proof of Pizza Admin
              </h1>
              <p className="text-sm text-gray-700">
                Review and process reimbursements
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {syncStatus && (
              <span className="text-sm text-gray-800">{syncStatus}</span>
            )}
            <button
              onClick={handleSyncSheets}
              className="px-4 py-2 text-sm text-gray-800 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sync missing submissions to Google Sheets"
            >
              Sync Sheets
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setShowAdminManager(!showAdminManager)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  showAdminManager
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-800 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Manage Admins
              </button>
            )}
            {adminName && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isSuperAdmin ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
              }`}>
                {adminName}
                {isSuperAdmin && " ★"}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-800 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Admin Manager Panel */}
      {showAdminManager && isSuperAdmin && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <AdminManager />
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SubmissionQueue />
      </main>
    </div>
  );
}
