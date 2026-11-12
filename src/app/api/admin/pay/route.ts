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
    // Only the submission id is taken from the client; amount and recipient come from the DB.
    const { submissionId } = await request.json();

    if (typeof submissionId !== "string" || !submissionId) {
      return NextResponse.json(
        { error: "Missing required fields", code: "BAD_REQUEST" },
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

    // Pay the admin-confirmed amount stored on the submission.
    const amount = submission.finalAmount === null ? NaN : Number(submission.finalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Submission has no valid final amount", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }
    if (amount > MAX_PAYMENT_AMOUNT) {
      return NextResponse.json(
        {
          error: `Amount $${amount} exceeds $${MAX_PAYMENT_AMOUNT} limit`,
          code: "LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    // Atomically claim the payout so concurrent requests can't both send.
    const claim = await prisma.submission.updateMany({
      where: { id: submissionId, status: "APPROVED", payoutClaimedAt: null },
      data: { payoutClaimedAt: new Date() },
    });
    if (claim.count === 0) {
      return NextResponse.json(
        {
          error:
            "A payout for this submission is already in progress (or was interrupted - check BaseScan before retrying)",
          code: "PAYOUT_IN_PROGRESS",
        },
        { status: 409 }
      );
    }
    const releaseClaim = () =>
      prisma.submission
        .updateMany({ where: { id: submissionId, status: "APPROVED" }, data: { payoutClaimedAt: null } })
        .catch((e) => console.error("Failed to release payout claim:", e));

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
      const sentHash = (error as { hash?: string }).hash;
      const onChainFailure = (error as { onChainFailure?: boolean }).onChainFailure;

      if (sentHash && !onChainFailure) {
        // Broadcast but unconfirmed (e.g. receipt timeout): keep the claim so it can't be paid twice.
        console.error("Payout broadcast but not confirmed:", sentHash, error);
        return NextResponse.json(
          {
            error: `Transaction ${sentHash} was sent but not confirmed. Check BaseScan before doing anything else.`,
            code: "TX_UNCONFIRMED",
            transactionHash: sentHash,
          },
          { status: 502 }
        );
      }

      // Nothing was transferred (pre-broadcast error or on-chain revert): release the claim.
      await releaseClaim();

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
        payoutClaimedAt: null,
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
