import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { approvePendingUser } from "@/services/userService";
import { ROLES } from "@/constants/roles";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function POST(request, { params }) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (auth.role !== ROLES.ADMIN) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const user = await approvePendingUser({ adminId: auth.sub, userId: params.id });
    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Approval failed." }, { status: 400 });
  }
}
