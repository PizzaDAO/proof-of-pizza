/**
 * Upload rules shared by the presign endpoint, receipt analysis and the
 * submission API. Keys are always generated server-side:
 *   <pizza|receipt>/<ms timestamp>-<uuid>.<ext>
 * and referenced by the app as /api/images/<key>.
 */

export const UPLOAD_FOLDERS = ["pizza", "receipt"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_UPLOAD_TYPES = Object.keys(EXT_BY_TYPE);

const KEY_RE =
  /^(pizza|receipt)\/(\d{13})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
// Keys minted before this change used Math.random() ids instead of UUIDs.
const LEGACY_KEY_RE = /^(pizza|receipt)\/(\d{13})-[a-z0-9]{1,16}\.(jpg|png|webp)$/;

export const IMAGE_URL_PREFIX = "/api/images/";

export function newUploadKey(folder: UploadFolder, contentType: string): string {
  return `${folder}/${Date.now()}-${crypto.randomUUID()}.${EXT_BY_TYPE[contentType]}`;
}

/** Parses an /api/images/... URL produced by our upload flow. */
export function parseUploadUrl(
  url: string
): { key: string; folder: UploadFolder; uploadedAt: number } | null {
  if (!url.startsWith(IMAGE_URL_PREFIX)) return null;
  const key = url.slice(IMAGE_URL_PREFIX.length);
  const m = KEY_RE.exec(key) ?? LEGACY_KEY_RE.exec(key);
  if (!m) return null;
  return { key, folder: m[1] as UploadFolder, uploadedAt: Number(m[2]) };
}
