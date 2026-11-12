import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logSubmission, initializeSheet } from "@/lib/google-sheets";
import { limitByIp } from "@/lib/rate-limit";
import { parseUploadUrl, type UploadFolder } from "@/lib/upload-keys";

// Public endpoint: throttle per IP and only accept photo URLs minted by our own
// presign flow (right folder, uploaded recently).
const SUBMIT_LIMIT = 10;
const SUBMIT_WINDOW_SECONDS = 60 * 60;
const MAX_PHOTO_AGE_MS = 24 * 60 * 60 * 1000;

function photoUrl(folder: UploadFolder) {
  return z.string().max(200).refine(
    (url) => {
      const parsed = parseUploadUrl(url);
      if (!parsed || parsed.folder !== folder) return false;
      const age = Date.now() - parsed.uploadedAt;
      return age <= MAX_PHOTO_AGE_MS && age >= -5 * 60 * 1000;
    },
    { message: `Invalid ${folder} photo URL` }
  );
}

// Initialize sheet headers on first load
initializeSheet().catch(console.error);

type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

// Ethereum address validation: 0x followed by 40 hex characters
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

const createSubmissionSchema = z.object({
  walletAddress: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => ethereumAddressRegex.test(s), {
      message: "Invalid Ethereum address format",
    }),
  ensName: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  // New multi-photo fields
  pizzaPhotoUrls: z.array(photoUrl("pizza")).min(1).max(10).optional(),
  receiptPhotoUrls: z.array(photoUrl("receipt")).min(1).max(10).optional(),
  // Legacy single-URL fields (for backward compat)
  pizzaPhotoUrl: photoUrl("pizza").optional(),
  receiptPhotoUrl: photoUrl("receipt").optional(),
  extractedAmount: z.number().positive().max(1_000_000),
  finalAmount: z.number().positive().max(1_000_000),
  currency: z.string().max(10).default("USD"),
  originalAmount: z.number().nonnegative().max(99_999_999).optional(),
  originalCurrency: z.string().max(10).optional(),
  exchangeRate: z.number().nonnegative().max(1_000_000).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as SubmissionStatus | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const cursor = searchParams.get("cursor");

    const submissions = await prisma.submission.findMany({
      where: status ? { status } : undefined,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | undefined;
    if (submissions.length > limit) {
      const nextItem = submissions.pop();
      nextCursor = nextItem?.id;
    }

    return NextResponse.json({
      submissions,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await limitByIp(request, "submit", SUBMIT_LIMIT, SUBMIT_WINDOW_SECONDS);
  if (limited) return limited;

  try {
    const body = await request.json();
    const data = createSubmissionSchema.parse(body);

    // Resolve photo URLs: prefer arrays, fall back to single URLs
    const pizzaPhotoUrls = data.pizzaPhotoUrls || (data.pizzaPhotoUrl ? [data.pizzaPhotoUrl] : []);
    const receiptPhotoUrls = data.receiptPhotoUrls || (data.receiptPhotoUrl ? [data.receiptPhotoUrl] : []);

    // Validate that at least one of each exists
    if (pizzaPhotoUrls.length === 0 || receiptPhotoUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one pizza photo and one receipt photo are required" },
        { status: 400 }
      );
    }

    // Use first URL for legacy single-URL fields
    const pizzaPhotoUrl = pizzaPhotoUrls[0];
    const receiptPhotoUrl = receiptPhotoUrls[0];

    const submission = await prisma.submission.create({
      data: {
        walletAddress: data.walletAddress,
        ensName: data.ensName,
        notes: data.notes,
        pizzaPhotoUrl,
        receiptPhotoUrl,
        pizzaPhotoUrls,
        receiptPhotoUrls,
        extractedAmount: data.extractedAmount,
        finalAmount: data.finalAmount,
        currency: data.currency,
        originalAmount: data.originalAmount,
        originalCurrency: data.originalCurrency,
        exchangeRate: data.exchangeRate,
        status: "PENDING",
      },
    });

    // Log to Google Sheets (async, don't wait)
    logSubmission({
      id: submission.id,
      walletAddress: submission.walletAddress,
      ensName: submission.ensName,
      extractedAmount: Number(submission.extractedAmount),
      finalAmount: Number(submission.finalAmount),
      currency: submission.currency,
      originalAmount: data.originalAmount,
      originalCurrency: data.originalCurrency,
      exchangeRate: data.exchangeRate,
      receiptPhotoUrl: submission.receiptPhotoUrls.join(" ; ") || submission.receiptPhotoUrl,
      pizzaPhotoUrl: submission.pizzaPhotoUrls.join(" ; ") || submission.pizzaPhotoUrl,
      notes: submission.notes,
      status: submission.status,
      transactionHash: submission.transactionHash,
      paidAmount: submission.paidAmount ? Number(submission.paidAmount) : null,
      paidAt: submission.paidAt,
      reviewedBy: submission.reviewedBy,
      rejectionReason: submission.rejectionReason,
      createdAt: submission.createdAt,
    }).catch(console.error);

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as { code?: string })?.code;
    console.error("Failed to create submission:", {
      message: errorMessage,
      code: errorCode,
      error,
    });
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}
