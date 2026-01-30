import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiting (resets on serverless cold start)
const attempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const record = attempts.get(ip);
  if (!record) return false;

  // Reset if lockout period has passed
  if (Date.now() - record.lastAttempt > LOCKOUT_DURATION) {
    attempts.delete(ip);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string, success: boolean): void {
  if (success) {
    attempts.delete(ip);
    return;
  }

  const record = attempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  attempts.set(ip, record);
}

// Parse admin credentials from env var
function getAdminCredentials(): Record<string, string> {
  const credentials = process.env.ADMIN_CREDENTIALS;
  if (!credentials) {
    // Fall back to single ADMIN_PASSWORD for backwards compatibility
    const singlePassword = process.env.ADMIN_PASSWORD;
    if (singlePassword) {
      return { admin: singlePassword };
    }
    return {};
  }
  try {
    return JSON.parse(credentials);
  } catch {
    console.error("Failed to parse ADMIN_CREDENTIALS");
    return {};
  }
}

function verifyPassword(password: string): { valid: boolean; adminName?: string } {
  const credentials = getAdminCredentials();

  if (Object.keys(credentials).length === 0) {
    console.error("No admin credentials configured");
    return { valid: false };
  }

  for (const [name, pwd] of Object.entries(credentials)) {
    if (pwd === password) {
      return { valid: true, adminName: name };
    }
  }
  return { valid: false };
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);

  // Check rate limit
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  try {
    const { password } = await request.json();

    const { valid, adminName } = verifyPassword(password);

    if (valid && adminName) {
      recordAttempt(ip, true);
      return NextResponse.json({ success: true, adminName });
    }

    recordAttempt(ip, false);
    const record = attempts.get(ip);
    const remaining = MAX_ATTEMPTS - (record?.count || 0);

    return NextResponse.json(
      { error: `Invalid password. ${remaining} attempts remaining.` },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
