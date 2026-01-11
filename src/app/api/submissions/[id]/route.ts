import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { updateSubmissionInSheet } from "@/lib/google-sheets";

const SubmissionStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]);

const updateSubmissionSchema = z.object({
  status: SubmissionStatusEnum.optional(),
  reviewedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
  transactionHash: z.string().optional(),
  paidAmount: z.number().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const submission = await prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("Failed to fetch submission:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateSubmissionSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.status) {
      updateData.status = data.status;

      if (data.status === "APPROVED" || data.status === "REJECTED") {
        updateData.reviewedAt = new Date();
      }

      if (data.status === "PAID") {
        updateData.paidAt = new Date();
      }
    }

    if (data.reviewedBy) updateData.reviewedBy = data.reviewedBy;
    if (data.rejectionReason) updateData.rejectionReason = data.rejectionReason;
    if (data.transactionHash) updateData.transactionHash = data.transactionHash;
    if (data.paidAmount) updateData.paidAmount = data.paidAmount;

    const submission = await prisma.submission.update({
      where: { id },
      data: updateData,
    });

    // Update Google Sheets (async, don't wait)
    updateSubmissionInSheet(id, {
      status: data.status,
      transactionHash: data.transactionHash,
      paidAmount: data.paidAmount,
      paidAt: submission.paidAt,
      reviewedBy: data.reviewedBy,
      rejectionReason: data.rejectionReason,
    }).catch(console.error);

    return NextResponse.json(submission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to update submission:", error);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}
