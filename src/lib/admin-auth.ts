import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function envCredentials(): Record<string, string> {
  const raw = process.env.ADMIN_CREDENTIALS;
  if (!raw) {
    const single = process.env.ADMIN_PASSWORD;
    return single ? { admin: single } : {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Returns true if the password matches an env-var admin or an active DB admin. */
export async function isValidAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  if (Object.values(envCredentials()).some((pwd) => pwd === password)) {
    return true;
  }
  const admins = await prisma.admin.findMany({ where: { isActive: true } });
  for (const admin of admins) {
    if (await bcrypt.compare(password, admin.passwordHash)) return true;
  }
  return false;
}

/** Checks `Authorization: Bearer <admin password>` (same scheme the admin UI already uses). */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const header = request.headers.get("Authorization");
  const password = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return isValidAdminPassword(password);
}
