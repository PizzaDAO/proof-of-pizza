// Client-safe helpers for PizzaDAO redemption codes (no secrets here).
export const PIZZADAO_CODE_LENGTH = 4;
const CODE_RE = /^[2-9A-HJKMNP-Z]{4}$/;

/** Trim, uppercase, strip spaces/dashes. Returns null if not a well-formed code. */
export function normalizePizzadaoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(code) ? code : null;
}
