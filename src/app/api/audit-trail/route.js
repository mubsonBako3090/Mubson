import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== ROLES.ADMIN) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  await connectDB();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const entityType = searchParams.get("entityType");
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const query = {};
  if (action) query.action = action;
  if (entityType) query.entityType = entityType;

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actor", "fullName role email")
    .lean();

  return NextResponse.json({ logs });
}
