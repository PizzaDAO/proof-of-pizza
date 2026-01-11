import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2-client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || !["pizza", "receipt"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split(".").pop() || "jpg";
    const key = `${type}/${timestamp}-${randomId}.${extension}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(command);

    // Return the proxy URL (goes through our API to avoid R2 access issues)
    const publicUrl = `/api/images/${key}`;

    return NextResponse.json({
      publicUrl,
      key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
