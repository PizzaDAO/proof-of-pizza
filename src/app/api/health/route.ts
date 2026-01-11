import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, { status: string; error?: string }> = {};

  // Check database connection
  try {
    const count = await prisma.submission.count();
    checks.database = { status: "ok", error: undefined };
    checks.submissionCount = { status: `${count} submissions` };
  } catch (error) {
    checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check environment variables
  checks.env = {
    status: "ok",
    error: undefined,
  };
  if (!process.env.DATABASE_URL) {
    checks.env = { status: "error", error: "DATABASE_URL not set" };
  }

  const allOk = Object.values(checks).every(
    (c) => c.status === "ok" || !c.error
  );

  return NextResponse.json(
    { status: allOk ? "healthy" : "unhealthy", checks },
    { status: allOk ? 200 : 500 }
  );
}
