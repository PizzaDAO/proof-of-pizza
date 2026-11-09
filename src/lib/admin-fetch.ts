// Client-side fetch that sends the admin token (same source the admin UI already uses).
export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
  return { ...extra, Authorization: `Bearer ${token}` };
}

export function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: adminHeaders((init.headers as Record<string, string>) || {}),
  });
}
