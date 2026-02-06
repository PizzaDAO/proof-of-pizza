"use client";

import { useState, useEffect } from "react";

interface Admin {
  id: string;
  name: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export function AdminManager() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/admins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
      } else {
        setError("Failed to load admins");
      }
    } catch {
      setError("Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPassword) return;

    setIsCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName, adminPassword: newPassword }),
      });

      if (response.ok) {
        setNewName("");
        setNewPassword("");
        fetchAdmins();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create admin");
      }
    } catch {
      setError("Failed to create admin");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (adminId: string, adminName: string) => {
    if (!confirm(`Are you sure you want to remove ${adminName}?`)) return;

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/admins?id=${adminId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchAdmins();
      } else {
        setError("Failed to delete admin");
      }
    } catch {
      setError("Failed to delete admin");
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Admins</h3>

      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
          {error}
        </div>
      )}

      {/* Add new admin form */}
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={isCreating || !newName || !newPassword}
          className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:text-gray-700"
        >
          {isCreating ? "Adding..." : "Add Admin"}
        </button>
      </form>

      {/* Admin list */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-700">Loading...</div>
      ) : admins.length === 0 ? (
        <div className="text-center py-4 text-gray-700">No admins added yet</div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div>
                <span className="font-medium text-gray-900">{admin.name}</span>
                {admin.isSuperAdmin && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                    Super
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(admin.id, admin.name)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-700">
        Superadmins are configured via environment variables and cannot be removed here.
      </p>
    </div>
  );
}
