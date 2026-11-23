import "server-only";
/**
 * Server-to-server client for the pizzadao.org redemption-code API.
 * All request/response shapes live here so they are easy to adjust.
 * Server only: never import from a client component (PIZZADAO_API_KEY must not reach the browser).
 *
 * Contract (Bearer auth with PIZZADAO_API_KEY):
 *   POST {base}/api/proof-of-pizza/codes/lookup  { code }
 *     -> 200 { status: "active"|"redeemed"|"void"|"unknown", holderName, acquiredAt, redeemedAt, redeemedRef }
 *   POST {base}/api/proof-of-pizza/codes/redeem  { code, ref }   (ref = BARE submission id; server stores "proofofpizza:<ref>")
 *     -> 200 { ok, already, redeemedAt } | 404 unknown_or_void | 409 already_redeemed
 *   400 malformed code, 401 bad key, 429 rate limited, 503 API not configured
 */

const TIMEOUT_MS = 5000;

export type CodeStatus = "valid" | "redeemed" | "void" | "unknown";

export interface CodeLookup {
  status: CodeStatus;
  holderName: string | null;
  acquiredAt: string | null;
  redeemedAt: string | null;
  redeemedRef: string | null;
}

export type LookupResult =
  | { ok: true; lookup: CodeLookup }
  | { ok: false; error: string };

export type RedeemResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: "unknown" | "used" | "unavailable"; error: string };

/** What pizzadao.org stores as redeemedRef for a submission. */
export function storedRedeemRef(submissionId: string): string {
  return `proofofpizza:${submissionId}`;
}

function config() {
  const key = process.env.PIZZADAO_API_KEY;
  if (!key) return null;
  const base = (process.env.PIZZADAO_API_URL || "https://pizzadao.org").replace(/\/+$/, "");
  return { base, key };
}

async function post(path: string, body: unknown): Promise<Response | null> {
  const cfg = config();
  if (!cfg) return null;
  return fetch(`${cfg.base}/api/proof-of-pizza/codes/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

const NOT_CONFIGURED = "PizzaDAO code service is not configured";
const UNREACHABLE = "Could not reach pizzadao.org, try again";

export async function lookupPizzadaoCode(code: string): Promise<LookupResult> {
  try {
    const res = await post("lookup", { code });
    if (!res) return { ok: false, error: NOT_CONFIGURED };
    if (!res.ok) return { ok: false, error: `${UNREACHABLE} (${res.status})` };
    const data = await res.json();
    const status: CodeStatus = data?.status === "active" ? "valid" : ["redeemed", "void"].includes(data?.status) ? data.status : "unknown";
    return {
      ok: true,
      lookup: {
        status,
        holderName: typeof data.holderName === "string" ? data.holderName : null,
        acquiredAt: typeof data.acquiredAt === "string" ? data.acquiredAt : null,
        redeemedAt: typeof data.redeemedAt === "string" ? data.redeemedAt : null,
        redeemedRef: typeof data.redeemedRef === "string" ? data.redeemedRef : null,
      },
    };
  } catch (error) {
    console.error("PizzaDAO lookup failed:", error);
    return { ok: false, error: UNREACHABLE };
  }
}

/** Idempotent on submissionId: a repeat redeem of the same submission returns already: true. */
export async function redeemPizzadaoCode(code: string, submissionId: string): Promise<RedeemResult> {
  try {
    const res = await post("redeem", { code, ref: submissionId });
    if (!res) return { ok: false, reason: "unavailable", error: NOT_CONFIGURED };
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, already: data?.already === true };
    }
    if (res.status === 404) {
      return { ok: false, reason: "unknown", error: "PizzaDAO code is unknown or void" };
    }
    if (res.status === 409) {
      return { ok: false, reason: "used", error: "PizzaDAO code was already used" };
    }
    return { ok: false, reason: "unavailable", error: `${UNREACHABLE} (${res.status})` };
  } catch (error) {
    console.error("PizzaDAO redeem failed:", error);
    return { ok: false, reason: "unavailable", error: UNREACHABLE };
  }
}
