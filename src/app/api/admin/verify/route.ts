import { NextRequest, NextResponse } from "next/server";
import {
  AdminSessionConfigError,
  isCrossSite,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { getClientIp, hitRateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";

// Per-IP login throttle, stored in Postgres so it holds across serverless instances.
// Every attempt counts; a successful login clears the counter.
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

/** POST /api/admin/verify — exchange the admin password for a session cookie. */
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((process.env.ADMIN_SESSION_SECRET ?? "").length < 32) {
    const message = new AdminSessionConfigError().message;
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const key = `admin-login:${getClientIp(request)}`;
  let attempt;
  try {
    attempt = await hitRateLimit(key, MAX_ATTEMPTS, WINDOW_SECONDS);
  } catch (error) {
    // Fail closed: no throttle, no login.
    console.error("Login rate limiter unavailable:", error);
    return NextResponse.json({ error: "Login temporarily unavailable" }, { status: 503 });
  }
  if (attempt.limited) {
    return tooManyRequests(attempt.retryAfterSeconds, "Too many attempts. Try again later.");
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = await verifyAdminPassword(password);
  if (!admin) {
    const remaining = Math.max(0, MAX_ATTEMPTS - attempt.count);
    return NextResponse.json(
      { error: `Invalid password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
      { status: 401 }
    );
  }

  await resetRateLimit(key).catch((error) => console.error("Failed to reset login counter:", error));

  const response = NextResponse.json({
    success: true,
    adminName: admin.name,
    isSuperAdmin: admin.isSuperAdmin,
    canManageAdmins: admin.source === "env",
  });
  await setAdminSessionCookie(response, admin, password as string);
  return response;
}
