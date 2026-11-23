import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { limitByIp } from "@/lib/rate-limit";
import { lookupPizzadaoCode, storedRedeemRef } from "@/lib/pizzadao";

// Admin-only: look up the PizzaDAO code attached to a submission (server-to-server).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limited = await limitByIp(request, "pizzadao-lookup", 60, 60);
  if (limited) return limited;

  const submissionId = request.nextUrl.searchParams.get("submissionId");
  if (!submissionId) {
    return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { pizzadaoCode: true, pizzadaoCodeRedeemedAt: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  if (!submission.pizzadaoCode) {
    return NextResponse.json({ error: "No code on this submission" }, { status: 404 });
  }

  const result = await lookupPizzadaoCode(submission.pizzadaoCode);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  const redeemedBySelf =
    result.lookup.status === "redeemed" && result.lookup.redeemedRef === storedRedeemRef(submissionId);
  return NextResponse.json({ ...result.lookup, redeemedBySelf }, { headers: { "Cache-Control": "no-store" } });
}
