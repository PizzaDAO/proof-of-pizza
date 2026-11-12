import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2-client";
import { limitByIp } from "@/lib/rate-limit";
import {
  ALLOWED_UPLOAD_TYPES,
  IMAGE_URL_PREFIX,
  MAX_UPLOAD_BYTES,
  UPLOAD_FOLDERS,
  newUploadKey,
} from "@/lib/upload-keys";

// Public (the submit form needs no login), so it's hardened instead of locked:
// - per-IP rate limit (a submission is at most 10 pizza + 10 receipt photos)
// - strict content-type allowlist and size cap
// - server-generated key; the client never picks a path
// - the presigned PUT is short-lived and signs Content-Type and Content-Length,
//   so it only accepts exactly the declared type and byte count at that one key
const PRESIGN_LIMIT = 40;
const PRESIGN_WINDOW_SECONDS = 15 * 60;
const PRESIGN_EXPIRES_SECONDS = 120;

const requestSchema = z.object({
  fileType: z.string(),
  fileSize: z.number().int(),
  type: z.enum(UPLOAD_FOLDERS),
});

export async function POST(request: NextRequest) {
  try {
    if (
      !process.env.R2_ACCOUNT_ID ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_BUCKET_NAME
    ) {
      console.error("Presign: R2 is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { fileType, fileSize, type } = parsed.data;

    if (!ALLOWED_UPLOAD_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    if (fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    const limited = await limitByIp(request, "presign", PRESIGN_LIMIT, PRESIGN_WINDOW_SECONDS);
    if (limited) return limited;

    const key = newUploadKey(type, fileType);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
      // Bind the URL to the declared type and size (the presigner otherwise leaves Content-Type unsigned).
      signableHeaders: new Set(["content-type", "content-length"]),
    });

    return NextResponse.json({
      presignedUrl,
      publicUrl: `${IMAGE_URL_PREFIX}${key}`,
      key,
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
