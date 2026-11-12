import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Postgres-backed fixed-window rate limiter (table "RateLimit").
 * Serverless instances don't share memory, so counters live in the DB.
 * Each hit is one atomic upsert; a window resets once `windowSeconds` have
 * passed since its first hit.
 */

/** Client IP as seen by Vercel's edge (these headers are set by Vercel, not the client). */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export interface RateLimitResult {
  count: number;
  limited: boolean;
  retryAfterSeconds: number;
}

/** Record one hit against `key` and report whether it is now over `limit`. */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Columns are timestamp-without-time-zone holding UTC (Prisma convention), so use UTC "now".
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}::double precision) THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}::double precision) THEN (now() AT TIME ZONE 'UTC')
        ELSE "RateLimit"."windowStart"
      END,
      "updatedAt" = (now() AT TIME ZONE 'UTC')
    RETURNING "count", "windowStart"
  `;
  maybeCleanup();
  const row = rows[0];
  const count = Number(row.count);
  return {
    count,
    limited: count > limit,
    retryAfterSeconds: retryAfter(row.windowStart, windowSeconds),
  };
}

/** Read the current count for `key` without incrementing it. */
export async function peekRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowStart.getTime() < Date.now() - windowSeconds * 1000) {
    return { count: 0, limited: false, retryAfterSeconds: 0 };
  }
  return {
    count: row.count,
    limited: row.count >= limit,
    retryAfterSeconds: retryAfter(row.windowStart, windowSeconds),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/**
 * Rate-limit a public endpoint by client IP. Returns a 429 response when over
 * the limit, otherwise null. Fails open (logs) if the DB is unreachable so the
 * public submit flow doesn't break on a limiter outage.
 */
export async function limitByIp(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  try {
    const result = await hitRateLimit(`${bucket}:${getClientIp(request)}`, limit, windowSeconds);
    if (result.limited) {
      return tooManyRequests(result.retryAfterSeconds);
    }
    return null;
  } catch (error) {
    console.error(`Rate limiter error (${bucket}); allowing request:`, error);
    return null;
  }
}

export function tooManyRequests(retryAfterSeconds: number, message?: string): NextResponse {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return NextResponse.json(
    { error: message ?? `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } }
  );
}

function retryAfter(windowStart: Date, windowSeconds: number): number {
  return Math.max(0, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
}

// Opportunistically prune stale rows (~1% of hits) so the table stays small.
function maybeCleanup() {
  if (Math.random() > 0.01) return;
  prisma.rateLimit
    .deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch((error) => console.error("Rate limit cleanup failed:", error));
}
