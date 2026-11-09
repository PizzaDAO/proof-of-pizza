import { clearAuthImageCache } from "@/components/AuthImage";

export const ADMIN_UNAUTHORIZED_EVENT = "admin-unauthorized";

// Client-side fetch that sends the admin token (same source the admin UI already uses).
export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
  return { ...extra, Authorization: `Bearer ${token}` };
}

export function clearAdminSession() {
  localStorage.removeItem("admin_authenticated");
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_name");
  localStorage.removeItem("admin_is_super");
  clearAuthImageCache();
}

/** On 401 the session is cleared and the admin page returns to the login screen. */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    headers: adminHeaders((init.headers as Record<string, string>) || {}),
  });
  if (res.status === 401) {
    clearAdminSession();
    window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
  }
  return res;
}
