"use client";

import { useState, useEffect } from "react";
import { SubmissionQueue } from "@/components/SubmissionQueue";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminManager } from "@/components/AdminManager";
import {
  adminFetch,
  clearLegacyAdminStorage,
  logoutAdmin,
  ADMIN_UNAUTHORIZED_EVENT,
} from "@/lib/admin-fetch";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showAdminManager, setShowAdminManager] = useState(false);

  // Ask the server whether the httpOnly session cookie is valid.
  useEffect(() => {
    clearLegacyAdminStorage();
    let cancelled = false;
    fetch("/api/admin/session", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setAdminName(data.adminName);
          setIsSuperAdmin(!!data.isSuperAdmin);
          setCanManageAdmins(!!data.canManageAdmins);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setIsAuthenticated(false);
      setAdminName(null);
      setIsSuperAdmin(false);
      setCanManageAdmins(false);
      setShowAdminManager(false);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const handleLogin = (name: string, superAdmin: boolean, manageAdmins: boolean) => {
    setAdminName(name);
    setIsSuperAdmin(superAdmin);
    setCanManageAdmins(manageAdmins);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
    setAdminName(null);
    setIsSuperAdmin(false);
    setCanManageAdmins(false);
    setShowAdminManager(false);
  };

  const handleSyncSheets = async () => {
    setSyncStatus("Syncing...");
    try {
      const response = await adminFetch("/api/admin/sync-sheets", { method: "POST" });
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
              className="text-gray-400 hover:text-orange-500 transition-colors"
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
              <p className="text-sm text-gray-500">
                Review and process reimbursements
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {syncStatus && (
              <span className="text-sm text-gray-600">{syncStatus}</span>
            )}
            <button
              onClick={handleSyncSheets}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sync missing submissions to Google Sheets"
            >
              Sync Sheets
            </button>
            {canManageAdmins && (
              <button
                onClick={() => setShowAdminManager(!showAdminManager)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  showAdminManager
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Admin Manager Panel */}
      {showAdminManager && canManageAdmins && (
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
