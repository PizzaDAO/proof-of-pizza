import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUsdcPayment, MAX_PAYMENT_AMOUNT } from "@/lib/server-wallet";
import { updateSubmissionInSheet } from "@/lib/google-sheets";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  // Server-wallet payouts stay limited to env-configured superadmins (unchanged behavior).
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;
  const adminName = auth.admin.name;

  try {
    const { submissionId, amount } = await request.json();

    // Validate required fields
    if (typeof submissionId !== "string" || !submissionId || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Missing required fields", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Check amount limit
    if (amount > MAX_PAYMENT_AMOUNT) {
      return NextResponse.json(
        {
          error: `Amount $${amount} exceeds $${MAX_PAYMENT_AMOUNT} limit`,
          code: "LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    // Get submission and verify status
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (submission.status === "PAID") {
      return NextResponse.json(
        { error: "Submission already paid", code: "ALREADY_PAID" },
        { status: 400 }
      );
    }

    if (submission.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Submission must be approved before payment", code: "NOT_APPROVED" },
        { status: 400 }
      );
    }

    // Send USDC payment
    let txHash: string;
    try {
      // Always pay the submitter's stored address, never a client-supplied one.
      const result = await sendUsdcPayment(
        submission.walletAddress as `0x${string}`,
        amount
      );
      txHash = result.hash;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("Insufficient balance")) {
        return NextResponse.json(
          { error: "Server wallet needs funding", code: "INSUFFICIENT_BALANCE" },
          { status: 400 }
        );
      }

      console.error("Payment failed:", error);
      return NextResponse.json(
        { error: `Transaction failed: ${message}`, code: "TX_FAILED" },
        { status: 500 }
      );
    }

    // Update database
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "PAID",
        transactionHash: txHash,
        paidAmount: amount,
        paidAt: new Date(),
        reviewedBy: adminName,
      },
    });

    // Update Google Sheets (async, don't wait)
    updateSubmissionInSheet(
      submissionId,
      {
        status: "PAID",
        transactionHash: txHash,
        paidAmount: amount,
        paidAt: updatedSubmission.paidAt,
        reviewedBy: adminName,
      },
      {
        walletAddress: submission.walletAddress,
        ensName: submission.ensName,
        extractedAmount: Number(submission.extractedAmount),
        finalAmount: Number(submission.finalAmount),
        currency: submission.currency,
        receiptPhotoUrl: submission.receiptPhotoUrl,
        pizzaPhotoUrl: submission.pizzaPhotoUrl,
        receiptPhotoUrls: submission.receiptPhotoUrls,
        pizzaPhotoUrls: submission.pizzaPhotoUrls,
        createdAt: submission.createdAt,
      }
    ).catch(console.error);

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      adminName,
    });
  } catch (error) {
    console.error("Payment endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
