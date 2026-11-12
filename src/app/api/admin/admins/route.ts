import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";

const createAdminSchema = z.object({
  name: z.string().trim().min(1).max(64),
  adminPassword: z.string().min(10).max(256),
});

const adminSelect = {
  id: true,
  name: true,
  isSuperAdmin: true,
  isActive: true,
  createdAt: true,
} as const;

// GET - List all admins (superadmin only)
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const admins = await prisma.admin.findMany({
    select: adminSelect,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

// POST - Create new admin (superadmin only)
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = createAdminSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name and a password of at least 10 characters are required" },
      { status: 400 }
    );
  }
  const { name, adminPassword } = parsed.data;

  const existing = await prisma.admin.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "Admin with this name already exists" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.admin.create({
    data: {
      name,
      passwordHash,
      isSuperAdmin: false,
      isActive: true,
    },
    select: adminSelect,
  });

  return NextResponse.json({ admin });
}

// DELETE - Remove admin (superadmin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const adminId = request.nextUrl.searchParams.get("id");
  if (!adminId) {
    return NextResponse.json({ error: "Admin ID required" }, { status: 400 });
  }

  const deleted = await prisma.admin.deleteMany({ where: { id: adminId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
