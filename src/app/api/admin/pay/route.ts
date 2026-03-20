import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendUsdcPayment, MAX_PAYMENT_AMOUNT } from "@/lib/server-wallet";
import { updateSubmissionInSheet } from "@/lib/google-sheets";

// Parse admin credentials from env var
function getAdminCredentials(): Record<string, string> {
  const credentials = process.env.ADMIN_CREDENTIALS;
  if (!credentials) {
    return {};
  }
  try {
    return JSON.parse(credentials);
  } catch {
    console.error("Failed to parse ADMIN_CREDENTIALS");
    return {};
  }
}

function verifyAdminPassword(password: string): string | null {
  const credentials = getAdminCredentials();
  for (const [name, pwd] of Object.entries(credentials)) {
    if (pwd === password) {
      return name;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { submissionId, adminPassword, amount, recipientAddress } =
      await request.json();

    // Validate required fields
    if (!submissionId || !adminPassword || !amount || !recipientAddress) {
      return NextResponse.json(
        { error: "Missing required fields", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Verify admin password
    const adminName = verifyAdminPassword(adminPassword);
    if (!adminName) {
      return NextResponse.json(
        { error: "Invalid admin password", code: "UNAUTHORIZED" },
        { status: 401 }
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
      const result = await sendUsdcPayment(
        recipientAddress as `0x${string}`,
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
