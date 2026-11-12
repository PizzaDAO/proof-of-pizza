import { clearAuthImageCache } from "@/components/AuthImage";

export const ADMIN_UNAUTHORIZED_EVENT = "admin-unauthorized";

// Keys an older version of the admin page kept in localStorage (including the
// plaintext password). Auth is now an httpOnly session cookie, so wipe them.
const LEGACY_STORAGE_KEYS = ["admin_authenticated", "admin_token", "admin_name", "admin_is_super"];

export function clearLegacyAdminStorage() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    // storage unavailable; nothing to clear
  }
}

/** Client-side state reset after logout or an expired session. */
export function clearAdminSession() {
  clearLegacyAdminStorage();
  clearAuthImageCache();
}

/** Ends the server session (clears the cookie) and local state. */
export async function logoutAdmin() {
  await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
  clearAdminSession();
}

/**
 * Same-origin fetch for admin APIs; the session cookie is sent automatically.
 * On 401 the session is cleared and the admin page returns to the login screen.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "same-origin" });
  if (res.status === 401) {
    clearAdminSession();
    window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
  }
  return res;
}
