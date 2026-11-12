import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Postgres-backed fixed-window rate limiter (table "RateLimit").
 * Serverless instances don't share memory, so counters live in the DB.
 * Each hit is one atomic upsert; a window resets once `windowSeconds` have
 * passed since its first hit.
 */

/**
 * Rate-limit identity for the client, from the IP Vercel's edge reports (these
 * headers are set by Vercel, not the client). IPv4 (and IPv4-mapped IPv6) use
 * the full address; other IPv6 addresses are bucketed by /64, since a single
 * client typically controls a whole /64 and could otherwise rotate addresses.
 */
export function getClientIp(request: NextRequest): string {
  const raw =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return rateLimitIdentity(raw);
}

const IPV4_RE = /^(\d{1,3})(\.\d{1,3}){3}$/;

export function rateLimitIdentity(ip: string): string {
  let addr = ip.trim().toLowerCase();
  if (addr.startsWith("[")) addr = addr.slice(1, addr.indexOf("]") > 0 ? addr.indexOf("]") : undefined);
  addr = addr.split("%")[0]; // drop IPv6 zone id
  if (IPV4_RE.test(addr)) return addr;
  if (!addr.includes(":")) return addr || "unknown";

  const groups = expandIpv6(addr);
  if (!groups) return addr; // unparseable: use as-is

  // IPv4-mapped (::ffff:a.b.c.d) -> plain IPv4
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** Expands an IPv6 address (with optional :: and trailing dotted IPv4) to 8 16-bit groups. */
function expandIpv6(addr: string): number[] | null {
  let tail: number[] = [];
  const lastColon = addr.lastIndexOf(":");
  const maybeV4 = addr.slice(lastColon + 1);
  if (IPV4_RE.test(maybeV4)) {
    const o = maybeV4.split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
    addr = addr.slice(0, lastColon + 1) + "0"; // placeholder group, replaced below
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":") : []);
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (tail.length) {
    (halves.length === 2 ? rest : head).pop();
  }
  const fill = 8 - tail.length - head.length - rest.length;
  if (halves.length === 2 ? fill < 0 : fill !== 0) return null;
  const hex = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...rest];
  const groups = hex.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  if (groups.some(Number.isNaN)) return null;
  return [...groups, ...tail];
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
