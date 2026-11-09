import { NextRequest, NextResponse } from "next/server";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Receipts/photos contain PII (card digits, names) and are only shown in
    // the admin panel, so every image requires admin auth.
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const key = path.join("/");

    if (!/^(pizza|receipt)\/[\w.-]+$/.test(key)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.ContentType || "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch image:", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
