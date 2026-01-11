import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logSubmission, initializeSheet } from "@/lib/google-sheets";

// Initialize sheet headers on first load
initializeSheet().catch(console.error);

type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

const createSubmissionSchema = z.object({
  walletAddress: z.string().min(1),
  ensName: z.string().optional(),
  pizzaPhotoUrl: z.string().url(),
  receiptPhotoUrl: z.string().url(),
  extractedAmount: z.number().positive(),
  finalAmount: z.number().positive(),
  currency: z.string().default("USD"),
  originalAmount: z.number().optional(),
  originalCurrency: z.string().optional(),
  exchangeRate: z.number().optional(),
});

export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json();
    const data = createSubmissionSchema.parse(body);

    const submission = await prisma.submission.create({
      data: {
        walletAddress: data.walletAddress,
        ensName: data.ensName,
        pizzaPhotoUrl: data.pizzaPhotoUrl,
        receiptPhotoUrl: data.receiptPhotoUrl,
        extractedAmount: data.extractedAmount,
        finalAmount: data.finalAmount,
        currency: data.currency,
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
      receiptPhotoUrl: submission.receiptPhotoUrl,
      pizzaPhotoUrl: submission.pizzaPhotoUrl,
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
      { error: "Failed to create submission", details: errorMessage, code: errorCode },
      { status: 500 }
    );
  }
}
