import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Check if user is superadmin (from env var ADMIN_CREDENTIALS)
function isSuperAdmin(password: string): { valid: boolean; name?: string } {
  const credentialsJson = process.env.ADMIN_CREDENTIALS;
  if (!credentialsJson) return { valid: false };

  try {
    const credentials = JSON.parse(credentialsJson);
    for (const [name, pwd] of Object.entries(credentials)) {
      if (pwd === password) {
        return { valid: true, name };
      }
    }
  } catch {
    return { valid: false };
  }
  return { valid: false };
}

// GET - List all admins (superadmin only)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const password = authHeader?.replace("Bearer ", "");

  if (!password || !isSuperAdmin(password).valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      name: true,
      isSuperAdmin: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
}

// POST - Create new admin (superadmin only)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const password = authHeader?.replace("Bearer ", "");

  if (!password || !isSuperAdmin(password).valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, adminPassword } = body;

  if (!name || !adminPassword) {
    return NextResponse.json(
      { error: "Name and password required" },
      { status: 400 }
    );
  }

  // Check if admin already exists
  const existing = await prisma.admin.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "Admin with this name already exists" },
      { status: 400 }
    );
  }

  // Hash password and create admin
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.admin.create({
    data: {
      name,
      passwordHash,
      isSuperAdmin: false,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      isSuperAdmin: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ admin });
}

// DELETE - Remove admin (superadmin only)
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const password = authHeader?.replace("Bearer ", "");

  if (!password || !isSuperAdmin(password).valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get("id");

  if (!adminId) {
    return NextResponse.json({ error: "Admin ID required" }, { status: 400 });
  }

  await prisma.admin.delete({ where: { id: adminId } });

  return NextResponse.json({ success: true });
}
