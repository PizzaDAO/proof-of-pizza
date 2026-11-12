import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Admin auth.
 *
 * Login (POST /api/admin/verify) checks the password once and issues a signed,
 * httpOnly, Secure, SameSite=Strict session cookie. The password is never
 * stored client-side. Admin API routes call `requireAdmin` /
 * `requireSuperAdmin`, which verify the cookie's HMAC and re-check that the
 * admin still exists with the same password, so deleting an admin or rotating
 * a password revokes their sessions.
 *
 * Requires ADMIN_SESSION_SECRET (>= 32 chars). Without it, login and every
 * admin route fail closed with a clear 500.
 */

export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const MIN_SECRET_LENGTH = 32;

export const ADMIN_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-pop_admin" : "pop_admin";

export class AdminSessionConfigError extends Error {
  constructor() {
    super(
      "Server misconfigured: ADMIN_SESSION_SECRET is missing or shorter than 32 characters"
    );
  }
}

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new AdminSessionConfigError();
  }
  return secret;
}

export interface AdminIdentity {
  name: string;
  isSuperAdmin: boolean;
  /** "env" = ADMIN_CREDENTIALS/ADMIN_PASSWORD superadmin; "db" = Admin table row */
  source: "env" | "db";
  /** Admin.id for db admins */
  adminId?: string;
}

interface SessionPayload {
  n: string; // name
  s: boolean; // isSuperAdmin
  src: "env" | "db";
  id?: string; // Admin.id (db)
  fp: string; // fingerprint of the credential, so a password change revokes the session
  exp: number; // unix seconds
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function envCredentials(): Record<string, string> {
  const raw = process.env.ADMIN_CREDENTIALS;
  if (!raw) {
    const single = process.env.ADMIN_PASSWORD;
    return single ? { admin: single } : {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.error("Failed to parse ADMIN_CREDENTIALS");
    return {};
  }
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time string compare (hash first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function fingerprint(credential: string): string {
  return createHmac("sha256", sessionSecret())
    .update(`fp:${credential}`)
    .digest("base64url")
    .slice(0, 22);
}

/**
 * Returns the matching admin for a password, or null. Every env credential is
 * compared (no early exit) in constant time; DB admins use bcrypt.
 */
export async function verifyAdminPassword(password: unknown): Promise<AdminIdentity | null> {
  if (typeof password !== "string" || !password || password.length > 256) return null;

  let envMatch: string | null = null;
  for (const [name, pwd] of Object.entries(envCredentials())) {
    const match = typeof pwd === "string" && pwd.length > 0 && safeEqual(pwd, password);
    if (match && envMatch === null) envMatch = name;
  }
  if (envMatch !== null) {
    return { name: envMatch, isSuperAdmin: true, source: "env" };
  }

  const admins = await prisma.admin.findMany({ where: { isActive: true } });
  for (const admin of admins) {
    if (await bcrypt.compare(password, admin.passwordHash)) {
      return { name: admin.name, isSuperAdmin: admin.isSuperAdmin, source: "db", adminId: admin.id };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session token: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
// ---------------------------------------------------------------------------

function sign(data: string): string {
  return createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

async function createSessionToken(identity: AdminIdentity, password: string): Promise<string> {
  let credential = password;
  if (identity.source === "db" && identity.adminId) {
    const admin = await prisma.admin.findUnique({ where: { id: identity.adminId } });
    credential = admin?.passwordHash ?? "";
  }
  const payload: SessionPayload = {
    n: identity.name,
    s: identity.isSuperAdmin,
    src: identity.source,
    id: identity.adminId,
    fp: fingerprint(credential),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function parseSessionToken(token: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Confirms the admin still exists, is active, and has the same password as at login. */
async function isSessionStillValid(p: SessionPayload): Promise<boolean> {
  if (p.src === "env") {
    const pwd = envCredentials()[p.n];
    return typeof pwd === "string" && pwd.length > 0 && safeEqual(fingerprint(pwd), p.fp);
  }
  if (!p.id) return false;
  const admin = await prisma.admin.findUnique({ where: { id: p.id } });
  return !!admin && admin.isActive && safeEqual(fingerprint(admin.passwordHash), p.fp);
}

/** Returns the signed-in admin for this request, or null. Throws AdminSessionConfigError if unconfigured. */
export async function getAdminSession(request: NextRequest): Promise<AdminIdentity | null> {
  sessionSecret(); // fail closed before looking at the cookie
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = parseSessionToken(token);
  if (!payload || !(await isSessionStillValid(payload))) return null;
  return { name: payload.n, isSuperAdmin: payload.s, source: payload.src, adminId: payload.id };
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

/**
 * For state-changing requests, reject a cross-site Origin (defense in depth on
 * top of SameSite=Strict).
 */
export function isCrossSite(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export type GuardResult =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; response: NextResponse };

async function guard(request: NextRequest, needSuper: boolean): Promise<GuardResult> {
  try {
    if (isCrossSite(request)) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    const admin = await getAdminSession(request);
    if (!admin) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }),
      };
    }
    // Superadmin-only actions stay limited to env-configured superadmins (unchanged behavior).
    if (needSuper && admin.source !== "env") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Superadmin only", code: "FORBIDDEN" }, { status: 403 }),
      };
    }
    return { ok: true, admin };
  } catch (error) {
    if (error instanceof AdminSessionConfigError) {
      console.error(error.message);
      return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) };
    }
    throw error;
  }
}

/** Any signed-in admin. */
export function requireAdmin(request: NextRequest): Promise<GuardResult> {
  return guard(request, false);
}

/** Env-configured (ADMIN_CREDENTIALS) superadmins only. */
export function requireSuperAdmin(request: NextRequest): Promise<GuardResult> {
  return guard(request, true);
}

/** Sets the session cookie on `response` after a successful login. */
export async function setAdminSessionCookie(
  response: NextResponse,
  identity: AdminIdentity,
  password: string
): Promise<void> {
  response.cookies.set(ADMIN_COOKIE_NAME, await createSessionToken(identity, password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
