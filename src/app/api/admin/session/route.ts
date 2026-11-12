import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookie, isCrossSite, requireAdmin } from "@/lib/admin-auth";

/** GET /api/admin/session — who is signed in (used by the admin page on load). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    adminName: auth.admin.name,
    isSuperAdmin: auth.admin.isSuperAdmin,
    canManageAdmins: auth.admin.source === "env",
  });
}

/** DELETE /api/admin/session — log out (clears the cookie). */
export async function DELETE(request: NextRequest) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
